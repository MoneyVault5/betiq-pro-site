// BetIQ Pro — MVP app logic (vanilla JS, ES module)
// Data: localStorage key 'betiq_v1'. All money/analytics math lives in
// settlement.mjs (shared with the Node tests) — nothing is computed ad hoc here.
// HONESTY: seeded tickets below are the verified ground-truth fixtures from
// test-slips/fixtures.json (read off Marquis's 4 screenshots, 2026-11-01).
// The design reference's numbers ($2,847.60 profit, 1,189 bets, player hit
// rates) are mockup filler and are NEVER used. Novig's $57.46 portfolio
// header is an account value, not a ticket, and is not seeded anywhere.
import {


  computeStats, profitForTicket, generateInsights, applySettlement,
  detectDuplicateTicket, wilsonInterval,
} from './settlement.mjs';
import { applyLiveSnapshot, migrateState } from './live-data.mjs';
import { polymarketSeedPositions, ensurePositions } from './positions.mjs';
import { applyVerifiedGrade, applyVerifiedGradesToState } from './verified-grades.mjs';

// Website conversion cleanup: earlier builds registered a service worker that can
// keep serving the old app shell from cache. Unregister any SW and clear its caches.
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister())).catch(() => {});
}
if (window.caches) {
  caches.keys().then((keys) => keys.forEach((k) => caches.delete(k))).catch(() => {});
}


const KEY = 'betiq_v1';
const $ = (id) => document.getElementById(id);
const money = (n) => `${n < 0 ? '-' : ''}$${Math.abs(Number(n) || 0).toFixed(2)}`;
const pct = (n) => `${((Number(n) || 0) * 100).toFixed(1)}%`;
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const leg = (player, market, line) => ({ player, market: market ?? 'Unspecified', line: line ?? '', team: '', opponent: '', status: 'pending' });

// TEST FIXTURES — source of truth: test-slips/fixtures.json (verified 2026-11-01)
function seedTickets() {
  return [];
}

function seedState() {
  // Fresh seed (TASK-0028): the 5 fixture tickets carry their operator-
  // verified STAT-DERIVED final grades (book_confirmed_status stays null),
  // plus the 4 seeded Polymarket positions (private build only).
  const tickets = [
    ...seedTickets().map(applyVerifiedGrade),
    ...polymarketSeedPositions(),
  ];
  return {
    tickets, transactions: [], settings: { startingBankroll: 0 }, uploads: [],
    positions_v1: true, verified_grades_v1: true,
  };
}
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      if (s && Array.isArray(s.tickets)) {
        // Migrations are additive and flag-guarded; user data is never
        // rewritten beyond what each step documents:
        //  TASK-0027: existing tickets gain live fields only.
        //  TASK-0028: seed Polymarket positions are appended once, and the
        //  operator-verified stat-derived fixture grades are applied once
        //  to fixture tickets still pending (book-confirmed and manually
        //  settled tickets are never overwritten).
        let m = migrateState(s);
        m = ensurePositions(m);
        m = applyVerifiedGradesToState(m);
        if (JSON.stringify(m) !== raw) localStorage.setItem(KEY, JSON.stringify(m));
        return m;
      }
    }
  } catch { /* fall through to seed */ }
  const s = seedState(); localStorage.setItem(KEY, JSON.stringify(s)); return s;
}
let state = load();
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

// ---------- Navigation ----------
function showView(name) {
  document.querySelectorAll('.view').forEach((v) => v.classList.toggle('active', v.id === `view-${name}`));
  document.querySelectorAll('[data-nav]').forEach((b) => b.classList.toggle('active', b.dataset.nav === name));
  render();
}
document.querySelectorAll('[data-nav]').forEach((b) => b.addEventListener('click', () => showView(b.dataset.nav)));

