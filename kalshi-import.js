/* Bet Lab LIVE — Kalshi API import via the secure signer.
 *
 * Built from the TASK-0046 spec now that the signer is live (v7,
 * verified HTTP 200 against the real account 2026-11-02). The signer
 * (Bet Lab Supabase Edge Function 'kalshi-signer') holds the account's
 * RSA private key as a server-side secret and signs Kalshi requests
 * server-side; this page only ever sends { keyId, method, path } and
 * holds NOTHING but the API Key ID — a public identifier — stored in
 * this browser only under 'betlab_kalshi_keyid'. No private key is
 * ever requested, pasted, stored, or bundled here.
 *
 * Scope (deliberate): balance display + OPEN POSITIONS import only.
 * Fills and settled history are NOT imported: how book-settled results
 * should land (auto-mark vs review list) is Marquis's pending decision
 * (TASK-0044), and this module does not pre-empt it. Kalshi settles in
 * CASH — imported bets are stakeType 'cash', never trade credit.
 *
 * Import is atomic per run: all position pages are collected before
 * anything is saved, so a partial pagination failure imports nothing.
 * Duplicates: the live saveBet() appends unconditionally, so ids
 * already in the tracker are pre-checked and skipped — re-importing
 * the same positions adds 0 (idempotent). Market titles are resolved
 * with one extra read per NEW ticker only, cached per import run; a
 * failed title lookup falls back to the ticker text, never blocks. */
