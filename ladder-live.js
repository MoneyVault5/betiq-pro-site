/* Bet Lab — Ladder Challenge (TASK-0051 Phase 2, Nov 6, 2026).
 *
 * Reproduces Marquis's reference design (IMG_5374): left rail
 * (Build. Protect. Repeat.), Create New Ladder column, Active Ladder
 * column with the glowing milestone pyramid, and the AI Scout —
 * Scout This Play column. Cyan/purple neon on deep navy.
 *
 * DATA: ladders persist in localStorage `betlab_ladders_v1` (this
 * phase: per-device; cloud sync is a known follow-up). Ladder plays
 * are REAL tickets in the app's main store (betlab_clean_real_bets_v1)
 * — attached tickets carry ladderId + ladderRung and a note tag, so
 * they show in Bet Tracker / History like any other slip. All ladder
 * figures are RECOMPUTED from the linked tickets on every render
 * (integer cents throughout), so a Won/Lost flip made anywhere in the
 * app is reflected here on the next render. Zero hardcoded amounts:
 * the reference image's example numbers/players appear nowhere.
 *
 * PROGRESSION (derived, deterministic): attempt starts at the
 * ladder's starting bankroll (or its restart seed). A Won play moves
 * bankroll by (payout − wager); a Lost play subtracts the wager and
 * busts the attempt; Void returns the stake (no change). Milestone
 * mode: when bankroll crosses a milestone, its protection — a fixed
 * $ or a % of profit-so-far — moves from bankroll into Protected /
 * Saved and the milestone completes. Protected mode: after every win,
 * skim % of that win's profit moves into Protected. Goal reached
 * (bankroll + protected ≥ goal) completes the challenge. A busted or
 * completed attempt is archived once into Ladder History; restart
 * follows the ladder's restart preference (fresh bankroll, or the
 * protected pot seeds the new attempt when that was chosen).
 *
 * SCOUT HONESTY (same rules as AI Scout): player numbers come only
 * from ESPN gamelogs (estimate = 0.6 × season avg + 0.4 × last-5 avg,
 * labelled ESTIMATES — uncalibrated) and DraftKings lines only via
 * the odds relay. Anything that cannot be fetched renders
 * UNAVAILABLE — no stat, grade, or matchup claim is invented. The
 * recommendation block is pure arithmetic on entered values plus the
 * active ladder's own milestone rules, shown separately.
 */