// ---------- Rendering helpers ----------
function sampleTag(n) { return n < 30 ? ' <span class="tag-small">small sample</span>' : ''; }
function perfTable(rows, cols) {
  if (!rows.length) return '<p class="muted small">No settled data yet.</p>';
  return `<table><tr>${cols.map((c) => `<th>${c.h}</th>`).join('')}</tr>${rows.map((r) => `<tr>${cols.map((c) => `<td>${c.f(r)}</td>`).join('')}</tr>`).join('')}</table>`;
}
const barCell = (v) => `<div class="bar"><i class="${v < 0.4 ? 'low' : ''}" style="width:${Math.max(0, Math.min(100, v * 100))}%"></i></div>`;

function ticketCard(t, { withControls = false } = {}) {
  const profit = t.status === 'pending' || t.status === 'partial' ? null : profitForTicket(t);
  const legsHtml = (t.legs || []).map((l, i) => {
    const g = (t.live_grades || [])[i];
    const live = g && g.current != null && g.lineValue != null
      ? `<div class="small">Live: ${esc(g.current)} / ${esc(g.lineValue)} ${barCell(g.progress || 0)} <span class="muted">${esc(g.reason || '')}</span></div>`
      : (g && g.current != null ? `<div class="small muted">Live: ${esc(g.current)} — ${esc(g.reason || '')}</div>` : '');
    const finalLine = l.stat_line ? `<div class="small muted">Final: ${esc(l.stat_line)}</div>` : '';
    const unspecifiedNote = !(l.market && l.market !== 'Unspecified')
      ? ' — <span class="muted">market unspecified on screen · stat not specified on slip</span>' : '';
    return `<div class="leg">• ${esc(l.line)} ${esc(l.player)}${l.market && l.market !== 'Unspecified' ? ` — ${esc(l.market)}` : unspecifiedNote} <span class="pill ${l.status === 'push' ? 'void' : l.status}">${esc(l.status)}</span>${live}${finalLine}</div>`;
  }).join('');
  // Settlement provenance (TASK-0028): a stat-derived grade is always
  // labelled as such and never presented as book-confirmed.
  const sourceHtml = t.settlement_source === 'stat-derived'
    ? `<div class="small"><span class="tag-small">stat-derived grade</span> <span class="muted">Settled from final stats${t.stat_grade?.event_id ? ` (ESPN event ${esc(t.stat_grade.event_id)})` : ''} — not book-confirmed.</span></div>`
    : (t.settlement_source === 'book-confirmed' || t.book_confirmed_status
      ? `<div class="small"><span class="tag-small">book-confirmed</span></div>` : '');
  if (t.type === 'position') {
    return `<div class="ticket">
    <div class="ticket-head"><strong>Polymarket — Position</strong><span class="pill ${t.status}">${esc(t.status.replace('_', ' '))}</span></div>
    <div class="leg">• ${esc(t.description || 'Position')}${t.side ? ` — <strong>${esc(t.side)}</strong>` : ''}</div>
    <div class="small muted">${t.placed_at ? esc(t.placed_at.replace('T', ' ')) : esc(t.placed_at_note || 'Date not shown')} · Cost ${money(t.stake)} (cash) · Payout ${money(t.potential_payout)}${profit != null ? ` · P&amp;L <strong class="${profit >= 0 ? 'pos' : 'neg'}">${money(profit)}</strong>` : ''}</div>
    ${t.note ? `<div class="small muted">${esc(t.note)}</div>` : ''}${sourceHtml}</div>`;
  }
  const controls = withControls ? `
    <div style="margin-top:10px;border-top:1px dashed #2e4a8a;padding-top:10px">
      <div class="small muted">TEST HARNESS — “simulate official result”: stands in for the future automatic-settlement feed. It calls the same applySettlement() the feed will use. This is not a manual win/loss button for real use.</div>
      <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:8px">
        <select id="sim-${t.id}" style="width:auto"><option value="won">All legs won</option><option value="lost">Ticket lost</option><option value="void">Void</option><option value="cashed_out">Cashed out</option><option value="partial">Partial (first leg won, rest pending)</option></select>
        <input id="simco-${t.id}" type="number" step="0.01" placeholder="Cashout $" style="width:110px">
        <button class="btn secondary" data-sim="${t.id}">Apply simulated result</button>
      </div>
    </div>` : '';
  return `<div class="ticket">
    <div class="ticket-head"><strong>${esc(t.book)} — ${(t.legs || []).length <= 1 ? 'Straight' : `${(t.legs || []).length}-Leg Parlay`}</strong><span class="pill ${t.status}">${esc(t.status.replace('_', ' '))}</span></div>
    <div class="small muted">${t.placed_at ? esc(t.placed_at.replace('T', ' ')) : esc(t.placed_at_note || 'Date not shown')} · Stake ${money(t.stake)} (${esc(t.stake_type.replace('_', ' '))}) · Odds ${esc(t.odds || '—')} · To win/payout ${money(t.potential_payout)}${profit != null ? ` · P&amp;L <strong class="${profit >= 0 ? 'pos' : 'neg'}">${money(profit)}</strong>` : ''}</div>
    ${t.external_ticket_id ? `<div class="small muted">Ticket ID: ${esc(t.external_ticket_id)}</div>` : ''}
    ${t.note ? `<div class="small muted">${esc(t.note)}</div>` : ''}
    ${sourceHtml}${legsHtml}${controls}</div>`;
}