(function (global) {
  'use strict';

  var SIGNER_URL = 'https://shnnefxhunroluelghbv.supabase.co/functions/v1/kalshi-signer';
  var ANON_KEY = 'sb_publishable_RoFhq3z2j5rJQjUUrTEIkg_Gm4fkaG4';
  var POSITIONS_PATH = '/trade-api/v2/portfolio/positions';
  var BALANCE_PATH = '/trade-api/v2/portfolio/balance';
  var MARKETS_PATH = '/trade-api/v2/markets/';
  var LS_KEYID = 'betlab_kalshi_keyid';
  var BETS_KEY = 'betlab_clean_real_bets_v1';

  /* -------- numeric helpers (mirror the Polymarket module) -------- */
  function num(v) {
    if (v == null) return null;
    var n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }
  function round2(n) { return Math.round(Number(n) * 100) / 100; }
  function impliedOddsFromPrice(p) {
    if (p == null || p <= 0 || p >= 1) return null;
    var raw = p >= 0.5 ? -(p / (1 - p)) * 100 : ((1 - p) / p) * 100;
    return Math.round(raw);
  }
  function money(n) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  /* -------- Key ID storage (browser-local, public identifier) -------- */
  function getKeyId() {
    try { return (global.localStorage.getItem(LS_KEYID) || '').trim(); } catch (e) { return ''; }
  }
  function setKeyId(v) {
    var value = String(v == null ? '' : v).trim();
    try {
      if (value) global.localStorage.setItem(LS_KEYID, value);
      else global.localStorage.removeItem(LS_KEYID);
    } catch (e) { /* storage unavailable */ }
    return value;
  }

  /* -------- duplicate pre-check (live saveBet appends blindly) -------- */
  function existingIds() {
    var ids = new Set();
    try {
      if (typeof bets !== 'undefined' && Array.isArray(bets)) {
        bets.forEach(function (b) { if (b && b.id) ids.add(b.id); });
        return ids;
      }
    } catch (e) { /* fall through to storage */ }
    try {
      var arr = JSON.parse(global.localStorage.getItem(BETS_KEY) || '[]');
      if (Array.isArray(arr)) arr.forEach(function (b) { if (b && b.id) ids.add(b.id); });
    } catch (e) { /* no readable store */ }
    return ids;
  }

  /* -------- status / balance lines (Sportsbooks > Kalshi tile) -------- */
  function setStatus(msg) {
    try {
      var el = global.document && global.document.getElementById('kalshiStatus');
      if (el) el.textContent = msg;
    } catch (e) { /* no DOM (e.g. Node) */ }
  }
  function setBalance(msg) {
    try {
      var el = global.document && global.document.getElementById('kalshiBalance');
      if (el) el.textContent = msg;
    } catch (e) { /* no DOM (e.g. Node) */ }
  }

  /* -------- signer transport --------
   * POST { keyId, method: 'GET', path } to the signer with the project's
   * public anon key as Bearer + apikey (same client material cloud-sync
   * ships). Resolves the upstream JSON; throws an Error carrying
   * .status and .upstreamMessage on any non-2xx. */
  async function signerGet(path, keyId, fetchImpl) {
    var res = await fetchImpl(SIGNER_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + ANON_KEY,
        'apikey': ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ keyId: keyId, method: 'GET', path: path })
    });
    var data = null;
    try { data = await res.json(); } catch (e) { /* handled below */ }
    if (!res.ok) {
      var err = new Error('signer answered HTTP ' + res.status);
      err.status = res.status;
      err.upstreamMessage = data && (data.error || data.message) ? String(data.error || data.message) : '';
      throw err;
    }
    if (data && typeof data === 'object' && data.error && !data.market_positions && !data.balance_dollars && !data.market) {
      var e2 = new Error(String(data.error));
      e2.status = res.status;
      e2.upstreamMessage = String(data.error);
      throw e2;
    }
    return data;
  }

  // Spec error language (TASK-0046): 503 = secret missing server-side,
  // 401 = Kalshi rejected the Key ID / signing-key pairing.
  function friendlyError(err) {
    var status = err && err.status;
    if (status === 503) return "Kalshi import failed: Kalshi isn't connected yet — the signing key hasn't been added. Nothing was added and no records were changed.";
    if (status === 401) return "Kalshi import failed: Kalshi rejected the key pairing — Key ID and signing key don't match. Nothing was added and no records were changed.";
    var detail = err && err.upstreamMessage ? err.upstreamMessage : (err && err.message ? err.message : 'unknown error');
    return 'Kalshi import failed: ' + detail + '. Nothing was added and no records were changed.';
  }

  function fail(message, total) {
    setStatus(message);
    return { imported: 0, skipped: 0, total: total || 0, error: message };
  }

  /* -------- mapping --------
   * Open position (Kalshi market_positions entry): ticker, position_fp
   * (signed contracts as a fixed-point string; positive = Yes held,
   * negative = No held), market_exposure_dollars (cost basis at risk).
   * Stake = market exposure (the dollars actually in the position);
   * payout = contract count (each contract pays $1 to the winner);
   * odds derive from the implied average price stake / contracts.
   * Market info (from GET /markets/<ticker>) supplies display text:
   * title -> game, yes_sub_title / no_sub_title (by side) -> selection.
   * Returns a bet or null when the row cannot be mapped honestly. */
  function toBet(row, market) {
    if (!row || typeof row !== 'object' || !row.ticker) return null;
    var contracts = num(row.position_fp != null ? row.position_fp : row.position);
    if (contracts == null || contracts === 0) return null;
    var stake = num(row.market_exposure_dollars != null ? row.market_exposure_dollars : (row.market_exposure != null ? row.market_exposure / 100 : null));
    if (stake == null || stake <= 0) return null;
    var count = Math.abs(contracts);
    var side = contracts > 0 ? 'Yes' : 'No';
    var avgPrice = stake / count;
    var odds = impliedOddsFromPrice(avgPrice);

    var game = row.event_ticker || row.ticker;
    var base = row.ticker;
    if (market && typeof market === 'object') {
      if (typeof market.title === 'string' && market.title) game = market.title;
      var sub = side === 'Yes' ? market.yes_sub_title : market.no_sub_title;
      if (typeof sub === 'string' && sub) base = sub;
      else if (typeof market.title === 'string' && market.title) base = market.title;
    }
    var selection = base + ' — ' + side;

    return {
      id: 'KAL-' + row.ticker,
      ticket: 'KAL-' + row.ticker,
      book: 'Kalshi',
      source: 'Kalshi API import',
      game: game,
      market: row.ticker,
      selection: selection,
      legs: [selection],
      stake: round2(stake),
      payout: round2(count),
      odds: odds,
      status: 'Open',
      stakeType: 'cash',
      importedAt: new Date().toISOString()
    };
  }

  /* -------- balance (display only) --------
   * GET /trade-api/v2/portfolio/balance -> balance_dollars ("108.0904")
   * preferred; the cents integer `balance` is the fallback. */
  async function getBalance(opts) {
    opts = opts || {};
    var fetchImpl = opts.fetchImpl || (typeof global.fetch === 'function' ? global.fetch.bind(global) : null);
    var keyId = opts.keyId != null ? String(opts.keyId).trim() : getKeyId();
    if (!keyId || !fetchImpl) return null;
    var data = await signerGet(BALANCE_PATH, keyId, fetchImpl);
    var bal = num(data && data.balance_dollars);
    if (bal == null && data && data.balance != null) { var cents = num(data.balance); bal = cents == null ? null : cents / 100; }
    return bal == null ? null : { balance: bal };
  }

  async function refreshBalance(opts) {
    try {
      var bal = await getBalance(opts || {});
      if (bal) setBalance('Kalshi balance: ' + money(bal.balance));
      return bal;
    } catch (e) { return null; }
  }

  /* -------- import: OPEN POSITIONS ONLY --------
   * 1. Refuse (no fetch) without a Key ID.
   * 2. Collect ALL position pages (cursor-following) before saving —
   *    any failure aborts the run with nothing imported.
   * 3. Resolve market text for NEW tickers only (cached per run).
   * 4. Save new bets through saveBet() with a duplicate pre-check. */
  async function importPositions(opts) {
    opts = opts || {};
    var fetchImpl = opts.fetchImpl || (typeof global.fetch === 'function' ? global.fetch.bind(global) : null);
    var keyId = opts.keyId != null ? String(opts.keyId).trim() : getKeyId();
    if (!keyId) {
      return fail('Add your Kalshi API Key ID first — it ships empty on purpose. The Key ID is the public identifier from your Kalshi profile, not a secret (the signing key never belongs in a page).', 0);
    }
    if (!fetchImpl) {
      return fail('Kalshi import failed: no fetch available in this browser. Nothing was added and no records were changed.', 0);
    }
    setStatus('Contacting Kalshi…');
    var rows = [];
    try {
      var path = POSITIONS_PATH;
      for (var page = 0; page < 50; page++) {
        var data = await signerGet(path, keyId, fetchImpl);
        var batch = data && Array.isArray(data.market_positions) ? data.market_positions : [];
        rows = rows.concat(batch);
        var cursor = data && typeof data.cursor === 'string' ? data.cursor : '';
        if (!cursor) break;
        path = POSITIONS_PATH + '?cursor=' + encodeURIComponent(cursor);
      }
    } catch (e) {
      return fail(friendlyError(e), 0);
    }

    var save = typeof global.saveBet === 'function' ? global.saveBet : null;
    if (!save && rows.length) {
      return fail('Kalshi import failed: the tracker save function is unavailable. Nothing was added and no records were changed.', rows.length);
    }
    var existing = existingIds();
    var marketCache = {};
    var imported = 0;
    for (var i = 0; i < rows.length; i++) {
      var row = rows[i];
      var id = row && row.ticker ? 'KAL-' + row.ticker : null;
      if (!id || existing.has(id)) continue; // duplicate (or untickered): skip without any extra reads
      // Cheap mappability pre-check so unmappable rows (zero contracts,
      // no exposure) never trigger a market read either.
      var contracts = num(row.position_fp != null ? row.position_fp : row.position);
      var exposure = num(row.market_exposure_dollars != null ? row.market_exposure_dollars : (row.market_exposure != null ? row.market_exposure / 100 : null));
      if (contracts == null || contracts === 0 || exposure == null || exposure <= 0) continue;
      var market = null;
      if (!(row.ticker in marketCache)) {
        try {
          var mdata = await signerGet(MARKETS_PATH + encodeURIComponent(row.ticker), keyId, fetchImpl);
          marketCache[row.ticker] = (mdata && (mdata.market || mdata)) || null;
        } catch (e) { marketCache[row.ticker] = null; }
      }
      market = marketCache[row.ticker];
      var bet = toBet(row, market);
      if (!bet) continue;
      if (save(bet)) { imported++; existing.add(id); }
    }
    var skipped = rows.length - imported;
    if (rows.length === 0) {
      setStatus('Kalshi returned no open positions for that Key ID. Nothing imported.');
    } else {
      setStatus('Import complete: ' + imported + ' new position(s) added, ' + skipped + ' skipped (duplicates or unmappable). Review them in Bet Tracker — settle each with Win/Lose as results land.');
    }
    try { await refreshBalance({ keyId: keyId, fetchImpl: fetchImpl }); } catch (e) { /* balance is display-only */ }
    return { imported: imported, skipped: skipped, total: rows.length };
  }

  /* -------- Sportsbooks panel wiring --------
   * Panel markup lives in sportsbooks.js (loaded deferred before this
   * file). Defensive: absent elements -> silent no-op. */
  function wirePanel() {
    var d = global.document;
    if (!d) return;
    var input = d.getElementById('kalshiKey');
    var saveBtn = d.getElementById('kalshiSave');
    var importBtn = d.getElementById('kalshiImport');
    if (!input || !saveBtn || !importBtn) return;
    var saved = getKeyId();
    input.value = saved;
    if (saved) {
      setStatus('Key ID saved in this browser (…' + saved.slice(-4) + '). Tap "Import positions" to pull your open Kalshi positions.');
      refreshBalance({ keyId: saved });
    }
    saveBtn.addEventListener('click', function () {
      var v = setKeyId(input.value);
      setStatus(v ? 'Key ID saved in this browser only.' : 'Key ID cleared.');
      if (v) refreshBalance({ keyId: v }); else setBalance('');
    });
    importBtn.addEventListener('click', function () {
      importPositions({ keyId: input.value });
    });
  }

  var api = {
    SIGNER_URL: SIGNER_URL,
    POSITIONS_PATH: POSITIONS_PATH,
    BALANCE_PATH: BALANCE_PATH,
    ANON_KEY: ANON_KEY,
    KEY_ID_STORAGE_KEY: LS_KEYID,
    getKeyId: getKeyId,
    setKeyId: setKeyId,
    getBalance: getBalance,
    refreshBalance: refreshBalance,
    importPositions: importPositions,
    toBet: toBet
  };
  global.BetLabKalshiImport = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  try { wirePanel(); } catch (e) { /* panel wiring is best-effort */ }
})(typeof window !== 'undefined' ? window : globalThis);
