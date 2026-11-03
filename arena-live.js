/* Bet Lab LIVE — Arena integration (arena-live.js).
 * The Arena Dashboard shell Marquis supplied (Nov 3, 2026) wired to the
 * PRODUCTION store, following the stitch-live.js binder pattern it
 * supersedes: this script inserts the Arena chrome (top system bar with
 * nav pills, banner, KPI strip, chart + ledger + Hot Takes column, open
 * bets radar, real sportsbook tiles, footer) into the live app and binds
 * every figure in it to the same store the app itself uses
 * (betlab_clean_real_bets_v1) — computed live, following settlements.
 * The Arena export's placeholder figures (bankroll, win rate, pick
 * cards, Live Wire items, simulations) do NOT appear: the top bar shows
 * real NET P&L + TOTAL WAGERED, the KPI strip shows real net / win
 * rate / wagered / open potential, the pick cards are replaced by the
 * profit chart, Today's Board, the settled-wager ledger and the AI
 * Scout Hot Takes panel (real market activity, UNCALIBRATED), and the
 * Connected Sportsbooks tiles are Marquis's real channels (Polymarket,
 * Kalshi, Novig, DraftKings — a friend's, upload only).
 * Internal binding ids shared with other live modules are kept on
 * purpose: #staNav (ai-scout-live.js's nav test hooks) and the
 * staHot* Hot Takes ids (ai-scout-live.js renders into them). All other
 * shell ids are arn*. This script NEVER writes to storage. */

var ARN_HEADER = `
<header id="arnHeader" class="border-b border-purple-900/30 bg-[#07030f]/90 backdrop-blur-md sticky top-0 z-50" data-purpose="top-navigation-bar">
<div class="max-w-[1400px] mx-auto px-4 sm:px-6 pt-2.5 flex items-center justify-between gap-4 flex-wrap">
<div class="flex items-center gap-3">
<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/30"><span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span> SYSTEM ONLINE</span>
<span class="text-xs text-slate-400 font-mono">v4.8 QUANTUM ARENA</span>
<span class="text-xs text-slate-500">|</span>
<span class="text-xs text-amber-400/90 font-mono font-medium">LAST RENDER: <span id="arnBarUpdated">—</span></span>
</div>
<div class="flex items-center gap-4 text-xs font-medium text-slate-300">
<div class="flex items-center gap-3 bg-purple-950/40 border border-purple-800/40 rounded-lg px-3 py-1.5 font-mono">
<span><span class="text-slate-400">NET P&amp;L:</span> <span id="arnBarNet" class="font-bold text-white">$0.00</span></span>
<span class="text-slate-600">|</span>
<span><span class="text-slate-400">WAGERED:</span> <span id="arnBarWagered" class="font-bold text-amber-400">$0.00</span></span>
</div>
<button id="arnSyncBooks" type="button" class="bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-black font-bold px-4 py-1.5 rounded-lg transition-all shadow-lg shadow-amber-500/20 font-display tracking-wider">SYNC BOOKS</button>
</div>
</div>
<nav id="staNav" class="max-w-[1400px] mx-auto px-4 sm:px-6 py-2.5 flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-300 overflow-x-auto" data-purpose="main-nav-pills">
<button type="button" data-go="Dashboard" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold shadow-lg shadow-amber-500/20 transition-all whitespace-nowrap">DASHBOARD</button>
<button type="button" data-go="Today’s Board" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-purple-900/40 transition-colors whitespace-nowrap">TODAY’S BOARD</button>
<button type="button" data-go="Bet Tracker" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-purple-900/40 transition-colors whitespace-nowrap">BET TRACKER</button>
<button type="button" id="arnAddBet" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-amber-500/60 text-amber-400 hover:bg-amber-500 hover:text-black font-bold transition-colors whitespace-nowrap">+ ADD BET</button>
<button type="button" data-go="Sportsbooks" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-purple-900/40 transition-colors whitespace-nowrap">SPORTSBOOKS</button>
<button type="button" data-go="Live Record" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-purple-900/40 transition-colors whitespace-nowrap">LIVE RECORD</button>
<button type="button" data-go="Analytics" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-purple-900/40 transition-colors whitespace-nowrap">ANALYTICS</button>
<button type="button" data-go="Slip Importer" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-purple-900/40 transition-colors whitespace-nowrap">SLIP IMPORTER</button>
<button type="button" data-go="AI Scout" class="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-purple-900/40 transition-colors whitespace-nowrap">AI Scout</button>
</nav>
</header>`;

var ARN_BANNER = `
<section class="w-full overflow-hidden border-b border-purple-900/40 shadow-2xl bg-black relative" data-purpose="arena-banner">
<div class="w-full relative">
<img alt="BET LAB SYSTEM™ Header Banner" class="w-full h-auto block" src="https://lh3.googleusercontent.com/aida-public/AB6AXuC_-A8O3FCHnqKelMpqzqnLquURfALaybqStCWxLKdIWmea2KlDQMdAavfyoSk_k2ytjL7NPFYEq6B7pG7T5ru61KXEDwQ46btVBq0sZ0NHQ6wVw-vuOO9zSF1MISNwTJ_9Wo5Uwi3NHpbxP3ovBme3vAq2Xy2J3LwbH8I5CDM8BHdGT1hUGx8MJkuprmJ-1VzekB7VcjvWxl_Lk2OLXQWIEdvHLjtDRloQQs5mhrpjqGxd_fF6rftLAQ=w1290-h645-p"/>
<div class="absolute inset-x-0 bottom-0 h-28 pointer-events-none bg-gradient-to-t from-[#05020a]/80 via-transparent to-transparent"></div>
</div>
</section>`;

