/* Bet Lab — Tracker Sync bar (Marquis, Nov 9, 2026).
 *
 * His ask, in his words: bets are not automatically uploading again, so
 * put a button right by Saved Bets that uploads the latest from his
 * accounts when clicked; show his record there plus how many bets are
 * open and closed; and make those numbers tappable — tap "Open · 5" and
 * it brings him to those slips, where he can edit them and mark Won/Lost.
 *
 * What this module does:
 *  (1) Inserts a bar directly above the Saved Bets list (#saved) inside
 *      Bet Tracker with:
 *        - "⬆ Sync Latest Bets" button. One tap runs the SAME proven
 *          sequence as the Dashboard Refresh (arena-live.js): cloud sync
 *          through cloud-sync.js's own 'online' trigger (completion read
 *          off the cloud pill's own label), then open-position imports
 *          via BetLabPolymarketUS / BetLabKalshiImport importPositions()
 *          for each book whose Key ID is saved in THIS browser, then a
 *          re-render through the app's renderBets(). Unlike the Dashboard
 *          button, this one says plainly when NO Key ID is saved on this
 *          device — the silent skip is exactly why his bets looked like
 *          they "stopped uploading" before (Nov 5–7, 2026).
 *        - Record + count chips: Record W–L, Open, Closed (Won+Lost),
 *          Won, Lost, All. Each chip is a button.
 *  (2) Tapping a chip filters the Saved Bets list directly below the bar
 *      to just those slips (All clears the filter) and scrolls the list
 *      into view. Every slip in that list already carries the app's own
 *      Result dropdown (Open/Won/Lost/Void) and Delete — the filter
 *      changes no data, it only shows/hides rows, and it re-applies
 *      after every renderBets() rebuild.
 *
 * Scope honesty: the sync pulls Polymarket + Kalshi OPEN positions —
 * the two books with live API imports. Novig has no import wired yet
 * (its API key step is still his to do), so Novig bets still arrive by
 * slip upload; the bar says so in plain text instead of implying
 * otherwise. Settled-history import stays withheld pending his
 * TASK-0044 call, exactly as in the other import modules.
 */