// ---------- Main render ----------
function render() {
  const stats = computeStats(state.tickets, state.transactions, state.settings);
  const h = new Date().getHours();
  $('greeting').textContent = h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening';

  $('kpi-profit').textContent = money(stats.netProfit);
  $('kpi-profit').className = `value ${stats.netProfit >= 0 ? 'pos' : 'neg'}`;
  $('kpi-roi').textContent = `ROI: ${stats.totalWageredSettled ? pct(stats.roi) : '—'} (settled n=${stats.settledCount})`;
  $('kpi-wagered').textContent = money(stats.totalWageredSettled);
  $('kpi-winrate').textContent = stats.settledCount ? pct(stats.winRate) : '—';
  $('kpi-wl').textContent = `${stats.wins} Wins / ${stats.settledCount} Settled`;
  $('kpi-total').textContent = String(stats.totalBets);
  $('kpi-settled').textContent = `${stats.settledCount} Settled · ${stats.openCount} Open`;
  $('kpi-bankroll').textContent = money(stats.bankroll);
  $('kpi-bankroll-foot').textContent = `Cash wagered (settled): ${money(stats.byStakeType.cash.wagered)} · Trade credit wagered: ${money(stats.byStakeType.trade_credit.wagered)} — tracked separately`;

  const insights = generateInsights(state.tickets);
  const insightsHtml = insights.map((i) => `<div class="insight">${esc(i.text)}<div class="conf">n=${i.n} · ${esc(i.confidence)}</div></div>`).join('');
  $('dash-insights').innerHTML = insightsHtml;
  $('full-insights').innerHTML = insightsHtml;

  $('dash-parlay').innerHTML = perfTable(stats.parlayPerformance, [
    { h: 'Legs', f: (r) => `${esc(r.key)} Legs${sampleTag(r.n)}` }, { h: 'Hit Rate', f: (r) => barCell(r.winRate) },
    { h: 'ROI', f: (r) => `${r.roi >= 0 ? '+' : ''}${pct(r.roi)}` }, { h: 'Bets (n)', f: (r) => r.n },
  ]);
  $('dash-market').innerHTML = perfTable(stats.marketPerformance, [
    { h: 'Market', f: (r) => `${esc(r.key)}${sampleTag(r.n)}` }, { h: 'Hit Rate', f: (r) => barCell(r.winRate) },
    { h: 'n', f: (r) => r.n },
  ]);
  $('dash-player').innerHTML = perfTable(stats.playerPerformance, [
    { h: 'Player', f: (r) => `${esc(r.key)}${sampleTag(r.n)}` }, { h: 'Hit', f: (r) => `${r.wins} / ${r.n}` },
    { h: 'Rate', f: (r) => pct(r.winRate) },
  ]);
  $('dash-book').innerHTML = perfTable(stats.perBook, [
    { h: 'Book', f: (r) => esc(r.key) }, { h: 'ROI', f: (r) => `${r.roi >= 0 ? '+' : ''}${pct(r.roi)}` },
    { h: 'Win Rate', f: (r) => pct(r.winRate) }, { h: 'Bets (n)', f: (r) => `${r.n}${sampleTag(r.n)}` },
  ]);

  const topBook = $('filter-book-top').value;
  const recent = [...state.tickets].filter((t) => !topBook || t.book === topBook)
    .sort((a, b) => String(b.placed_at || '').localeCompare(String(a.placed_at || ''))).slice(0, 6);
  $('dash-recent').innerHTML = recent.length ? recent.map((t) => ticketCard(t)).join('') : '<p class="muted small">No tickets yet.</p>';

  // Tracker
  const q = ($('flt-search').value || '').toLowerCase();
  const fb = $('flt-book').value, fs = $('flt-status').value;
  const list = state.tickets.filter((t) =>
    (!fb || t.book === fb) && (!fs || t.status === fs) &&
    (!q || JSON.stringify(t).toLowerCase().includes(q)));
  $('ticket-list').innerHTML = list.length ? list.map((t) => ticketCard(t, { withControls: true })).join('') : '<p class="muted">No tickets match those filters.</p>';
  document.querySelectorAll('[data-sim]').forEach((btn) => btn.addEventListener('click', () => {
    const t = state.tickets.find((x) => x.id === btn.dataset.sim);
    const sel = $(`sim-${t.id}`).value;
    const co = parseFloat($(`simco-${t.id}`).value);
    let result;
    if (sel === 'partial') result = { legResults: [{ index: 0, status: 'won' }] };
    else if (sel === 'won') result = { legResults: (t.legs || []).map((_, i) => ({ index: i, status: 'won' })) };
    else if (sel === 'lost') result = { legResults: [{ index: 0, status: 'lost' }] };
    else result = { status: sel, cashout_amount: sel === 'cashed_out' && !Number.isNaN(co) ? co : undefined };
    const idx = state.tickets.findIndex((x) => x.id === t.id);
    state.tickets[idx] = applySettlement(t, result);
    save(); render();
  }));

  // Analytics view
  $('an-parlay').innerHTML = $('dash-parlay').innerHTML;
  $('an-book').innerHTML = $('dash-book').innerHTML;
  $('an-market').innerHTML = perfTable(stats.marketPerformance, [
    { h: 'Market', f: (r) => `${esc(r.key)}${sampleTag(r.n)}` }, { h: 'Wins', f: (r) => r.wins },
    { h: 'n', f: (r) => r.n }, { h: 'Hit Rate', f: (r) => pct(r.winRate) },
    { h: '95% CI', f: (r) => { const [lo, hi] = wilsonInterval(r.wins, r.n); return `${pct(lo)} – ${pct(hi)}`; } },
  ]);
  $('an-player').innerHTML = $('an-market').innerHTML === '' ? '' : perfTable(stats.playerPerformance, [
    { h: 'Player', f: (r) => `${esc(r.key)}${sampleTag(r.n)}` }, { h: 'Wins', f: (r) => r.wins },
    { h: 'n', f: (r) => r.n }, { h: 'Hit Rate', f: (r) => pct(r.winRate) },
    { h: '95% CI', f: (r) => { const [lo, hi] = wilsonInterval(r.wins, r.n); return `${pct(lo)} – ${pct(hi)}`; } },
  ]);

  // Bankroll
  $('bankroll-summary').innerHTML = `
    <table>
      <tr><td>Starting bankroll</td><td>${money(stats.startingBankroll)}</td></tr>
      <tr><td>Deposits</td><td>${money(stats.deposits)}</td></tr>
      <tr><td>Withdrawals</td><td>-${money(stats.withdrawals).slice(0)}</td></tr>
      <tr><td>Realized P&amp;L (settled)</td><td class="${stats.netProfit >= 0 ? 'pos' : 'neg'}">${money(stats.netProfit)}</td></tr>
      <tr><td><strong>Bankroll (tracked)</strong></td><td><strong>${money(stats.bankroll)}</strong></td></tr>
      <tr><td>Cash stakes (settled)</td><td>${money(stats.byStakeType.cash.wagered)} · P&amp;L ${money(stats.byStakeType.cash.profit)} · n=${stats.byStakeType.cash.n}</td></tr>
      <tr><td>Trade-credit stakes (settled)</td><td>${money(stats.byStakeType.trade_credit.wagered)} · P&amp;L ${money(stats.byStakeType.trade_credit.profit)} · n=${stats.byStakeType.trade_credit.n}</td></tr>
      <tr><td>Bonus stakes (settled)</td><td>${money(stats.byStakeType.bonus.wagered)} · n=${stats.byStakeType.bonus.n}</td></tr>
    </table>`;
  $('txn-list').innerHTML = state.transactions.length
    ? state.transactions.map((x) => `<div class="small">${esc(x.type)} — ${money(x.amount)} <span class="muted">${esc(x.occurred_at || '')}</span></div>`).join('')
    : '<p class="muted small">No deposits or withdrawals recorded.</p>';

  $('report-summary').innerHTML = `<p class="small">Tickets: ${stats.totalBets} (${stats.settledCount} settled, ${stats.openCount} open) · Net profit ${money(stats.netProfit)} · ROI ${stats.totalWageredSettled ? pct(stats.roi) : '—'}</p>`;
  if (document.activeElement !== $('s-bankroll')) $('s-bankroll').value = stats.startingBankroll || 0;

  drawCashflow(stats);
  drawDonut(stats);
}

