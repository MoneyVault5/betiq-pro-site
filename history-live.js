/* Bet Lab — History view (TASK-0051 Phase 1, Nov 5, 2026).
 *
 * Shows ALL slips in the app's store in chronological order (newest
 * first — stated in the UI) and lets Marquis open any slip into a full
 * editor: selection, game, book, stake, payout, odds, sport, placed
 * date, note, a Result control (Open/Won/Lost/Void), and Delete.
 *
 * Every write goes through the app's OWN mechanisms — the same
 * in-memory `bets` array and the global persist() the Bet Tracker's
 * Result dropdown and Delete buttons use (see renderBets in
 * index.html) — so cloud-sync (which wraps persist) picks the changes
 * up, stamps result edits, and every dashboard figure recalculates
 * through renderBets(). No parallel store is introduced.
 *
 * DELETE LIMITATION (known, flagged in the TASK-0051 Phase 1 report):
 * cloud-sync's merge is union / never-delete, so a ticket that exists
 * in the cloud can return on the next sync after a local delete. A
 * tombstone cannot be honored without editing cloud-sync.js, which is
 * out of scope for this phase. History's delete therefore mirrors the
 * Bet Tracker delete mechanics exactly, and its confirmation says
 * plainly that a cloud-backed ticket may return — marking it Void is
 * the way to retire a synced ticket for good until the sync follow-up.
 */
