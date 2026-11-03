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
 * cloud-sync, and never touches the tickets table.
 * Matchup sheet (added Nov 3, 2026 at Marquis's request): Pregame and
 * Live game cards are tappable and open a drill-in sheet. Data verified
 * live against ESPN's public endpoints before building: game summary
 * (site v2 /summary?event= — header records, season leaders with
 * athlete ids, standings points-for/against, boxscore for started
 * games) and athlete gamelogs (site.web.api.espn.com common/v3
 * /athletes/{id}/gamelog — stat names aligned with per-game rows plus
 * gameDate metadata). Estimates for not-yet-started games are computed
 * ONLY from a player's own gamelog: 0.6 x season per-game average +
 * 0.4 x last-5-games per-game average, and are labelled ESTIMATES —
 * simple average-based projections, uncalibrated, not a paid model.
 * Started/final games show ACTUAL boxscore lines instead. Any player
 * whose gamelog cannot be fetched renders UNAVAILABLE — a line is
 * never invented.
 * DraftKings via the odds-relay (Nov 3, 2026): game lines AND player
 * props reach this page only through the Bet Lab odds-relay (The Odds
 * API) — see the DraftKings section comment for the full story. Props
 * load ONLY when a matchup sheet opens (one relay call per game,
 * click-to-load, per Marquis's credit-saving design); a persistent
 * credits meter at the top of this page mirrors the relay's
 * x-requests-remaining header into ai_scout_odds_quota_v1 (update-on-
 * use only — the meter never fetches, because a refresh call would
 * burn the very credits it reports). Player-name search in Pregame
 * runs over a local index built from ESPN's FREE roster endpoints,
 * cached in ai_scout_player_index_v1 (24 h TTL); searching makes ZERO
 * relay calls — credits are spent only when a game's sheet opens. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  var TKEY = 'ai_scout_tracker_v1';
  var QKEY = 'ai_scout_odds_quota_v1';
  var PKEY = 'ai_scout_player_index_v1';
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
      var score = function (c) { return c.score != null && c.score !== '' ? c.score : '–'; };
      var st = (e.status || {}).type || {}; var detail = st.detail || st.shortDetail || '';
      var live = !!st.completed === false && (detail && /Q|OT|Half|In Progress/i.test(detail));
      var teams = cs.map(function (c) {
        var rec = (c.records || []).filter(function (r) { return r.type === 'total'; })[0];
        return { id: (c.team || {}).id || '', name: team(c), record: rec ? (rec.summary || '') : '', score: c.score != null && c.score !== '' ? String(c.score) : '', homeAway: c.homeAway || '' };
      });
      return { id: e.id || '', name: cs.map(team).join(' vs '), a: cs[0] ? team(cs[0]) + ' ' + score(cs[0]) : '', b: cs[1] ? team(cs[1]) + ' ' + score(cs[1]) : '', detail: detail, live: live, venue: (comp.venue || {}).fullName || '', date: e.date || '', state: st.state || '', completed: !!st.completed, teams: teams };
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
    sheetCtx = null;
    var sh = $('aisSheet'); if (sh) sh.hidden = true;
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
      '.ais-badge{display:inline-block;padding:2px 8px;border:1px solid #ff6b00;color:#ff8c42;border-radius:999px;font-size:11px;letter-spacing:.08em}' +
      '.ais-game{cursor:pointer}' +
      '.ais-game:hover{border-color:#39FF88}' +
      '.ais-tap{color:#39FF88;font-size:13px;font-weight:600;margin-top:8px}' +
      '.ais-sheetbar{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}' +
      '.ais-estgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:10px;margin-top:8px}' +
      '.ais-player{background:#0d1622;border:1px solid #2c4a63;border-radius:10px;padding:10px}' +
      '.ais-player h5{margin:0 0 4px;font-size:14px;color:#f2f0ff}' +
      '.ais-player p{margin:3px 0;font-size:13px}' +
      '.ais-kpi{font-size:15px}' +
      'table.ais-tbl{border-collapse:collapse;width:100%;font-size:13px;margin-top:6px}' +
      'table.ais-tbl td,table.ais-tbl th{border-bottom:1px solid #2c4a63;padding:5px 6px;text-align:left}' +
      '.ais-meter{margin:0 0 12px}' +
      '.ais-meterbar{height:6px;background:#1c2f45;border-radius:999px;overflow:hidden;margin-top:5px}' +
      '.ais-meterfill{height:100%;background:#39FF88;border-radius:999px}' +
      '.ais-propfilter{margin:8px 0}' +
      '.ais-searchres{display:flex;flex-direction:column;gap:6px;margin-top:8px}' +
      '.ais-searchres .ais-ghost{text-align:left}';
    document.head.appendChild(st);
  }

  function buildPage() {
    if ($('aiScoutPage')) return;
    var page = document.createElement('section');
    page.className = 'content-page'; page.id = 'aiScoutPage'; page.hidden = true;
    page.innerHTML =
      '<h2 style="margin:6px 0">◈ AI Scout</h2>' +
      '<div class="ais-meter" id="aisQuotaMeter"></div>' +
      '<p class="notice">AI Scout reads only public, keyless feeds (ESPN scoreboards · Polymarket and Kalshi public markets). DraftKings and Novig have no public feed, so they always show UNAVAILABLE — odds are never invented to fill a gap. <b>No calibrated model exists yet</b>: rankings use real market activity only, and edge/EV appear only against a model probability you type in yourself.</p>' +
      '<div class="ais-subnav" role="tablist" aria-label="AI Scout sections">' +
      '<button type="button" data-ais-view="pregame" class="on">Pregame</button>' +
      '<button type="button" data-ais-view="live">Live</button>' +
      '<button type="button" data-ais-view="markets">Markets</button>' +
      '<button type="button" data-ais-view="tracker">Performance Tracker</button>' +
      '<button type="button" data-ais-view="chat">Chat</button>' +
      '</div>' +

      '<section class="ais-view" id="aisView-pregame"><div class="ais-card">' +
      '<h3>Find a player — DraftKings props</h3>' +
      '<p class="ais-muted">Type a player name to jump to his game\'s matchup sheet, where DraftKings lines and player props load. Searching is free — it uses a local index built from ESPN rosters and spends <b>zero</b> line credits; credits are used only when a game\'s sheet opens.</p>' +
      '<div class="ais-row"><input class="ais-in" id="aisPlayerQ" placeholder="Player name (e.g. Burrow, Chase, Mahomes)" size="38" autocomplete="off">' +
      '<span class="ais-muted" id="aisPlayerMeta"></span></div>' +
      '<div class="ais-searchres" id="aisPlayerResults"></div>' +
      '</div><div class="ais-card">' +
      '<h3>Pregame Scout — NFL / NBA</h3>' +
      '<p class="ais-muted">Games come from the public ESPN scoreboard. Matchup notes below are computed from those records only (records, venue, status). Injury and defense-depth detail requires a licensed feed and is shown as unavailable where it cannot be fetched — it is not guessed. <b>Tap any game</b> to open its matchup sheet: team comparison plus player estimates computed from each player\'s own game log (formula printed on the sheet).</p>' +
      '<div class="ais-row"><select class="ais-in" id="aisLeagueSel"><option value="nfl">NFL</option><option value="nba">NBA</option></select>' +
      '<button class="ais-cta" type="button" id="aisLoadPregame">Load games</button><span class="ais-muted" id="aisPreMeta"></span></div>' +
      '<div id="aisPreList" style="margin-top:10px"></div>' +
      '</div></section>' +

      '<section class="ais-view" id="aisView-live" hidden><div class="ais-card">' +
      '<h3>Live Scout</h3>' +
      '<p class="ais-muted">Live scores/clocks come from the public ESPN scoreboard at fetch time; every refresh is timestamped. In-game player-stat depth and win-probability estimates require a licensed feed and are marked unavailable when not fetched — no estimate is invented. <b>Tap any live game</b> to open its matchup sheet with the actual player stats from the game so far.</p>' +
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
      '</div></section>' +

      '<section class="ais-view" id="aisSheet" hidden><div class="ais-card">' +
      '<div id="aisSheetBody"><p class="ais-muted">Loading matchup…</p></div>' +
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
        rows.forEach(function (g) { box.appendChild(gameCard(g, lg, 'pregame')); });
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
        live.forEach(function (g) { box.appendChild(gameCard(g, g.lg, 'live', true)); });
        refreshFeedStatus();
      });
    });
  }

  /* ---------------- Matchup sheet (tap-a-game) ----------------
   * Endpoints verified live Nov 3, 2026 (see header note): ESPN game
   * summary + ESPN athlete gamelogs carry every figure below. The
   * DraftKings block is fed by the Bet Lab odds-relay (see the
   * DraftKings section below for why: DK's own feed blocks cloud
   * fetches, so DK lines come from the licensed Odds API aggregator
   * through the relay) — the block stays honest: team match must be
   * confident or it renders the UNAVAILABLE note. */
  var sheetCtx = null; var sheetSeq = 0;
  var SB_URL = { nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl', nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba' };
  var WEB_PATH = { nfl: 'football/nfl', nba: 'basketball/nba' };
  var EST_LABEL = 'ESTIMATES — simple average-based projections, uncalibrated, not a paid model.';
  var EST_FORMULA = 'Formula: estimate = 0.6 × season per-game average + 0.4 × last-5-games per-game average, computed from each player\'s own ESPN game log.';

  function gameCard(g, lg, fromView, isLiveList) {
    var d = el('div', '<div class="ais-card ais-game" data-ais-game="' + esc(g.id || '') + '" role="button" tabindex="0" aria-label="Open matchup for ' + esc(g.name) + '">'
      + (isLiveList ? '<h4><span class="ais-tag live">LIVE</span> ' + esc(g.name) + ' (' + esc(lg.toUpperCase()) + ')</h4>' : '<h4>' + esc(g.name) + '</h4>')
      + '<p>' + esc(g.a) + ' — ' + esc(g.b) + '</p>'
      + '<p class="ais-muted">' + esc(g.detail) + (g.venue ? ' · ' + esc(g.venue) : '') + (isLiveList ? ' · fetched ' + fmtT(now()) : '') + '</p>'
      + (fromView === 'pregame' ? '<p class="ais-muted">Grounded note: records/venue/status only. Injury report and defensive-depth analysis: <span class="ais-tag unavail">UNAVAILABLE — licensed feed required, not guessed</span>.</p>' : '')
      + '<p class="ais-tap">Tap for matchup ›</p></div>');
    var card = d.querySelector('.ais-game');
    if (card) {
      var open = function () { if (g.id) openMatchup(g, lg, fromView); };
      card.addEventListener('click', open);
      card.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    }
    return d;
  }
  function sheetHeadHTML(g, lg) {
    var when = '';
    if (g.date) { var dt = new Date(g.date); if (!isNaN(dt.getTime())) when = ' · ' + dt.toLocaleString(); }
    var recs = (g.teams || []).filter(function (t) { return t.record; }).map(function (t) { return esc(t.name) + ' ' + esc(t.record); }).join(' · ');
    return '<div class="ais-sheetbar"><button class="ais-ghost" type="button" id="aisSheetBack">‹ Back to games</button><span class="ais-badge">' + esc(lg.toUpperCase()) + ' MATCHUP</span></div>'
      + '<h3 style="margin:10px 0 4px">' + esc(g.name) + '</h3>'
      + '<p>' + esc(g.a) + ' — ' + esc(g.b) + '</p>'
      + '<p class="ais-muted">' + esc(g.detail) + (g.venue ? ' · ' + esc(g.venue) : '') + when + (recs ? '<br>' + recs : '') + '</p>';
  }
  function wireSheetBack(root) { var b = root.querySelector('#aisSheetBack'); if (b) b.addEventListener('click', closeSheet); }
  function srcLine() { return '<p class="ais-muted" style="margin-top:12px">Sources: ESPN scoreboard, game summary and athlete game logs (public ESPN endpoints) · fetched ' + fmtT(now()) + '. Anything ESPN does not supply is shown as UNAVAILABLE — never filled in.</p>'; }
  function closeSheet() {
    sheetSeq++;
    var from = sheetCtx ? sheetCtx.from : 'pregame';
    sheetCtx = null;
    var sh = $('aisSheet'); if (sh) sh.hidden = true;
    showSub(from === 'live' ? 'live' : 'pregame');
  }
  function openMatchup(g, lg, fromView) {
    if (!$('aiScoutPage')) return;
    var seq = ++sheetSeq;
    sheetCtx = { game: g, lg: lg, from: fromView || 'pregame' };
    ['pregame', 'live', 'markets', 'tracker', 'chat'].forEach(function (n) { var s = $('aisView-' + n); if (s) s.hidden = true; });
    var sheet = $('aisSheet'); if (!sheet) return;
    sheet.hidden = false;
    var body = $('aisSheetBody');
    body.innerHTML = sheetHeadHTML(g, lg) + '<p class="ais-muted">Loading matchup data from ESPN…</p>';
    wireSheetBack(body);
    window.scrollTo({ top: 0 });
    fetchJSON(SB_URL[lg] + '/summary?event=' + encodeURIComponent(g.id)).then(function (sum) {
      if (seq !== sheetSeq) return;
      renderSheet(g, lg, sum, seq);
    }).catch(function (e) {
      if (seq !== sheetSeq) return;
      body.innerHTML = sheetHeadHTML(g, lg) + '<p class="ais-muted">Matchup data <span class="ais-tag unavail">UNAVAILABLE</span> — the ESPN game summary could not be fetched (' + esc(e) + '). Nothing has been filled in.</p>' + srcLine();
      wireSheetBack(body);
    });
  }
  function pfpaMap(sum) {
    var raw = {};
    try {
      ((((sum || {}).standings || {}).groups) || []).forEach(function (gr) {
        (((gr.standings || {}).entries) || []).forEach(function (en) {
          var st = {}; (en.stats || []).forEach(function (s) { st[s.name] = parseFloat(s.displayValue); });
          if (!isNaN(st.pointsFor) && !isNaN(st.pointsAgainst)) {
            var gp = (!isNaN(st.wins) && !isNaN(st.losses)) ? st.wins + st.losses + (isNaN(st.ties) ? 0 : st.ties) : 0;
            raw[en.team] = { pf: st.pointsFor, pa: st.pointsAgainst, gp: gp };
          }
        });
      });
    } catch (e) {}
    return { get: function (full) { for (var k in raw) { if (full === k || full.indexOf(k + ' ') === 0 || full.split(' ').slice(-1)[0] === k) return raw[k]; } return null; } };
  }
  function teamCompareHTML(g, sum) {
    if (!g.teams || !g.teams.length) return '';
    var pf = pfpaMap(sum);
    var rows = g.teams.map(function (t) {
      var s = pf.get(t.name);
      return '<tr><td><b>' + esc(t.name) + '</b></td><td>' + esc(t.record || '—') + '</td><td>' + (s && s.gp ? (s.pf / s.gp).toFixed(1) : '—') + '</td><td>' + (s && s.gp ? (s.pa / s.gp).toFixed(1) : '—') + '</td></tr>';
    }).join('');
    return '<h4>Team comparison</h4><table class="ais-tbl"><tr><th>Team</th><th>Record</th><th>Pts scored / game</th><th>Pts allowed / game</th></tr>' + rows + '</table>'
      + '<p class="ais-muted">Points per game are computed from ESPN standings totals (points for / against ÷ games played) when the game summary supplies them; a dash means ESPN did not supply the figure — it is not estimated.</p>';
  }
  function statMap(keys, stats) { var m = {}; (keys || []).forEach(function (k, i) { m[k] = stats ? stats[i] : undefined; }); return m; }
  function num(v) { var n = parseFloat(v); return isNaN(n) ? null : n; }
  function actualsHTML(sum, lg) {
    var teams = (((sum || {}).boxscore || {}).players) || [];
    if (!teams.length) return '<h4>Player stats — ACTUAL</h4><p class="ais-muted">Box score <span class="ais-tag unavail">UNAVAILABLE</span> from ESPN for this game yet — no player lines are shown rather than invented.</p>';
    var html = '<h4>Player stats — ACTUAL (this game, from the ESPN box score)</h4>';
    teams.forEach(function (tp) {
      var lines = [];
      (tp.statistics || []).forEach(function (grp) {
        var keys = grp.labels || grp.names || [];
        var rowsA = (grp.athletes || []).map(function (a) { return { name: (a.athlete || {}).displayName || '', m: statMap(keys, a.stats) }; });
        if (lg === 'nfl') {
          var ydIdx = keys.indexOf('YDS');
          rowsA.sort(function (x, y) { return (num(y.m.YDS) || 0) - (num(x.m.YDS) || 0); });
          if (grp.name === 'passing') rowsA.slice(0, 1).forEach(function (r) { lines.push(esc(r.name) + ' — ' + esc(r.m['C/ATT'] || '–') + ' passing · ' + esc(r.m.YDS || '–') + ' pass yds · ' + esc(r.m.TD || '0') + ' TD'); });
          else if (grp.name === 'rushing') rowsA.slice(0, 2).forEach(function (r) { lines.push(esc(r.name) + ' — ' + esc(r.m.CAR || '–') + ' car · ' + esc(r.m.YDS || '–') + ' rush yds · ' + esc(r.m.TD || '0') + ' TD'); });
          else if (grp.name === 'receiving') rowsA.slice(0, 3).forEach(function (r) { lines.push(esc(r.name) + ' — ' + esc(r.m.REC || '–') + ' rec · ' + esc(r.m.YDS || '–') + ' rec yds · ' + esc(r.m.TD || '0') + ' TD · ' + esc(r.m.TGTS || '–') + ' targets'); });
        } else {
          rowsA.sort(function (x, y) { return (num(y.m.PTS) || 0) - (num(x.m.PTS) || 0); });
          rowsA.slice(0, 3).forEach(function (r) { lines.push(esc(r.name) + ' — ' + esc(r.m.PTS || '–') + ' pts · ' + esc(r.m.REB || '–') + ' reb · ' + esc(r.m.AST || '–') + ' ast · ' + esc(r.m.MIN || '–') + ' min'); });
          lines = lines.slice(0, 3);
        }
        void ydIdx;
      });
      html += '<p style="margin:10px 0 2px"><b>' + esc((tp.team || {}).displayName || '') + '</b></p>' + (lines.length ? lines.map(function (l) { return '<p>' + l + '</p>'; }).join('') : '<p class="ais-muted">No player lines in the box score yet.</p>');
    });
    return html;
  }
  function glData(gl) {
    if (!gl || !gl.names || !gl.seasonTypes) return null;
    var byId = {}; var meta = gl.events || {};
    gl.seasonTypes.forEach(function (st) {
      if (!/regular season/i.test(st.displayName || '')) return;
      (st.categories || []).forEach(function (c) {
        if (c.type && c.type !== 'event') return;
        (c.events || []).forEach(function (ev) { if (ev.eventId && !byId[ev.eventId]) byId[ev.eventId] = ev.stats || []; });
      });
    });
    var ids = Object.keys(byId);
    if (!ids.length) return null;
    var rows = ids.map(function (id) { return { id: id, date: (meta[id] && meta[id].gameDate) ? Date.parse(meta[id].gameDate) : 0, stats: byId[id] }; });
    rows.sort(function (a, b) { return b.date - a.date; });
    return { names: gl.names, rows: rows };
  }
  function avgOf(rows, idx, cap) {
    var vals = [];
    for (var i = 0; i < rows.length && vals.length < cap; i++) { var v = parseFloat(rows[i].stats[idx]); if (!isNaN(v)) vals.push(v); }
    if (!vals.length) return null;
    return { avg: vals.reduce(function (a, b) { return a + b; }, 0) / vals.length, n: vals.length };
  }
  function estimateFor(gl, statName) {
    var data = glData(gl); if (!data) return null;
    var idx = data.names.indexOf(statName); if (idx < 0) return null;
    var season = avgOf(data.rows, idx, data.rows.length);
    var last5 = avgOf(data.rows, idx, 5);
    if (!season || !last5) return null;
    return { est: 0.6 * season.avg + 0.4 * last5.avg, season: season.avg, last5: last5.avg, games: season.n };
  }
  function estSpecs(lg, kind) {
    if (lg === 'nba') return [{ key: 'points', label: 'pts', dec: 1 }, { key: 'totalRebounds', label: 'reb', dec: 1 }, { key: 'assists', label: 'ast', dec: 1 }];
    if (kind === 'qb') return [{ key: 'passingYards', label: 'pass yds', dec: 0 }];
    if (kind === 'rb') return [{ key: 'rushingAttempts', label: 'rush att', dec: 1 }, { key: 'rushingYards', label: 'rush yds', dec: 0 }, { key: 'receptions', label: 'rec', dec: 1 }, { key: 'receivingYards', label: 'rec yds', dec: 0 }];
    return [{ key: 'receptions', label: 'rec', dec: 1 }, { key: 'receivingYards', label: 'rec yds', dec: 0 }];
  }
  function fmtEst(v, dec) { return dec === 0 ? String(Math.round(v)) : v.toFixed(1); }
  function leaderCands(sum, lg) {
    var out = {};
    (((sum || {}).leaders) || []).forEach(function (tp) {
      var team = (tp.team || {}).displayName || '';
      var list = [];
      (tp.leaders || []).forEach(function (cat) {
        var first = (cat.leaders || [])[0];
        if (!first || !first.athlete || !first.athlete.id) return;
        var nm = (cat.name || '') + ' ' + (cat.displayName || '');
        var kind = null;
        if (lg === 'nfl') { if (/passing/i.test(nm)) kind = 'qb'; else if (/rushing/i.test(nm)) kind = 'rb'; else if (/receiving/i.test(nm)) kind = 'wr'; }
        else kind = 'nba';
        if (kind && !list.some(function (p) { return p.id === String(first.athlete.id); })) list.push({ id: String(first.athlete.id), name: first.athlete.displayName || '', kind: kind });
      });
      if (team) out[team] = list;
    });
    return out;
  }
  function renderEstimates(g, lg, sum, seq) {
    var cands = leaderCands(sum, lg);
    var teams = (g.teams || []).map(function (t) { return t.name; });
    var jobs = teams.map(function (tname) {
      var list = cands[tname] || [];
      if (!list.length) return Promise.resolve('<h4>' + esc(tname) + '</h4><div class="ais-estgrid"><div class="ais-player"><h5>' + esc(tname) + '</h5><p class="ais-muted">Season leaders <span class="ais-tag unavail">UNAVAILABLE</span> from ESPN for this team — no estimates shown.</p></div></div>');
      return Promise.all(list.map(function (p) {
        return fetchJSON('https://site.web.api.espn.com/apis/common/v3/sports/' + WEB_PATH[lg] + '/athletes/' + encodeURIComponent(p.id) + '/gamelog?region=us&lang=en').then(function (gl) {
          var parts = []; var any = false;
          estSpecs(lg, p.kind).forEach(function (sp) {
            var e = estimateFor(gl, sp.key);
            if (e) { any = true; parts.push(esc(sp.label) + ' <b class="ais-kpi">' + fmtEst(e.est, sp.dec) + '</b> <span class="ais-muted">(season ' + fmtEst(e.season, sp.dec) + '/g · last 5 ' + fmtEst(e.last5, sp.dec) + '/g · ' + e.games + ' games)</span>'); }
          });
          if (!any) return '<div class="ais-player"><h5>' + esc(p.name) + '</h5><p class="ais-muted">Game log <span class="ais-tag unavail">UNAVAILABLE</span> — no estimate shown for this player.</p></div>';
          return '<div class="ais-player"><h5>' + esc(p.name) + '</h5><p>' + parts.join('<br>') + '</p></div>';
        }).catch(function () {
          return '<div class="ais-player"><h5>' + esc(p.name) + '</h5><p class="ais-muted">Game log <span class="ais-tag unavail">UNAVAILABLE</span> — no estimate shown for this player.</p></div>';
        });
      })).then(function (cards) { return '<h4>' + esc(tname) + '</h4><div class="ais-estgrid">' + cards.join('') + '</div>'; });
    });
    Promise.all(jobs).then(function (secs) {
      if (seq !== sheetSeq || !sheetCtx) return;
      var est = $('aisEstBlock'); if (!est) return;
      est.innerHTML = '<p><span class="ais-badge">' + EST_LABEL + '</span></p><p class="ais-muted">' + EST_FORMULA + ' Players shown: each team\'s ESPN season leaders (NFL: passing / rushing / receiving leaders; NBA: points / assists / rebounds leaders).</p>' + secs.join('');
    });
  }
  /* DraftKings block: DK lines arrive through the Bet Lab odds-relay
   * (Supabase Edge Function), verified LIVE Nov 3, 2026 — POST
   * {"league":"nfl"} returned HTTP 200 with 15 NFL events carrying
   * real DraftKings h2h / spreads / totals, plus The Odds API quota
   * headers x-requests-remaining / x-requests-used. Why a relay:
   * DraftKings' own feed blocks cloud fetches outright (Akamai 403
   * for every server-side attempt during the Nov 3 build, and no
   * CORS grant for browser reads), so the relay fetches the licensed
   * aggregator (The Odds API, which republishes DK lines)
   * server-side; this page only calls the relay with the public
   * publishable key, exactly like the Polymarket/Kalshi modules.
   * Relay payload = The Odds API v4 shape: an array of events, each
   * with home_team / away_team and a bookmakers[] entry keyed
   * "draftkings" whose markets[] (h2h / spreads / totals) carry
   * outcomes {name, price (American), point}. A sheet game renders
   * numbers only on a confident match: BOTH of its teams must match
   * one event's home/away pair, by full normalized name or by
   * last-word nickname fallback — never a nearest guess. The
   * percentages shown are implied probability computed from the odds
   * via impliedFromOdds (the "lines and percents" view Marquis
   * approved), NOT DraftKings betting splits — no licensed feed
   * sells DK splits, and none are shown or invented here.
   * PLAYER PROPS (relay v2, live-verified Nov 3, 2026): POST
   * {"league":..., "eventId": <the matched slate event's id>} returns
   * that ONE game's per-event object; its draftkings markets are the
   * server-pinned prop markets (NFL: player_pass_yds /
   * player_rush_yds / player_reception_yds / player_anytime_td; NBA:
   * player_points / player_rebounds / player_assists /
   * player_threes) whose outcomes are {name: "Over"|"Under"|"Yes",
   * description: "<Player>", point, price}. NFL props verified live
   * (Bengals @ Falcons: Burrow pass O/U 276.5 -113/-111; Bijan
   * anytime TD -255). NBA props: relay + endpoint verified, but The
   * Odds API returned EMPTY bookmakers for both of tonight's games at
   * verification time (props not posted yet upstream, zero credits
   * charged) — the sub-block renders its honest unavailable line
   * whenever the draftkings entry or a market is absent. Props load
   * ONLY on sheet open (click-to-load — nothing prefetches them),
   * one call per game, per Marquis's credit-saving design.
   * CREDITS METER: every relay response's x-requests-remaining (and
   * x-requests-used when present) is persisted to
   * ai_scout_odds_quota_v1 and re-renders the meter pinned above this
   * page's sub-nav. The header is the only source of truth: a higher
   * later value (monthly reset, key swap) is simply adopted; the
   * meter itself NEVER fetches (an odds call would burn the credits
   * it reports) and never decrements locally. */
  var ODDS_RELAY_URL = 'https://shnnefxhunroluelghbv.supabase.co/functions/v1/odds-relay';
  var ODDS_ANON_KEY = 'sb_publishable_RoFhq3z2j5rJQjUUrTEIkg_Gm4fkaG4';
  function dkNorm(s) { return String(s || '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\s+/g, ' ').trim(); }
  function dkNick(s) { var p = dkNorm(s).split(' '); return p[p.length - 1] || ''; }
  function dkTeamEq(a, b) {
    if (!a || !b) return false;
    if (dkNorm(a) === dkNorm(b)) return true;
    var na = dkNick(a), nb = dkNick(b);
    return na.length > 2 && na === nb;
  }
  function dkSigned(n) { n = Number(n); return n > 0 ? '+' + n : '' + n; }
  function dkPct(price) { return impliedFromOdds(Number(price)).toFixed(1) + '%'; }
  function relayHdr(r, name) { try { return r.headers && typeof r.headers.get === 'function' ? r.headers.get(name) : null; } catch (e) { return null; } }
  function dkFetchRelay(bodyObj, ms) {
    if (typeof fetch !== 'function') return Promise.reject(new Error('fetch unavailable in this browser'));
    var c = new AbortController(); var t = setTimeout(function () { c.abort(); }, ms || 12000);
    return fetch(ODDS_RELAY_URL, {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + ODDS_ANON_KEY, 'apikey': ODDS_ANON_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj),
      signal: c.signal
    }).then(function (r) {
      var quota = { remaining: relayHdr(r, 'x-requests-remaining'), used: relayHdr(r, 'x-requests-used') };
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json().then(function (data) {
        noteQuota(quota.remaining, quota.used);
        return { data: data, remaining: quota.remaining };
      });
    }).finally(function () { clearTimeout(t); });
  }
  /* Credits meter: persists the relay's quota headers (the API is the
   * source of truth — a higher later value is adopted as-is) and
   * renders the meter at the top of the AI Scout page. Update-on-use
   * only; this code path never triggers a fetch. */
  function quotaLoad() { try { var q = JSON.parse(localStorage.getItem(QKEY) || 'null'); return q && typeof q.remaining === 'number' ? q : null; } catch (e) { return null; } }
  function noteQuota(remaining, used) {
    var rem = remaining == null || remaining === '' ? NaN : Number(remaining);
    if (isNaN(rem)) return;
    var usd = used == null || used === '' ? NaN : Number(used);
    try { localStorage.setItem(QKEY, JSON.stringify({ remaining: rem, used: isNaN(usd) ? null : usd, seenAt: now() })); } catch (e) {}
    renderQuotaMeter();
  }
  function renderQuotaMeter() {
    var n = $('aisQuotaMeter'); if (!n) return;
    var q = quotaLoad();
    if (!q) {
      n.innerHTML = '<p style="margin:0">DK line credits: — / 500 left this month</p><div class="ais-meterbar"><div class="ais-meterfill" style="width:0%"></div></div><p class="ais-muted" style="margin:4px 0 0">loads when you view a game\'s lines · resets monthly</p>';
      return;
    }
    var pct = Math.max(0, Math.min(100, q.remaining / 500 * 100));
    var asOf = '';
    if (q.seenAt) { var dt = new Date(q.seenAt); if (!isNaN(dt.getTime())) asOf = ' · as of ' + dt.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }); }
    n.innerHTML = '<p style="margin:0">DK line credits: <b>' + q.remaining + ' / 500</b> left this month</p><div class="ais-meterbar"><div class="ais-meterfill" style="width:' + pct.toFixed(1) + '%"></div></div><p class="ais-muted" style="margin:4px 0 0">updates when lines/props load' + asOf + ' · resets monthly</p>';
  }
  function dkMatch(events, g) {
    try {
      var t0 = (g.teams[0] || {}).name, t1 = (g.teams[1] || {}).name;
      if (!t0 || !t1 || !Array.isArray(events)) return null;
      var ev = null;
      events.forEach(function (e) {
        if (ev || !e) return;
        var pair = (dkTeamEq(t0, e.home_team) && dkTeamEq(t1, e.away_team)) || (dkTeamEq(t0, e.away_team) && dkTeamEq(t1, e.home_team));
        if (pair) ev = e;
      });
      if (!ev) return null;
      var bk = (ev.bookmakers || []).filter(function (b) { return b && b.key === 'draftkings'; })[0];
      if (!bk) return null;
      var res = { id: ev.id || '', spread: null, total: null, ml: null };
      (bk.markets || []).forEach(function (m) {
        if (!m || !Array.isArray(m.outcomes) || !m.outcomes.length) return;
        if (m.key === 'spreads' && !res.spread) res.spread = m.outcomes;
        else if (m.key === 'totals' && !res.total) res.total = m.outcomes;
        else if (m.key === 'h2h' && !res.ml) res.ml = m.outcomes;
      });
      if (!res.spread && !res.total && !res.ml) return null;
      return res;
    } catch (e) { return null; }
  }
  function dkUnavailableHTML() {
    return '<h4>DraftKings line</h4><p class="ais-muted">DraftKings: <span class="ais-tag unavail">UNAVAILABLE</span> — the odds relay could not return DraftKings lines for this game, so no line is shown here rather than a guessed one. Market data only — DraftKings is not one of your betting channels.</p>';
  }
  var PROP_HEADS = { player_pass_yds: 'Passing Yards', player_rush_yds: 'Rushing Yards', player_reception_yds: 'Reception Yards', player_anytime_td: 'Anytime TD', player_points: 'Points', player_rebounds: 'Rebounds', player_assists: 'Assists', player_threes: 'Threes' };
  function propsUnavailableHTML() {
    return '<h4>DraftKings player props</h4><p class="ais-muted">Player props unavailable for this game — DraftKings has not posted them (or the relay could not return them), so no prop lines are shown rather than guessed ones.</p>';
  }
  function renderProps(evObj, seq) {
    var sub = $('aisDkProps'); if (!sub) return;
    var bk = ((evObj && evObj.bookmakers) || []).filter(function (b) { return b && b.key === 'draftkings'; })[0];
    if (!bk || !Array.isArray(bk.markets) || !bk.markets.length) { sub.innerHTML = propsUnavailableHTML(); return; }
    var html = '<h4>DraftKings player props</h4>'
      + '<div class="ais-propfilter"><input class="ais-in" id="aisPropFilter" placeholder="Filter these props by player name — free, no credits" size="40" autocomplete="off"></div>';
    var any = false;
    bk.markets.forEach(function (m) {
      if (!m || !Array.isArray(m.outcomes) || !m.outcomes.length) return;
      var head = PROP_HEADS[m.key] || m.key;
      if (m.key === 'player_anytime_td') {
        var tds = m.outcomes.filter(function (o) { return o && o.description && /^yes$/i.test(o.name || ''); })
          .sort(function (a, b) { return Number(a.price) - Number(b.price); }).slice(0, 10);
        if (!tds.length) return;
        any = true;
        html += '<h5 style="margin:10px 0 4px">' + esc(head) + '</h5>' + tds.map(function (o) {
          return '<p data-prop-player="' + esc(dkNorm(o.description)) + '">' + esc(o.description) + ' — Yes ' + dkSigned(o.price) + ' (' + dkPct(o.price) + ')</p>';
        }).join('');
        return;
      }
      var byPlayer = {};
      m.outcomes.forEach(function (o) {
        if (!o || !o.description) return;
        var p = byPlayer[o.description] || (byPlayer[o.description] = { name: o.description, point: o.point, over: null, under: null });
        if (/^over$/i.test(o.name || '')) { p.over = o; p.point = o.point; }
        else if (/^under$/i.test(o.name || '')) { p.under = o; p.point = o.point; }
      });
      var players = Object.keys(byPlayer).map(function (k) { return byPlayer[k]; })
        .filter(function (p) { return p.over || p.under; })
        .sort(function (a, b) { return (Number(b.point) || 0) - (Number(a.point) || 0); }).slice(0, 10);
      if (!players.length) return;
      any = true;
      html += '<h5 style="margin:10px 0 4px">' + esc(head) + '</h5>' + players.map(function (p) {
        var parts = [];
        if (p.over) parts.push('Over ' + dkSigned(p.over.price) + ' (' + dkPct(p.over.price) + ')');
        if (p.under) parts.push('Under ' + dkSigned(p.under.price) + ' (' + dkPct(p.under.price) + ')');
        return '<p data-prop-player="' + esc(dkNorm(p.name)) + '">' + esc(p.name) + ' — O/U ' + p.point + ': ' + parts.join(' · ') + '</p>';
      }).join('');
    });
    if (!any) { sub.innerHTML = propsUnavailableHTML(); return; }
    sub.innerHTML = html;
    var f = $('aisPropFilter');
    if (f) f.addEventListener('input', function () {
      var q = dkNorm(f.value);
      sub.querySelectorAll('[data-prop-player]').forEach(function (row) {
        row.style.display = !q || row.getAttribute('data-prop-player').includes(q) ? '' : 'none';
      });
    });
  }
  function renderDK(g, lg, seq) {
    dkFetchRelay({ league: lg }, 12000).then(function (out) {
      if (seq !== sheetSeq || !sheetCtx) return;
      var blk = $('aisDkBlock'); if (!blk) return;
      var m = dkMatch(out.data, g);
      if (!m) { blk.innerHTML = dkUnavailableHTML(); return; }
      var rows = '';
      if (m.ml) rows += '<p>Moneyline: ' + m.ml.map(function (o) { return esc(o.name) + ' ' + dkSigned(o.price) + ' (' + dkPct(o.price) + ')'; }).join(' · ') + '</p>';
      if (m.spread) rows += '<p>Spread: ' + m.spread.map(function (o) { return esc(o.name) + ' ' + dkSigned(o.point) + ' (' + dkSigned(o.price) + ' · ' + dkPct(o.price) + ')'; }).join(' · ') + '</p>';
      if (m.total) rows += '<p>Total: ' + m.total.map(function (o) { return esc(o.name) + ' ' + o.point + ' (' + dkSigned(o.price) + ' · ' + dkPct(o.price) + ')'; }).join(' · ') + '</p>';
      var src = 'DraftKings line · via The Odds API · fetched ' + fmtT(now());
      if (out.remaining != null && out.remaining !== '') src += ' · free credits left: ' + esc(out.remaining);
      blk.innerHTML = '<h4>DraftKings line</h4>' + rows + '<p class="ais-muted" id="aisDkSrc">' + src + '. Market data only — DraftKings is not one of your betting channels.</p>'
        + (m.id ? '<div id="aisDkProps"><h4>DraftKings player props</h4><p class="ais-muted">Loading player props for this game…</p></div>' : '<div id="aisDkProps">' + propsUnavailableHTML() + '</div>');
      if (m.id) {
        dkFetchRelay({ league: lg, eventId: m.id }, 12000).then(function (pout) {
          if (seq !== sheetSeq || !sheetCtx) return;
          renderProps(pout.data, seq);
          var srcEl = $('aisDkSrc');
          if (srcEl && pout.remaining != null && pout.remaining !== '') {
            var s2 = 'DraftKings line · via The Odds API · fetched ' + fmtT(now()) + ' · free credits left: ' + esc(pout.remaining);
            srcEl.textContent = s2 + '. Market data only — DraftKings is not one of your betting channels.';
          }
        }).catch(function () {
          if (seq !== sheetSeq || !sheetCtx) return;
          var sub = $('aisDkProps'); if (sub) sub.innerHTML = propsUnavailableHTML();
        });
      }
    }).catch(function () {
      if (seq !== sheetSeq || !sheetCtx) return;
      var blk = $('aisDkBlock'); if (blk) blk.innerHTML = dkUnavailableHTML();
    });
  }

  /* ---------------- Player-name search (zero Odds API credits) ----
   * Index: ESPN's FREE roster endpoints (site v2 /teams/{id}/roster,
   * verified live Nov 3, 2026 — NFL returns athletes grouped by unit
   * with items[]; NBA returns a flat athletes[]; both carry
   * displayName + position). Built lazily on first search focus from
   * the teams in the CURRENT scoreboards (both leagues), mapping
   * player -> team -> that team's game in the current slate, and
   * cached in ai_scout_player_index_v1 for 24 h. Search keystrokes
   * and result renders make ZERO relay calls — the fetch spy in the
   * test suite proves it; credits are spent only when the tapped
   * game's sheet opens (its lines + props), exactly like tapping the
   * game card directly. */
  var PLAYER_TTL_MS = 24 * 60 * 60 * 1000;
  var playerIdx = null; var playerIdxAt = 0; var playerIdxBuilding = null;
  var ROSTER_URL = { nfl: 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/teams/', nba: 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/teams/' };
  function playerIdxLoad() {
    try {
      var raw = JSON.parse(localStorage.getItem(PKEY) || 'null');
      if (raw && Array.isArray(raw.players) && raw.at && now() - raw.at < PLAYER_TTL_MS) { playerIdx = raw.players; playerIdxAt = raw.at; return playerIdx; }
    } catch (e) {}
    return null;
  }
  function rosterPlayers(r) {
    var out = [];
    var pushAth = function (a) { if (a && a.displayName) out.push({ name: a.displayName, pos: (a.position && a.position.abbreviation) || '' }); };
    ((r && r.athletes) || []).forEach(function (grp) {
      if (grp && Array.isArray(grp.items)) grp.items.forEach(pushAth);
      else pushAth(grp);
    });
    return out;
  }
  function buildPlayerIndex() {
    if (playerIdx) return Promise.resolve(playerIdx);
    if (playerIdxBuilding) return playerIdxBuilding;
    playerIdxBuilding = Promise.all(['nfl', 'nba'].map(function (lg) {
      var ready = state.games[lg] ? Promise.resolve(state.games[lg]) : loadGames(lg).catch(function () { return null; });
      return ready.then(function (d) {
        if (!d) return [];
        var rows = gameRows(d);
        var seen = {}; var jobs = [];
        rows.forEach(function (g) {
          (g.teams || []).forEach(function (t) {
            if (!t.id || seen[t.id]) return;
            seen[t.id] = 1;
            jobs.push(fetchJSON(ROSTER_URL[lg] + encodeURIComponent(t.id) + '/roster').then(function (r) {
              return rosterPlayers(r).map(function (p) {
                return { name: p.name, pos: p.pos, team: t.name, teamId: t.id, league: lg, eventId: g.id, gameName: g.name };
              });
            }).catch(function () { return []; }));
          });
        });
        return Promise.all(jobs).then(function (lists) { return lists.flat(); });
      });
    })).then(function (per) {
      playerIdx = per.flat();
      playerIdxAt = now();
      try { localStorage.setItem(PKEY, JSON.stringify({ at: playerIdxAt, players: playerIdx })); } catch (e) {}
      playerIdxBuilding = null;
      return playerIdx;
    }).catch(function () { playerIdxBuilding = null; return []; });
    return playerIdxBuilding;
  }
  function findGameFor(entry) {
    var d = state.games[entry.league];
    if (d) {
      var rows = gameRows(d);
      var byEvent = rows.filter(function (g) { return g.id === entry.eventId; })[0];
      if (byEvent) return byEvent;
      var byTeam = rows.filter(function (g) { return (g.teams || []).some(function (t) { return t.id === entry.teamId; }); })[0];
      if (byTeam) return byTeam;
    }
    return null;
  }
  function wirePlayerSearch() {
    var inp = $('aisPlayerQ'); if (!inp) return;
    var resBox = $('aisPlayerResults'), meta = $('aisPlayerMeta');
    playerIdxLoad();
    var ensure = function () {
      if (playerIdx) { if (meta) meta.textContent = playerIdx.length + ' players indexed (ESPN rosters · free)'; return; }
      if (meta) meta.textContent = 'Building the player index from ESPN rosters (free)…';
      buildPlayerIndex().then(function (list) {
        if (meta) meta.textContent = list.length ? list.length + ' players indexed (ESPN rosters · free)' : 'Player index unavailable — rosters could not be fetched.';
        if ((inp.value || '').trim().length >= 3) render();
      });
    };
    var render = function () {
      if (!resBox) return;
      var q = dkNorm(inp.value);
      if (q.length < 3) { resBox.innerHTML = ''; return; }
      if (!playerIdx) { ensure(); resBox.innerHTML = '<p class="ais-muted">Index is building — results will appear here.</p>'; return; }
      var hits = playerIdx.filter(function (p) { return dkNorm(p.name).includes(q); }).slice(0, 8);
      resBox.innerHTML = hits.length ? '' : '<p class="ais-muted">No player in the current slates matches that name. Nothing was fetched — try a different spelling.</p>';
      hits.forEach(function (p) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'ais-ghost';
        b.textContent = p.name + (p.pos ? ' · ' + p.pos : '') + ' — ' + p.team + ' (' + p.league.toUpperCase() + ') · ' + p.gameName + ' ›';
        b.addEventListener('click', function () {
          var openIt = function () {
            var g = findGameFor(p);
            if (g) { openMatchup(g, p.league, 'pregame'); return true; }
            return false;
          };
          if (openIt()) return;
          loadGames(p.league).then(function () {
            if (!openIt() && meta) meta.textContent = 'That team has no game in the current slate — the sheet cannot open.';
          }).catch(function () {});
        });
        resBox.appendChild(b);
      });
    };
    inp.addEventListener('focus', ensure);
    inp.addEventListener('input', render);
  }
  function renderSheet(g, lg, sum, seq) {
    var body = $('aisSheetBody'); if (!body) return;
    var started = g.state === 'in' || g.state === 'post' || g.completed;
    var html = sheetHeadHTML(g, lg) + teamCompareHTML(g, sum);
    if (started) html += '<div id="aisActBlock">' + actualsHTML(sum, lg) + '</div>';
    else html += '<div id="aisEstBlock"><p class="ais-muted">Loading player estimates from ESPN game logs…</p></div>';
    if (!started || g.state === 'in') html += '<div id="aisDkBlock"><h4>DraftKings line</h4><p class="ais-muted">Loading DraftKings market data…</p></div>';
    html += srcLine();
    body.innerHTML = html;
    wireSheetBack(body);
    if (!started) renderEstimates(g, lg, sum, seq);
    if (!started || g.state === 'in') renderDK(g, lg, seq);
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
  try { renderQuotaMeter(); } catch (e) { console.warn('Bet Lab: AI Scout quota meter skipped', e); }
  try { wirePlayerSearch(); } catch (e) { console.warn('Bet Lab: AI Scout player search skipped', e); }
  try { wirePregameLive(); } catch (e) { console.warn('Bet Lab: AI Scout pregame/live skipped', e); }
  try { wireMarkets(); } catch (e) { console.warn('Bet Lab: AI Scout markets skipped', e); }
  try { wireTracker(); renderTracker(); } catch (e) { console.warn('Bet Lab: AI Scout tracker skipped', e); }
  try { wireChat(); } catch (e) { console.warn('Bet Lab: AI Scout chat skipped', e); }
  try { wireNav(); } catch (e) { console.warn('Bet Lab: AI Scout nav wiring skipped', e); }
  try { armHotWidget(); } catch (e) { console.warn('Bet Lab: AI Scout hot takes skipped', e); }

  window.BetLabAiScout = { showPage: showMine, hidePage: hideMine, showSub: showSub, refreshHot: loadHot, openMatchup: openMatchup, closeSheet: closeSheet };
})();