// ---------- Charts (canvas, no external dependencies) ----------
function drawCashflow(stats) {
  const cv = $('chart-cashflow'); if (!cv) return;
  const ctx = cv.getContext('2d'); const W = cv.width, H = cv.height;
  ctx.clearRect(0, 0, W, H);
  const settled = state.tickets.filter((t) => ['won', 'lost', 'void', 'cashed_out'].includes(t.status))
    .sort((a, b) => String(a.placed_at || '').localeCompare(String(b.placed_at || '')));
  if (!settled.length) {
    ctx.fillStyle = '#a9bce0'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('No settled tickets yet — the profit trend starts when tickets settle.', W / 2, H / 2);
    $('chart-note').textContent = 'Pending tickets are excluded from realized P&L.';
    return;
  }
  let cum = 0; const pts = settled.map((t) => (cum += profitForTicket(t)));
  const min = Math.min(0, ...pts), max = Math.max(0, ...pts), range = (max - min) || 1;
  const X = (i) => 40 + (i / Math.max(1, pts.length - 1)) * (W - 60);
  const Y = (v) => H - 25 - ((v - min) / range) * (H - 50);
  ctx.strokeStyle = '#2b4176'; ctx.beginPath(); ctx.moveTo(40, Y(0)); ctx.lineTo(W - 20, Y(0)); ctx.stroke();
  const lineGrad = ctx.createLinearGradient(40, 0, W - 20, 0);
  lineGrad.addColorStop(0, '#8b5cf6'); lineGrad.addColorStop(.55, '#d946ef'); lineGrad.addColorStop(1, '#38b6ff');
  ctx.strokeStyle = lineGrad; ctx.lineWidth = 2.5; ctx.shadowColor = 'rgba(168,85,247,.6)'; ctx.shadowBlur = 8; ctx.beginPath();
  pts.forEach((p, i) => (i ? ctx.lineTo(X(i), Y(p)) : ctx.moveTo(X(i), Y(p)))); ctx.stroke();
  ctx.lineTo(X(pts.length - 1), Y(0)); ctx.lineTo(X(0), Y(0)); ctx.closePath();
  ctx.shadowBlur = 0;
  const fillGrad = ctx.createLinearGradient(0, 0, 0, H);
  fillGrad.addColorStop(0, 'rgba(168,85,247,.50)'); fillGrad.addColorStop(.55, 'rgba(139,92,246,.20)'); fillGrad.addColorStop(1, 'rgba(0,140,255,.04)');
  ctx.fillStyle = fillGrad; ctx.fill();
  const lastX = X(pts.length - 1), lastY = Y(pts[pts.length - 1]);
  ctx.beginPath(); ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
  ctx.fillStyle = '#f5d0fe'; ctx.shadowColor = 'rgba(217,70,239,.95)'; ctx.shadowBlur = 14; ctx.fill(); ctx.shadowBlur = 0;
  ctx.fillStyle = '#eef3ff'; ctx.font = '12px sans-serif'; ctx.textAlign = 'left';
  ctx.fillText(`Net ${money(cum)}`, 44, 18);
  $('chart-note').textContent = `Cumulative realized profit across ${settled.length} settled ticket(s).`;
}
function drawDonut(stats) {
  const cv = $('chart-donut'); if (!cv) return;
  const ctx = cv.getContext('2d'); const cx = 100, cy = 100, r = 78;
  ctx.clearRect(0, 0, 200, 200);
  const parts = [
    { v: stats.wins, c: '#2dff8f', label: 'Wins' }, { v: stats.losses, c: '#a855f7', label: 'Losses' },
    { v: stats.voids + stats.cashedOut, c: '#00c2ff', label: 'Void/Cashed' }, { v: stats.openCount, c: '#31477f', label: 'Open' },
  ];
  const total = parts.reduce((s, p) => s + p.v, 0);
  if (!total) { $('donut-legend').textContent = 'No tickets yet.'; return; }
  let a = -Math.PI / 2;
  for (const p of parts) {
    if (!p.v) continue;
    const sweep = (p.v / total) * Math.PI * 2;
    ctx.beginPath(); ctx.arc(cx, cy, r, a, a + sweep); ctx.arc(cx, cy, r * 0.62, a + sweep, a, true); ctx.closePath();
    ctx.fillStyle = p.c; ctx.fill(); a += sweep;
  }
  ctx.fillStyle = '#eef3ff'; ctx.font = 'bold 17px sans-serif'; ctx.textAlign = 'center';
  ctx.fillText(stats.settledCount ? pct(stats.winRate) : '—', cx, cy + 2);
  ctx.font = '10px sans-serif'; ctx.fillStyle = '#a9bce0'; ctx.fillText('Win Rate', cx, cy + 17);
  $('donut-legend').innerHTML = parts.filter((p) => p.v).map((p) => `<span style="color:${p.c}">●</span> ${p.label} ${p.v}`).join(' · ') + `<br>Total Settled ${stats.settledCount}`;
}