var ARN_MAIN = `
<div class="max-w-[1400px] mx-auto px-4 sm:px-6 py-6 space-y-8" data-purpose="main-dashboard-body">
<section class="grid grid-cols-1 md:grid-cols-4 gap-4" data-purpose="top-kpi-metrics-row">
<div class="glow-card rounded-xl p-4 flex items-center justify-between" data-purpose="kpi-net-profit">
<div>
<p class="text-xs font-mono uppercase text-slate-400 tracking-wider">Net Profit</p>
<div class="flex items-baseline gap-2 mt-1">
<span id="arnKpiNet" class="text-2xl font-extrabold font-display text-white">$0.00</span>
<span id="arnKpiNetChip" class="text-xs text-slate-400 font-mono">REC 0–0</span>
</div>
</div>
<div class="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg">◎</div>
</div>
<div class="glow-card rounded-xl p-4 flex items-center justify-between" data-purpose="kpi-win-rate">
<div>
<p class="text-xs font-mono uppercase text-slate-400 tracking-wider">Win Rate</p>
<div class="flex items-baseline gap-2 mt-1">
<span id="arnKpiRate" class="text-2xl font-extrabold font-display text-white">—</span>
<span id="arnKpiRateChip" class="text-xs text-slate-400 font-mono">0 SETTLED</span>
</div>
<p id="arnKpiRateSub" class="text-xs text-slate-400 font-mono mt-0.5">0 W / 0 L</p>
</div>
<div class="w-10 h-10 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 text-lg">📈</div>
</div>
<div class="glow-card rounded-xl p-4 flex items-center justify-between" data-purpose="kpi-total-wagered">
<div>
<p class="text-xs font-mono uppercase text-slate-400 tracking-wider">Total Wagered</p>
<div class="flex items-baseline gap-2 mt-1">
<span id="arnKpiWagered" class="text-2xl font-extrabold font-display text-amber-400">$0.00</span>
<span id="arnKpiWagSub" class="text-xs text-slate-400 font-mono">0 BETS</span>
</div>
</div>
<div class="w-10 h-10 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400 text-lg">◆</div>
</div>
<div class="glow-card rounded-xl p-4 flex items-center justify-between" data-purpose="kpi-open-potential">
<div>
<p class="text-xs font-mono uppercase text-slate-400 tracking-wider">Open Potential</p>
<div class="flex items-baseline gap-2 mt-1">
<span id="arnKpiPot" class="text-2xl font-extrabold font-display text-purple-400">$0.00</span>
<span id="arnKpiPotSub" class="text-xs text-slate-400 font-mono">0 OPEN BETS</span>
</div>
</div>
<div class="w-10 h-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400 text-lg">⚡</div>
</div>
</section>
<div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
<section class="lg:col-span-2 space-y-4">
<article class="glow-card rounded-2xl p-5 transition-all" data-purpose="cumulative-profit-chart-panel">
<div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
<h2 class="text-sm font-bold font-display uppercase tracking-wider text-slate-100">Cumulative Profit</h2>
<div class="flex items-center gap-1 bg-purple-950/60 p-1 rounded-lg border border-purple-800/40 text-xs font-mono self-start sm:self-auto">
<button class="px-2.5 py-0.5 rounded-full text-slate-400 hover:text-white transition" data-chart-tf="7">7D</button>
<button class="px-2.5 py-0.5 rounded-full text-slate-400 hover:text-white transition" data-chart-tf="30">30D</button>
<button class="px-2.5 py-0.5 rounded-full text-black font-bold bg-amber-500 transition" data-chart-tf="90">90D</button>
<button class="px-2.5 py-0.5 rounded-full text-slate-400 hover:text-white transition" data-chart-tf="365">1Y</button>
<button class="px-2.5 py-0.5 rounded-full text-slate-400 hover:text-white transition" data-chart-tf="ALL">ALL</button>
</div>
</div>
<div class="relative w-full h-[280px] bg-black/40 rounded-xl border border-purple-900/30 p-3 pt-4 overflow-hidden" data-purpose="dual-axis-svg-chart">
<div class="absolute left-3 top-4 bottom-8 flex flex-col justify-between text-[10px] font-mono text-slate-500 pointer-events-none select-none" id="arnYLeft"><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span></div>
<div class="absolute right-3 top-4 bottom-8 flex flex-col justify-between text-[10px] font-mono text-purple-400/80 pointer-events-none select-none text-right" id="arnYRight"><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span></div>
<div class="absolute left-[84%] top-[46%] -translate-x-1/2 z-20 bg-[#0b0814]/95 border border-purple-500/60 rounded-lg p-2.5 shadow-[0_0_15px_rgba(168,85,247,0.4)] pointer-events-none font-mono text-[11px] whitespace-nowrap">
<div class="flex items-center gap-1.5 text-slate-300 font-semibold mb-1 pb-1 border-b border-slate-800" id="arnCalloutDate"><svg class="w-3 h-3 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><rect height="18" rx="2" ry="2" width="18" x="3" y="4"></rect><line x1="16" x2="16" y1="2" y2="6"></line><line x1="8" x2="8" y1="2" y2="6"></line><line x1="3" x2="21" y1="10" y2="10"></line></svg> DATE</div>
<div class="flex items-center justify-between gap-3 text-[#FF3B5C]" id="arnCalloutNetRow">
<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-[#FF3B5C]"></span> Cum. Profit:</span>
<span class="font-bold" id="arnCalloutNet">$0.00 NET</span>
</div>
<div class="flex items-center justify-between gap-3 text-purple-300">
<span class="flex items-center gap-1"><span class="w-2 h-2 rounded-full bg-purple-400"></span> Record:</span>
<span class="font-bold" id="arnCalloutRec">0 W / 0 L</span>
</div>
</div>
<div class="w-full h-full pl-10 pr-10 pb-6">
<svg class="w-full h-full overflow-visible" preserveAspectRatio="none" viewBox="0 0 800 240">
<defs>
<linearGradient id="arnProfitGrad" x1="0" x2="0" y1="0" y2="1">
<stop offset="0%" stop-color="#FF3B5C" stop-opacity="0.38"></stop>
<stop offset="60%" stop-color="#FF3B5C" stop-opacity="0.10"></stop>
<stop offset="100%" stop-color="#FF3B5C" stop-opacity="0.0"></stop>
</linearGradient>
</defs>
<line stroke="#241a3f" stroke-dasharray="3 3" stroke-width="1" x1="0" x2="800" y1="20" y2="20"></line>
<line stroke="#241a3f" stroke-dasharray="3 3" stroke-width="1" x1="0" x2="800" y1="55" y2="55"></line>
<line stroke="#241a3f" stroke-dasharray="3 3" stroke-width="1" x1="0" x2="800" y1="90" y2="90"></line>
<line stroke="#241a3f" stroke-dasharray="3 3" stroke-width="1" x1="0" x2="800" y1="125" y2="125"></line>
<line stroke="#241a3f" stroke-dasharray="3 3" stroke-width="1" x1="0" x2="800" y1="160" y2="160"></line>
<line stroke="#241a3f" stroke-dasharray="3 3" stroke-width="1" x1="0" x2="800" y1="195" y2="195"></line>
<line stroke="#241a3f" stroke-dasharray="3 3" stroke-width="1" x1="0" x2="800" y1="230" y2="230"></line>
<path id="arnChartArea" d="M 0.0 125.0 L 800.0 125.0 L 800 230 L 0 230 Z" fill="url(#arnProfitGrad)"></path>
<path id="arnChartBase" d="M 0 125.0 L 800 125.0" stroke="#475569" stroke-dasharray="4 4" stroke-width="1" fill="none"></path>
<path id="arnChartLine" d="M 0.0 125.0 L 800.0 125.0" stroke="#39FF88" stroke-width="3" fill="none" stroke-linecap="round"></path>
<circle id="arnChartBaseDot" cx="800" cy="125.0" r="3.5" fill="#475569"></circle>
<circle id="arnChartDot" cx="800" cy="125.0" r="4.5" fill="#39FF88"></circle>
</svg>
</div>
<div class="absolute left-10 right-10 bottom-1 flex justify-between text-[10px] font-mono text-slate-500" id="arnXAxis"></div>
</div>
<div class="grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-purple-900/30 text-xs font-mono" data-purpose="chart-legend-metrics">
<div class="flex items-center gap-2 bg-black/40 p-2 rounded-lg border border-purple-900/30">
<span class="text-[#39FF88] text-sm">✦</span>
<div><div class="text-[10px] text-slate-400">SETTLED BETS</div><div class="font-bold text-[#39FF88]" id="arnLegSettled">0 · 0 W / 0 L</div></div>
</div>
<div class="flex items-center gap-2 bg-black/40 p-2 rounded-lg border border-purple-900/30">
<span class="text-[#39FF88] text-sm">📈</span>
<div><div class="text-[10px] text-slate-400">WIN RATE</div><div class="font-bold text-[#39FF88]" id="arnLegRate">—</div></div>
</div>
<div class="flex items-center gap-2 bg-black/40 p-2 rounded-lg border border-purple-900/30">
<span class="text-amber-400 text-sm">⚖</span>
<div><div class="text-[10px] text-slate-400">AVG STAKE SIZE</div><div class="font-bold text-amber-400" id="arnLegAvg">—</div></div>
</div>
<div class="flex items-center gap-2 bg-black/40 p-2 rounded-lg border border-purple-900/30">
<span class="text-purple-400 text-sm">⚡</span>
<div><div class="text-[10px] text-slate-400">OPEN POTENTIAL</div><div class="font-bold text-purple-300" id="arnLegPot">$0.00</div></div>
</div>
</div>
</article>
<article class="glow-card rounded-2xl p-5 transition-all" data-purpose="recent-wager-ledger-panel">
<div class="flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4">
<div class="flex items-start gap-2">
<div class="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 mt-0.5">
<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" x2="8" y1="13" y2="13"></line><line x1="16" x2="8" y1="17" y2="17"></line></svg>
</div>
<div>
<div class="flex items-center gap-2">
<h2 class="text-sm font-bold tracking-wide text-amber-400 uppercase font-display">RECENT WAGER LEDGER &amp; AUDIT TRAIL</h2>
<span class="w-3.5 h-3.5 rounded-full border border-slate-500 text-slate-400 flex items-center justify-center text-[9px] cursor-pointer" title="Settled wagers from your tracker">ℹ</span>
</div>
<p class="text-xs text-slate-400 font-mono">All settled wagers — results and profit / loss</p>
</div>
</div>
<div class="flex items-center gap-2 flex-wrap font-mono text-xs">
<div class="flex items-center bg-black/40 p-0.5 rounded-full border border-purple-900/40" id="status-pill-group">
<button class="status-btn px-2.5 py-0.5 rounded-full text-black font-bold bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all" data-status="ALL">ALL</button>
<button class="status-btn px-2.5 py-0.5 rounded-full text-slate-400 hover:text-white transition-all" data-status="WON">WON</button>
<button class="status-btn px-2.5 py-0.5 rounded-full text-slate-400 hover:text-white transition-all" data-status="LOST">LOST</button>
<button class="status-btn px-2.5 py-0.5 rounded-full text-slate-400 hover:text-white transition-all" data-status="PUSH">PUSH</button>
</div>
<div class="px-2.5 py-1 bg-black/40 rounded-full border border-purple-900/40 text-[11px] text-slate-300 flex items-center gap-1.5">
<span class="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
<span class="text-emerald-400 font-bold" id="ledger-counter">Showing 0 of 0</span>
</div>
</div>
</div>
<div class="p-3 mb-3.5 rounded-xl bg-black/40 border border-purple-900/40 font-mono text-xs space-y-2.5" data-purpose="wager-ledger-filters">
<div class="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-2.5 items-center">
<div class="relative xl:col-span-1">
<span class="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400">
<svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path></svg>
</span>
<input class="w-full pl-8 pr-3 py-1.5 bg-[#0b0814]/90 border border-purple-900/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg text-slate-200 placeholder-slate-500 text-xs transition" id="filter-search" placeholder="Search team, player, matchup..." type="text"/>
</div>
<div class="relative">
<select class="w-full py-1.5 pl-2.5 pr-7 bg-[#0b0814]/90 border border-purple-900/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg text-slate-300 text-xs transition cursor-pointer appearance-none" id="filter-sport">
<option value="ALL">All Sports</option>
<option value="NBA">NBA (Basketball)</option>
<option value="NFL">NFL (Football)</option>
<option value="EPL">EPL (Soccer)</option>
<option value="MLB">MLB (Baseball)</option>
<option value="NHL">NHL (Hockey)</option>
</select>
<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 text-[9px]">▼</div>
</div>
<div class="relative">
<select class="w-full py-1.5 pl-2.5 pr-7 bg-[#0b0814]/90 border border-purple-900/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg text-slate-300 text-xs transition cursor-pointer appearance-none" id="filter-market">
<option value="ALL">All Markets</option>
<option value="Parlay">Parlay</option>
<option value="Player Prop">Player Prop</option>
<option value="Straight">Straight</option>
<option value="Live Bet">Live Bet</option>
</select>
<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 text-[9px]">▼</div>
</div>
<div class="relative">
<select class="w-full py-1.5 pl-2.5 pr-7 bg-[#0b0814]/90 border border-purple-900/50 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 rounded-lg text-slate-300 text-xs transition cursor-pointer appearance-none" id="filter-timeframe">
<option value="ALL">All Time</option>
<option value="7D">Last 7 Days</option>
<option value="30D">Last 30 Days</option>
<option selected="" value="90D">Last 90 Days</option>
</select>
<div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 text-[9px]">▼</div>
</div>
</div>
<div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-purple-900/30">
<div class="flex items-center gap-2 flex-wrap">
<span class="text-[11px] text-slate-400 flex items-center gap-1">
<svg class="w-3 h-3 text-purple-400" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 6h18M6 12h12m-9 6h6"></path></svg>
SORT BY:
</span>
<div class="inline-flex rounded-lg bg-[#0b0814] border border-purple-900/50 p-0.5" id="sort-control-group">
<button class="sort-btn px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-500/40 transition" data-sort="date">Date (Newest)</button>
<button class="sort-btn px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-white transition" data-sort="profit">Profit/Loss</button>
<button class="sort-btn px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-white transition" data-sort="stake">Stake Size</button>
</div>
</div>
<div class="flex items-center gap-2 flex-wrap">
<div class="flex items-center gap-1.5 flex-wrap" id="active-filter-chips"></div>
<button class="px-2 py-0.5 rounded text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 transition flex items-center gap-1" id="reset-filters-btn">
<svg class="w-2.5 h-2.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M18 6L6 18M6 6l12 12"></path></svg>
Reset Filters
</button>
</div>
</div>
</div>
<div class="overflow-x-auto rounded-xl border border-purple-900/40 bg-black/40" data-purpose="ledger-table-container">
<table class="w-full text-left font-mono text-xs whitespace-nowrap" id="wager-ledger-table">
<thead>
<tr class="bg-purple-950/40 text-[10px] uppercase tracking-wider text-slate-400 border-b border-purple-900/40">
<th class="py-2.5 px-3 font-semibold">SETTLED ▼</th>
<th class="py-2.5 px-3 font-semibold">EVENT / MARKET</th>
<th class="py-2.5 px-2 font-semibold">SPORT</th>
<th class="py-2.5 px-2 font-semibold">MARKET TYPE</th>
<th class="py-2.5 px-3 font-semibold">ODDS (DEC / AMER)</th>
<th class="py-2.5 px-3 font-semibold text-right">STAKE</th>
<th class="py-2.5 px-3 font-semibold text-center">RESULT</th>
<th class="py-2.5 px-3 font-semibold text-right">PROFIT / LOSS</th>
</tr>
</thead>
<tbody class="divide-y divide-purple-900/30 text-slate-300" id="ledger-tbody"></tbody>
</table>
<div class="hidden flex-col items-center justify-center py-12 px-4 text-center" id="ledger-empty-state">
<div class="w-12 h-12 rounded-xl bg-purple-900/30 border border-purple-500/40 flex items-center justify-center text-purple-400 mb-3 shadow-[0_0_15px_rgba(168,85,247,0.25)]">
<svg class="w-6 h-6" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"></circle><path d="m21 21-4.35-4.35"></path><line x1="8" x2="14" y1="11" y2="11"></line></svg>
</div>
<div class="text-sm font-bold text-slate-200 font-mono tracking-wide">No matching wagers found</div>
<p class="text-xs text-slate-400 font-mono max-w-sm mt-1">Try adjusting your filters, searching for another team or player, or resetting criteria to view settled wagers.</p>
<button class="mt-4 px-3.5 py-1.5 rounded-lg bg-emerald-500/20 text-[#39FF88] border border-[#39FF88]/50 hover:bg-[#39FF88] hover:text-black font-mono font-bold text-xs transition shadow-[0_0_12px_rgba(57,255,136,0.25)]" id="empty-reset-btn">Reset All Filters</button>
</div>
</div>
</article>
<section class="glow-card rounded-2xl p-5 transition-all" data-purpose="hot-takes-panel" id="staHotTakes">
<div class="flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-3">
<div class="flex items-start gap-2">
<div class="p-1.5 rounded-lg bg-amber-500/10 text-amber-400 mt-0.5">
<svg class="w-4 h-4" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"></path></svg>
</div>
<div>
<div class="flex items-center gap-2 flex-wrap">
<h2 class="text-sm font-bold tracking-wide text-amber-400 uppercase font-display">HOT TAKES — TOP MARKET ACTIVITY</h2>
<span class="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">UNCALIBRATED</span>
</div>
<p class="text-xs text-slate-400 font-mono">Ranked by real market activity (volume + liquidity) from public feeds that actually load — not by a model pick. No calibrated model exists yet, so no Hot Take carries a model hit probability or model edge. Nothing here is a wager recommendation and nothing is auto-bet.</p>
</div>
</div>
<div class="flex items-center gap-2 font-mono text-xs flex-shrink-0">
<button class="px-3 py-1.5 rounded-full bg-black/40 border border-purple-800/50 text-slate-300 hover:text-white transition" id="staHotRefresh" type="button">REFRESH</button>
<button class="px-3 py-1.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/50 hover:bg-amber-500 hover:text-black font-bold transition" data-go="AI Scout" id="staHotViewAll" type="button">VIEW ALL IN AI SCOUT ›</button>
</div>
</div>
<div class="grid grid-cols-1 md:grid-cols-2 gap-3" id="staHotGrid">
<p class="text-xs font-mono text-slate-400">Loading real markets…</p>
</div>
<p class="text-xs font-mono text-slate-500 mt-3" id="staHotMeta"></p>
<p class="text-xs font-mono text-slate-500" id="staHotNote"></p>
</section>
</section>
<aside class="space-y-4">
<div class="glow-card rounded-2xl p-5" data-purpose="ai-scout-entry-panel">
<div class="flex items-center justify-between mb-3">
<h3 class="text-sm font-bold font-display uppercase tracking-wider text-slate-200 flex items-center gap-2">
<span class="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
AI SCOUT LIVE WIRE
</h3>
<span class="text-[11px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">LIVE SCAN</span>
</div>
<p class="text-xs text-slate-300 leading-relaxed">Pregame boards, live scores, and market activity from real public feeds (ESPN, Polymarket, Kalshi). Feeds that do not load are shown as unavailable — nothing is filled in with invented picks, percentages, or edges.</p>
<button type="button" data-go="AI Scout" class="mt-4 w-full bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-extrabold text-xs py-2.5 rounded-lg font-display tracking-wider transition-all shadow-md shadow-purple-600/20">OPEN AI SCOUT ›</button>
</div>
<div class="glow-card rounded-2xl p-5" data-purpose="live-edge-radar-panel">
<div class="flex items-center justify-between pb-3 mb-3 border-b border-purple-900/40">
<div class="flex items-center gap-2">
<span class="relative flex h-3 w-3">
<span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
<span class="relative inline-flex rounded-full h-3 w-3 bg-emerald-400"></span>
</span>
<h3 class="text-sm font-bold font-display uppercase tracking-wider text-slate-200">Open Bets Radar</h3>
</div>
<span class="px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/40" id="arnRadarBadge">● 0 OPEN</span>
</div>
<div class="space-y-3 font-mono" data-purpose="radar-opportunities-list" id="arnRadarList"></div>
<div class="pt-4 mt-3 border-t border-purple-900/30">
<button id="arnRadarCta" data-go="Bet Tracker" type="button" class="w-full py-2.5 rounded-xl border-2 border-[#39FF88] bg-emerald-950/40 text-[#39FF88] hover:bg-[#39FF88] hover:text-black transition-all font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(57,255,136,0.3)]">
<span id="arnRadarCtaLabel">VIEW ALL OPEN BETS (0)</span>
<span class="text-sm font-black">›</span>
</button>
</div>
</div>
<div class="glow-card rounded-2xl p-5" data-purpose="connected-sportsbooks-panel">
<div class="flex items-center justify-between mb-3">
<h3 class="text-sm font-bold font-display uppercase tracking-wider text-slate-200">Connected Sportsbooks</h3>
<span class="text-[11px] text-amber-400 font-mono">YOUR CHANNELS</span>
</div>
<div class="grid grid-cols-2 gap-2 text-xs font-mono">
<button type="button" data-go="Sportsbooks" class="p-2.5 rounded bg-black/50 border border-purple-900/40 flex items-center justify-between text-left hover:border-amber-500/60 transition-colors">
<span><span class="text-slate-200 font-bold block">Polymarket</span><span class="text-[10px] text-slate-500">API IMPORT</span></span>
<span class="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span>
</button>
<button type="button" data-go="Sportsbooks" class="p-2.5 rounded bg-black/50 border border-purple-900/40 flex items-center justify-between text-left hover:border-amber-500/60 transition-colors">
<span><span class="text-slate-200 font-bold block">Kalshi</span><span class="text-[10px] text-slate-500">API IMPORT</span></span>
<span class="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0"></span>
</button>
<button type="button" data-go="Sportsbooks" class="p-2.5 rounded bg-black/50 border border-purple-900/40 flex items-center justify-between text-left hover:border-amber-500/60 transition-colors">
<span><span class="text-slate-200 font-bold block">Novig</span><span class="text-[10px] text-slate-500">SLIP UPLOAD</span></span>
<span class="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"></span>
</button>
<button type="button" data-go="Sportsbooks" class="p-2.5 rounded bg-black/50 border border-purple-900/40 flex items-center justify-between text-left hover:border-amber-500/60 transition-colors">
<span><span class="text-slate-200 font-bold block">DraftKings</span><span class="text-[10px] text-slate-500">FRIEND'S · UPLOAD</span></span>
<span class="w-2 h-2 rounded-full bg-amber-400 flex-shrink-0"></span>
</button>
</div>
<p class="text-[11px] text-slate-500 font-mono mt-3">Tap a book to open its import panel. DraftKings slips are a friend's — upload only.</p>
</div>
</aside>
</div>
</div>`;