(function () {
  "use strict";

  var currentFilter = "All"; // All | Open | Closed | Won | Lost
  var syncing = false;

  function $(id) { return document.getElementById(id); }
  function store() { try { return Array.isArray(bets) ? bets : []; } catch (e) { return []; } }

  function counts() {
    var arr = store();
    var won = 0, lost = 0, open = 0, vd = 0;
    arr.forEach(function (b) {
      if (b.status === "Won") won++;
      else if (b.status === "Lost") lost++;
      else if (b.status === "Void") vd++;
      else open++; // Open (and any legacy/unknown status) counts as open
    });
    return { total: arr.length, won: won, lost: lost, open: open, void: vd, closed: won + lost };
  }

  /* ---------------- the bar ---------------- */
  function chip(id, cls, label) {
    return '<button type="button" class="tsb-chip ' + cls + '" id="' + id + '">' +
      "<small>" + label + "</small><strong>—</strong></button>";
  }

  function buildBar() {
    if ($("trackerSyncBar")) return true;
    var saved = $("saved");
    if (!saved || !saved.parentElement) return false;
    var bar = document.createElement("div");
    bar.id = "trackerSyncBar";
    bar.innerHTML =
      '<div class="tsb-top">' +
        '<button type="button" id="blSyncLatest">⬆ Sync Latest Bets</button>' +
        '<span id="blSyncStatus">Pulls your newest open bets from Polymarket + Kalshi into Saved Bets below.</span>' +
      "</div>" +
      '<div class="tsb-counts" role="group" aria-label="Your record and bet counts — tap a box to see those slips">' +
        chip("tsbRecord", "tsb-chip-record", "Record") +
        chip("tsbOpen", "tsb-chip-open", "Open") +
        chip("tsbClosed", "", "Closed") +
        chip("tsbWon", "tsb-chip-won", "Won") +
        chip("tsbLost", "tsb-chip-lost", "Lost") +
        chip("tsbAll", "", "All Bets") +
      "</div>" +
      '<p id="tsbFilterNote"></p>' +
      '<p class="tsb-note">Sync pulls Polymarket + Kalshi open positions. Novig bets still come in by slip upload for now. Tap a count box to jump to just those slips — each one has a Result dropdown to mark Won or Lost.</p>';
    saved.parentElement.insertBefore(bar, saved);

    $("blSyncLatest").addEventListener("click", runSync);
    $("tsbOpen").addEventListener("click", function () { setFilter("Open", true); });
    $("tsbClosed").addEventListener("click", function () { setFilter("Closed", true); });
    $("tsbRecord").addEventListener("click", function () { setFilter("Closed", true); });
    $("tsbWon").addEventListener("click", function () { setFilter("Won", true); });
    $("tsbLost").addEventListener("click", function () { setFilter("Lost", true); });
    $("tsbAll").addEventListener("click", function () { setFilter("All", true); });
    updateCounts();
    return true;
  }

  function updateCounts() {
    var c = counts();
    var set = function (id, text) { var n = $(id); if (n) { var s = n.querySelector("strong"); if (s) s.textContent = text; } };
    set("tsbRecord", c.won + "–" + c.lost);
    set("tsbOpen", String(c.open));
    set("tsbClosed", String(c.closed));
    set("tsbWon", String(c.won));
    set("tsbLost", String(c.lost));
    set("tsbAll", String(c.total));
  }

  /* ---------------- filtering the Saved Bets list ---------------- */
  function rowStatus(row) {
    var sel = row.querySelector("select");
    if (sel && sel.value) return sel.value;
    return "Open";
  }
  function matches(status, filter) {
    if (filter === "All") return true;
    if (filter === "Closed") return status === "Won" || status === "Lost";
    return status === filter;
  }
  function applyFilter() {
    var saved = $("saved");
    if (!saved) return 0;
    var shown = 0;
    saved.querySelectorAll(".saved-ticket").forEach(function (row) {
      var ok = matches(rowStatus(row), currentFilter);
      row.style.display = ok ? "" : "none";
      if (ok) shown++;
    });
    // Active chip highlighting (Record and Closed both mean Closed).
    var map = { All: "tsbAll", Open: "tsbOpen", Closed: "tsbClosed", Won: "tsbWon", Lost: "tsbLost" };
    ["tsbAll", "tsbOpen", "tsbClosed", "tsbWon", "tsbLost", "tsbRecord"].forEach(function (id) {
      var n = $(id); if (n) n.classList.remove("tsb-active");
    });
    var active = $(map[currentFilter]);
    if (active) active.classList.add("tsb-active");
    if (currentFilter === "Closed") { var r = $("tsbRecord"); if (r) r.classList.add("tsb-active"); }
    var note = $("tsbFilterNote");
    if (note) {
      if (currentFilter === "All") note.textContent = "";
      else if (currentFilter === "Open") note.textContent = "Showing your " + shown + " open slip" + (shown === 1 ? "" : "s") + " — use each slip's Result dropdown to mark Won or Lost. Tap All Bets to see everything again.";
      else if (currentFilter === "Closed") note.textContent = "Showing your " + shown + " closed slips (Won/Lost) — that's your record. Tap All Bets to see everything again.";
      else note.textContent = "Showing your " + shown + " " + currentFilter.toLowerCase() + " slips. Tap All Bets to see everything again.";
    }
    return shown;
  }
  function setFilter(filter, scroll) {
    currentFilter = filter;
    buildBar();
    updateCounts();
    applyFilter();
    if (scroll) {
      var saved = $("saved");
      if (saved && saved.scrollIntoView) saved.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }

  /* ---------------- sync (mirrors arena-live.js Dashboard Refresh) ---------------- */
  function cloudSignedIn() {
    var btn = $("betlab-cloud-login");
    return !!btn && (btn.textContent || "").trim() === "Sign out";
  }
  function waitForCloudCycle(timeoutMs) {
    return new Promise(function (resolve) {
      var text = $("betlab-cloud-text");
      if (!text) { resolve("unavailable"); return; }
      var done = false;
      var finish = function (v) {
        if (done) return; done = true;
        try { obs.disconnect(); } catch (e) {}
        clearTimeout(timer);
        resolve(v);
      };
      var check = function () {
        var t = (text.textContent || "").trim();
        if (t.indexOf("Cloud saved") === 0) finish("saved");
        else if (t.indexOf("Cloud sync error") === 0) finish("error");
      };
      var obs = new MutationObserver(check);
      obs.observe(text, { childList: true, characterData: true, subtree: true });
      var timer = setTimeout(function () { finish("timeout"); }, timeoutMs);
      // No immediate check (same as arena-live.js): the pill may still
      // show a previous cycle's "Cloud saved" — only a fresh mutation
      // from THIS cycle counts as this sync's result.
    });
  }
  async function runBookImports() {
    var result = { failed: false, imported: 0, anyKey: false, errors: [] };
    var mods = [
      { name: "Polymarket", mod: window.BetLabPolymarketUS },
      { name: "Kalshi", mod: window.BetLabKalshiImport }
    ];
    for (var i = 0; i < mods.length; i++) {
      var m = mods[i].mod;
      if (!m || typeof m.getKeyId !== "function" || typeof m.importPositions !== "function") continue;
      var key = "";
      try { key = m.getKeyId(); } catch (e) { key = ""; }
      if (!key) continue; // no Key ID on this device for this book
      result.anyKey = true;
      try {
        var r = await m.importPositions();
        if (r && typeof r.imported === "number") result.imported += r.imported;
        if (r && r.error) { result.failed = true; result.errors.push(mods[i].name); }
      } catch (e) { result.failed = true; result.errors.push(mods[i].name); }
    }
    return result;
  }
  function fmtTime(d) {
    try { return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }); } catch (e) { return ""; }
  }
  async function runSync() {
    if (syncing) return;
    var btn = $("blSyncLatest"), status = $("blSyncStatus");
    if (!btn) return;
    syncing = true;
    btn.disabled = true;
    var REST = "⬆ Sync Latest Bets";
    btn.textContent = "Syncing…";
    if (status) status.textContent = "Checking the cloud, then pulling your latest open positions from Polymarket + Kalshi…";
    var failed = false;
    var signedIn = cloudSignedIn();
    if (signedIn) {
      var wait = waitForCloudCycle(25000); // observer armed BEFORE the trigger
      try { window.dispatchEvent(new Event("online")); } catch (e) {}
      var outcome = await wait;
      if (outcome !== "saved") failed = true;
    }
    var books = await runBookImports();
    if (books.failed) failed = true;
    try { if (typeof window.renderBets === "function") window.renderBets(); } catch (e) {}
    try { document.dispatchEvent(new Event("betlab-board-rendered")); } catch (e) {}
    buildBar(); updateCounts(); applyFilter();
    var msg;
    if (!books.anyKey) {
      msg = "No account Key IDs are saved on this device yet, so there's nothing to pull from. Open Sportsbooks and save your Polymarket / Kalshi Key ID there once — after that, this button pulls your bets. (That's also why bets looked like they stopped uploading.)";
      failed = true;
    } else if (books.imported > 0) {
      msg = "✓ Synced " + fmtTime(new Date()) + " — " + books.imported + " new bet" + (books.imported === 1 ? "" : "s") + " pulled in. They're in Saved Bets below.";
    } else {
      msg = "✓ Synced " + fmtTime(new Date()) + " — no new bets. Your accounts and Saved Bets already match.";
    }
    if (!signedIn) msg += " You're signed out of the cloud, so tap Sign in (bottom-right pill) to back these up.";
    if (books.failed) msg += " One book hit an error (" + books.errors.join(", ") + ") — try again in a moment.";
    else if (failed && books.anyKey && signedIn) msg += " The cloud step didn't confirm — your local list is up to date; try once more if a bet looks missing.";
    if (status) status.textContent = msg;
    btn.textContent = failed && !books.anyKey ? REST : (books.imported > 0 || signedIn ? "✓ Synced" : REST);
    setTimeout(function () { btn.textContent = REST; btn.disabled = false; syncing = false; }, 3500);
  }

  /* ---------------- keep-alive ----------------
   * renderBets() rebuilds #saved (not the bar — the bar is its sibling),
   * so the bar survives; counts and the active filter must re-assert
   * after each rebuild. The board-rendered event fires on renders; the
   * interval covers any path that doesn't fire it. */
  function refresh() { if (buildBar()) { updateCounts(); applyFilter(); } }
  function init() {
    refresh();
    document.addEventListener("betlab-board-rendered", refresh);
    window.setInterval(refresh, 1500);
  }
  window.BetLabTrackerSync = { sync: runSync, setFilter: setFilter, counts: counts, refresh: refresh };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init, { once: true });
  else init();
})();