// ---------- Upload: SHA-256 duplicate blocking + review form ----------
let pendingHash = null;
async function sha256Hex(file) {
  const buf = await file.arrayBuffer();
  const digest = await crypto.subtle.digest('SHA-256', buf);
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function showMsg(el, kind, text) { el.className = `msg show ${kind}`; el.textContent = text; }

$('slip-file').addEventListener('change', async (e) => {
  const file = e.target.files[0]; const msg = $('upload-msg');
  pendingHash = null;
  if (!file) return;
  pendingHash = await sha256Hex(file);
  const knownHashes = [...state.tickets.map((t) => t.image_hash), ...state.uploads.map((u) => u.image_hash)].filter(Boolean);
  if (knownHashes.includes(pendingHash)) {
    $('slip-preview').style.display = 'none';
    showMsg(msg, 'error', `Duplicate blocked: this exact image was already uploaded (SHA-256 ${pendingHash.slice(0, 16)}…). It was not saved again.`);
    e.target.value = '';
    return;
  }
  const reader = new FileReader();
  reader.onload = () => { const img = $('slip-preview'); img.src = reader.result; img.style.display = 'block'; };
  reader.readAsDataURL(file);
  showMsg(msg, 'ok', `New image (SHA-256 ${pendingHash.slice(0, 16)}…). Review the image and complete the form — extraction is not automatic in this MVP, so only what you confirm gets saved.`);
});

// Dynamic leg rows (shared by upload review + manual entry — same form)
function addLegRow(player = '', market = '', lineVal = '') {
  const row = document.createElement('div');
  row.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;flex-wrap:wrap';
  row.innerHTML = `<input class="leg-player" placeholder="Player" value="${esc(player)}" style="flex:2 1 130px">
    <input class="leg-market" placeholder="Market (leave blank if screen doesn't name it)" value="${esc(market)}" style="flex:2 1 150px">
    <input class="leg-line" placeholder="Line e.g. 10+" value="${esc(lineVal)}" style="flex:1 1 70px">
    <button type="button" class="btn secondary leg-remove">✕</button>`;
  row.querySelector('.leg-remove').addEventListener('click', () => row.remove());
  $('leg-rows').appendChild(row);
}
$('add-leg').addEventListener('click', () => addLegRow());
addLegRow();

$('ticket-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const msg = $('form-msg');
  // Polymarket position mode: no legs — a market description, a side, a cash
  // cost and a payout. Positions are cash only, never trade credit.
  if ($('f-book').value === 'Polymarket') {
    const description = $('f-posdesc').value.trim();
    if (!description) { showMsg(msg, 'error', 'Describe the Polymarket market (e.g. "Ja\'Marr Chase 110+ receiving yards").'); return; }
    state.tickets.push({
      id: `t-${Date.now()}`, type: 'position', book: 'Polymarket',
      description, side: $('f-side').value || null,
      external_ticket_id: null, placed_at: $('f-date').value || '',
      stake: parseFloat($('f-stake').value) || 0, stake_type: 'cash',
      odds: '', potential_payout: parseFloat($('f-payout').value) || 0,
      status: $('f-posstatus').value, cashout_amount: null, image_hash: null, legs: [],
      note: 'Polymarket position — cash stake (manual entry).',
    });
    save(); render();
    showMsg(msg, 'ok', 'Polymarket position saved and persisted.');
    e.target.reset(); $('leg-rows').innerHTML = ''; addLegRow(); $('slip-preview').style.display = 'none';
    return;
  }
  const legs = [...document.querySelectorAll('#leg-rows > div')].map((row) => ({
    player: row.querySelector('.leg-player').value.trim(),
    market: row.querySelector('.leg-market').value.trim() || 'Unspecified',
    line: row.querySelector('.leg-line').value.trim(), team: '', opponent: '', status: 'pending',
  })).filter((l) => l.player);
  if (!legs.length) { showMsg(msg, 'error', 'Add at least one leg with a player name.'); return; }
  const candidate = {
    id: `t-${Date.now()}`, book: $('f-book').value,
    external_ticket_id: $('f-extid').value.trim() || null,
    placed_at: $('f-date').value || '', stake: parseFloat($('f-stake').value) || 0,
    stake_type: $('f-staketype').value, odds: $('f-odds').value.trim(),
    potential_payout: parseFloat($('f-payout').value) || 0,
    status: 'pending', cashout_amount: null, image_hash: pendingHash, legs,
  };
  const dup = detectDuplicateTicket(candidate, state.tickets);
  if (dup.byHash) { showMsg(msg, 'error', 'Blocked: this slip image (hash) is already saved.'); return; }
  if (dup.byExternalId) { showMsg(msg, 'error', `Blocked: ${candidate.book} ticket ID ${candidate.external_ticket_id} is already saved — the same ticket can arrive in two different screenshots, so identity is checked, not just the image.`); return; }
  if (dup.probable && !window.confirm('Probable duplicate: same book, stake, payout and leg count as an existing ticket. Save anyway?')) {
    showMsg(msg, 'warn', 'Not saved — probable duplicate.'); return;
  }
  state.tickets.push(candidate);
  if (pendingHash) state.uploads.push({ image_hash: pendingHash, ticket_id: candidate.id, at: new Date().toISOString() });
  pendingHash = null; save(); render();
  showMsg(msg, 'ok', 'Ticket saved and persisted.');
  e.target.reset(); $('leg-rows').innerHTML = ''; addLegRow(); $('slip-preview').style.display = 'none';
});

