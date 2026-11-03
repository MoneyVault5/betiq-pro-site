/* Bet Lab LIVE — Polymarket US API import (read-only proxy).
 *
 * Ported from the preview build's polymarket-us.js (PREVIEW-05, live-
 * verified against the real account 2026-11-02). Differences from the
 * preview version, all forced by the live app:
 * - The Key ID persists under the live-scoped key 'betlab_pmus_keyid'.
 * - The backend host and the project's public publishable key are plain
 *   literals: the live app already ships both in cloud-sync.js (client
 *   material by design), so the preview's fragment assembly is unneeded.
 * - The live saveBet() always appends (the preview's refused duplicates
 *   centrally), so dedupe is a pre-check here: an id already in the
 *   tracker's bets is skipped without calling saveBet().
 * - Balance display: the panel also shows the account balance from
 *   /v1/account/balances (best-effort; never blocks the positions import).
 * Only OPEN POSITIONS are imported. Activities/settlements are never
 * fetched — how book-settled results should land is Marquis's pending
 * call (TASK-0044), and this module does not pre-empt it.
 * The proxy holds the account's secret key server-side and only ever
 * forwards three read-only GET paths; this page holds NOTHING but the
 * API Key ID, a public identifier (a UUID from polymarket.us/developer —
 * NOT the secret key, which must never be pasted into any web page). */