(function () {
  "use strict";

  var LKEY = "betlab_ladders_v1";
  var EST_LABEL = "ESTIMATES — simple average-based projections, uncalibrated, not a paid model.";
  var EST_FORMULA = "Formula: estimate = 0.6 × season per-game average + 0.4 × last-5-games per-game average, computed from each player's own ESPN game log.";

  /* ---------------- generic helpers ---------------- */
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function C(dollars) { var n = Number(dollars); return isFinite(n) ? Math.round(n * 100) : 0; }
  function moneyC(cents) {
    var v = (Number(cents) || 0) / 100;
    try { return money(v); } catch (e) {
      return "$" + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }
  function store() { try { return Array.isArray(bets) ? bets : []; } catch (e) { return []; } }
  function findTicket(id) {
    var arr = store();
    for (var i = 0; i < arr.length; i++) if (String(arr[i].id) === String(id)) return arr[i];
    return null;
  }
  function payoutOf(t) {
    try { return payoutFor(t); } catch (e) {
      var p = Number(t.payout); if (isFinite(p) && p > 0) return p;
      var st = Number(t.stake) || 0, od = Number(t.odds) || 0;
      return od === 0 ? 0 : st + (od > 0 ? st * od / 100 : st * 100 / Math.abs(od));
    }
  }
  function oddsLabel(t) {
    try { return ticketOdds(t); } catch (e) {
      var od = Number(t.odds) || 0; return od ? (od > 0 ? "+" + od : "" + od) : "—";
    }
  }
  function persistStore() {
    var ok = true;
    try { if (typeof persist === "function") ok = persist() !== false; } catch (e) { ok = false; }
    try { if (typeof renderBets === "function") renderBets(); } catch (e) {}
    return ok;
  }
  function decFromAmerican(a) {
    a = Number(a); if (!a || isNaN(a)) return 0;
    return a > 0 ? 1 + a / 100 : 1 + 100 / Math.abs(a);
  }
  function impliedPct(a) { a = Number(a); if (!a) return null; return a > 0 ? 100 / (100 + a) * 100 : Math.abs(a) / (Math.abs(a) + 100) * 100; }

  /* ---------------- ladder persistence ---------------- */
  function loadLadders() {
    try { var v = JSON.parse(localStorage.getItem(LKEY) || "[]"); return Array.isArray(v) ? v : []; }
    catch (e) { return []; }
  }
  function saveLadders(ls) {
    try { localStorage.setItem(LKEY, JSON.stringify(ls)); return true; } catch (e) { return false; }
  }
  function baseOf(l) { return l.seedCents != null ? Number(l.seedCents) : Number(l.startCents) || 0; }

  /* ---------------- progression engine ----------------
   * Pure derivation from (ladder, its linked tickets). See header. */
  function compute(l) {
    var base = baseOf(l);
    var bankroll = base, prot = 0, wins = 0, losses = 0, voids = 0, terminal = null;
    var miles = (l.milestones || []).map(function (m) {
      return { amountCents: Number(m.amountCents) || 0, ptype: m.ptype || "fixed", pvalue: Number(m.pvalue) || 0, done: false, protectedCents: 0 };
    }).sort(function (a, b) { return a.amountCents - b.amountCents; });
    var rows = [];
    (l.plays || []).forEach(function (tid, i) {
      var t = findTicket(tid);
      var row = {
        rung: i + 1, ticketId: tid, ticket: t,
        result: t ? (t.status || "Open") : "Missing",
        wagerCents: t ? C(t.stake) : 0, bankrollAfter: null
      };
      if (!t || terminal) { rows.push(row); return; }
      if (t.status === "Won") {
        var pay = C(payoutOf(t));
        bankroll = bankroll - row.wagerCents + pay;
        wins++;
        if (l.mode === "protected") {
          var profit = Math.max(0, pay - row.wagerCents);
          var skim = Math.max(0, Math.min(bankroll, Math.round(profit * (Number(l.skimPct) || 0) / 100)));
          bankroll -= skim; prot += skim;
          miles.forEach(function (m) { if (!m.done && m.amountCents <= bankroll + prot) m.done = true; });
        } else {
          miles.forEach(function (m) {
            if (m.done || m.ptype === "goal" || m.amountCents > bankroll) return;
            var amt = m.ptype === "fixed"
              ? Math.min(C(m.pvalue), bankroll)
              : Math.round(Math.max(0, bankroll - base) * Number(m.pvalue) / 100);
            amt = Math.max(0, Math.min(amt, bankroll));
            bankroll -= amt; prot += amt; m.done = true; m.protectedCents = amt;
          });
          miles.forEach(function (m) { if (!m.done && m.ptype === "goal" && m.amountCents <= bankroll + prot) m.done = true; });
        }
        row.bankrollAfter = bankroll;
        if (bankroll + prot >= (Number(l.goalCents) || 0) && l.goalCents > 0) terminal = "Completed";
      } else if (t.status === "Lost") {
        bankroll -= row.wagerCents; losses++;
        row.bankrollAfter = bankroll;
        terminal = "Busted";
      } else if (t.status === "Void") {
        voids++; row.bankrollAfter = bankroll;
      }
      rows.push(row);
    });
    var settled = wins + losses;
    return {
      bankrollCents: bankroll, protectedCents: prot, totalCents: bankroll + prot,
      wins: wins, losses: losses, voids: voids,
      winPct: settled ? Math.round(wins / settled * 100) : null,
      netCents: bankroll - base,
      progressPct: l.goalCents > 0 ? Math.max(0, Math.min(100, (bankroll + prot) / l.goalCents * 100)) : 0,
      milestones: miles, rows: rows, status: terminal || "Active"
    };
  }

  /* Archive a finished attempt exactly once; returns true if changed. */
  function reconcile(l) {
    var c = compute(l);
    if (c.status !== "Active" && l.archivedAttempt !== l.attempt) {
      l.attempts = Array.isArray(l.attempts) ? l.attempts : [];
      l.attempts.push({
        n: l.attempt, result: c.status, wins: c.wins, losses: c.losses,
        netCents: c.netCents, protectedCents: c.protectedCents,
        endedAt: new Date().toISOString(), playIds: (l.plays || []).slice()
      });
      l.archivedAttempt = l.attempt;
      l.status = c.status;
      return true;
    }
    if (l.status !== c.status && c.status === "Active") { l.status = "Active"; return true; }
    return false;
  }

  /* ---------------- projection (create / review) ---------------- */
  function winsNeeded(fromC, toC, mode, skimPct, dec) {
    if (toC <= fromC) return 0;
    if (!dec || dec <= 1) return Infinity;
    var g = mode === "protected" ? 1 + (1 - (Number(skimPct) || 0) / 100) * (dec - 1) : dec;
    if (g <= 1) return Infinity;
    return Math.max(0, Math.ceil(Math.log(toC / fromC) / Math.log(g) - 1e-9));
  }
  function checkpoints(like) {
    var pts = [{ amountCents: Number(like.startCents) || 0, label: "Start" }];
    (like.milestones || []).slice().sort(function (a, b) { return a.amountCents - b.amountCents; }).forEach(function (m) {
      if (m.amountCents > (Number(like.startCents) || 0) && m.amountCents < (Number(like.goalCents) || 0)) {
        pts.push({ amountCents: m.amountCents, label: "Milestone", ptype: m.ptype, pvalue: m.pvalue });
      }
    });
    pts.push({ amountCents: Number(like.goalCents) || 0, label: "Goal" });
    return pts;
  }
  function projectionRows(like, typicalOdds) {
    var dec = decFromAmerican(typicalOdds);
    var pts = checkpoints(like);
    var out = [];
    for (var i = 1; i < pts.length; i++) {
      out.push({
        from: pts[i - 1], to: pts[i],
        wins: winsNeeded(pts[i - 1].amountCents, pts[i].amountCents, like.mode, like.skimPct, dec)
      });
    }
    return out;
  }

  /* ---------------- module state ---------------- */
  var view = "active";           // active | ladders | history | simulator | decisions | settings
  var selectedId = null;
  var createMode = "milestone";
  var createRestart = "fresh";
  var scoutTab = "enter";        // enter | upload | import
  var scoutBusy = false;
  var lastScout = null;          // last analysis inputs, for Use Recommendation

  function selectedLadder(ls) {
    if (!ls.length) return null;
    var found = null;
    ls.forEach(function (l) { if (String(l.id) === String(selectedId)) found = l; });
    if (found) return found;
    var act = ls.filter(function (l) { return compute(l).status === "Active"; });
    return act[0] || ls[ls.length - 1];
  }

  /* ---------------- HTML builders ---------------- */
  function railHTML(ls) {
    var activeCount = ls.filter(function (l) { return compute(l).status === "Active"; }).length;
    function item(v, icon, label, badge) {
      var on = view === v || (v === "active" && view === "ladders");
      return '<button type="button" data-lad-view="' + v + '"' + (on ? ' class="on"' : "") + '><span class="lad-mi">' + icon + "</span>" + esc(label) + (badge ? ' <span style="margin-left:auto" class="lad-note">' + esc(badge) + "</span>" : "") + "</button>";
    }
    return '<div class="lad-panel lad-rail">'
      + '<div class="lad-brand"><div class="lad-brand-ico">🪜</div><div><div class="lad-brand-name">Ladder<br>Challenge</div><div class="lad-brand-tag">Build. Protect. Repeat.</div></div></div>'
      + '<nav class="lad-menu">'
      + item("active", "🎯", "Active Ladders", activeCount ? String(activeCount) : "")
      + item("create", "＋", "Create New Ladder", "")
      + item("history", "📜", "Ladder History", "")
      + item("simulator", "🧪", "Ladder Simulator", "")
      + item("decisions", "🧭", "Scout Decision History", "")
      + item("settings", "⚙️", "Settings", "")
      + "</nav></div>";
  }

  function milestoneRowHTML(m) {
    m = m || { amount: "", ptype: "fixed", pvalue: "" };
    function sel(v, cur) { return v === cur ? " selected" : ""; }
    return '<tr class="lad-ms-row"><td style="width:26%"><input class="lad-in lad-ms-amount" type="number" min="0" step="1" placeholder="250" value="' + esc(m.amount) + '"></td>'
      + '<td><select class="lad-sel lad-ms-type"><option value="fixed"' + sel("fixed", m.ptype) + '>Protect $ fixed</option><option value="pct"' + sel("pct", m.ptype) + ">Protect % of profit</option><option value=\"goal\"" + sel("goal", m.ptype) + ">Goal — complete challenge</option></select></td>"
      + '<td style="width:22%"><input class="lad-in lad-ms-value" type="number" min="0" step="any" placeholder="150 or 25" value="' + esc(m.pvalue) + '"></td>'
      + '<td style="width:34px"><button type="button" class="lad-del" data-lad-act="ms-del" title="Remove milestone">🗑</button></td></tr>';
  }

  function createHTML() {
    return '<div class="lad-panel lad-col-create">'
      + "<h3 class=\"lad-h\">🪜 Create New Ladder</h3><p class=\"lad-sub\">Configure your ladder before you start.</p>"
      + '<label class="lad-label" for="ladName">Challenge Name</label><input class="lad-in" id="ladName" type="text" placeholder="Name your challenge">'
      + '<label class="lad-label">Ladder Mode</label><div class="lad-modes">'
      + '<div class="lad-mode' + (createMode === "protected" ? " on" : "") + '" data-lad-mode="protected" role="button" tabindex="0"><div style="font-size:18px">🛡️</div><b>Protected Ladder</b><span>Steady growth with ongoing protection.</span>' + (createMode === "protected" ? '<span class="lad-check">✓</span>' : "") + "</div>"
      + '<div class="lad-mode' + (createMode === "milestone" ? " on" : "") + '" data-lad-mode="milestone" role="button" tabindex="0"><div style="font-size:18px">🏁</div><b>Milestone Ladder</b><span>Roll over early, protect at set milestones.</span>' + (createMode === "milestone" ? '<span class="lad-check">✓</span>' : "") + "</div></div>"
      + '<div id="ladSkimWrap"' + (createMode === "protected" ? "" : " hidden") + '><label class="lad-label" for="ladSkim">Protection skim — % of each win\'s profit moved to Protected</label><input class="lad-in" id="ladSkim" type="number" min="0" max="90" step="1" value="20"></div>'
      + '<div class="lad-row2"><div><label class="lad-label" for="ladStart">Starting Bankroll ($)</label><input class="lad-in" id="ladStart" type="number" min="1" step="any" placeholder="10"></div>'
      + '<div><label class="lad-label" for="ladGoal">Target Goal ($)</label><input class="lad-in" id="ladGoal" type="number" min="1" step="any" placeholder="1000"></div></div>'
      + '<label class="lad-label">Milestones &amp; Protection Rules</label>'
      + '<table class="lad-table"><thead><tr><th>Milestone</th><th>Protect / Withdraw</th><th>Amount / %</th><th></th></tr></thead><tbody id="ladMsRows">'
      + milestoneRowHTML({ amount: "", ptype: "fixed", pvalue: "" })
      + milestoneRowHTML({ amount: "", ptype: "pct", pvalue: "" })
      + "</tbody></table>"
      + '<button type="button" class="lad-btn" data-lad-act="ms-add" style="margin-top:8px;padding:7px 12px;font-size:12px">+ Add Milestone</button>'
      + '<label class="lad-label">Restart Preferences</label>'
      + '<label class="lad-radio' + (createRestart === "fresh" ? " on" : "") + '"><input type="radio" name="ladRestart" value="fresh"' + (createRestart === "fresh" ? " checked" : "") + ' style="margin-top:3px"><span><b>Fresh bankroll (default)</b><span>Start a new attempt with new funds.</span></span></label>'
      + '<label class="lad-radio' + (createRestart === "protected" ? " on" : "") + '"><input type="radio" name="ladRestart" value="protected"' + (createRestart === "protected" ? " checked" : "") + ' style="margin-top:3px"><span><b>Use protected funds (optional)</b><span>Choose how much to use from your savings.</span></span></label>'
      + '<button type="button" class="lad-btn lad-btn-primary" data-lad-act="review">Review &amp; Start Challenge →</button>'
      + '<div id="ladReview"></div>'
      + "</div>";
  }

  function statusChip(st) {
    if (st === "Won") return '<span class="lad-chip lad-chip-won">Won</span>';
    if (st === "Lost") return '<span class="lad-chip lad-chip-lost">Lost</span>';
    if (st === "Void") return '<span class="lad-chip lad-chip-void">Void</span>';
    if (st === "Missing") return '<span class="lad-chip lad-chip-void">Not in store</span>';
    return '<span class="lad-chip lad-chip-open">Open</span>';
  }

  function pyramidHTML(l, c) {
    var rungs = [];
    c.milestones.forEach(function (m) {
      rungs.push({ amountCents: m.amountCents, done: m.done, goal: m.ptype === "goal" || m.amountCents >= l.goalCents });
    });
    rungs.sort(function (a, b) { return b.amountCents - a.amountCents; });
    var nextFound = false;
    var html = '<div class="lad-pyr">';
    rungs.forEach(function (r, i) {
      var w = Math.max(34, 96 - i * 11);
      var cls = "lad-rung" + (r.goal ? " goal" : "") + (r.done ? " done" : "");
      if (!r.done && !nextFound && c.status === "Active") { cls += " next"; nextFound = true; }
      html += '<div class="' + cls + '" style="width:' + w + '%">' + (r.goal ? "👑 " : "") + esc(moneyC(r.amountCents)) + (r.done ? " ✓" : "") + "<small>" + (r.goal ? "GOAL" : "MILESTONE") + "</small></div>";
    });
    var sw = Math.max(30, 96 - rungs.length * 11);
    html += '<div class="lad-rung start done" style="width:' + sw + '%">' + esc(moneyC(baseOf(l))) + "<small>START</small></div>";
    return html + "</div>";
  }

  function checklistHTML(l, c) {
    var rows = "";
    var desc = c.milestones.slice().sort(function (a, b) { return b.amountCents - a.amountCents; });
    desc.forEach(function (m) {
      var isGoal = m.ptype === "goal" || m.amountCents >= l.goalCents;
      var rule = isGoal ? "Complete Challenge 👑"
        : l.mode === "protected" ? (m.done ? "Reached" : "Milestone")
        : m.ptype === "fixed" ? "Protect " + moneyC(C(m.pvalue)) + " (fixed)"
        : "Protect " + esc(m.pvalue) + "% of profit";
      var right = m.done && l.mode === "milestone" && !isGoal ? esc(moneyC(m.protectedCents)) + " protected" : rule;
      rows += '<div class="lad-check-row"><span>' + (m.done ? '<span class="ok">✓</span> ' : '<span class="todo">○</span> ') + esc(moneyC(m.amountCents)) + (isGoal ? " – Goal" : "") + '</span><span class="rule">' + esc(right) + "</span></div>";
    });
    rows += '<div class="lad-check-row"><span><span class="ok">✓</span> ' + esc(moneyC(baseOf(l))) + ' – Start</span><span class="rule">Challenge began</span></div>';
    return rows;
  }

  function activeHTML(l, c) {
    var terminal = c.status !== "Active";
    var head = '<div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px">'
      + '<div><h3 class="lad-h">' + (terminal ? (c.status === "Completed" ? '<span class="lad-status-done">👑</span>' : '<span class="lad-status-busted">●</span>') : '<span class="lad-status-dot">●</span>') + " Active Ladder</h3>"
      + '<div style="font-size:17px;font-weight:800;color:#f0f9ff;margin-top:4px">' + esc(l.name) + "</div>"
      + '<div class="lad-note">' + esc(l.mode === "protected" ? "Protected Ladder" : "Milestone Ladder") + " • Attempt #" + esc(l.attempt) + (terminal ? " • " + esc(c.status) : "") + "</div></div>"
      + '<select class="lad-sel" id="ladOptions" style="width:auto;flex:none" aria-label="Ladder options"><option value="">Options ▾</option>'
      + (terminal ? '<option value="restart">Start New Attempt</option>' : "")
      + '<option value="delete">Delete Ladder</option></select></div>';
    var stats = '<div class="lad-stats">'
      + '<div class="lad-stat"><div class="lad-stat-k">Current Bankroll</div><div class="lad-stat-v lad-money-cyan">' + esc(moneyC(c.bankrollCents)) + "</div></div>"
      + '<div class="lad-stat"><div class="lad-stat-k">Protected / Saved</div><div class="lad-stat-v lad-money-pos">' + esc(moneyC(c.protectedCents)) + "</div></div>"
      + '<div class="lad-stat"><div class="lad-stat-k">Total Funds</div><div class="lad-stat-v">' + esc(moneyC(c.totalCents)) + "</div></div>"
      + '<div class="lad-stat"><div class="lad-stat-k">Progress to Goal</div><div class="lad-stat-v">' + esc(c.progressPct.toFixed(1)) + '%</div><div class="lad-bar"><div style="width:' + esc(c.progressPct.toFixed(1)) + '%"></div></div></div></div>';
    var record = '<div class="lad-sect">Ladder Record <span class="lad-note">(This Attempt)</span></div><div class="lad-record">'
      + '<div><div class="k">Wins</div><div class="v lad-money-pos">' + c.wins + "</div></div>"
      + '<div><div class="k">Losses</div><div class="v lad-money-neg">' + c.losses + "</div></div>"
      + '<div><div class="k">Win %</div><div class="v">' + (c.winPct == null ? "—" : c.winPct + "%") + "</div></div>"
      + '<div><div class="k">Net Profit</div><div class="v ' + (c.netCents >= 0 ? "lad-money-pos" : "lad-money-neg") + '">' + (c.netCents >= 0 ? "+" : "−") + esc(moneyC(Math.abs(c.netCents))) + "</div></div></div>";
    var plays = '<div class="lad-sect">Recent Ladder Plays</div>';
    if (!c.rows.length) {
      plays += '<p class="lad-note">No plays yet. Attach an open bet from the Tracker or enter one in the Scout panel — it becomes rung #1.</p>';
    } else {
      plays += '<table class="lad-table"><thead><tr><th>#</th><th>Bet / Play</th><th>Odds</th><th>Wager</th><th>Result</th><th>Bankroll</th></tr></thead><tbody>';
      c.rows.slice().reverse().forEach(function (r) {
        var t = r.ticket;
        plays += "<tr><td>" + r.rung + "</td><td>" + esc(t ? (t.selection || t.game || "Bet") : "Ticket removed from store") + "</td><td>" + esc(t ? oddsLabel(t) : "—") + "</td><td>" + esc(t ? moneyC(r.wagerCents) : "—") + "</td><td>" + statusChip(r.result) + "</td><td>" + (r.bankrollAfter == null ? "—" : esc(moneyC(r.bankrollAfter))) + "</td></tr>";
      });
      plays += "</tbody></table>";
    }
    var restartBtn = "";
    if (terminal) {
      restartBtn = '<button type="button" class="lad-btn lad-btn-green lad-btn-block" data-lad-act="restart">'
        + (c.status === "Completed" ? "Start a New Ladder Run" : "Restart Attempt #" + (Number(l.attempt) + 1))
        + "</button><p class=\"lad-note\" style=\"margin-top:6px\">Restart preference: " + (l.restart === "protected" ? "use protected funds — the new attempt is seeded with this attempt's Protected pot (" + esc(moneyC(c.protectedCents)) + ") when it has funds." : "fresh bankroll — the new attempt starts again at " + esc(moneyC(l.startCents)) + ".") + "</p>";
    }
    return '<div class="lad-panel lad-col-active">' + head + stats + pyramidHTML(l, c)
      + '<div class="lad-sect">Milestone Progress</div><div class="lad-check-list">' + checklistHTML(l, c) + "</div>"
      + record + plays + restartBtn + "</div>";
  }

  function ladderListHTML(ls) {
    var html = '<div class="lad-panel lad-col-active"><h3 class="lad-h">🎯 Your Ladders</h3><p class="lad-sub">Pick a ladder to open it.</p>';
    ls.forEach(function (l) {
      var c = compute(l);
      html += '<div class="lad-hist-row" style="display:flex;justify-content:space-between;gap:8px;align-items:center"><div><b style="color:#f0f9ff">' + esc(l.name) + "</b><br><span class=\"lad-note\">" + esc(l.mode === "protected" ? "Protected" : "Milestone") + " • Attempt #" + esc(l.attempt) + " • " + esc(c.status) + " • Bankroll " + esc(moneyC(c.bankrollCents)) + " of " + esc(moneyC(l.goalCents)) + ' goal</span></div><button type="button" class="lad-btn" style="padding:7px 12px;font-size:12px" data-lad-open="' + esc(l.id) + '">Open ›</button></div>';
    });
    return html + "</div>";
  }

  function historyHTML(ls) {
    var entries = [];
    ls.forEach(function (l) {
      (l.attempts || []).forEach(function (a) {
        entries.push({ name: l.name, mode: l.mode, a: a });
      });
    });
    entries.sort(function (x, y) { return String(y.a.endedAt || "").localeCompare(String(x.a.endedAt || "")); });
    var html = '<div class="lad-panel lad-col-active"><h3 class="lad-h">📜 Ladder History</h3><p class="lad-sub">Finished attempts, kept from your stored ladder state.</p>';
    if (!entries.length) html += '<div class="lad-empty"><b>No finished attempts yet</b>When an attempt busts or completes the goal, its final record lands here.</div>';
    entries.forEach(function (e) {
      var a = e.a;
      html += '<div class="lad-hist-row"><b style="color:#f0f9ff">' + esc(e.name) + "</b> — Attempt #" + esc(a.n) + ' · <span class="' + (a.result === "Completed" ? "lad-status-done" : "lad-status-busted") + '">' + esc(a.result) + "</span><br>"
        + '<span class="lad-note">Record ' + esc(a.wins) + "–" + esc(a.losses) + " • Net " + (a.netCents >= 0 ? "+" : "−") + esc(moneyC(Math.abs(a.netCents))) + " • Protected " + esc(moneyC(a.protectedCents)) + (a.endedAt ? " • " + esc(String(a.endedAt).slice(0, 10)) : "") + "</span></div>";
    });
    return html + "</div>";
  }

  function comingSoonHTML(title, icon, blurb) {
    return '<div class="lad-panel lad-col-active"><h3 class="lad-h">' + icon + " " + esc(title) + '</h3><p class="lad-sub">' + esc(blurb) + '</p><div class="lad-empty"><span class="lad-badge">COMING SOON</span><b style="margin-top:10px">Not built yet</b>This panel is a placeholder in the design — no fake data, no fake controls. It ships when there is real data and a real design pass behind it.</div></div>';
  }

  function centerHTML(ls) {
    if (view === "history") return historyHTML(ls);
    if (view === "ladders") return ladderListHTML(ls);
    if (view === "simulator") return comingSoonHTML("Ladder Simulator", "🧪", "Run what-if ladders against your real bet history.");
    if (view === "decisions") return comingSoonHTML("Scout Decision History", "🧭", "Every Scout call you acted on or skipped, graded after the game.");
    if (view === "settings") return comingSoonHTML("Settings", "⚙️", "Ladder defaults and display preferences.");
    var l = selectedLadder(ls);
    if (!l) {
      return '<div class="lad-panel lad-col-active"><div class="lad-empty"><b>No active ladder yet</b>Set a starting bankroll and a goal in the Create panel, review the projection, and your first ladder starts here — bankroll, protected pot, pyramid and record all computed from your real plays.</div></div>';
    }
    var panel = activeHTML(l, compute(l));
    if (ls.length > 1) {
      panel = '<div class="lad-col-active"><button type="button" class="lad-btn" data-lad-view="ladders" style="margin-bottom:10px;padding:7px 12px;font-size:12px">‹ All ladders (' + ls.length + ")</button>"
        + panel.replace("lad-panel lad-col-active", "lad-panel") + "</div>";
    }
    return panel;
  }

  /* ---------------- scout panel ---------------- */
  function scoutHTML(ls) {
    var l = selectedLadder(ls);
    function tab(id, label) {
      return '<button type="button" data-lad-tab="' + id + '"' + (scoutTab === id ? ' class="on"' : "") + ">" + label + "</button>";
    }
    var enter = '<div id="ladTabEnter"' + (scoutTab === "enter" ? "" : " hidden") + ">"
      + '<div class="lad-row2"><div><label class="lad-label">Sport</label><select class="lad-sel" id="ladScSport"><option>NBA</option><option>NFL</option><option>NCAAF</option><option>MLB</option><option>Other</option></select></div>'
      + '<div><label class="lad-label">Bet Type</label><select class="lad-sel" id="ladScType"><option>Player Prop</option><option>Moneyline</option><option>Spread</option><option>Total</option><option>Parlay</option><option>Other</option></select></div></div>'
      + '<label class="lad-label">Player / Selection</label><input class="lad-in" id="ladScPlayer" type="text" placeholder="Player name or team selection">'
      + '<label class="lad-label">Game</label><input class="lad-in" id="ladScGame" type="text" placeholder="Away team vs Home team">'
      + '<div class="lad-row2"><div><label class="lad-label">Prop</label><input class="lad-in" id="ladScProp" type="text" placeholder="e.g. 25.5 Points"></div>'
      + '<div><label class="lad-label">Odds</label><input class="lad-in" id="ladScOdds" type="number" step="any" placeholder="-110"></div></div>'
      + '<label class="lad-label">Planned Wager ($)</label><input class="lad-in" id="ladScWager" type="number" min="0" step="any" placeholder="25">'
      + '<button type="button" class="lad-btn lad-btn-primary" data-lad-act="scout-run">🔍 Scout This Play</button>'
      + '<button type="button" class="lad-btn lad-btn-block" data-lad-act="add-play" ' + (l && compute(l).status === "Active" ? "" : "disabled") + '>Add as Next Rung Play' + (l ? "" : " (needs an active ladder)") + "</button>"
      + '<div id="ladScoutResult"></div></div>';
    var upload = '<div id="ladTabUpload"' + (scoutTab === "upload" ? "" : " hidden") + ">"
      + '<p class="lad-note" style="margin-top:4px">Slip photos are read by the Slip Importer — it pulls the book, event, odds, stake and ticket ID off the image. Import the slip there, then attach it to this ladder from the Import from Tracker tab.</p>'
      + '<button type="button" class="lad-btn lad-btn-block" data-go="Slip Importer">Open Slip Importer ›</button></div>';
    var open = store().filter(function (t) { return (t.status || "Open") === "Open" && !t.ladderId; });
    var imp = '<div id="ladTabImport"' + (scoutTab === "import" ? "" : " hidden") + ">";
    if (!l) imp += '<p class="lad-note">Create a ladder first — then open bets from your Tracker can be attached as rung plays.</p>';
    else if (!open.length) imp += '<p class="lad-note">No open, unattached bets in your Tracker right now. Add one in Bet Tracker or with Enter Bet, and it will show up here.</p>';
    else {
      imp += '<p class="lad-note">Open bets from your Tracker. Attaching makes the bet the next rung play of “' + esc(l.name) + '”.</p>';
      open.forEach(function (t) {
        imp += '<div class="lad-import-row"><div><b style="color:#f0f9ff">' + esc(t.selection || t.game || "Bet") + '</b><br><span class="lad-note">' + esc(t.game || "") + " • " + esc(oddsLabel(t)) + " • " + esc(moneyC(C(t.stake))) + '</span></div><button type="button" class="lad-btn" style="padding:7px 12px;font-size:12px" data-lad-attach="' + esc(t.id) + '">Attach ›</button></div>';
      });
    }
    imp += "</div>";
    return '<div class="lad-panel lad-panel-purple lad-col-scout"><h3 class="lad-h">🤖 AI Scout <span class="lad-note" style="font-weight:400">– Scout This Play</span></h3>'
      + '<p class="lad-sub">Analyze a potential bet within your ladder.</p>'
      + '<div class="lad-tabs">' + tab("enter", "Enter Bet") + tab("upload", "Upload Slip") + tab("import", "Import from Tracker") + "</div>"
      + enter + upload + imp + "</div>";
  }

  /* Recommendation arithmetic — entered values + the active ladder's
   * own milestone rules only. Always computable, no feed needed. */
  function recommend(l, wagerCents, odds) {
    var dec = decFromAmerican(odds);
    var gross = dec > 0 ? Math.round(wagerCents * dec) : 0;
    var out = { grossCents: gross, protectCents: 0, recommendedCents: wagerCents, bankrollIfWonCents: null, nextMs: null, stakePct: null };
    if (!l) return out;
    var c = compute(l);
    out.bankrollIfWonCents = c.bankrollCents - wagerCents + gross;
    out.stakePct = c.bankrollCents > 0 ? wagerCents / c.bankrollCents * 100 : null;
    var target = c.milestones.filter(function (m) { return !m.done; })[0] || null;
    out.nextMs = target;
    var crosses = target && (out.bankrollIfWonCents + c.protectedCents >= target.amountCents);
    if (l.mode === "protected") {
      out.protectCents = Math.max(0, Math.round(Math.max(0, gross - wagerCents) * (Number(l.skimPct) || 0) / 100));
    } else if (crosses && target.ptype !== "goal") {
      out.protectCents = target.ptype === "fixed"
        ? C(target.pvalue)
        : Math.round(Math.max(0, out.bankrollIfWonCents + c.protectedCents - baseOf(l)) * Number(target.pvalue) / 100);
      out.protectCents = Math.max(0, Math.min(out.protectCents, Math.max(0, gross - wagerCents)));
    }
    out.recommendedCents = Math.max(0, wagerCents - out.protectCents);
    return out;
  }

  /* -------- ESPN + odds-relay data paths (same endpoints and
   * parsing rules as ai-scout-live.js; nothing is invented) -------- */
  var SB_URL = { nfl: "https://site.api.espn.com/apis/site/v2/sports/football/nfl", nba: "https://site.api.espn.com/apis/site/v2/sports/basketball/nba" };
  var GL_URL = { nfl: "https://site.web.api.espn.com/apis/common/v3/sports/football/nfl", nba: "https://site.web.api.espn.com/apis/common/v3/sports/basketball/nba" };
  var RELAY_URL = "https://shnnefxhunroluelghbv.supabase.co/functions/v1/odds-relay";
  var PUBLISHABLE = "sb_publishable_RoFhq3z2j5rJQjUUrTEIkg_Gm4fkaG4";
  function fetchJSON(url, opts) {
    opts = opts || {};
    var ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, 12000) : null;
    return fetch(url, Object.assign({}, opts, ctl ? { signal: ctl.signal } : {}))
      .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
      .finally(function () { if (timer) clearTimeout(timer); });
  }
  function relay(body) {
    return fetch(RELAY_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + PUBLISHABLE, apikey: PUBLISHABLE },
      body: JSON.stringify(body)
    }).then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); });
  }
  function normName(s) { return String(s || "").toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(/\s+/g, " ").trim(); }
  function nameEq(a, b) {
    var x = normName(a), y = normName(b);
    if (!x || !y) return false;
    if (x === y) return true;
    var xl = x.split(" ").pop(), yl = y.split(" ").pop();
    return xl === yl && xl.length > 2;
  }
  function statSpec(propText, league) {
    var t = String(propText || "").toLowerCase();
    var m = t.match(/(\d+(?:\.\d+)?)/);
    var line = m ? Number(m[1]) : null;
    if (league === "nba") {
      if (/rebound/.test(t)) return { key: "totalRebounds", label: "Rebounds", dk: "player_rebounds", line: line };
      if (/assist/.test(t)) return { key: "assists", label: "Assists", dk: "player_assists", line: line };
      if (/three|3 ?pt|3-point/.test(t)) return { key: "threePointFieldGoalsMade", label: "Threes", dk: "player_threes", line: line };
      if (/point/.test(t)) return { key: "points", label: "Points", dk: "player_points", line: line };
    }
    if (league === "nfl") {
      if (/passing|pass/.test(t)) return { key: "passingYards", label: "Passing Yards", dk: "player_pass_yds", line: line };
      if (/rushing|rush/.test(t)) return { key: "rushingYards", label: "Rushing Yards", dk: "player_rush_yds", line: line };
      if (/receiving|rec yards/.test(t)) return { key: "receivingYards", label: "Receiving Yards", dk: "player_reception_yds", line: line };
      if (/reception/.test(t)) return { key: "receptions", label: "Receptions", dk: null, line: line };
    }
    return null;
  }
  function rosterAthletes(j) {
    var out = [];
    (j.athletes || []).forEach(function (a) {
      if (a && a.items) a.items.forEach(function (it) { if (it && it.id) out.push({ id: String(it.id), name: it.displayName || it.fullName || "" }); });
      else if (a && a.id) out.push({ id: String(a.id), name: a.displayName || a.fullName || "" });
    });
    return out;
  }
  function resolvePlayer(league, playerName) {
    return fetchJSON(SB_URL[league] + "/scoreboard").then(function (sb) {
      var teams = [];
      (sb.events || []).forEach(function (ev) {
        (((ev.competitions || [])[0] || {}).competitors || []).forEach(function (cp) {
          if (cp.team && cp.team.id) teams.push({ id: String(cp.team.id), name: cp.team.displayName || "" });
        });
      });
      var chain = Promise.resolve(null);
      teams.forEach(function (tm) {
        chain = chain.then(function (found) {
          if (found) return found;
          return fetchJSON(SB_URL[league] + "/teams/" + tm.id + "/roster").then(function (rj) {
            var hit = null;
            rosterAthletes(rj).forEach(function (a) { if (!hit && normName(a.name) === normName(playerName)) hit = a; });
            return hit ? { athlete: hit, team: tm } : null;
          }).catch(function () { return null; });
        });
      });
      return chain;
    });
  }
  function glData(json) {
    var names = ((json || {}).labels || []).map(function (x) { return String(x || ""); });
    var byKey = {};
    names.forEach(function (n) {
      var nn = n.toLowerCase();
      if (nn === "pts" || nn === "points") byKey.points = n;
      if (nn === "reb" || nn === "totalrebounds" || nn === "rebounds") byKey.totalRebounds = n;
      if (nn === "ast" || nn === "assists") byKey.assists = n;
      if (nn === "passingyards" || nn === "pass yds" || nn === "passyds") byKey.passingYards = n;
      if (nn === "rushingyards" || nn === "rush yds" || nn === "rushyds") byKey.rushingYards = n;
      if (nn === "receivingyards" || nn === "rec yds" || nn === "recyds") byKey.receivingYards = n;
      if (nn === "receptions" || nn === "rec") byKey.receptions = n;
      if (nn === "3pm" || nn === "threepointfieldgoalsmade" || nn === "3ptm") byKey.threePointFieldGoalsMade = n;
    });
    var num = function (v) { var n = parseFloat(String(v == null ? "" : v).replace(/[^0-9.\-]/g, "")); return isNaN(n) ? 0 : n; };
    var rows = [];
    ((json || {}).events || []).forEach(function (ev) {
      var st = ev && ev.seasonType;
      if (st && st.slug && String(st.slug).indexOf("regular-season") < 0) return;
      var stats = (ev && ev.stats) || [];
      var row = {};
      names.forEach(function (n, i) { row[n] = num(stats[i]); });
      rows.push(row);
    });
    return { byKey: byKey, rows: rows };
  }
  function avgOf(rows, key) {
    if (!rows.length) return null;
    var s = 0; rows.forEach(function (r) { s += Number(r[key]) || 0; });
    return s / rows.length;
  }
  function estimateFor(gd, key) {
    var label = gd.byKey[key];
    if (!label || !gd.rows.length) return null;
    var season = avgOf(gd.rows, label);
    var last5 = avgOf(gd.rows.slice(0, 5), label);
    var last10 = avgOf(gd.rows.slice(0, 10), label);
    if (season === null || last5 === null) return null;
    var hits = null;
    return { est: 0.6 * season + 0.4 * last5, season: season, last5: last5, last10: last10, rows: gd.rows, label: label, hits: hits };
  }
  function dkPlayerLine(league, teamName, playerName, marketKey) {
    if (!marketKey) return Promise.resolve(null);
    return relay({ league: league }).then(function (slate) {
      var ev = null;
      (Array.isArray(slate) ? slate : []).forEach(function (e) {
        if (ev) return;
        if (nameEq(e.home_team, teamName) || nameEq(e.away_team, teamName)) ev = e;
      });
      if (!ev) return null;
      return relay({ league: league, eventId: ev.id }).then(function (full) {
        var evs = Array.isArray(full) ? full : [full];
        var found = null;
        evs.forEach(function (e) {
          (e.bookmakers || []).forEach(function (bk) {
            if (bk.key !== "draftkings") return;
            (bk.markets || []).forEach(function (mk) {
              if (mk.key !== marketKey) return;
              (mk.outcomes || []).forEach(function (o) {
                if (normName(o.description) === normName(playerName) && o.name === "Over") found = { point: o.point, price: o.price };
              });
            });
          });
        });
        return found;
      });
    });
  }

  var GRADE_STEPS = ["F", "D", "C", "B-", "B", "B+", "A-", "A", "A+"];
  function gradeFromEdge(p) { return p >= 20 ? "A+" : p >= 14 ? "A" : p >= 9 ? "A-" : p >= 6 ? "B+" : p >= 3.5 ? "B" : p >= 1.5 ? "B-" : p >= -1.5 ? "C" : p >= -5 ? "D" : "F"; }
  function shiftGrade(g, d) { var i = GRADE_STEPS.indexOf(g); i = Math.max(0, Math.min(GRADE_STEPS.length - 1, i + d)); return GRADE_STEPS[i]; }
  function gradeCls(g) { return g.charAt(0) === "A" ? "" : (g.charAt(0) === "B" || g.charAt(0) === "C") ? " mid" : " low"; }
  function fitGrade(stakePct) { return stakePct <= 5 ? "A+" : stakePct <= 10 ? "A" : stakePct <= 20 ? "A-" : stakePct <= 35 ? "B" : stakePct <= 50 ? "C" : stakePct <= 75 ? "D" : "F"; }

  function runScout() {
    var out = $("ladScoutResult");
    if (!out || scoutBusy) return;
    var ls = loadLadders();
    var l = selectedLadder(ls);
    var sport = ($("ladScSport") || {}).value || "NBA";
    var player = (($("ladScPlayer") || {}).value || "").trim();
    var prop = (($("ladScProp") || {}).value || "").trim();
    var odds = Number(($("ladScOdds") || {}).value);
    var wagerD = Number(($("ladScWager") || {}).value);
    var wagerCents = C(isFinite(wagerD) ? wagerD : 0);
    var rec = recommend(l, wagerCents, odds);
    lastScout = { recommendedCents: rec.recommendedCents };
    var league = sport === "NBA" ? "nba" : sport === "NFL" ? "nfl" : null;
    var spec = league ? statSpec(prop, league) : null;

    function mathTable() {
      return '<table class="lad-table"><tbody>'
        + "<tr><td>Planned Wager</td><td style=\"text-align:right\">" + esc(moneyC(wagerCents)) + "</td></tr>"
        + "<tr><td>Recommended Wager</td><td style=\"text-align:right\" class=\"lad-money-pos\">" + esc(moneyC(rec.recommendedCents)) + "</td></tr>"
        + "<tr><td>Amount to Protect (Profit)</td><td style=\"text-align:right\" class=\"lad-money-pos\">" + esc(moneyC(rec.protectCents)) + "</td></tr>"
        + "<tr><td>Potential Payout (total return)</td><td style=\"text-align:right\">" + (rec.grossCents ? esc(moneyC(rec.grossCents)) : "—") + "</td></tr>"
        + "<tr><td>Bankroll if Won</td><td style=\"text-align:right\" class=\"lad-money-cyan\">" + (rec.bankrollIfWonCents == null ? "—" : esc(moneyC(rec.bankrollIfWonCents))) + "</td></tr></tbody></table>";
    }
    function recoBox() {
      if (!l) return '<div class="lad-reco"><b>No active ladder.</b> Recommendation math needs a ladder — create one and this panel prices every play against its milestones.</div>';
      if (rec.protectCents > 0) return '<div class="lad-reco">💡 <b>Recommendation:</b> Don\'t bet the full ' + esc(moneyC(wagerCents)) + ". Protect " + esc(moneyC(rec.protectCents)) + " of the profit" + (rec.nextMs ? " at the " + esc(moneyC(rec.nextMs.amountCents)) + " milestone" : "") + " — wager " + esc(moneyC(rec.recommendedCents)) + " instead.</div>";
      return '<div class="lad-reco">💡 <b>Recommendation:</b> No protection is due at the next milestone on this win — your planned wager of ' + esc(moneyC(wagerCents)) + " stands.</div>";
    }
    function actionsRow() {
      return '<div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px"><button type="button" class="lad-btn lad-btn-green" data-lad-act="scout-use" style="flex:1">Use Recommendation</button><button type="button" class="lad-btn" data-lad-act="scout-keep" style="flex:1">Keep My Wager</button><button type="button" class="lad-btn" data-lad-act="scout-skip" style="flex:1">Skip Play</button></div>';
    }

    if (!league || !player || !spec || spec.line == null) {
      var why = !league ? "Player data paths exist for NBA and NFL props."
        : !player ? "Enter a player name so his ESPN game log can be pulled."
        : !spec ? "The prop text was not recognized — use a form like “25.5 Points”, “10.5 Rebounds”, “275.5 Passing Yards”."
        : "The prop needs a line number (e.g. 25.5 Points).";
      out.innerHTML = '<div class="lad-sect">AI Scout Analysis</div>'
        + '<p><span class="lad-unavail">UNAVAILABLE</span> <span class="lad-note">' + esc(why) + " Grades are only computed from fetched numbers, so none are shown.</span></p>"
        + recoBox() + mathTable() + actionsRow();
      return;
    }

    scoutBusy = true;
    out.innerHTML = '<div class="lad-sect">AI Scout Analysis</div><p class="lad-note">Pulling the ESPN game log and DraftKings line for ' + esc(player) + "…</p>" + recoBox() + mathTable();
    Promise.resolve().then(function () {
      if (typeof fetch !== "function") throw new Error("no fetch");
      return resolvePlayer(league, player).catch(function () { return null; });
    }).then(function (found) {
      if (!found) throw { nodata: "player" };
      return fetchJSON(GL_URL[league] + "/athletes/" + found.athlete.id + "/gamelog?region=us&lang=en").then(function (gj) {
        return dkPlayerLine(league, found.team.name, player, spec.dk).catch(function () { return null; }).then(function (dk) {
          return { found: found, gd: glData(gj), dk: dk };
        });
      });
    }).then(function (r) {
      var est = estimateFor(r.gd, spec.key);
      var bullets = [];
      var quality = null, lineUsed = null;
      if (est && r.dk) lineUsed = Number(r.dk.point);
      else if (est) lineUsed = spec.line;
      if (est) {
        var hits = 0;
        r.gd.rows.slice(0, 10).forEach(function (row) { if ((Number(row[est.label]) || 0) >= lineUsed) hits++; });
        var hitRate = Math.min(10, r.gd.rows.length) ? hits / Math.min(10, r.gd.rows.length) : null;
        var edge = est.est - lineUsed, edgePct = lineUsed ? edge / lineUsed * 100 : 0;
        quality = gradeFromEdge(edgePct);
        if (hitRate !== null) quality = shiftGrade(quality, hitRate >= 0.7 ? 1 : hitRate <= 0.3 ? -1 : 0);
        bullets.push("Projection: " + player + " projects to " + est.est.toFixed(1) + " " + spec.label + " (season " + est.season.toFixed(1) + ", last-5 " + est.last5.toFixed(1) + ", last-10 " + (est.last10 == null ? "—" : est.last10.toFixed(1)) + ") vs the line " + lineUsed + " — edge " + (edge >= 0 ? "+" : "") + edge.toFixed(1) + " (" + (edgePct >= 0 ? "+" : "") + edgePct.toFixed(1) + "%).");
        if (hitRate !== null) bullets.push("Hit rate: cleared " + lineUsed + "+ in " + hits + " of his last " + Math.min(10, r.gd.rows.length) + " games (" + Math.round(hitRate * 100) + "%).");
      }
      if (r.dk) {
        var imp = impliedPct(r.dk.price);
        bullets.push("DraftKings line (odds relay): Over " + r.dk.point + " at " + (r.dk.price > 0 ? "+" : "") + r.dk.price + (imp == null ? "" : " — " + imp.toFixed(1) + "% implied") + ".");
      }
      var fit = null;
      if (l && rec.stakePct != null) {
        fit = fitGrade(rec.stakePct);
        if (rec.nextMs && rec.protectCents > 0) fit = shiftGrade(fit, 1);
        bullets.push("Ladder fit: the planned wager is " + rec.stakePct.toFixed(1) + "% of the current ladder bankroll (" + esc(moneyC(compute(l).bankrollCents)) + ").");
        if (rec.protectCents > 0 && rec.nextMs) bullets.push("A win crosses the " + esc(moneyC(rec.nextMs.amountCents)) + " milestone — " + esc(moneyC(rec.protectCents)) + " of profit gets protected there.");
      }
      var gradesHtml;
      if (quality || fit) {
        gradesHtml = '<div class="lad-grades">'
          + '<div class="lad-grade"><div class="k">Bet Quality</div><div class="g' + (quality ? gradeCls(quality) : "") + '">' + (quality || '<span class="lad-unavail" style="font-size:15px">UNAVAILABLE</span>') + "</div></div>"
          + '<div class="lad-grade"><div class="k">Ladder Fit</div><div class="g' + (fit ? gradeCls(fit) : "") + '">' + (fit || '<span class="lad-unavail" style="font-size:15px">UNAVAILABLE</span>') + "</div></div></div>";
      } else {
        gradesHtml = '<p><span class="lad-unavail">UNAVAILABLE</span> <span class="lad-note">No usable game-log line for this prop, so no grades are shown.</span></p>';
      }
      out.innerHTML = '<div class="lad-sect">AI Scout Analysis</div>' + gradesHtml + recoBox() + mathTable()
        + (bullets.length ? '<div class="lad-sect">Reasoning</div><ul class="lad-why">' + bullets.map(function (b) { return "<li>" + esc(b) + "</li>"; }).join("") + "</ul>" : "")
        + '<p class="lad-note" style="margin-top:8px">' + esc(EST_LABEL) + "<br>" + esc(EST_FORMULA) + "</p>"
        + actionsRow();
    }).catch(function () {
      out.innerHTML = '<div class="lad-sect">AI Scout Analysis</div>'
        + '<p><span class="lad-unavail">UNAVAILABLE</span> <span class="lad-note">The player lookup or game log could not be loaded, so no stats or grades are shown — nothing is filled in by hand. The recommendation math below only uses your entered numbers and the ladder\'s rules.</span></p>'
        + recoBox() + mathTable() + actionsRow();
    }).finally(function () { scoutBusy = false; });
  }

  /* ---------------- render ---------------- */
  function doRender() {
    var root = $("ladRoot");
    if (!root) return;
    var ls = loadLadders();
    var changed = false;
    ls.forEach(function (l) { if (reconcile(l)) changed = true; });
    if (changed) saveLadders(ls);
    var l = selectedLadder(ls);
    if (l) selectedId = l.id;
    root.innerHTML = '<div class="lad-layout">' + railHTML(ls) + createHTML() + centerHTML(ls) + scoutHTML(ls) + "</div>";
  }

  /* ---------------- create flow ---------------- */
  var pendingDraft = null;
  function readMilestones() {
    var out = [];
    var rows = document.querySelectorAll("#ladMsRows .lad-ms-row");
    for (var i = 0; i < rows.length; i++) {
      var amt = Number(rows[i].querySelector(".lad-ms-amount").value);
      var type = rows[i].querySelector(".lad-ms-type").value;
      var val = Number(rows[i].querySelector(".lad-ms-value").value);
      if (amt > 0) out.push({ amountCents: C(amt), ptype: type, pvalue: isFinite(val) ? val : 0 });
    }
    out.sort(function (a, b) { return a.amountCents - b.amountCents; });
    return out;
  }
  function readDraft() {
    var start = Number(($("ladStart") || {}).value);
    var goal = Number(($("ladGoal") || {}).value);
    var skimEl = $("ladSkim");
    return {
      name: (($("ladName") || {}).value || "").trim(),
      mode: createMode,
      skimPct: skimEl ? Number(skimEl.value) || 0 : 20,
      startCents: C(isFinite(start) ? start : 0),
      goalCents: C(isFinite(goal) ? goal : 0),
      milestones: readMilestones(),
      restart: createRestart
    };
  }
  function reviewHTML(d, typicalOdds) {
    var rows = projectionRows(d, typicalOdds);
    var total = rows.reduce(function (s, r) { return s + (isFinite(r.wins) ? r.wins : 0); }, 0);
    var html = '<div class="lad-sect">Review — Projection <span class="lad-badge">ESTIMATE</span></div>'
      + '<p class="lad-note">“' + esc(d.name || "Untitled ladder") + '” — ' + esc(d.mode === "protected" ? "Protected Ladder (skim " + esc(d.skimPct) + "% of win profit)" : "Milestone Ladder") + ", " + esc(moneyC(d.startCents)) + " → " + esc(moneyC(d.goalCents)) + ", restart: " + esc(d.restart === "protected" ? "use protected funds" : "fresh bankroll") + ".</p>"
      + '<label class="lad-label" for="ladTypOdds">Typical odds for the projection</label>'
      + '<div style="display:flex;gap:8px"><input class="lad-in" id="ladTypOdds" type="number" step="any" value="' + esc(typicalOdds) + '"><button type="button" class="lad-btn" data-lad-act="proj" style="flex:none">Recalculate</button></div>'
      + '<table class="lad-table" style="margin-top:8px"><thead><tr><th>Segment</th><th>Wins needed</th><th>Protection</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      var prot = "—";
      if (r.to.label === "Milestone") {
        prot = r.to.ptype === "fixed" ? "Protect " + moneyC(C(r.to.pvalue)) + " (fixed)"
          : r.to.ptype === "pct" ? "Protect " + esc(r.to.pvalue) + "% of profit" : "Complete challenge 👑";
      }
      html += "<tr><td>" + esc(moneyC(r.from.amountCents)) + " → " + esc(moneyC(r.to.amountCents)) + " (" + esc(r.to.label) + ")</td><td>" + (isFinite(r.wins) ? r.wins : "∞") + "</td><td>" + esc(prot) + "</td></tr>";
    });
    html += "</tbody></table>"
      + '<p class="lad-note" style="margin-top:6px">About <b style="color:#f0f9ff">' + total + " straight wins</b> at " + esc(typicalOdds) + " odds, full bankroll rolling each time" + (d.mode === "protected" ? ", with the skim taken out of each win's profit" : "") + ". A projection, not a promise — one loss ends the attempt.</p>"
      + '<button type="button" class="lad-btn lad-btn-green lad-btn-block" data-lad-act="start">✓ Confirm &amp; Start Challenge</button>';
    return html;
  }
  function doReview() {
    var d = readDraft();
    var box = $("ladReview");
    if (!box) return;
    if (!(d.startCents > 0)) { box.innerHTML = '<p class="lad-note" style="color:#fda4af;margin-top:10px">Enter a starting bankroll above $0.</p>'; return; }
    if (!(d.goalCents > d.startCents)) { box.innerHTML = '<p class="lad-note" style="color:#fda4af;margin-top:10px">The target goal must be above the starting bankroll.</p>'; return; }
    if (!d.name) d.name = "Road to " + moneyC(d.goalCents);
    pendingDraft = d;
    box.innerHTML = reviewHTML(d, -110);
  }
  function doStart() {
    if (!pendingDraft) return;
    var d = pendingDraft;
    var ls = loadLadders();
    var l = {
      id: "ladder-" + Date.now() + "-" + Math.random().toString(36).slice(2, 8),
      name: d.name, mode: d.mode, skimPct: d.skimPct,
      startCents: d.startCents, goalCents: d.goalCents,
      milestones: d.milestones, restart: d.restart,
      attempt: 1, status: "Active", seedCents: null,
      plays: [], attempts: [], archivedAttempt: 0,
      createdAt: new Date().toISOString()
    };
    if (!l.milestones.some(function (m) { return m.amountCents >= l.goalCents; })) {
      l.milestones.push({ amountCents: l.goalCents, ptype: "goal", pvalue: 0 });
      l.milestones.sort(function (a, b) { return a.amountCents - b.amountCents; });
    }
    ls.push(l);
    if (!saveLadders(ls)) return;
    pendingDraft = null;
    selectedId = l.id;
    view = "active";
    doRender();
  }

  /* ---------------- play attach / create ---------------- */
  function attachTicket(l, t, silent) {
    var rung = (l.plays || []).length + 1;
    var prevNote = t.note, prevId = t.ladderId, prevRung = t.ladderRung;
    t.ladderId = l.id; t.ladderRung = rung;
    var tag = "Ladder: " + l.name + " · Rung " + rung;
    if (!t.note || String(t.note).indexOf("Ladder:") < 0) t.note = (t.note ? String(t.note) + " · " : "") + tag;
    var ls = loadLadders();
    for (var i = 0; i < ls.length; i++) if (String(ls[i].id) === String(l.id)) { ls[i].plays = (ls[i].plays || []).concat([String(t.id)]); l = ls[i]; }
    saveLadders(ls);
    if (!persistStore()) {
      t.note = prevNote; t.ladderId = prevId; t.ladderRung = prevRung;
      ls = loadLadders();
      for (var j = 0; j < ls.length; j++) if (String(ls[j].id) === String(l.id)) ls[j].plays = (ls[j].plays || []).filter(function (x) { return String(x) !== String(t.id); });
      saveLadders(ls);
      return false;
    }
    if (!silent) { doRender(); flashScout("Attached as rung #" + rung + " of “" + l.name + "”. Settle it in Bet Tracker or History — the ladder updates from the ticket."); }
    return true;
  }
  function flashScout(msg) {
    var el = $("ladScoutResult");
    if (el) el.innerHTML = '<p class="lad-note" style="margin-top:10px;color:#39ff88">' + esc(msg) + "</p>";
  }
  function doAddPlay() {
    var ls = loadLadders();
    var l = selectedLadder(ls);
    if (!l || compute(l).status !== "Active") return;
    var sport = ($("ladScSport") || {}).value || "NBA";
    var type = ($("ladScType") || {}).value || "Other";
    var player = (($("ladScPlayer") || {}).value || "").trim();
    var game = (($("ladScGame") || {}).value || "").trim();
    var prop = (($("ladScProp") || {}).value || "").trim();
    var odds = Number(($("ladScOdds") || {}).value);
    var wager = Number(($("ladScWager") || {}).value);
    if (!isFinite(wager) || wager <= 0) { flashScout("Enter a planned wager above $0 first — the ticket is created with that stake."); return; }
    if (!isFinite(odds) || odds === 0) { flashScout("Enter the bet's odds (e.g. -110) first."); return; }
    var selection = [player, prop].filter(Boolean).join(" — ") || game || (sport + " " + type);
    var id = "bet-" + Date.now() + "-" + Math.random().toString(36).slice(2, 9);
    var ok = false;
    try { ok = typeof saveBet === "function" && saveBet({ id: id, game: game, selection: selection, odds: odds, stake: wager, book: "Other", sport: sport, status: "Open", source: "Ladder Challenge" }); } catch (e) { ok = false; }
    var t = ok ? findTicket(id) : null;
    if (!t) { flashScout("The ticket could not be created — nothing was added to the ladder."); return; }
    scoutTab = "enter";
    if (attachTicket(l, t, true)) { doRender(); flashScout("Rung play added: “" + selection + "” at " + moneyC(C(wager)) + ". It is a real ticket in your Tracker — settle it there or in History."); }
    else flashScout("The ticket was created but attaching it to the ladder failed.");
  }

  /* ---------------- attempt lifecycle ---------------- */
  function doRestart(l) {
    var c = compute(l);
    var ls = loadLadders();
    for (var i = 0; i < ls.length; i++) {
      if (String(ls[i].id) !== String(l.id)) continue;
      ls[i].seedCents = (ls[i].restart === "protected" && c.protectedCents > 0) ? c.protectedCents : null;
      ls[i].attempt = Number(ls[i].attempt || 1) + 1;
      ls[i].plays = [];
      ls[i].status = "Active";
    }
    saveLadders(ls);
    view = "active";
    doRender();
  }
  function doDelete(l) {
    if (!window.confirm("Delete the ladder “" + l.name + "”? Its tickets stay in your Tracker; only the ladder link is removed.")) return;
    var ls = loadLadders().filter(function (x) { return String(x.id) !== String(l.id); });
    saveLadders(ls);
    store().forEach(function (t) { if (t.ladderId === l.id) { delete t.ladderId; delete t.ladderRung; } });
    persistStore();
    if (String(selectedId) === String(l.id)) selectedId = null;
    view = ls.length ? "active" : "create";
    doRender();
  }

  /* ---------------- wiring ---------------- */
  function wire() {
    var root = $("ladRoot");
    if (!root || root.dataset.ladWired) return;
    root.dataset.ladWired = "1";
    root.addEventListener("click", function (e) {
      var viewBtn = e.target.closest("[data-lad-view]");
      if (viewBtn) {
        var v = viewBtn.getAttribute("data-lad-view");
        view = (v === "active" && loadLadders().length > 1) ? "ladders" : v;
        doRender(); return;
      }
      var modeEl = e.target.closest("[data-lad-mode]");
      if (modeEl) {
        createMode = modeEl.getAttribute("data-lad-mode");
        var modes = root.querySelectorAll("[data-lad-mode]");
        for (var i = 0; i < modes.length; i++) {
          var on = modes[i].getAttribute("data-lad-mode") === createMode;
          modes[i].classList.toggle("on", on);
          var chk = modes[i].querySelector(".lad-check");
          if (on && !chk) { var s = document.createElement("span"); s.className = "lad-check"; s.textContent = "✓"; modes[i].appendChild(s); }
          if (!on && chk) chk.remove();
        }
        var skim = $("ladSkimWrap");
        if (skim) skim.hidden = createMode !== "protected";
        return;
      }
      var tabBtn = e.target.closest("[data-lad-tab]");
      if (tabBtn) {
        scoutTab = tabBtn.getAttribute("data-lad-tab");
        var tabs = root.querySelectorAll("[data-lad-tab]");
        for (var j = 0; j < tabs.length; j++) tabs[j].classList.toggle("on", tabs[j].getAttribute("data-lad-tab") === scoutTab);
        ["enter", "upload", "import"].forEach(function (k) {
          var p = $("ladTab" + k.charAt(0).toUpperCase() + k.slice(1));
          if (p) p.hidden = scoutTab !== k;
        });
        return;
      }
      var openBtn = e.target.closest("[data-lad-open]");
      if (openBtn) { selectedId = openBtn.getAttribute("data-lad-open"); view = "active"; doRender(); return; }
      var attBtn = e.target.closest("[data-lad-attach]");
      if (attBtn) {
        var ls = loadLadders(); var l = selectedLadder(ls);
        var t = findTicket(attBtn.getAttribute("data-lad-attach"));
        if (l && t) attachTicket(l, t);
        return;
      }
      var actBtn = e.target.closest("[data-lad-act]");
      if (!actBtn) return;
      var act = actBtn.getAttribute("data-lad-act");
      var ls2 = loadLadders(); var lad = selectedLadder(ls2);
      if (act === "ms-add") { var tb = $("ladMsRows"); if (tb) tb.insertAdjacentHTML("beforeend", milestoneRowHTML({})); }
      else if (act === "ms-del") { var tr = actBtn.closest("tr"); if (tr) tr.remove(); }
      else if (act === "review") doReview();
      else if (act === "proj") { var d = readDraft(); if (!d.name) d.name = pendingDraft ? pendingDraft.name : "Road to " + moneyC(d.goalCents); pendingDraft = d; var to = Number(($("ladTypOdds") || {}).value); $("ladReview").innerHTML = reviewHTML(d, isFinite(to) && to !== 0 ? to : -110); }
      else if (act === "start") doStart();
      else if (act === "restart" && lad) doRestart(lad);
      else if (act === "add-play") doAddPlay();
      else if (act === "scout-run") runScout();
      else if (act === "scout-use") { var w = $("ladScWager"); if (w && lastScout) w.value = (lastScout.recommendedCents / 100).toFixed(2); }
      else if (act === "scout-keep") { /* wager stays as entered — nothing to change */ }
      else if (act === "scout-skip") { var r = $("ladScoutResult"); if (r) r.innerHTML = ""; lastScout = null; }
    });
    root.addEventListener("change", function (e) {
      if (e.target && e.target.name === "ladRestart") {
        createRestart = e.target.value;
        var labs = root.querySelectorAll(".lad-radio");
        for (var i = 0; i < labs.length; i++) {
          var inp = labs[i].querySelector("input");
          labs[i].classList.toggle("on", !!inp && inp.checked);
        }
      }
      if (e.target && e.target.id === "ladOptions") {
        var v = e.target.value; e.target.value = "";
        var ls = loadLadders(); var l = selectedLadder(ls);
        if (!l) return;
        if (v === "restart") doRestart(l);
        else if (v === "delete") doDelete(l);
      }
    });
  }

  /* --------- navigation entry points (Bet Tracker link row +
   * Dashboard entry card), re-asserted like History's links ------- */
  function placeNavLink() {
    if (document.getElementById("arnLadderLink")) return;
    var live = document.getElementById("arnLiveRecordLink");
    if (!live || !live.parentElement) return;
    var b = document.createElement("button");
    b.type = "button"; b.id = "arnLadderLink";
    b.setAttribute("data-go", "Ladder Challenge");
    b.className = live.className;
    b.style.marginLeft = "16px";
    b.textContent = "Ladder Challenge ›";
    live.parentElement.appendChild(b);
  }
  function placeEntryCard() {
    if (document.getElementById("arnLadderEntry")) return;
    var panel = document.querySelector('[data-purpose="ai-scout-entry-panel"]');
    if (!panel || !panel.parentElement) return;
    var ls = loadLadders();
    var act = null, actC = null;
    ls.forEach(function (l) { var c = compute(l); if (!act && c.status === "Active") { act = l; actC = c; } });
    var status = act
      ? "“" + act.name + "” is climbing: bankroll " + moneyC(actC.bankrollCents) + ", " + moneyC(actC.protectedCents) + " protected, " + actC.progressPct.toFixed(1) + "% of the " + moneyC(act.goalCents) + " goal."
      : "No ladder started yet. Set a starting bankroll and a goal, protect profit at milestones, and roll one real bet into the next.";
    var d = document.createElement("div");
    d.className = "glow-card rounded-2xl p-5";
    d.id = "arnLadderEntry";
    d.setAttribute("data-purpose", "ladder-entry-panel");
    d.innerHTML = '<div class="flex items-center justify-between mb-3"><h3 class="text-sm font-bold font-display uppercase tracking-wider text-slate-200 flex items-center gap-2"><span class="w-2 h-2 rounded-full bg-cyan-400 animate-pulse"></span>LADDER CHALLENGE</h3><span class="text-[11px] font-mono text-cyan-300 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">BUILD · PROTECT · REPEAT</span></div>'
      + '<p class="text-xs text-slate-300 leading-relaxed">' + esc(status) + "</p>"
      + '<button type="button" data-go="Ladder Challenge" class="mt-4 w-full bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 text-white font-extrabold text-xs py-2.5 rounded-lg font-display tracking-wider transition-all shadow-md shadow-cyan-600/20">OPEN LADDER CHALLENGE ›</button>';
    panel.parentElement.insertBefore(d, panel.nextSibling);
  }

  function init() {
    wire();
    placeNavLink();
    placeEntryCard();
    setInterval(function () { placeNavLink(); placeEntryCard(); }, 1500);
    document.addEventListener("betlab-board-rendered", function () {
      var page = $("ladderPage");
      if (!page || page.hidden) return;
      var ae = document.activeElement;
      if (ae && $("ladRoot") && $("ladRoot").contains(ae) && /INPUT|TEXTAREA|SELECT/.test(ae.tagName)) return;
      doRender();
    });
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();

  window.BetLabLadder = {
    render: doRender,
    load: loadLadders,
    compute: compute,
    winsNeeded: winsNeeded,
    projectionRows: projectionRows,
    recommend: recommend
  };
})();
