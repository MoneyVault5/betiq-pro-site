/* Bet Lab LIVE — AI Scout (TASK-0049 production port; additive; loaded
 * deferred after kalshi-import.js).
 * Native port of the standalone TASK-0049 AI Scout preview
 * (~/workspace/betlab-ai-scout-preview/index.html) into the live app:
 * - Adds an "AI Scout" page (#aiScoutPage, a .content-page next to
 *   #workspace, shown via a window.go wrapper exactly the way
 *   sportsbooks.js wraps go()) with five sub-views: Pregame, Live,
 *   Markets, Performance Tracker, Chat. The Stitch top-bar pill
 *   (data-go="AI Scout", in stitch-live.js STA_HEADER) routes here.
 *   The app's pre-existing Scout features (nav Scout placeholder, the
 *   DG "Run Scout" analysis and the AI Scout Report tooling) are a
 *   different, older surface and are NOT touched by this module.
 * - The dashboard Hot Takes panel markup lives in stitch-live.js
 *   (STA_MAIN, below the two-column split); this module renders the
 *   takes into it and wires its Refresh / View All controls.
 * Data honesty (unchanged from the preview): keyless public GETs only
 * (ESPN NFL/NBA scoreboards, Polymarket Gamma, Kalshi public markets).
 * Feeds that fail render UNAVAILABLE; odds, probabilities, edges and
 * picks are never invented. Edge/EV are computed ONLY from a model
 * probability the user types in; otherwise they read UNCALIBRATED.
 * Storage isolation: the Performance Tracker uses ONLY the browser-
 * local key ai_scout_tracker_v1. This module never reads or writes
 * the production bet store (betlab_clean_real_bets_v1), never calls
 * cloud-sync, and never touches the tickets table. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var TKEY = 'ai_scout_tracker_v1';
  var state = { games: { nfl: null, nba: null }, fetchedAt: {}, poly: [], kalshi: [], polyErr: '', kalshiErr: '', sample: false };
  var now = function () { return Date.now(); };

  /* ---------------- utilities (ported from the standalone) ---------------- */
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function el(tag, html) { var t = document.createElement(tag); t.innerHTML = html; return t; }
  function fmtT(ts) { return new Date(ts).toLocaleString(); }
  function setText(id, txt) { var n = $(id); if (n) n.textContent = txt; }
  function fetchJSON(url, ms) {
    if (typeof fetch !== 'function') return Promise.reject(new Error('fetch unavailable in this browser'));
    var c = new AbortController(); var t = setTimeout(function () { c.abort(); }, ms || 12000);
    return fetch(url, { signal: c.signal }).then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); }).finally(function () { clearTimeout(t); });
  }
  function oddsFromPrice(p) { p = Math.min(0.99, Math.max(0.01, p)); return p >= 0.5 ? -Math.round(100 * p / (1 - p)) : Math.round(100 * (1 - p) / p); }
  function impliedFromOdds(o) { return o > 0 ? 100 / (100 + o) * 100 : Math.abs(o) / (Math.abs(o) + 100) * 100; }
  function edgeEV(modelPct, odds) { if (modelPct == null || isNaN(modelPct)) return null; var imp = impliedFromOdds(odds) / 100, m = modelPct / 100; var dec = odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds); return { edge: (m - imp) * 100, ev: m * dec - 1 }; }
  function edgeCell(odds) { var inp = $('aisModelP'); var mp = inp ? parseFloat(inp.value) : NaN; var r = edgeEV(isNaN(mp) ? null : mp, odds); if (!r) return '<span class="ais-muted">UNCALIBRATED — enter model % in Markets</span>'; var cls = r.ev >= 0 ? 'ais-pos' : 'ais-neg'; return '<span class="' + cls + '">edge ' + r.edge.toFixed(1) + ' pts · EV ' + (r.ev * 100).toFixed(1) + '%</span>'; }

  /* ---------------- feeds (ported) ---------------- */
  function loadGames(league) {
    var url = league === 'nfl'
      ? 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard'
      : 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard';
    return fetchJSON(url).then(function (d) { state.games[league] = d; state.fetchedAt[league] = now(); return d; });
  }
  function gameRows(d) {
    var evs = (d && d.events) || [];
    return evs.map(function (e) {
      var comp = (e.competitions || [])[0] || {}; var cs = comp.competitors || [];
      var team = function (c) { return (c.team || {}).displayName || (c.team || {}).shortDisplayName || '?'; };
      var score = function (c) { return c.score != null ? c.score : '–'; };
      var st = (e.status || {}).type || {}; var detail = st.detail || st.shortDetail || '';
      var live = !!st.completed === false && (detail && /Q|OT|Half|In Progress/i.test(detail));
      return { name: cs.map(team).join(' vs '), a: cs[0] ? team(cs[0]) + ' ' + score(cs[0]) : '', b: cs[1] ? team(cs[1]) + ' ' + score(cs[1]) : '', detail: detail, live: live, venue: (comp.venue || {}).fullName || '', date: e.date || '' };
    });
  }
  function loadPoly() {
    return fetchJSON('https://gamma-api.polymarket.com/markets?limit=100&active=true&closed=false').then(function (d) {
      var arr = Array.isArray(d) ? d : [];
      state.poly = arr.map(function (m) {
        var prices = []; try { prices = JSON.parse(m.outcomePrices || '[]').map(Number); } catch (e) {}
        var vol = parseFloat(m.volume24hr || m.volume || 0) || 0;
        return { src: 'Polymarket', q: m.question || '', price: prices[0], vol: vol, liq: parseFloat(m.liquidity || 0) || 0 };
      }).filter(function (m) { return m.q && !isNaN(m.price); });
      state.fetchedAt.poly = now(); state.polyErr = ''; return state.poly;
    });
  }
  function loadKalshi() {
    return fetchJSON('https://api.elections.kalshi.com/trade-api/v2/markets?limit=100&status=open').then(function (d) {
      var arr = (d && d.markets) || [];
      state.kalshi = arr.map(function (m) {
        var p = (m.yes_ask != null ? m.yes_ask : m.last_price) / 100;
        return { src: 'Kalshi', q: m.title || '', price: p, vol: parseFloat(m.volume || 0) || 0, liq: parseFloat(m.liquidity || 0) || 0 };
      }).filter(function (m) { return m.q && !isNaN(m.price) && m.price > 0 && m.price < 1; });
      state.fetchedAt.kalshi = now(); state.kalshiErr = ''; return state.kalshi;
    });
  }
  var SPORT = /nfl|nba|football|basketball|super bowl|touchdown|playoff/i;
  function sampleMarkets() {
    return [
      { src: 'SAMPLE (labeled mock)', q: 'SAMPLE ONLY — Demo United vs Sample FC: Demo United wins?', price: 0.55, vol: 1000, liq: 500, sample: true },
      { src: 'SAMPLE (labeled mock)', q: 'SAMPLE ONLY — Sample City total points over 42.5?', price: 0.48, vol: 800, liq: 400, sample: true },
      { src: 'SAMPLE (labeled mock)', q: 'SAMPLE ONLY — Fictional player scores first?', price: 0.30, vol: 600, liq: 300, sample: true }
    ];
  }
  function allMarkets() {
    if (state.sample) return Promise.resolve(sampleMarkets());
    var out = [];
    var jobs = [
      loadPoly().then(function (ms) { ms.filter(function (m) { return SPORT.test(m.q); }).forEach(function (m) { out.push(m); }); }, function (e) { state.polyErr = String(e); }),
      loadKalshi().then(function (ms) { ms.filter(function (m) { return SPORT.test(m.q); }).forEach(function (m) { out.push(m); }); }, function (e) { state.kalshiErr = String(e); })
    ];
    return Promise.all(jobs).then(function () { out.sort(function (a, b) { return (b.vol + b.liq) - (a.vol + a.liq); }); return out; });
  }
  function feedStatusHTML() {
    var parts = [];
    parts.push('ESPN NFL/NBA scoreboard: ' + (state.fetchedAt.nfl || state.fetchedAt.nba ? 'LOADED at ' + fmtT(Math.max(state.fetchedAt.nfl || 0, state.fetchedAt.nba || 0)) : 'not loaded yet / will show on use'));
    parts.push('Polymarket public markets: ' + (state.poly.length ? state.poly.length + ' markets loaded at ' + fmtT(state.fetchedAt.poly) : (state.polyErr ? 'UNAVAILABLE (' + esc(state.polyErr) + ')' : 'not loaded yet')));
    parts.push('Kalshi public markets: ' + (state.kalshi.length ? state.kalshi.length + ' markets loaded at ' + fmtT(state.fetchedAt.kalshi) : (state.kalshiErr ? 'UNAVAILABLE (' + esc(state.kalshiErr) + ')' : 'not loaded yet')));
    parts.push('DraftKings: <span class="ais-tag unavail">UNAVAILABLE — no public feed</span>');
    parts.push('Novig: <span class="ais-tag unavail">UNAVAILABLE — no public feed</span>');
    return parts.map(function (p) { return '<p>' + p + '</p>'; }).join('');
  }
  function refreshFeedStatus() { var n = $('aisFeedStatus'); if (n) n.innerHTML = feedStatusHTML(); }

  /* ---------------- market cards + Hot Takes (ported) ---------------- */
  function marketCard(m) {
    var odds = oddsFromPrice(m.price), imp = (m.price * 100).toFixed(1);
    var tag = m.sample ? '<span class="ais-badge-sample">SAMPLE</span> ' : '';
    return '<article class="ais-mkt"><h4>' + tag + esc(m.q) + '</h4>'
      + '<p class="ais-muted">' + esc(m.src) + ' · price ' + m.price.toFixed(2) + ' · American ' + (odds > 0 ? '+' : '') + odds + ' · implied ' + imp + '%'
      + ' · volume ' + Math.round(m.vol).toLocaleString() + ' · liquidity ' + Math.round(m.liq).toLocaleString() + '</p>'
      + '<p>' + edgeCell(odds) + '</p>'
      + '<p><button class="ais-ghost" type="button" data-ais-open="' + esc(m.q.replace(/"/g, '')) + '">Open full analysis in AI Scout →</button> '
      + '<button class="ais-ghost" type="button" data-ais-log="' + esc(m.q.replace(/"/g, '')) + '" data-ais-odds="' + odds + '">Log as prediction</button></p></article>';
  }
  function wireCards(root) {
    if (!root) return;
    root.querySelectorAll('[data-ais-open]').forEach(function (b) { b.addEventListener('click', function () { var q = $('aisMktQ'); if (q) q.value = b.dataset.aisOpen; openScout('markets'); loadMarkets(); }); });
    root.querySelectorAll('[data-ais-log]').forEach(function (b) { b.addEventListener('click', function () { var dIn = $('aisTrkDesc'); if (dIn) dIn.value = b.dataset.aisLog; var oIn = $('aisTrkOdds'); if (oIn) oIn.value = b.dataset.aisOdds; openScout('tracker'); addPrediction(); }); });
  }
  function loadHot() {
    var grid = $('staHotGrid'); if (!grid) return Promise.resolve();
    grid.innerHTML = '<p class="ais-muted">Loading real markets…</p>';
    return allMarkets().then(function (mkts) {
      var top = mkts.slice(0, 10);
      setText('staHotMeta', top.length ? ('Showing ' + top.length + ' of ' + mkts.length + ' matching markets · fetched ' + fmtT(now())) : 'No matching markets returned');
      setText('staHotNote', top.length ? 'Ranked by volume + liquidity (market activity), NOT by model edge. No model probability is claimed for any row.' : 'No value bets: no matching real markets loaded, or feeds were unavailable. Nothing has been filled in with fabricated picks.');
      grid.innerHTML = top.length ? '' : '<p class="ais-muted">No Hot Takes right now — see note below. Ranked by real market activity only; a labeled sample mode lives in AI Scout → Markets for QA.</p>';
      top.forEach(function (m) { grid.appendChild(el('div', marketCard(m))); });
      wireCards(grid); refreshFeedStatus();
    }).catch(function () { /* allMarkets never rejects by construction; belt-and-braces */ });
  }

  /* ---------------- sub-view navigation ---------------- */
  function showSub(v) {
    var page = $('aiScoutPage'); if (!page) return;
    page.querySelectorAll('[data-ais-view]').forEach(function (b) { b.classList.toggle('on', b.dataset.aisView === v); });
    ['pregame', 'live', 'markets', 'tracker', 'chat'].forEach(function (name) {
      var s = $('aisView-' + name); if (s) s.hidden = name !== v;
    });
  }
  function openScout(sub) {
    if (typeof window.go === 'function') window.go('AI Scout');
    if (sub) showSub(sub);
  }

  /* ---------------- page ---------------- */
  function injectStyles() {
    if ($('blAiScoutStyles')) return;
    var st = document.createElement('style');
    st.id = 'blAiScoutStyles';
    st.textContent =
      '.ais-muted{opacity:.78;font-size:13px}' +
      '.ais-row{display:flex;flex-wrap:wrap;gap:8px;align-items:center}' +
      '.ais-subnav{display:flex;flex-wrap:wrap;gap:6px;margin:12px 0}' +
      '.ais-subnav button{background:#132436;color:#e8f1f8;border:1px solid #52758e;border-radius:999px;padding:8px 14px;cursor:pointer;font-size:14px}' +
      '.ais-subnav button.on{background:#39FF88;color:#07130c;border-color:#39FF88;font-weight:700}' +
      '.ais-card{background:#101c2c;border:1px solid #2c4a63;border-radius:14px;padding:14px;margin:0 0 14px}' +
      '.ais-card h3{margin:0 0 8px;font-size:16px}' +
      '.ais-card h4{margin:12px 0 6px;font-size:14px;color:#ffd76a}' +
      '.ais-in{background:#0d1622;color:#e8f1f8;border:1px solid #52758e;border-radius:8px;padding:8px 10px;font-size:14px;min-width:0}' +
      '.ais-cta{background:#39FF88;color:#07130c;border:0;border-radius:999px;padding:8px 14px;cursor:pointer;font-weight:700}' +
      '.ais-ghost{background:transparent;color:#e8f1f8;border:1px solid #52758e;border-radius:999px;padding:7px 12px;cursor:pointer}' +
      '.ais-pos{color:#39FF88;font-weight:700}.ais-neg{color:#FF3B5C;font-weight:700}' +
      '.ais-tag{display:inline-block;padding:1px 7px;border-radius:999px;border:1px solid #52758e;font-size:11px}' +
      '.ais-tag.unavail{border-color:#FF3B5C;color:#FF6B81}' +
      '.ais-tag.live{border-color:#39FF88;color:#39FF88}' +
      '.ais-badge-sample{display:inline-block;padding:1px 7px;border-radius:999px;border:1px solid #2ea8ff;color:#2ea8ff;font-size:11px;letter-spacing:.06em}' +
      '.ais-mkt{background:rgba(16,12,29,.72);border:1px solid rgba(255,255,255,.12);border-left:4px solid #ff6b00;border-radius:12px;padding:12px;min-width:0}' +
      '.ais-mkt h4{margin:0 0 4px;font-size:14px;color:#f2f0ff}' +
      '.ais-hotgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(300px,1fr));gap:10px}' +
      '#aisChatlog{background:#0d1622;border:1px solid #2c4a63;border-radius:10px;padding:10px;min-height:120px;font-size:14px}' +
      '#aisChatlog p{margin:6px 0}' +
      '.ais-badge{display:inline-block;padding:2px 8px;border:1px solid #ff6b00;color:#ff8c42;border-radius:999px;font-size:11px;letter-spacing:.08em}';
    document.head.appendChild(st);
  }

  function buildPage() {
    if ($('aiScoutPage')) return;
    var page = document.createElement('section');
    page.className = 'content-page'; page.id = 'aiScoutPage'; page.hidden = true;
    page.innerHTML =
      '<h2 style="margin:6px 0">◈ AI Scout</h2>' +
      '<p class="notice">AI Scout reads only public, keyless feeds (ESPN scoreboards · Polymarket and Kalshi public markets). DraftKings and Novig have no public feed, so they always show UNAVAILABLE — odds are never invented to fill a gap. <b>No calibrated model exists yet</b>: rankings use real market activity only, and edge/EV appear only against a model probability you type in yourself.</p>' +
      '<div class="ais-subnav" role="tablist" aria-label="AI Scout sections">' +
      '<button type="button" data-ais-view="pregame" class="on">Pregame</button>' +
      '<button type="button" data-ais-view="live">Live</button>' +
      '<button type="button" data-ais-view="markets">Markets</button>' +
      '<button type="button" data-ais-view="tracker">Performance Tracker</button>' +
      '<button type="button" data-ais-view="chat">Chat</button>' +
      '</div>' +

      '<section class="ais-view" id="aisView-pregame"><div class="ais-card">' +
      '<h3>Pregame Scout — NFL / NBA</h3>' +
      '<p class="ais-muted">Games come from the public ESPN scoreboard. Matchup notes below are computed from those records only (records, venue, status). Injury and defense-depth detail requires a licensed feed and is shown as unavailable where it cannot be fetched — it is not guessed.</p>' +
      '<div class="ais-row"><select class="ais-in" id="aisLeagueSel"><option value="nfl">NFL</option><option value="nba">NBA</option></select>' +
      '<button class="ais-cta" type="button" id="aisLoadPregame">Load games</button><span class="ais-muted" id="aisPreMeta"></span></div>' +
      '<div id="aisPreList" style="margin-top:10px"></div>' +
      '</div></section>' +

      '<section class="ais-view" id="aisView-live" hidden><div class="ais-card">' +
      '<h3>Live Scout</h3>' +
      '<p class="ais-muted">Live scores/clocks come from the public ESPN scoreboard at fetch time; every refresh is timestamped. In-game player-stat depth and win-probability estimates require a licensed feed and are marked unavailable when not fetched — no estimate is invented.</p>' +
      '<div class="ais-row"><button class="ais-cta" type="button" id="aisLoadLive">Refresh live games</button><span class="ais-muted" id="aisLiveMeta"></span></div>' +
      '<div id="aisLiveList" style="margin-top:10px"></div>' +
      '</div></section>' +

      '<section class="ais-view" id="aisView-markets" hidden><div class="ais-card">' +
      '<h3>Market Comparison</h3>' +
      '<p class="ais-muted">Quotes are fetched live from public endpoints. American odds and implied probability are computed from the quote. DraftKings / Novig: <span class="ais-tag unavail">UNAVAILABLE — no public feed</span>.</p>' +
      '<div class="ais-row"><input class="ais-in" id="aisMktQ" placeholder="Search team, player, or market (e.g. Chiefs)" size="34">' +
      '<button class="ais-cta" type="button" id="aisLoadMarkets">Search markets</button>' +
      '<label class="ais-muted">Your model probability % <input class="ais-in" id="aisModelP" type="number" min="0" max="100" step="0.1" placeholder="e.g. 60" style="width:90px"></label>' +
      '<span class="ais-muted">Edge/EV use YOUR probability only. Blank = UNCALIBRATED.</span></div>' +
      '<div class="ais-row" style="margin-top:8px"><label class="ais-muted"><input type="checkbox" id="aisSampleMode"> Labeled sample mode (SAMPLE rows only — for QA, never presented as real)</label></div>' +
      '<div id="aisMktList" style="margin-top:10px"></div>' +
      '</div>' +
      '<div class="ais-card"><h3>Feed status — checked live in your browser</h3><div id="aisFeedStatus" class="ais-muted">Checking feeds…</div>' +
      '<p class="ais-muted">If a fetch is blocked (network/CORS), that feed shows UNAVAILABLE — it is never filled in.</p></div></section>' +

      '<section class="ais-view" id="aisView-tracker" hidden><div class="ais-card">' +
      '<h3>AI Performance Tracker</h3>' +
      '<p class="ais-muted">Append-only log, stored in this browser only (key <code>ai_scout_tracker_v1</code>) — it never touches your Bet Lab tickets or cloud sync. A logged prediction is never edited; only its outcome is later marked Won / Lost / Void. Win rate, ROI, and calibration are computed from logged entries only.</p>' +
      '<div class="ais-row"><input class="ais-in" id="aisTrkDesc" placeholder="Prediction (e.g. Chiefs moneyline)" size="34">' +
      '<input class="ais-in" id="aisTrkOdds" type="number" step="1" placeholder="American odds" style="width:130px">' +
      '<input class="ais-in" id="aisTrkStake" type="number" step="0.01" min="0" placeholder="Stake $" style="width:110px">' +
      '<button class="ais-cta" type="button" id="aisTrkAdd">Log prediction</button></div>' +
      '<div id="aisTrkStats" style="margin-top:10px"></div>' +
      '<div id="aisTrkList" style="margin-top:10px"></div>' +
      '</div></section>' +

      '<section class="ais-view" id="aisView-chat" hidden><div class="ais-card">' +
      '<h3>AI Scout Chat</h3>' +
      '<p class="ais-muted">Rule-based answers over data this page actually fetched, with source + fetch time on every answer. It says <b>“no value bets”</b> whenever no calibrated edge exists, and it never invents a stat, odd, or probability.</p>' +
      '<div id="aisChatlog"><p class="ais-muted">Ask about a team, player, or market — e.g. “Chiefs”, “Lakers”, or “show me live games”.</p></div>' +
      '<div class="ais-row" style="margin-top:10px"><input class="ais-in" id="aisChatQ" placeholder="Ask AI Scout…" size="46" style="flex:1">' +
      '<button class="ais-cta" type="button" id="aisChatSend">Ask</button></div>' +
      '</div></section>';
    var ws = $('workspace');
    if (ws && ws.parentNode) { ws.parentNode.insertBefore(page, ws.nextSibling); }
    else { (document.querySelector('main.main') || document.body).appendChild(page); }
  }

  /* ---------------- Pregame / Live (ported) ---------------- */
  function wirePregameLive() {
    var lp = $('aisLoadPregame');
    if (lp) lp.addEventListener('click', function () {
      var lg = $('aisLeagueSel').value, box = $('aisPreList'); box.innerHTML = '<p class="ais-muted">Loading…</p>';
      loadGames(lg).then(function (d) {
        var rows = gameRows(d);
        setText('aisPreMeta', 'ESPN ' + lg.toUpperCase() + ' scoreboard · fetched ' + fmtT(state.fetchedAt[lg]) + ' · ' + rows.length + ' games');
        box.innerHTML = rows.length ? '' : '<p class="ais-muted">No games returned for this league right now.</p>';
        rows.forEach(function (g) { box.appendChild(el('div', '<div class="ais-card"><h4>' + esc(g.name) + '</h4><p>' + esc(g.a) + ' — ' + esc(g.b) + '</p><p class="ais-muted">' + esc(g.detail) + (g.venue ? ' · ' + esc(g.venue) : '') + '</p><p class="ais-muted">Grounded note: records/venue/status only. Injury report and defensive-depth analysis: <span class="ais-tag unavail">UNAVAILABLE — licensed feed required, not guessed</span>.</p></div>')); });
      }).catch(function (e) { box.innerHTML = '<p class="ais-muted">ESPN scoreboard UNAVAILABLE (' + esc(e) + '). No games invented.</p>'; });
      refreshFeedStatus();
    });
    var ll = $('aisLoadLive');
    if (ll) ll.addEventListener('click', function () {
      var box = $('aisLiveList'); box.innerHTML = '<p class="ais-muted">Loading…</p>';
      var all = [];
      var jobs = ['nfl', 'nba'].map(function (lg) {
        return loadGames(lg).then(function (d) { gameRows(d).forEach(function (g) { all.push(Object.assign({ lg: lg }, g)); }); }, function () {});
      });
      Promise.all(jobs).then(function () {
        var live = all.filter(function (g) { return g.live; });
        setText('aisLiveMeta', 'Fetched ' + fmtT(now()) + ' · ' + live.length + ' live of ' + all.length + ' games (ESPN status text)');
        box.innerHTML = live.length ? '' : '<p class="ais-muted">No games in progress at fetch time. Player-level live stats and in-game win probability: <span class="ais-tag unavail">UNAVAILABLE — licensed feed required</span>.</p>';
        live.forEach(function (g) { box.appendChild(el('div', '<div class="ais-card"><h4><span class="ais-tag live">LIVE</span> ' + esc(g.name) + ' (' + esc(g.lg.toUpperCase()) + ')</h4><p>' + esc(g.a) + ' — ' + esc(g.b) + '</p><p class="ais-muted">' + esc(g.detail) + ' · fetched ' + fmtT(now()) + '</p></div>')); });
        refreshFeedStatus();
      });
    });
  }

  /* ---------------- Markets view (ported) ---------------- */
  function loadMarkets() {
    var box = $('aisMktList'); if (!box) return Promise.resolve();
    box.innerHTML = '<p class="ais-muted">Loading real markets…</p>';
    var q = (($('aisMktQ') && $('aisMktQ').value) || '').trim().toLowerCase();
    return allMarkets().then(function (mkts) {
      var filt = q ? mkts.filter(function (m) { return m.q.toLowerCase().includes(q); }) : mkts;
      box.innerHTML = filt.length ? '' : '<p class="ais-muted">No matching markets. DraftKings / Novig are UNAVAILABLE (no public feed) and are never substituted with invented odds.</p>';
      filt.slice(0, 50).forEach(function (m) { var d = el('div', marketCard(m)); d.className = 'ais-hotgrid'; d.style.marginBottom = '10px'; box.appendChild(d); });
      wireCards(box); refreshFeedStatus();
    });
  }
  function wireMarkets() {
    var b = $('aisLoadMarkets'); if (b) b.addEventListener('click', loadMarkets);
    var mp = $('aisModelP'); if (mp) mp.addEventListener('change', function () { var s = $('aisView-markets'); if (s && !s.hidden) loadMarkets(); });
    var sm = $('aisSampleMode'); if (sm) sm.addEventListener('change', function () { state.sample = !!sm.checked; loadMarkets(); loadHot(); });
  }

  /* ---------------- Tracker (append-only, browser-local; ported) ---------------- */
  function tload() { try { return JSON.parse(localStorage.getItem(TKEY) || '[]'); } catch (e) { return []; } }
  function tsave(v) { localStorage.setItem(TKEY, JSON.stringify(v)); }
  function renderTracker() {
    var statsEl = $('aisTrkStats'), listEl = $('aisTrkList'); if (!statsEl || !listEl) return;
    var rows = tload();
    var settled = rows.filter(function (r) { return r.outcome !== 'pending'; });
    var wins = settled.filter(function (r) { return r.outcome === 'won'; }).length;
    var staked = settled.reduce(function (s, r) { return s + (r.outcome === 'void' ? 0 : (+r.stake || 0)); }, 0);
    var profit = settled.reduce(function (s, r) { if (r.outcome === 'won') return s + (+r.stake || 0) * (r.odds > 0 ? r.odds / 100 : 100 / Math.abs(r.odds)); if (r.outcome === 'lost') return s - (+r.stake || 0); return s; }, 0);
    statsEl.innerHTML = '<p>Logged: ' + rows.length + ' · Settled: ' + settled.length + ' · Won: ' + wins
      + ' · Win rate: ' + (settled.length ? (100 * wins / settled.length).toFixed(1) + '%' : 'n/a (no settled entries)')
      + ' · Staked: $' + staked.toFixed(2) + ' · Profit: <span class="' + (profit >= 0 ? 'ais-pos' : 'ais-neg') + '">$' + profit.toFixed(2) + '</span>'
      + ' · ROI: ' + (staked ? (100 * profit / staked).toFixed(1) + '%' : 'n/a') + '</p>'
      + '<p class="ais-muted">Calibration: computed only from settled logged entries; with fewer than 10 settled entries no calibration claim is made.</p>';
    listEl.innerHTML = rows.length ? '' : '<p class="ais-muted">No predictions logged yet.</p>';
    rows.slice().reverse().forEach(function (r) {
      var d = el('div', '<div class="ais-card"><p><b>' + esc(r.desc) + '</b> · odds ' + (r.odds > 0 ? '+' : '') + r.odds + ' · stake $' + (+r.stake || 0).toFixed(2)
        + ' · logged ' + fmtT(r.ts) + ' · outcome: <b>' + esc(r.outcome.toUpperCase()) + '</b>' + (r.settledTs ? ' · settled ' + fmtT(r.settledTs) : '') + '</p>'
        + (r.outcome === 'pending' ? '<p class="ais-row"><button class="ais-ghost" type="button" data-settle="' + r.id + '" data-out="won">Mark Won</button><button class="ais-ghost" type="button" data-settle="' + r.id + '" data-out="lost">Mark Lost</button><button class="ais-ghost" type="button" data-settle="' + r.id + '" data-out="void">Mark Void</button></p>' : '') + '</div>');
      d.querySelectorAll('[data-settle]').forEach(function (b) { b.addEventListener('click', function () {
        var v = tload(); var row = v.find(function (x) { return x.id === b.dataset.settle; });
        if (row && row.outcome === 'pending') { row.outcome = b.dataset.out; row.settledTs = now(); tsave(v); renderTracker(); }
      }); });
      listEl.appendChild(d);
    });
  }
  function addPrediction() {
    var desc = ($('aisTrkDesc').value || '').trim(), odds = parseFloat($('aisTrkOdds').value), stake = parseFloat($('aisTrkStake').value);
    if (!desc || isNaN(odds) || isNaN(stake)) { if (typeof window.alert === 'function') window.alert('Enter a prediction, American odds, and a stake before logging.'); return; }
    var v = tload(); v.push({ id: 'S' + now() + Math.floor(Math.random() * 1000), ts: now(), desc: desc, odds: odds, stake: stake, outcome: 'pending', settledTs: null }); tsave(v);
    $('aisTrkDesc').value = ''; $('aisTrkOdds').value = ''; $('aisTrkStake').value = ''; renderTracker();
  }
  function wireTracker() { var b = $('aisTrkAdd'); if (b) b.addEventListener('click', addPrediction); }

  /* ---------------- Chat (rule-based, cites only fetched data; ported) ---------------- */
  function chatAnswer(q) {
    var s = q.toLowerCase();
    var games = ['nfl', 'nba'].map(function (lg) { return state.games[lg] ? gameRows(state.games[lg]).map(function (g) { return Object.assign({ lg: lg }, g); }) : []; }).flat();
    var hit = games.filter(function (g) { return g.name.toLowerCase().includes(s.replace(/[^a-z ]/g, '').trim().split(' ').slice(-1)[0] || '___'); });
    var mkts = state.poly.concat(state.kalshi).filter(function (m) { return m.q.toLowerCase().includes(s.split(' ').find(function (w) { return w.length > 3; }) || '___'); });
    if (/live/.test(s)) return 'Live games at last fetch: ' + (games.filter(function (g) { return g.live; }).map(function (g) { return g.name + ' (' + g.detail + ')'; }).join('; ') || 'none in progress at last ESPN fetch') + '. Source: ESPN scoreboard, fetched ' + fmtT(state.fetchedAt.nfl || state.fetchedAt.nba || now()) + '. Player-level live stats: unavailable (licensed feed required).';
    if (hit.length) return 'Games found: ' + hit.slice(0, 5).map(function (g) { return g.name + ' — ' + g.a + ' / ' + g.b + ' (' + g.detail + ')'; }).join('; ') + '. Source: ESPN ' + hit[0].lg.toUpperCase() + ' scoreboard, fetched ' + fmtT(now()) + '.';
    if (mkts.length) return 'Markets found: ' + mkts.slice(0, 5).map(function (m) { return m.q + ' (' + m.src + ', price ' + m.price.toFixed(2) + ', implied ' + (m.price * 100).toFixed(1) + '%)'; }).join('; ') + '. No model edge is claimed — enter a model probability in Markets to compute edge.';
    return 'No value bets: I have no fetched game or market matching that, and no calibrated model to price one. Load Pregame, Live, or Markets first, or ask about a team in a loaded game. Nothing here is invented to fill the gap.';
  }
  function wireChat() {
    var send = $('aisChatSend');
    if (send) send.addEventListener('click', function () {
      var qIn = $('aisChatQ'); var q = (qIn.value || '').trim(); if (!q) return;
      var log = $('aisChatlog');
      log.appendChild(el('p', '<b>You:</b> ' + esc(q)));
      log.appendChild(el('p', '<b>AI Scout:</b> ' + esc(chatAnswer(q))));
      qIn.value = '';
    });
    var qIn = $('aisChatQ');
    if (qIn) qIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') $('aisChatSend').click(); });
  }

  /* ---------------- dashboard Hot Takes wiring ----------------
   * The panel markup is part of stitch-live.js's STA_MAIN and only
   * exists after stitch mounts (its deferred script runs after this
   * one), so wiring waits for DOMContentLoaded and retries briefly. */
  var hotWired = false;
  function wireHotWidget() {
    if (hotWired) return;
    var grid = $('staHotGrid'); if (!grid) return;
    hotWired = true;
    var rb = $('staHotRefresh'); if (rb) rb.addEventListener('click', function () { state.sample = false; var sm = $('aisSampleMode'); if (sm) sm.checked = false; loadHot(); });
    var va = $('staHotViewAll'); if (va) va.addEventListener('click', function () { showSub('markets'); loadMarkets(); });
    loadHot();
  }
  function armHotWidget() {
    var tries = 0;
    var iv = setInterval(function () {
      tries++;
      wireHotWidget();
      if (hotWired || tries > 40) clearInterval(iv);
    }, 250);
    wireHotWidget();
  }

  /* ---------------- navigation (sportsbooks.js pattern) ---------------- */
  function hideMine() { var elx = $('aiScoutPage'); if (elx) { elx.hidden = true; elx.classList.remove('active'); } }
  function showMine() { hideMine(); var elx = $('aiScoutPage'); if (elx) { elx.hidden = false; elx.classList.add('active'); } }
  function wireNav() {
    if (typeof window.go !== 'function') return;
    var origGo = window.go;
    window.go = function (name) {
      if (name === 'AI Scout') {
        origGo('Dashboard');
        var dash = $('dashboard'); if (dash) dash.classList.remove('active');
        document.querySelectorAll('[data-go]').forEach(function (x) { x.classList.toggle('active', x.dataset.go === 'AI Scout'); });
        showMine();
        window.scrollTo({ top: 0 });
        return;
      }
      hideMine();
      origGo(name);
    };
  }
  function wireSubNav() {
    var page = $('aiScoutPage'); if (!page) return;
    page.querySelectorAll('[data-ais-view]').forEach(function (b) { b.addEventListener('click', function () { showSub(b.dataset.aisView); }); });
  }

  try { injectStyles(); } catch (e) { console.warn('Bet Lab: AI Scout styles skipped', e); }
  try { buildPage(); } catch (e) { console.warn('Bet Lab: AI Scout page build skipped', e); }
  try { wireSubNav(); } catch (e) { console.warn('Bet Lab: AI Scout sub-nav skipped', e); }
  try { wirePregameLive(); } catch (e) { console.warn('Bet Lab: AI Scout pregame/live skipped', e); }
  try { wireMarkets(); } catch (e) { console.warn('Bet Lab: AI Scout markets skipped', e); }
  try { wireTracker(); renderTracker(); } catch (e) { console.warn('Bet Lab: AI Scout tracker skipped', e); }
  try { wireChat(); } catch (e) { console.warn('Bet Lab: AI Scout chat skipped', e); }
  try { wireNav(); } catch (e) { console.warn('Bet Lab: AI Scout nav wiring skipped', e); }
  try { armHotWidget(); } catch (e) { console.warn('Bet Lab: AI Scout hot takes skipped', e); }

  window.BetLabAiScout = { showPage: showMine, hidePage: hideMine, showSub: showSub, refreshHot: loadHot };
})();