var ARN_FOOTER = `
<footer class="mt-12 border-t border-purple-900/30 bg-[#040108] py-6 text-center text-xs text-slate-500 font-mono" data-purpose="arena-footer">
<p class="mb-2">BETS <span id="arnFBets" class="text-slate-300 font-bold">0</span> · NET <span id="arnFNet" class="font-bold text-white">$0.00</span> · ROI <span id="arnFRoi" class="font-bold text-white">—</span> · WIN RATE <span id="arnFRate" class="text-slate-300 font-bold">—</span> · WAGERED <span id="arnFWagered" class="text-slate-300 font-bold">$0.00</span> · OPEN POTENTIAL <span id="arnFPot" class="text-slate-300 font-bold">$0.00</span> · OPEN <span id="arnFOpen" class="text-slate-300 font-bold">0</span> · UPDATED <span id="arnFUpdated" class="text-slate-300 font-bold">—</span></p>
<p>BET LAB SYSTEM™ • Real-time Algorithmic Sports Edge Engine &amp; Arbitrage Terminal • v4.8 Quantum Build</p>
</footer>`;

(function () {
  "use strict";
  const STORAGE_KEY = "betlab_clean_real_bets_v1";
  const GREEN = "#39FF88", RED = "#FF3B5C";
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const $ = (id) => document.getElementById(id);
  const dashAll = (sel) => { const d = $("dashboard"); return d ? [...d.querySelectorAll(sel)] : []; };
  let queued = false;

  /* ---------- data (formulas identical to the app) ---------- */
  function readBets() {
    try {
      const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(data) ? data.filter((b) => b && typeof b === "object") : [];
    } catch { return []; }
  }
  function payoutFor(b) {
    const explicit = Number(b.payout);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    const stake = Number(b.stake) || 0, odds = Number(b.odds) || 0;
    return odds === 0 ? 0 : stake + (odds > 0 ? stake * odds / 100 : stake * 100 / Math.abs(odds));
  }
  function pnl(b) {
    const stake = Number(b.stake) || 0;
    if (b.status === "Won") return payoutFor(b) - stake;
    if (b.status === "Lost") return -stake;
    return 0;
  }
  const isSettled = (b) => b.status === "Won" || b.status === "Lost" || b.status === "Push" || b.status === "Void";
  function stats(bets) {
    const won = bets.filter((b) => b.status === "Won");
    const lost = bets.filter((b) => b.status === "Lost");
    const push = bets.filter((b) => b.status === "Push" || b.status === "Void");
    const open = bets.filter((b) => b.status === "Open");
    const settled = bets.filter(isSettled);
    const net = settled.reduce((s, b) => s + pnl(b), 0);
    const settledStakes = settled.reduce((s, b) => s + (Number(b.stake) || 0), 0);
    const decided = won.length + lost.length;
    return {
      total: bets.length, won: won.length, lost: lost.length, push: push.length,
      pending: open.length, settledCount: settled.length,
      wagered: bets.reduce((s, b) => s + (Number(b.stake) || 0), 0),
      openPotential: open.reduce((s, b) => s + payoutFor(b), 0),
      net, settledStakes,
      winRate: decided ? won.length / decided * 100 : null,
      roi: settledStakes ? net / settledStakes * 100 : null
    };
  }
  function betType(b) {
    if (Array.isArray(b.legs) && b.legs.length > 1) return "Parlay";
    const s = String(b.selection || "");
    if (/touchdown|yards|reception|catch/i.test(s)) return "Player Prop";
    if (b.liveBet || b.betType === "live") return "Live Bet";
    return "Straight";
  }
  function fmtMoney(n) { return "$" + Math.abs(n).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }
  /* KPI/footer style: U+2212 minus, explicit + (matches the replica's figures) */
  function fmtKpi(n) { return (n < 0 ? "−" : n > 0 ? "+" : "") + fmtMoney(n); }
  /* Ledger style: ASCII sign (matches the replica's rows) */
  function fmtLedger(n) { return (n < 0 ? "-" : n > 0 ? "+" : "") + fmtMoney(n); }
  function fmtPct(v) { return (v < 0 ? "−" : "") + Math.abs(v).toFixed(1) + "%"; }
  function fmtDate(iso) {
    const d = new Date(iso);
    if (!Number.isFinite(d.getTime())) return "—";
    return MONTHS[d.getMonth()] + " " + d.getDate() + ", " + d.getFullYear();
  }
  function fmtTime(d) {
    let h = d.getHours(); const m = String(d.getMinutes()).padStart(2, "0");
    const ap = h >= 12 ? "PM" : "AM"; h = h % 12 || 12;
    return h + ":" + m + " " + ap;
  }
  function fmtOdds(b) {
    const odds = Number(b.odds) || 0;
    if (!odds) return "—";
    const dec = odds > 0 ? 1 + odds / 100 : 1 + 100 / Math.abs(odds);
    return (odds > 0 ? "+" + odds : "" + odds) + " (" + dec.toFixed(2) + ")";
  }
  function el(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  /* ---------- semantic value painting (replica's own classes) ---------- */
  const KPI_VAL_BASE = "text-2xl font-extrabold font-display tracking-tight";
  function paintKpiValue(node, v) {
    if (!node) return;
    node.className = KPI_VAL_BASE + (v < 0 ? " text-[#FF3B5C]" : v > 0 ? " text-[#39FF88] neon-text-green" : " text-white");
    node.style.textShadow = v < 0 ? "0 0 12px rgba(255, 59, 92, 0.65), 0 0 24px rgba(255, 59, 92, 0.35)" : v > 0 ? "0 0 12px rgba(57, 255, 136, 0.55), 0 0 24px rgba(57, 255, 136, 0.3)" : "";
  }
  function paintFooterValue(node, v) {
    if (!node) return;
    node.className = "font-bold " + (v < 0 ? "text-[#FF3B5C]" : v > 0 ? "text-[#39FF88]" : "text-white");
  }

  /* ---------- top bar + KPI cards (all values from the store) ---------- */
  function renderBar(s) {
    const net = $("arnBarNet");
    if (net) { net.textContent = fmtKpi(s.net); net.style.color = s.net < 0 ? RED : s.net > 0 ? GREEN : "#fff"; }
    const wag = $("arnBarWagered"); if (wag) wag.textContent = fmtMoney(s.wagered);
    const upd = $("arnBarUpdated"); if (upd) upd.textContent = fmtTime(new Date());
  }
  function renderKPIs(s) {
    const net = $("arnKpiNet");
    if (net) { net.textContent = fmtKpi(s.net); paintKpiValue(net, s.net); }
    const nc = $("arnKpiNetChip"); if (nc) nc.textContent = "REC " + s.won + "\u2013" + s.lost;
    const rate = $("arnKpiRate"); if (rate) rate.textContent = s.winRate === null ? "\u2014" : s.winRate.toFixed(1) + "%";
    const rc = $("arnKpiRateChip"); if (rc) rc.textContent = s.settledCount + " SETTLED";
    const rs = $("arnKpiRateSub"); if (rs) rs.textContent = s.won + " W / " + s.lost + " L" + (s.push ? " / " + s.push + " P" : "");
    const wag = $("arnKpiWagered"); if (wag) wag.textContent = fmtMoney(s.wagered);
    const ws = $("arnKpiWagSub"); if (ws) ws.textContent = s.total + (s.total === 1 ? " BET" : " BETS") + " \u00b7 " + (s.total ? "$" + (s.wagered / s.total).toFixed(2) + " AVG" : "\u2014");
    const pot = $("arnKpiPot"); if (pot) pot.textContent = fmtMoney(s.openPotential);
    const ps = $("arnKpiPotSub"); if (ps) ps.textContent = s.pending + " OPEN BETS";
  }

  /* ---------- chart (replica geometry: 800x240, zero at y=125, 35px ticks) ---------- */
  const F = { status: "ALL", sport: "ALL", market: "ALL", tf: "90D", search: "", sort: "date", chartTf: "90" };
  function smoothPath(pts) {
    if (pts.length < 2) return "";
    const P = (i) => pts[Math.max(0, Math.min(pts.length - 1, i))];
    let d = "M " + pts[0].x.toFixed(1) + " " + pts[0].y.toFixed(1);
    for (let i = 0; i < pts.length - 1; i++) {
      const p0 = P(i - 1), p1 = P(i), p2 = P(i + 1), p3 = P(i + 2);
      const c1x = p1.x + (p2.x - p0.x) / 6, c1y = p1.y + (p2.y - p0.y) / 6;
      const c2x = p2.x - (p3.x - p1.x) / 6, c2y = p2.y - (p3.y - p1.y) / 6;
      d += " C " + c1x.toFixed(1) + " " + c1y.toFixed(1) + ", " + c2x.toFixed(1) + " " + c2y.toFixed(1) + ", " + p2.x.toFixed(1) + " " + p2.y.toFixed(1);
    }
    return d;
  }
  function renderChart(bets, s) {
    const line = $("arnChartLine"), area = $("arnChartArea");
    if (!line || !area) return;
    const settled = bets.filter(isSettled)
      .map((b) => ({ t: new Date(b.placedAt || b.createdAt || 0).getTime(), v: pnl(b) }))
      .filter((x) => Number.isFinite(x.t))
      .sort((a, b) => a.t - b.t);
    const setTicks = (step) => {
      const labels = [3 * step, 2 * step, step, 0, -step, -2 * step, -3 * step]
        .map((v) => (v > 0 ? "+$" + v : v === 0 ? "$0" : "−$" + Math.abs(v)));
      [$("arnYLeft"), $("arnYRight")].forEach((col) => {
        if (!col) return;
        [...col.querySelectorAll("span")].forEach((sp, i) => { if (labels[i]) sp.textContent = labels[i]; });
      });
      return 35 / step;
    };
    if (!settled.length) {
      const px = setTicks(3);
      const flat = "M 0.0 125.0 L 800.0 125.0";
      line.setAttribute("d", flat); line.setAttribute("stroke", GREEN);
      area.setAttribute("d", flat + " L 800 230 L 0 230 Z");
      return;
    }
    const end = settled[settled.length - 1].t;
    const days = F.chartTf === "ALL" ? Infinity : Number(F.chartTf);
    const start = days === Infinity ? settled[0].t : end - days * 86400000;
    const carry = settled.filter((x) => x.t < start).reduce((sum, x) => sum + x.v, 0);
    const inside = settled.filter((x) => x.t >= start && x.t <= end);
    let cum = carry;
    const vals = [carry];
    for (const x of inside) { cum += x.v; vals.push(cum); }
    if (vals.length === 1) vals.push(cum);
    const finalV = vals[vals.length - 1];
    const maxAbs = Math.max(0, ...vals.map((v) => Math.abs(v)));
    const step = Math.max(1, Math.ceil(maxAbs / 3));
    const pxPerUnit = setTicks(step);
    const Y = (v) => 125 - v * pxPerUnit;
    const pts = vals.map((v, i) => ({ x: i * 800 / (vals.length - 1), y: Y(v) }));
    const dLine = smoothPath(pts);
    const color = finalV >= 0 ? GREEN : RED;
    line.setAttribute("d", dLine);
    line.setAttribute("stroke", color);
    area.setAttribute("d", dLine + " L 800 230 L 0 230 Z");
    const grad = $("arnProfitGrad");
    if (grad) grad.querySelectorAll("stop").forEach((st) => st.setAttribute("stop-color", color));
    const dot = $("arnChartDot");
    if (dot) { dot.setAttribute("cy", Y(finalV).toFixed(1)); dot.setAttribute("fill", color); }
    const base = $("arnChartBase"); if (base) base.setAttribute("d", "M 0 125.0 L 800 125.0");
    const baseDot = $("arnChartBaseDot"); if (baseDot) baseDot.setAttribute("cy", "125.0");
    /* callout chip */
    const lastDate = new Date(end);
    const cd = $("arnCalloutDate");
    if (cd) {
      const txt = [...cd.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());
      if (txt) txt.nodeValue = " " + MONTHS[lastDate.getMonth()].toUpperCase() + " " + lastDate.getDate() + ", " + lastDate.getFullYear() + " ";
    }
    const cn = $("arnCalloutNet"); if (cn) cn.textContent = fmtKpi(finalV) + " NET";
    const crow = $("arnCalloutNetRow"); if (crow) crow.className = crow.className.replace(/text-\[#FF3B5C\]|text-[#39FF88]/g, "").trim() + (finalV < 0 ? " text-[#FF3B5C]" : " text-[#39FF88]");
    const cr = $("arnCalloutRec"); if (cr) cr.textContent = s.won + " W / " + s.lost + " L";
    /* x-axis labels: first in-window settlement carries the date */
    const xa = $("arnXAxis");
    if (xa) {
      xa.replaceChildren();
      inside.forEach((x, i) => {
        const d = new Date(x.t);
        xa.appendChild(el("span", null, i === 0 ? MONTHS[d.getMonth()] + " " + d.getDate() + " · " + fmtTime(d) : fmtTime(d)));
      });
      xa.appendChild(el("span", "text-[#FF3B5C] font-bold", "Final"));
    }
    /* legend pills */
    const l1 = $("arnLegSettled"); if (l1) l1.textContent = s.settledCount + " · " + s.won + " W / " + s.lost + " L";
    const l2 = $("arnLegRate"); if (l2) l2.textContent = s.winRate === null ? "—" : s.winRate.toFixed(1) + "%";
    const l3 = $("arnLegAvg"); if (l3) l3.textContent = s.total ? "$" + (s.wagered / s.total).toFixed(2) + " avg" : "—";
    const l4 = $("arnLegPot"); if (l4) l4.textContent = fmtMoney(s.openPotential);
  }

  /* ---------- ledger (replica rows, replica filter behaviour) ---------- */
  function daysAgo(iso, maxT) {
    const t = new Date(iso || 0).getTime();
    if (!Number.isFinite(t) || !maxT) return 0;
    const a = new Date(t), b = new Date(maxT);
    a.setHours(0, 0, 0, 0); b.setHours(0, 0, 0, 0);
    return Math.max(0, Math.round((b - a) / 86400000));
  }
  function buildRow(b, maxT) {
    const tr = el("tr", "wager-row hover:bg-purple-950/20 transition-colors");
    const type = betType(b);
    const p = pnl(b);
    tr.dataset.date = String(b.placedAt || "").slice(0, 10);
    tr.dataset.daysAgo = String(daysAgo(b.placedAt, maxT));
    tr.dataset.edge = "0";
    tr.dataset.market = type;
    tr.dataset.profit = p.toFixed(2);
    tr.dataset.search = ((b.selection || "") + " " + (b.game || "") + " " + (b.book || "") + " " + type + " " + (b.sport || "")).toLowerCase();
    tr.dataset.sport = b.sport || "";
    tr.dataset.stake = String(Number(b.stake) || 0);
    tr.dataset.status = b.status === "Won" ? "WON" : b.status === "Lost" ? "LOST" : "PUSH";
    tr.appendChild(el("td", "py-2 px-3 text-slate-400", fmtDate(b.placedAt)));
    tr.appendChild(el("td", "py-2 px-3 font-semibold text-white", b.selection || b.game || "Bet"));
    tr.appendChild(el("td", "py-2 px-2 text-slate-400 font-bold", b.sport || "—"));
    tr.appendChild(el("td", "py-2 px-2 text-slate-300", type + " · " + (b.book || "—")));
    tr.appendChild(el("td", "py-2 px-3 text-amber-300", fmtOdds(b)));
    tr.appendChild(el("td", "py-2 px-3 text-right text-slate-300", fmtMoney(Number(b.stake) || 0)));
    const rc = el("td", "py-2 px-3 text-center");
    const pillCls = b.status === "Won"
      ? "px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-[#39FF88] border border-[#39FF88]/40 shadow-[0_0_8px_rgba(57,255,136,0.25)]"
      : b.status === "Lost"
        ? "px-2 py-0.5 rounded text-[10px] font-bold bg-[#FF3B5C]/20 text-[#FF3B5C] border border-[#FF3B5C]/40"
        : "px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/40";
    rc.appendChild(el("span", pillCls, tr.dataset.status));
    tr.appendChild(rc);
    const plCls = "py-2 px-3 text-right font-bold " + (b.status === "Won" ? "text-[#39FF88]" : b.status === "Lost" ? "text-[#FF3B5C]" : "text-slate-300");
    tr.appendChild(el("td", plCls, (b.status === "Push" || b.status === "Void") ? "$0.00" : fmtLedger(p)));
    return tr;
  }
  function renderLedger(bets) {
    const tbody = $("ledger-tbody");
    if (!tbody) return;
    const settled = bets.filter(isSettled)
      .sort((a, b) => String(b.placedAt || "").localeCompare(String(a.placedAt || "")));
    const maxT = settled.reduce((m, b) => Math.max(m, new Date(b.placedAt || 0).getTime() || 0), 0);
    tbody.replaceChildren();
    for (const b of settled) tbody.appendChild(buildRow(b, maxT));
    applyFiltersAndSort();
  }
  function updateActiveChips() {
    const wrap = $("active-filter-chips");
    if (!wrap) return;
    wrap.replaceChildren();
    const chips = [];
    if (F.status !== "ALL") chips.push({ label: "Status: " + F.status, type: "status" });
    if (F.sport !== "ALL") chips.push({ label: "Sport: " + F.sport, type: "sport" });
    if (F.market !== "ALL") chips.push({ label: "Market: " + F.market, type: "market" });
    if (F.tf !== "ALL") chips.push({ label: "Window: " + F.tf, type: "timeframe" });
    if (F.search.trim() !== "") chips.push({ label: '"' + F.search + '"', type: "search" });
    for (const chip of chips) {
      const span = el("span", "px-1.5 py-0.5 rounded text-[10px] bg-purple-900/50 text-purple-200 border border-purple-500/40 flex items-center gap-1");
      /* label via textContent ONLY — raw search text never becomes markup
       * (the Stitch original's innerHTML sink stays closed). */
      span.appendChild(document.createTextNode(chip.label + " "));
      const x = el("span", "cursor-pointer hover:text-white", "×");
      x.setAttribute("data-remove", chip.type);
      x.addEventListener("click", (e) => {
        e.stopPropagation();
        const t = chip.type;
        if (t === "status") setStatus("ALL");
        if (t === "sport") { const s = $("filter-sport"); if (s) s.value = "ALL"; F.sport = "ALL"; }
        if (t === "market") { const s = $("filter-market"); if (s) s.value = "ALL"; F.market = "ALL"; }
        if (t === "timeframe") { const s = $("filter-timeframe"); if (s) s.value = "ALL"; F.tf = "ALL"; }
        if (t === "search") { const s = $("filter-search"); if (s) s.value = ""; F.search = ""; }
        applyFiltersAndSort();
      });
      span.appendChild(x);
      wrap.appendChild(span);
    }
  }
  function setStatus(status) {
    F.status = status;
    dashAll(".status-btn").forEach((btn) => {
      const on = btn.getAttribute("data-status") === status;
      btn.className = "status-btn px-2.5 py-0.5 rounded-full transition-all " + (on ? "text-black font-bold bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.5)]" : "text-slate-400 hover:text-white");
    });
  }
  function applyFiltersAndSort() {
    const tbody = $("ledger-tbody");
    if (!tbody) return;
    const rows = [...tbody.querySelectorAll(".wager-row")];
    const total = rows.length;
    rows.sort((a, b) => {
      if (F.sort === "profit") return parseFloat(b.dataset.profit) - parseFloat(a.dataset.profit);
      if (F.sort === "stake") return parseFloat(b.dataset.stake) - parseFloat(a.dataset.stake);
      if (F.sort === "edge") return parseFloat(b.dataset.edge) - parseFloat(a.dataset.edge);
      return new Date(b.dataset.date) - new Date(a.dataset.date);
    });
    let visible = 0;
    for (const row of rows) {
      const dAgo = parseInt(row.getAttribute("data-days-ago"), 10);
      let matchTime = true;
      if (F.tf === "7D") matchTime = dAgo <= 7;
      else if (F.tf === "30D") matchTime = dAgo <= 30;
      else if (F.tf === "90D") matchTime = dAgo <= 90;
      const ok = (F.status === "ALL" || row.getAttribute("data-status") === F.status)
        && (F.sport === "ALL" || row.getAttribute("data-sport") === F.sport)
        && (F.market === "ALL" || row.getAttribute("data-market") === F.market)
        && matchTime
        && (!F.search || (row.getAttribute("data-search") || "").includes(F.search.toLowerCase()));
      row.style.display = ok ? "" : "none";
      if (ok) visible++;
      tbody.appendChild(row);
    }
    const counter = $("ledger-counter");
    if (counter) counter.textContent = "Showing " + visible + " of " + total;
    const empty = $("ledger-empty-state"), table = $("wager-ledger-table");
    if (empty && table) {
      if (visible === 0) { empty.classList.remove("hidden"); empty.classList.add("flex"); table.classList.add("hidden"); }
      else { empty.classList.add("hidden"); empty.classList.remove("flex"); table.classList.remove("hidden"); }
    }
    updateActiveChips();
  }
  function resetFilters() {
    setStatus("ALL");
    F.sport = "ALL"; F.market = "ALL"; F.tf = "ALL"; F.search = ""; F.sort = "date";
    const sp = $("filter-sport"); if (sp) sp.value = "ALL";
    const mk = $("filter-market"); if (mk) mk.value = "ALL";
    const tf = $("filter-timeframe"); if (tf) tf.value = "ALL";
    const se = $("filter-search"); if (se) se.value = "";
    dashAll(".sort-btn").forEach((b) => {
      const on = b.getAttribute("data-sort") === "date";
      b.className = "sort-btn px-2 py-0.5 rounded text-[11px] transition " + (on ? "font-semibold bg-purple-950/80 text-purple-300 border border-purple-500/40" : "text-slate-400 hover:text-white");
    });
    applyFiltersAndSort();
  }
  function wireLedger() {
    dashAll(".status-btn").forEach((btn) => {
      btn.addEventListener("click", () => { setStatus(btn.getAttribute("data-status")); applyFiltersAndSort(); });
    });
    const se = $("filter-search");
    if (se) se.addEventListener("input", (e) => { F.search = e.target.value.trim(); applyFiltersAndSort(); });
    const sp = $("filter-sport");
    if (sp) sp.addEventListener("change", (e) => { F.sport = e.target.value; applyFiltersAndSort(); });
    const mk = $("filter-market");
    if (mk) mk.addEventListener("change", (e) => { F.market = e.target.value; applyFiltersAndSort(); });
    const tf = $("filter-timeframe");
    if (tf) tf.addEventListener("change", (e) => { F.tf = e.target.value; applyFiltersAndSort(); });
    dashAll(".sort-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        F.sort = btn.getAttribute("data-sort");
        dashAll(".sort-btn").forEach((b) => {
          const on = b === btn;
          b.className = "sort-btn px-2 py-0.5 rounded text-[11px] transition " + (on ? "font-semibold bg-purple-950/80 text-purple-300 border border-purple-500/40" : "text-slate-400 hover:text-white");
        });
        applyFiltersAndSort();
      });
    });
    const rb = $("reset-filters-btn"); if (rb) rb.addEventListener("click", resetFilters);
    const eb = $("empty-reset-btn"); if (eb) eb.addEventListener("click", resetFilters);
    dashAll("[data-chart-tf]").forEach((btn) => {
      btn.addEventListener("click", () => {
        F.chartTf = btn.getAttribute("data-chart-tf");
        dashAll("[data-chart-tf]").forEach((b) => {
          const on = b === btn;
          b.className = "px-2.5 py-0.5 rounded-full transition " + (on ? "text-black font-bold bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.6)]" : "text-slate-400 hover:text-white");
        });
        update();
      });
    });
  }

  /* ---------- radar (open positions from the store) ---------- */
  function radarItem(b) {
    const item = el("div", "p-3 rounded-xl bg-black/40 border border-slate-800 hover:border-[#39FF88]/50 transition-all cursor-pointer group");
    item.addEventListener("click", () => { if (typeof window.go === "function") window.go("Bet Tracker"); });
    const row = el("div", "flex items-start justify-between gap-2");
    const left = el("div", "flex items-start gap-2.5");
    left.appendChild(el("span", "p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs", "🏈"));
    const mid = el("div");
    mid.appendChild(el("div", "text-xs font-semibold text-slate-400", (b.sport || "—") + " • " + betType(b) + " · " + (b.book || "—")));
    mid.appendChild(el("div", "text-sm font-bold text-white group-hover:text-[#39FF88] transition-colors", b.game || b.selection || "Bet"));
    mid.appendChild(el("div", "text-xs text-slate-400 font-semibold mt-0.5", b.selection || ""));
    left.appendChild(mid);
    const right = el("div", "text-right");
    right.appendChild(el("div", "text-xs font-bold text-[#39FF88]", "Pays: " + fmtMoney(payoutFor(b))));
    right.appendChild(el("div", "text-[10px] text-slate-400", "Stake: " + fmtMoney(Number(b.stake) || 0)));
    right.appendChild(el("span", "text-xs text-slate-500 group-hover:text-[#39FF88] transition-colors font-bold", "›"));
    row.append(left, right);
    item.appendChild(row);
    return item;
  }
  function renderRadar(bets, s) {
    const list = $("arnRadarList");
    if (!list) return;
    const open = bets.filter((b) => b.status === "Open")
      .sort((a, b) => String(b.placedAt || "").localeCompare(String(a.placedAt || "")));
    list.replaceChildren();
    if (!open.length) list.appendChild(el("div", "p-3 rounded-xl bg-black/40 border border-slate-800 text-xs text-slate-400 font-mono", "No open bets."));
    open.forEach((b, i) => {
      list.appendChild(radarItem(b));
      if (i === 0) {
        const banner = el("div", "px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-900/60 via-pink-900/40 to-dark-900 border border-purple-500/50 shadow-[0_0_18px_rgba(176,38,255,0.3)] flex items-center justify-between");
        banner.setAttribute("data-purpose", "open-potential-callout");
        const bl = el("div", "flex items-center gap-2");
        bl.appendChild(el("span", "text-amber-400 text-sm", "⚡"));
        bl.appendChild(el("span", "text-xs font-black tracking-wider text-purple-200 uppercase", "OPEN POTENTIAL — " + fmtMoney(s.openPotential)));
        banner.append(bl, el("span", "text-[10px] text-[#39FF88] font-bold", s.pending + " OPEN"));
        list.appendChild(banner);
      }
    });
    const badge = $("arnRadarBadge"); if (badge) badge.textContent = "● " + s.pending + " OPEN";
    const cta = $("arnRadarCtaLabel"); if (cta) cta.textContent = "VIEW ALL OPEN BETS (" + s.pending + ")";
  }

  /* ---------- footer ribbon ---------- */
  function renderFooter(s) {
    const set = (id, text) => { const n = $(id); if (n) n.textContent = text; };
    set("arnFBets", String(s.total));
    const fn = $("arnFNet"); if (fn) { fn.textContent = fmtKpi(s.net); paintFooterValue(fn, s.net); }
    const fr = $("arnFRoi"); if (fr) { fr.textContent = s.roi === null ? "—" : fmtPct(s.roi); paintFooterValue(fr, s.roi === null ? 0 : s.roi); }
    set("arnFRate", s.winRate === null ? "—" : s.winRate.toFixed(1) + "%");
    set("arnFWagered", fmtMoney(s.wagered));
    set("arnFPot", fmtMoney(s.openPotential));
    set("arnFOpen", String(s.pending));
    set("arnFUpdated", fmtTime(new Date()));
  }

  /* ---------- top-bar pill sync (router owns navigation) ---------- */
  const PILL_ON = "flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold shadow-lg shadow-amber-500/20 transition-all whitespace-nowrap";
  const PILL_OFF = "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-purple-900/40 transition-colors whitespace-nowrap";
  function syncPills(name) {
    document.querySelectorAll("#staNav [data-go]").forEach((p) => {
      p.className = p.dataset.go === name ? PILL_ON : PILL_OFF;
    });
  }

  /* ---------- update cycle ---------- */
  function placeBoard() {
    // Marquis (Nov 3, 2026): Today's Board box sits immediately before the
    // Recent Wager Ledger (audit) box on the Home Screen. The board node is
    // the app's own #todayBoard (renderBoard fills it by id, so the move is
    // safe); re-asserted on every update pass so it cannot drift back.
    const board = document.getElementById("todayBoard");
    const ledger = document.querySelector('[data-purpose="recent-wager-ledger-panel"]');
    if (!board || !ledger || !ledger.parentElement) return;
    if (board.parentElement === ledger.parentElement && board.nextElementSibling === ledger) return;
    ledger.parentElement.insertBefore(board, ledger);
  }
  function update() {
    const bets = readBets();
    const s = stats(bets);
    renderBar(s);
    renderKPIs(s);
    renderChart(bets, s);
    renderLedger(bets);
    renderRadar(bets, s);
    renderFooter(s);
    placeBoard();
  }
  function scheduleUpdate() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => { queued = false; update(); });
  }

  function wireArena() {
    const sync = $("arnSyncBooks");
    if (sync) sync.addEventListener("click", () => { syncPills("Sportsbooks"); if (typeof window.go === "function") window.go("Sportsbooks"); });
    const add = $("arnAddBet");
    if (add) add.addEventListener("click", () => {
      syncPills("Bet Tracker");
      if (typeof window.go === "function") window.go("Bet Tracker");
      window.setTimeout(() => {
        const form = $("betForm");
        if (form && form.scrollIntoView) form.scrollIntoView({ behavior: "smooth", block: "center" });
        const game = $("game"); if (game && game.focus) game.focus({ preventScroll: true });
      }, 350);
    });
  }
  function mount() {
    const main = document.querySelector(".main");
    const dashboard = $("dashboard");
    if (!main || !dashboard || document.body.classList.contains("arn-on")) return;
    try {
      main.insertAdjacentHTML("afterbegin", ARN_HEADER);
      dashboard.insertAdjacentHTML("afterbegin", ARN_BANNER + ARN_MAIN);
      document.body.insertAdjacentHTML("beforeend", ARN_FOOTER);
      document.body.classList.add("arn-on");
      document.body.dataset.arenaLive = "live";
      wireLedger();
      wireArena();
      syncPills("Dashboard");
      document.addEventListener("click", (e) => {
        const g = e.target && e.target.closest ? e.target.closest("[data-go]") : null;
        if (g) syncPills(g.dataset.go);
      });
      update();
      document.addEventListener("betlab-board-rendered", scheduleUpdate);
      window.addEventListener("storage", (e) => { if (e.key === STORAGE_KEY) scheduleUpdate(); });
      const observed = $("kpiProfit");
      if (observed) new MutationObserver(scheduleUpdate).observe(observed, { characterData: true, childList: true, subtree: true });
      window.setInterval(() => { if (!document.hidden) scheduleUpdate(); }, 4000);
    } catch (err) {
      console.error("Arena live integration could not initialize; app unchanged.", err);
      document.body.classList.remove("arn-on");
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();