(function () {
  "use strict";
  var STATUSES = ["Open", "Won", "Lost", "Void"];
  var editingId = null;

  function $(id) { return document.getElementById(id); }
  function store() { try { return Array.isArray(bets) ? bets : []; } catch (e) { return []; } }
  function moneyFmt(n) {
    try { return money(n); } catch (e) {
      return "$" + Number(n || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    }
  }
  function payoutFmt(b) {
    try { var p = payoutFor(b); return p ? moneyFmt(p) : "Not entered"; } catch (e) {
      return b.payout ? moneyFmt(b.payout) : "Not entered";
    }
  }
  function placedRaw(b) { return String(b.placedAt || b.importedAt || ""); }
  function placedLabel(b) {
    var raw = placedRaw(b);
    var d = raw ? new Date(raw) : null;
    if (d && !isNaN(d.getTime())) {
      return d.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
    }
    return raw || "Date unknown";
  }
  function sortedBets() {
    return store().map(function (b, i) { return { b: b, i: i }; }).sort(function (x, y) {
      var tx = Date.parse(placedRaw(x.b)) || 0, ty = Date.parse(placedRaw(y.b)) || 0;
      if (ty !== tx) return ty - tx;
      return y.i - x.i;
    }).map(function (x) { return x.b; });
  }

  /* ---------------- list ---------------- */
  function render() {
    var list = $("histList"), empty = $("histEmpty"), sub = $("histSub");
    if (!list) return;
    var rows = sortedBets();
    if (sub) sub.textContent = "All saved slips · " + rows.length + (rows.length === 1 ? " slip" : " slips") + " · newest first · tap a slip to view or edit it";
    list.replaceChildren();
    if (empty) empty.hidden = rows.length > 0;
    rows.forEach(function (b) {
      var row = document.createElement("button");
      row.type = "button";
      row.className = "hist-row";
      row.dataset.histId = String(b.id || "");
      var top = document.createElement("div"); top.className = "hist-row-top";
      var sel = document.createElement("span"); sel.className = "hist-row-sel";
      sel.textContent = b.selection || (Array.isArray(b.legs) && b.legs.length ? b.legs.join(" | ") : "Ticket");
      var chip = document.createElement("span");
      var st = STATUSES.indexOf(b.status) >= 0 ? b.status : "Open";
      chip.className = "hist-chip hist-chip-" + st.toLowerCase();
      chip.textContent = st.toUpperCase();
      top.append(sel, chip);
      var meta = document.createElement("div"); meta.className = "hist-row-meta";
      meta.textContent = [placedLabel(b), b.book || "Other", b.game || "", "Stake " + moneyFmt(b.stake) + " · Payout " + payoutFmt(b)].filter(Boolean).join(" · ");
      row.append(top, meta);
      row.addEventListener("click", function () { openEditor(b); });
      list.append(row);
    });
    var ed = $("histEditor");
    if (ed && !ed.hidden && editingId && !store().some(function (b) { return String(b.id) === editingId; })) closeEditor();
  }

  /* ---------------- editor ---------------- */
  function field(labelText, id, value, attrs) {
    var label = document.createElement("label");
    label.textContent = labelText;
    var input = document.createElement("input");
    input.id = id;
    input.value = value == null ? "" : String(value);
    if (attrs) for (var k in attrs) input.setAttribute(k, attrs[k]);
    label.append(input);
    return label;
  }
  function closeEditor() {
    editingId = null;
    var ed = $("histEditor");
    if (ed) { ed.hidden = true; ed.replaceChildren(); }
  }
  function openEditor(b) {
    var ed = $("histEditor");
    if (!ed) return;
    editingId = String(b.id || "");
    ed.replaceChildren();
    ed.hidden = false;
    var h = document.createElement("h4"); h.textContent = "EDIT SLIP";
    var fields = document.createElement("div"); fields.className = "hist-fields";
    fields.append(
      field("Selection", "histFSelection", b.selection || ""),
      field("Game / Matchup", "histFGame", b.game || ""),
      field("Book", "histFBook", b.book || ""),
      field("Stake ($)", "histFStake", b.stake == null ? "" : b.stake, { type: "number", step: "0.01", min: "0" }),
      field("Payout ($)", "histFPayout", b.payout == null ? "" : b.payout, { type: "number", step: "0.01", min: "0" }),
      field("Odds (American)", "histFOdds", b.odds == null ? "" : b.odds, { type: "number", step: "1" }),
      field("Sport", "histFSport", b.sport || ""),
      field("Placed (ISO date/time)", "histFPlaced", placedRaw(b))
    );
    var statusLabel = document.createElement("label");
    statusLabel.textContent = "Result";
    var select = document.createElement("select"); select.id = "histFStatus";
    STATUSES.forEach(function (v) {
      var o = document.createElement("option"); o.value = v; o.textContent = v;
      if (v === b.status) o.selected = true;
      select.append(o);
    });
    statusLabel.append(select);
    fields.append(statusLabel);
    var noteLabel = document.createElement("label");
    noteLabel.textContent = "Note";
    var note = document.createElement("textarea");
    note.id = "histFNote"; note.rows = 2; note.value = b.note || "";
    noteLabel.append(note);
    fields.append(noteLabel);

    var actions = document.createElement("div"); actions.className = "hist-actions";
    var save = document.createElement("button"); save.type = "button"; save.className = "hist-btn hist-btn-save"; save.textContent = "Save changes";
    save.addEventListener("click", function () { saveEditor(b); });
    var del = document.createElement("button"); del.type = "button"; del.className = "hist-btn hist-btn-delete"; del.textContent = "Delete ticket";
    del.addEventListener("click", function () { deleteFromEditor(b); });
    var close = document.createElement("button"); close.type = "button"; close.className = "hist-btn hist-btn-close"; close.textContent = "Close";
    close.addEventListener("click", closeEditor);
    actions.append(save, del, close);
    var note2 = document.createElement("p"); note2.className = "hist-note";
    note2.textContent = "Saving uses the same storage as Bet Tracker and syncs to your cloud backup when you're signed in. Deleting removes the slip from this device; a slip that is in your cloud backup can return on the next sync — mark it Void to retire a synced slip for good.";
    ed.append(h, fields, actions, note2);
    if (ed.scrollIntoView) ed.scrollIntoView({ behavior: "smooth", block: "start" });
  }
  function saveEditor(b) {
    var F = function (id) { var n = $(id); return n ? n.value : ""; };
    var prior = {
      selection: b.selection, game: b.game, book: b.book, stake: b.stake,
      payout: b.payout, odds: b.odds, sport: b.sport, placedAt: b.placedAt,
      note: b.note, status: b.status
    };
    b.selection = F("histFSelection").trim();
    b.game = F("histFGame").trim();
    b.book = F("histFBook").trim() || b.book;
    b.stake = Number(F("histFStake")) || 0;
    b.payout = Number(F("histFPayout")) || 0;
    b.odds = Number(F("histFOdds")) || 0;
    b.sport = F("histFSport").trim() || b.sport;
    var placed = F("histFPlaced").trim();
    if (placed) b.placedAt = placed;
    b.note = F("histFNote");
    b.status = F("histFStatus") || b.status;
    if (!persist()) { for (var k in prior) b[k] = prior[k]; return; } // mirror Bet Tracker: revert on failed save
    renderBets(); // app-wide refresh: dashboard, tracker, analytics figures
    closeEditor();
    render();
  }
  function deleteFromEditor(b) {
    if (!confirm("Delete this ticket?\n\nCloud note: if this ticket is in your cloud backup it can return on the next sync. To retire a synced ticket for good, mark it Void instead.")) return;
    var arr = store();
    var index = arr.findIndex(function (x) { return x === b; });
    if (index < 0) index = arr.findIndex(function (x) { return String(x.id) === String(b.id); });
    if (index < 0) return;
    arr.splice(index, 1);
    if (!persist()) { arr.splice(index, 0, b); return; } // mirror Bet Tracker delete
    renderBets();
    closeEditor();
    render();
  }

  /* ---------------- entry links ----------------
   * Mirrors arena-live.js placeLiveRecordLink(): one discreet
   * Arena-styled text link at the top of the Bet Tracker view, placed
   * NEXT TO the Live Record link in the same row, plus a matching link
   * under the Dashboard's Recent Wager Ledger. Re-asserted on a timer
   * because Arena re-renders its panels. The banner's six artwork
   * hotspots and the mini-nav are NOT touched. */
  var LINK_CLASSES = "text-xs font-mono text-slate-400 hover:text-amber-300 underline decoration-purple-500/60 hover:decoration-amber-400 underline-offset-4 transition-colors cursor-pointer bg-transparent border-0 p-0";
  function makeLink(id, text) {
    var btn = document.createElement("button");
    btn.type = "button"; btn.id = id; btn.dataset.go = "History";
    btn.className = LINK_CLASSES; btn.textContent = text;
    return btn;
  }
  function placeLinks() {
    var live = $("arnLiveRecordLink");
    if (live && live.parentElement && !$("arnHistoryLink")) {
      var link = makeLink("arnHistoryLink", "History ›");
      link.style.marginLeft = "16px";
      live.parentElement.append(link);
    }
    var ledger = document.querySelector('[data-purpose="recent-wager-ledger-panel"]');
    if (ledger && !$("arnHistoryLinkDash")) {
      var wrap = document.createElement("div");
      wrap.className = "flex justify-end pt-2";
      wrap.append(makeLink("arnHistoryLinkDash", "Full History ›"));
      ledger.append(wrap);
    }
  }

  function init() {
    placeLinks();
    window.setInterval(placeLinks, 1500);
    document.addEventListener("betlab-board-rendered", function () {
      var page = $("historyPage");
      if (page && !page.hidden) render();
    });
  }
  window.BetLabHistory = { render: render };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