(function (global) {
  'use strict';

  var PROXY_URL = 'https://shnnefxhunroluelghbv.supabase.co/functions/v1/polymarket-us-proxy';
  var POSITIONS_PATH = '/v1/portfolio/positions';
  var BALANCES_PATH = '/v1/account/balances';
  var ANON_KEY = 'sb_publishable_RoFhq3z2j5rJQjUUrTEIkg_Gm4fkaG4';
  var LS_KEYID = 'betlab_pmus_keyid';
  var BETS_KEY = 'betlab_clean_real_bets_v1';

  /* -------- canonical mapper port (from mapper.mjs, verified live) -------- */
  function parseAmount(v) {
    if (v == null) return null;
    if (typeof v === 'number') return Number.isFinite(v) ? v : null;
    if (typeof v === 'string') {
      var n = Number(v);
      return Number.isFinite(n) ? n : null;
    }
    if (typeof v === 'object') {
      var keys = ['amount', 'value'];
      for (var i = 0; i < keys.length; i++) {
        if (v[keys[i]] != null) {
          var m = typeof v[keys[i]] === 'number' ? v[keys[i]] : Number(v[keys[i]]);
          if (Number.isFinite(m)) return m;
        }
      }
    }
    return null;
  }

  function num(v) {
    if (v == null) return null;
    var n = typeof v === 'number' ? v : Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function impliedOddsFromPrice(p) {
    if (p == null || p <= 0 || p >= 1) return null;
    var raw = p >= 0.5 ? -(p / (1 - p)) * 100 : ((1 - p) / p) * 100;
    return Math.round(raw);
  }

  // row: one position object from the positions map; slug: its map key.
  // Returns a Bet Lab bet, or null when the row cannot be mapped honestly.
  function toBet(slug, row) {
    if (!row || typeof row !== 'object') return null;
    var qty = num(row.netPositionDecimal != null ? row.netPositionDecimal : row.netPosition);
    var bought = num(row.qtyBoughtDecimal != null ? row.qtyBoughtDecimal : row.qtyBought);
    var stake = parseAmount(row.cost);
    if (!slug || qty == null || qty === 0 || stake == null || stake <= 0) return null;

    var meta = row.marketMetadata && typeof row.marketMetadata === 'object' ? row.marketMetadata : {};
    var game = typeof meta.title === 'string' && meta.title ? meta.title : slug;
    var outcome = typeof meta.outcome === 'string' && meta.outcome ? meta.outcome : null;
    var subjectName =
      meta.subject && typeof meta.subject === 'object' && typeof meta.subject.name === 'string' && meta.subject.name
        ? meta.subject.name
        : null;
    var selectionBase = subjectName != null ? subjectName : game;
    var selection = outcome ? selectionBase + ' — ' + outcome : selectionBase;

    var avg = parseAmount(row.avgPx);
    var entryPrice = avg != null ? avg : (bought && bought > 0 ? stake / bought : null);
    var odds = impliedOddsFromPrice(entryPrice);
    var cashValue = parseAmount(row.cashValue);
    var payout = qty > 0 ? Math.abs(qty) : cashValue; // short side: cashValue (verify-live note in mapper)

    return {
      id: 'PMUS-' + slug,
      ticket: 'PMUS-' + slug,
      book: 'Polymarket',
      source: 'Polymarket US API import',
      game: game,
      market: slug,
      selection: selection,
      legs: [selection],
      stake: stake,
      payout: payout,
      odds: odds,
      status: row.expired ? 'Expired' : 'Open',
      stakeType: 'cash',
      placedAt: row.updateTime != null ? row.updateTime : null,
      importedAt: new Date().toISOString()
    };
  }

  // Whole-response helper: positions map -> array of bets (nulls dropped).
  function positionsToBets(positionsMap) {
    if (!positionsMap || typeof positionsMap !== 'object' || Array.isArray(positionsMap)) return [];
    var bets = [];
    var slugs = Object.keys(positionsMap);
    for (var i = 0; i < slugs.length; i++) {
      var bet = toBet(slugs[i], positionsMap[slugs[i]]);
      if (bet) bets.push(bet);
    }
    return bets;
  }

  /* -------- Key ID storage (live-scoped key only) -------- */
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

  /* -------- duplicate pre-check --------
   * The live saveBet() appends unconditionally, so ids already in the
   * tracker are collected first (live `bets` binding when reachable,
   * else the persisted array) and skipped without a saveBet() call. */
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

  /* -------- status / balance lines (Sportsbooks > Polymarket tile) -------- */
  function setStatus(msg) {
    try {
      var el = global.document && global.document.getElementById('pmusStatus');
      if (el) el.textContent = msg;
    } catch (e) { /* no DOM (e.g. Node) */ }
  }
  function setBalance(msg) {
    try {
      var el = global.document && global.document.getElementById('pmusBalance');
      if (el) el.textContent = msg;
    } catch (e) { /* no DOM (e.g. Node) */ }
  }

  function fail(message, total) {
    setStatus(message);
    return { imported: 0, skipped: 0, total: total || 0, error: message };
  }

  function proxyPost(path, keyId, fetchImpl) {
    return fetchImpl(PROXY_URL, {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + ANON_KEY,
        'apikey': ANON_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ keyId: keyId, path: path })
    });
  }

  /* -------- balance (best-effort; display only) --------
   * Verified live facts (2026-11-02): the account's current balance was
   * $33.84 with $23.83 available to withdraw. The upstream payload shape
   * was observed through those values, not recorded field-by-field, so
   * parsing is deliberately tolerant: any USD entry/object carrying a
   * currentBalance/balance Amount is accepted. Returns
   * { current, withdrawable } or null; never throws. */
  async function getBalance(opts) {
    opts = opts || {};
    var fetchImpl = opts.fetchImpl || (typeof global.fetch === 'function' ? global.fetch.bind(global) : null);
    var keyId = opts.keyId != null ? String(opts.keyId).trim() : getKeyId();
    if (!keyId || !fetchImpl) return null;
    try {
      var res = await proxyPost(BALANCES_PATH, keyId, fetchImpl);
      if (!res.ok) return null;
      var data = await res.json();
      var entries = [];
      if (Array.isArray(data)) entries = data;
      else if (data && typeof data === 'object') {
        if (Array.isArray(data.balances)) entries = data.balances;
        else if (data.balances && typeof data.balances === 'object') entries = Object.values(data.balances);
        else entries = [data];
      }
      for (var i = 0; i < entries.length; i++) {
        var e = entries[i];
        if (!e || typeof e !== 'object') continue;
        if (e.currency && String(e.currency).toUpperCase() !== 'USD') continue;
        var current = parseAmount(e.currentBalance != null ? e.currentBalance : e.balance);
        if (current == null) continue;
        var withdrawable = parseAmount(e.availableToWithdraw != null ? e.availableToWithdraw : (e.withdrawable != null ? e.withdrawable : e.availableBalance));
        return { current: current, withdrawable: withdrawable };
      }
      return null;
    } catch (e) { return null; }
  }

  function money(n) { return '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }

  async function refreshBalance(opts) {
    var bal = await getBalance(opts || {});
    if (bal) {
      setBalance('Polymarket US balance: ' + money(bal.current) + (bal.withdrawable != null ? ' · ' + money(bal.withdrawable) + ' available to withdraw' : ''));
    }
    return bal;
  }

  /* -------- import --------
   * POSTs { keyId, path } to the proxy, converts the positions map via
   * positionsToBets, and saves each NEW bet through the page's saveBet()
   * (duplicates are pre-checked and skipped — see existingIds).
   * Resolves { imported, skipped, total } (+ error when refused/failed);
   * never throws. */
  async function importPositions(opts) {
    opts = opts || {};
    var fetchImpl = opts.fetchImpl || (typeof global.fetch === 'function' ? global.fetch.bind(global) : null);
    var keyId = opts.keyId != null ? String(opts.keyId).trim() : getKeyId();
    if (!keyId) {
      return fail('Add your Polymarket US API Key ID first — it ships empty on purpose. The Key ID is the public identifier from polymarket.us/developer, not your secret key (the secret never belongs in a page).', 0);
    }
    if (!fetchImpl) {
      return fail('Polymarket US import failed: no fetch available in this browser. Nothing was added and no records were changed.', 0);
    }
    setStatus('Contacting Polymarket US…');
    var res;
    try {
      res = await proxyPost(POSITIONS_PATH, keyId, fetchImpl);
    } catch (e) {
      return fail('Polymarket US import failed: could not reach the proxy (' + (e && e.message ? e.message : e) + '). Nothing was added and no records were changed.', 0);
    }
    var data = null;
    try { data = await res.json(); } catch (e) { /* handled below */ }
    if (!res.ok || (data && typeof data === 'object' && data.error)) {
      var msg = data && data.error ? String(data.error) : 'the proxy answered HTTP ' + res.status;
      return fail('Polymarket US import failed: ' + msg + '. Nothing was added and no records were changed.', 0);
    }
    // Verified live shape: the positions map rides in an envelope
    // ({ positions: {slug: row}, nextCursor, eof }); a bare map is also
    // accepted so the module matches the mapper's documented contract.
    var map = null;
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      if (data.positions && typeof data.positions === 'object' && !Array.isArray(data.positions)) map = data.positions;
      else map = data;
    }
    var rows = map ? Object.keys(map).length : 0;
    var mapped = positionsToBets(map || {});
    var save = typeof global.saveBet === 'function' ? global.saveBet : null;
    if (!save && mapped.length) {
      return fail('Polymarket US import failed: the tracker save function is unavailable. Nothing was added and no records were changed.', rows);
    }
    var existing = existingIds();
    var imported = 0;
    for (var i = 0; i < mapped.length; i++) {
      if (existing.has(mapped[i].id)) continue; // duplicate: live saveBet would append it
      if (save(mapped[i])) { imported++; existing.add(mapped[i].id); }
    }
    var skipped = rows - imported;
    if (rows === 0) {
      setStatus('Polymarket US returned no open positions for that Key ID. Nothing imported.');
    } else {
      setStatus('Import complete: ' + imported + ' new position(s) added, ' + skipped + ' skipped (duplicates or unmappable). Review them in Bet Tracker — settle each with Win/Lose as results land.');
    }
    try { await refreshBalance({ keyId: keyId, fetchImpl: fetchImpl }); } catch (e) { /* balance is display-only */ }
    return { imported: imported, skipped: skipped, total: rows };
  }

  /* -------- Sportsbooks panel wiring --------
   * The panel markup lives in sportsbooks.js (loaded deferred before
   * this file), so the elements exist by now. Defensive: absent
   * elements -> silent no-op. */
  function wirePanel() {
    var d = global.document;
    if (!d) return;
    var input = d.getElementById('pmusKeyId');
    var saveBtn = d.getElementById('pmusSave');
    var importBtn = d.getElementById('pmusImport');
    if (!input || !saveBtn || !importBtn) return;
    var saved = getKeyId();
    input.value = saved;
    if (saved) {
      setStatus('Key ID saved in this browser (…' + saved.slice(-4) + '). Tap "Import positions" to pull your open Polymarket US positions.');
      refreshBalance({ keyId: saved });
    }
    saveBtn.addEventListener('click', function () {
      var v = setKeyId(input.value);
      setStatus(v ? 'Key ID saved in this browser only.' : 'Key ID cleared.');
      if (v) refreshBalance({ keyId: v }); else setBalance('');
    });
    importBtn.addEventListener('click', function () {
      // An unsaved edit in the box wins over the stored value.
      importPositions({ keyId: input.value });
    });
  }

  var api = {
    PROXY_URL: PROXY_URL,
    POSITIONS_PATH: POSITIONS_PATH,
    BALANCES_PATH: BALANCES_PATH,
    ANON_KEY: ANON_KEY,
    KEY_ID_STORAGE_KEY: LS_KEYID,
    getKeyId: getKeyId,
    setKeyId: setKeyId,
    getBalance: getBalance,
    refreshBalance: refreshBalance,
    importPositions: importPositions,
    toBet: toBet,
    positionsToBets: positionsToBets,
    parseAmount: parseAmount
  };
  global.BetLabPolymarketUS = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;

  try { wirePanel(); } catch (e) { /* panel wiring is best-effort */ }
})(typeof window !== 'undefined' ? window : globalThis);