// ---------- Filters / transactions / reports / settings ----------
['flt-search', 'flt-book', 'flt-status'].forEach((id) => $(id).addEventListener('input', render));
$('filter-book-top').addEventListener('change', render);
$('txn-form').addEventListener('submit', (e) => {
  e.preventDefault();
  state.transactions.push({ type: $('t-type').value, amount: parseFloat($('t-amount').value) || 0, occurred_at: new Date().toISOString().slice(0, 10) });
  save(); render(); e.target.reset();
});
$('csv-btn').addEventListener('click', () => {
  const rows = [['ticket_id', 'book', 'external_ticket_id', 'placed_at', 'stake', 'stake_type', 'odds', 'potential_payout', 'status', 'profit', 'legs']];
  for (const t of state.tickets) rows.push([t.id, t.book, t.external_ticket_id || '', t.placed_at || '', t.stake, t.stake_type, t.odds || '', t.potential_payout, t.status, profitForTicket(t).toFixed(2), (t.legs || []).length ? (t.legs || []).map((l) => `${l.line} ${l.player} (${l.market})`).join(' | ') : (t.description ? `Position: ${t.description}${t.side ? ` (${t.side})` : ''}` : '')]);
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' })); a.download = 'betiq-tickets.csv'; a.click();
  URL.revokeObjectURL(a.href);
});
$('s-save').addEventListener('click', () => { state.settings.startingBankroll = parseFloat($('s-bankroll').value) || 0; save(); render(); });
$('s-reseed').addEventListener('click', () => { state = seedState(); save(); render(); });
$('s-clear').addEventListener('click', () => { if (window.confirm('Clear ALL BetIQ data in this browser?')) { state = { tickets: [], transactions: [], settings: { startingBankroll: 0 }, uploads: [], positions_v1: true, verified_grades_v1: true }; save(); render(); } });

// ---------- Live demo (TASK-0027): SYNTHETIC game only ----------
// Demonstrates per-leg progress bars + automatic settlement end to end.
// Nothing here touches real tickets: the demo ticket is created separately
// and its players exist only in these snapshots — never a provider feed.
const DEMO_BASE = { game_id: 'demo-game-1', source: 'demo', latency_note: 'synthetic demo — not a provider feed', void_leg_keys: [], binary_results: {} };
function demoSnap(status, players) {
  return { ...DEMO_BASE, status, updated_at: new Date().toISOString(), players };
}
$('live-demo-btn').addEventListener('click', () => {
  const msg = $('live-msg');
  let demo = state.tickets.find((t) => t.id === 'demo-live-ticket');
  if (!demo) {
    demo = {
      id: 'demo-live-ticket', book: 'DraftKings', game_id: 'demo-game-1',
      external_ticket_id: null, placed_at: '', stake: 10.00, stake_type: 'cash',
      odds: '+200', potential_payout: 30.00, status: 'pending', cashout_amount: null,
      image_hash: null, note: 'DEMO ticket — synthetic players, not a real bet',
      legs: [
        leg('Synth WR', 'Receptions', '4+'), leg('Synth RB', 'Rushing Yards', '50+'),
        leg('Synth QB', 'Anytime TD Scorer', ''),
      ],
    };
    state.tickets.push(demo);
    state.tickets = applyLiveSnapshot(state.tickets, demoSnap('in_progress', {
      'Synth WR': { snaps: 40, receptions: 3 },
      'Synth RB': { snaps: 30, rushing_yards: 42 },
      'Synth QB': { snaps: 50, passing_tds: 1, scoring_tds: 0 },
    }));
    save(); render();
    showMsg(msg, 'ok', 'Demo game in progress: WR 3/4 receptions, RB 42/50 rushing yards, QB has a passing TD but 0 scoring TDs (still pending — the anytime-TD trap). Click again for the final.');
  } else if (demo.settlement_state === 'provisional' || demo.status === 'pending' || demo.status === 'partial') {
    state.tickets = applyLiveSnapshot(state.tickets, demoSnap('final', {
      'Synth WR': { snaps: 55, receptions: 4 },
      'Synth RB': { snaps: 55, rushing_yards: 61 },
      'Synth QB': { snaps: 60, passing_tds: 1, scoring_tds: 1 },
    }));
    save(); render();
    showMsg(msg, 'ok', 'Demo game final: all three legs won, demo ticket settled +$20.00. Real tickets are untouched — a live provider feed still needs approval (see LIVE-DATA.md).');
  } else {
    showMsg(msg, 'warn', 'Demo ticket already settled. Use Settings → Reset to test fixtures to run the demo again.');
  }
});

render();
