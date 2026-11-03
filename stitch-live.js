/* Bet Lab LIVE — Stitch design integration (stitch-live.js).
 * Markup constants are the Stitch design (betlab-stitch-exact) with
 * binding hooks added (sta* ids, data-go router pills, data-chart-tf)
 * and every static figure scrubbed to a neutral placeholder: all values
 * on the dashboard are computed at runtime from the production store.
 * The design source file itself is untouched. */
var STA_AMBIENT = "<div class=\"fixed inset-0 pointer-events-none z-0 overflow-hidden\" data-purpose=\"ambient-lighting\">\n<div class=\"absolute -top-40 left-1/4 w-[600px] h-[500px] bg-emerald-600/15 rounded-full blur-[140px]\"></div>\n<div class=\"absolute top-10 right-10 w-[600px] h-[500px] bg-purple-600/15 rounded-full blur-[150px]\"></div>\n<div class=\"absolute top-1/2 left-[-150px] w-[500px] h-[500px] bg-pink-600/10 rounded-full blur-[140px]\"></div>\n<div class=\"absolute bottom-10 right-1/3 w-[700px] h-[450px] bg-emerald-500/10 rounded-full blur-[160px]\"></div>\n</div>";
var STA_HEADER = "<header id=\"staHeader\" class=\"sticky top-0 z-50 w-full glass-panel border-b border-purple-900/40 bg-dark-900/90\" data-purpose=\"top-navigation-bar\">\n<div class=\"max-w-[1720px] mx-auto px-4 lg:px-6 h-14 flex items-center justify-between gap-4\">\n<!-- Brand Logo Left -->\n<div class=\"flex items-center gap-3 flex-shrink-0\" data-purpose=\"brand-logo\">\n<div class=\"w-8 h-8 rounded-lg bg-dark-800 border border-neon-green/60 flex items-center justify-center shadow-[0_0_12px_rgba(57,255,136,0.45)]\">\n<!-- Flask/Atom Icon SVG -->\n<svg class=\"w-5 h-5 text-neon-green\" fill=\"none\" stroke=\"currentColor\" stroke-linecap=\"round\" stroke-linejoin=\"round\" stroke-width=\"2\" viewbox=\"0 0 24 24\">\n<path d=\"M10 2v7.31L4.17 18.23A2 2 0 0 0 5.86 21h12.28a2 2 0 0 0 1.69-2.77L14 9.31V2\"></path>\n<path d=\"M8.5 2h7\"></path>\n<path d=\"M14 9.3a6.5 6.5 0 1 1-4 0\"></path>\n<circle cx=\"12\" cy=\"15\" fill=\"currentColor\" r=\"1\"></circle>\n</svg>\n</div>\n<span class=\"text-xl font-black tracking-wider text-neon-green neon-text-green font-mono\">BET LAB</span>\n</div>\n<!-- Center Navigation Links / Mode Capsules -->\n<nav id=\"staNav\" class=\"hidden xl:flex items-center gap-1.5 text-xs font-semibold tracking-wider text-slate-300\" data-purpose=\"main-nav-pills\">\n<button type=\"button\" data-go=\"Dashboard\" class=\"flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neon-green text-dark-950 font-bold shadow-[0_0_14px_rgba(57,255,136,0.5)] transition-all\">\n<svg class=\"w-3.5 h-3.5\" fill=\"currentColor\" viewbox=\"0 0 24 24\">\n<path d=\"M4 13h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1zm-1 7a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v4zm10 0a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1v-7a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v7zm1-17a1 1 0 0 0-1 1v4a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V4a1 1 0 0 0-1-1h-6z\"></path>\n</svg>\n          DASHBOARD</button>\n<button type=\"button\" data-go=\"Today’s Board\" class=\"flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-dark-700/60 transition-colors\">\nTODAY’S BOARD</button>\n<button type=\"button\" data-go=\"Bet Tracker\" class=\"flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-dark-700/60 transition-colors\">\nBET TRACKER</button>\n<button type=\"button\" data-go=\"Sportsbooks\" class=\"flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-dark-700/60 transition-colors\">\nSPORTSBOOKS</button>\n<button type=\"button\" data-go=\"Live Record\" class=\"flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-dark-700/60 transition-colors\">\nLIVE RECORD</button>\n<button type=\"button\" data-go=\"Analytics\" class=\"flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-dark-700/60 transition-colors\">\nANALYTICS</button>\n<button type=\"button\" data-go=\"Slip Importer\" class=\"flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-dark-700/60 transition-colors\">\nSLIP IMPORTER</button>\n<button type=\"button\" data-go=\"AI Scout\" class=\"flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-dark-700/60 transition-colors\">\nAI Scout</button>\n</nav>\n<!-- Right Utility Actions -->\n<div class=\"flex items-center gap-3\" data-purpose=\"user-actions\">\n<!-- Search Button -->\n<button class=\"w-8 h-8 rounded-full bg-dark-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white hover:border-slate-500 transition-colors\" title=\"Search Markets\">\n<svg class=\"w-4 h-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" viewbox=\"0 0 24 24\"><circle cx=\"11\" cy=\"11\" r=\"8\"></circle><path d=\"m21 21-4.35-4.35\"></path></svg>\n</button>\n<!-- Alert Bell with Active Dot -->\n<div class=\"relative\">\n<button class=\"w-8 h-8 rounded-full bg-dark-800 border border-slate-700 flex items-center justify-center text-slate-300 hover:text-white transition-colors\" title=\"Notifications\">\n<svg class=\"w-4 h-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" viewbox=\"0 0 24 24\"><path d=\"M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9\"></path><path d=\"M10.3 21a1.94 1.94 0 0 0 3.4 0\"></path></svg>\n</button>\n<span class=\"absolute top-0 right-0 w-2.5 h-2.5 bg-neon-green rounded-full shadow-[0_0_6px_#39FF88]\"></span>\n</div>\n<!-- User Avatar -->\n<div class=\"w-8 h-8 rounded-full bg-gradient-to-tr from-purple-600 via-indigo-600 to-neon-green p-[1px] cursor-pointer\">\n<div class=\"w-full h-full rounded-full bg-dark-900 flex items-center justify-center text-xs font-bold text-white font-mono\">\n            BL\n          </div>\n</div>\n</div>\n</div>\n</header>";
var STA_HERO = "<section class=\"relative w-full overflow-hidden border-b border-purple-900/30 py-5 bg-gradient-to-b from-dark-900 via-dark-950 to-dark-900\" data-purpose=\"epic-brand-hero\">\n<!-- Cyber Background Hologram Grid & Radial Atmosphere -->\n<div class=\"absolute inset-0 hologram-grid opacity-25 pointer-events-none\"></div>\n<div class=\"absolute inset-x-0 top-1/2 -translate-y-1/2 h-44 hero-glow-ring pointer-events-none\"></div>\n<div class=\"max-w-[1720px] mx-auto px-4 lg:px-6 relative z-10\">\n<div class=\"flex flex-col lg:flex-row items-center justify-between gap-6\">\n<!-- Flanking Hologram Visual Left: Cybernetic American Football Neon Helmet -->\n<div class=\"hidden lg:flex items-center justify-center w-52 h-28 relative rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-2 shadow-[0_0_25px_rgba(16,185,129,0.2)] overflow-hidden\" data-purpose=\"hologram-left\">\n<div class=\"absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-emerald-500/20 via-transparent to-transparent\"></div>\n<!-- Futuristic Football Graphic SVG -->\n<svg class=\"w-20 h-20 text-neon-green drop-shadow-[0_0_12px_rgba(57,255,136,0.8)] opacity-90\" fill=\"none\" stroke=\"currentColor\" viewbox=\"0 0 100 100\">\n<ellipse cx=\"50\" cy=\"50\" rx=\"42\" ry=\"24\" stroke-width=\"2.5\" transform=\"rotate(-30 50 50)\"></ellipse>\n<path d=\"M22 66 L78 34\" stroke-dasharray=\"2 3\" stroke-width=\"2.5\"></path>\n<path d=\"M42 42 L48 54 M49 38 L55 50 M56 34 L62 46\" stroke-width=\"2\"></path>\n<circle cx=\"50\" cy=\"50\" fill=\"#39FF88\" r=\"3\"></circle>\n</svg>\n<div class=\"absolute bottom-1 text-[9px] font-mono tracking-widest text-emerald-400 font-bold uppercase\" id=\"staHoloLeft\"></div>\n</div>\n<!-- Center Epic Title & Cyber Orbital Badge -->\n<div class=\"text-center flex-1 max-w-2xl mx-auto\" data-purpose=\"hero-title-unit\">\n<div class=\"inline-flex items-center gap-2 mb-1\">\n<span class=\"h-[1px] w-8 bg-gradient-to-r from-transparent to-neon-green\"></span>\n<div class=\"flex items-center gap-2\">\n<span class=\"text-2xl md:text-3xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.8)]\">BET</span>\n<span class=\"text-2xl md:text-3xl font-black italic tracking-tighter text-neon-green neon-text-green\">LAB</span>\n</div>\n<span class=\"h-[1px] w-8 bg-gradient-to-l from-transparent to-neon-green\"></span>\n</div>\n<h1 class=\"text-xs md:text-sm uppercase font-mono tracking-[0.25em] text-slate-300 font-semibold mb-3\">\n            Algorithmic Sports Arbitrage &amp; Quantitative Edge Engine\n          </h1>\n<!-- League Filter Pills Bar -->\n<div class=\"flex flex-wrap items-center justify-center gap-1.5\" data-purpose=\"sports-league-selector\">\n<button class=\"px-3.5 py-1 text-[11px] font-bold rounded-full bg-neon-green text-dark-950 font-mono shadow-[0_0_12px_rgba(57,255,136,0.4)] transition\">\n              ALL LEAGUES\n            </button>\n<button class=\"px-3 py-1 text-[11px] font-medium rounded-full bg-dark-800/80 border border-slate-700/80 text-slate-300 hover:border-slate-500 hover:text-white font-mono transition\">\n              NBA\n            </button>\n<button class=\"px-3 py-1 text-[11px] font-medium rounded-full bg-dark-800/80 border border-slate-700/80 text-slate-300 hover:border-slate-500 hover:text-white font-mono transition\">\n              NFL\n            </button>\n<button class=\"px-3 py-1 text-[11px] font-medium rounded-full bg-dark-800/80 border border-slate-700/80 text-slate-300 hover:border-slate-500 hover:text-white font-mono transition\">\n              NCAAF\n            </button>\n<button class=\"px-3 py-1 text-[11px] font-medium rounded-full bg-dark-800/80 border border-slate-700/80 text-slate-300 hover:border-slate-500 hover:text-white font-mono transition\">\n              MLB\n            </button>\n<button class=\"px-3 py-1 text-[11px] font-medium rounded-full bg-dark-800/80 border border-slate-700/80 text-slate-300 hover:border-slate-500 hover:text-white font-mono transition\">\n              NHL\n            </button>\n<button class=\"px-3 py-1 text-[11px] font-medium rounded-full bg-dark-800/80 border border-slate-700/80 text-slate-300 hover:border-slate-500 hover:text-white font-mono transition\">\n              UFC\n            </button>\n<button class=\"px-3 py-1 text-[11px] font-medium rounded-full bg-dark-800/80 border border-slate-700/80 text-slate-300 hover:border-slate-500 hover:text-white font-mono transition\">\n              SOCCER\n            </button>\n<button class=\"px-2.5 py-1 text-[11px] font-medium rounded-full bg-dark-800/80 border border-slate-700/80 text-slate-400 hover:text-white font-mono flex items-center gap-1 transition\">\n              MORE <span class=\"text-[9px]\">▼</span>\n</button>\n</div>\n</div>\n<!-- Flanking Hologram Visual Right: Warm Neon Basketball Player Dunk Hologram -->\n<div class=\"hidden lg:flex items-center justify-center w-52 h-28 relative rounded-xl border border-amber-500/30 bg-amber-950/20 p-2 shadow-[0_0_25px_rgba(245,158,11,0.2)] overflow-hidden\" data-purpose=\"hologram-right\">\n<div class=\"absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-amber-500/20 via-transparent to-transparent\"></div>\n<!-- Hologram Basketball Net / Player Silhouette Vector -->\n<svg class=\"w-20 h-20 text-neon-orange drop-shadow-[0_0_12px_rgba(255,107,0,0.8)] opacity-90\" fill=\"none\" stroke=\"currentColor\" viewbox=\"0 0 100 100\">\n<circle cx=\"48\" cy=\"22\" r=\"7\" stroke-width=\"2\"></circle>\n<path d=\"M48 29 L48 55 L38 68 M48 55 L60 68\" stroke-width=\"2.5\"></path>\n<path d=\"M48 35 L68 20 M48 37 L30 45\" stroke-width=\"2.5\"></path>\n<circle cx=\"72\" cy=\"18\" fill=\"#ff6b00\" r=\"5\" stroke-width=\"2\"></circle>\n<path d=\"M68 26 L86 26 L78 44 Z\" stroke-dasharray=\"2 2\" stroke-width=\"1.8\"></path>\n</svg>\n<div class=\"absolute bottom-1 text-[9px] font-mono tracking-widest text-amber-400 font-bold uppercase\" id=\"staHoloRight\"></div>\n</div>\n</div>\n</div>\n</section>";
var STA_MAIN = "<main class=\"flex-1 max-w-[1720px] w-full mx-auto px-4 lg:px-6 pt-5 pb-6 space-y-5\" data-purpose=\"main-dashboard-body\">\n<!-- BEGIN: TopKPICardsGrid -->\n<section class=\"grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4\" data-purpose=\"top-kpi-metrics-row\">\n<!-- Card 1: NET PROFIT (Emerald Neon) -->\n<div class=\"glass-panel neon-border-green rounded-2xl p-4 relative overflow-hidden flex flex-col justify-between group\" data-purpose=\"kpi-total-profit\">\n<div class=\"flex items-center justify-between mb-2\">\n<div class=\"flex items-center gap-2\">\n<span class=\"w-6 h-6 rounded-md bg-neon-green/10 border border-neon-green/40 flex items-center justify-center text-neon-green\">\n<svg class=\"w-3.5 h-3.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" viewbox=\"0 0 24 24\"><path d=\"M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6\"></path></svg>\n</span>\n<span class=\"text-xs font-bold text-slate-300 font-mono tracking-wide\">NET PROFIT</span>\n</div>\n<span class=\"px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-neon-green/20 text-neon-green border border-neon-green/40 flex items-center gap-0.5\" id=\"staKpiNetChip\">REC 0–0</span>\n</div>\n<div>\n<div class=\"text-2xl sm:text-3xl font-extrabold text-[#FF3B5C] font-mono tracking-tight\" style=\"text-shadow: 0 0 12px rgba(255, 59, 92, 0.65), 0 0 24px rgba(255, 59, 92, 0.35)\" id=\"staKpiNet\">$0.00</div>\n<div class=\"text-[11px] font-mono text-slate-400 mt-1\">\n            (Since Inception)\n          </div>\n</div>\n</div>\n<!-- Card 2: WIN RATE (Purple Neon) -->\n<div class=\"glass-panel neon-border-purple rounded-2xl p-4 relative overflow-hidden flex flex-col justify-between group\" data-purpose=\"kpi-win-rate\">\n<div class=\"flex items-center justify-between mb-2\">\n<div class=\"flex items-center gap-2\">\n<span class=\"w-6 h-6 rounded-md bg-neon-purple/10 border border-neon-purple/40 flex items-center justify-center text-neon-purple\">\n<svg class=\"w-3.5 h-3.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" viewbox=\"0 0 24 24\"><circle cx=\"12\" cy=\"12\" r=\"10\"></circle><path d=\"m9 12 2 2 4-4\"></path></svg>\n</span>\n<span class=\"text-xs font-bold text-slate-300 font-mono tracking-wide\">WIN RATE</span>\n</div>\n<span class=\"px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-neon-purple/20 text-purple-300 border border-neon-purple/40 flex items-center gap-0.5\" id=\"staKpiRateChip\">0 SETTLED</span>\n</div>\n<div>\n<div class=\"text-2xl sm:text-3xl font-extrabold text-purple-300 font-mono tracking-tight neon-text-purple\" id=\"staKpiRate\">—</div>\n<div class=\"text-[11px] font-mono text-slate-400 mt-1\" id=\"staKpiRateSub\">0 W / 0 L</div>\n</div>\n</div>\n<!-- Card 3: ROI (Orange/Amber Neon) -->\n<div class=\"glass-panel neon-border-orange rounded-2xl p-4 relative overflow-hidden flex flex-col justify-between group\" data-purpose=\"kpi-roi\">\n<div class=\"flex items-center justify-between mb-2\">\n<div class=\"flex items-center gap-2\">\n<span class=\"w-6 h-6 rounded-md bg-amber-500/10 border border-neon-orange/40 flex items-center justify-center text-neon-orange\">\n<svg class=\"w-3.5 h-3.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" viewbox=\"0 0 24 24\"><path d=\"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z\"></path></svg>\n</span>\n<span class=\"text-xs font-bold text-slate-300 font-mono tracking-wide\">ROI</span>\n</div>\n<span class=\"px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-neon-orange/20 text-orange-400 border border-neon-orange/40 flex items-center gap-0.5\" id=\"staKpiRoiChip\">STAKED $0.00</span>\n</div>\n<div>\n<div class=\"text-2xl sm:text-3xl font-extrabold text-[#FF3B5C] font-mono tracking-tight\" style=\"text-shadow: 0 0 12px rgba(255, 59, 92, 0.65), 0 0 24px rgba(255, 59, 92, 0.35)\" id=\"staKpiRoi\">—</div>\n<div class=\"text-[11px] font-mono text-slate-400 mt-1\">\n            Per Dollar Staked\n          </div>\n</div>\n</div>\n<!-- Card 4: OPEN POTENTIAL (Mint/Cyan Neon) -->\n<div class=\"glass-panel neon-border-cyan rounded-2xl p-4 relative overflow-hidden flex flex-col justify-between group\" data-purpose=\"kpi-expected-value\">\n<div class=\"flex items-center justify-between mb-2\">\n<div class=\"flex items-center gap-2\">\n<span class=\"w-6 h-6 rounded-md bg-neon-green/10 border border-neon-green/40 flex items-center justify-center text-neon-green\">\n<svg class=\"w-3.5 h-3.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2.5\" viewbox=\"0 0 24 24\"><polyline points=\"23 6 13.5 15.5 8.5 10.5 1 18\"></polyline><polyline points=\"17 6 23 6 23 12\"></polyline></svg>\n</span>\n<span class=\"text-xs font-bold text-slate-300 font-mono tracking-wide\">OPEN POTENTIAL</span>\n</div>\n<span class=\"px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-neon-green/20 text-neon-green border border-neon-green/40 flex items-center gap-0.5\" id=\"staKpiPotChip\">0 PENDING</span>\n</div>\n<div>\n<div class=\"text-2xl sm:text-3xl font-extrabold text-neon-green font-mono tracking-tight neon-text-green\" id=\"staKpiPot\">$0.00</div>\n<div class=\"text-[11px] font-mono text-slate-400 mt-1\" id=\"staKpiPotSub\">0 Open Bets | $0.00 Total Wagered</div>\n</div>\n</div>\n</section>\n<!-- END: TopKPICardsGrid -->\n<!-- BEGIN: MainDashboardSplitGrid -->\n<div class=\"grid grid-cols-1 lg:grid-cols-12 gap-5\" data-purpose=\"dashboard-two-column-split\">\n<!-- LEFT COLUMN: Charts & Settlement Ledger (8 of 12 columns, ~67-70%) -->\n<div class=\"lg:col-span-8 flex flex-col gap-5\">\n<!-- BEGIN: ProfitAndTrajectoryCard -->\n<article class=\"glass-panel rounded-2xl p-5 border border-purple-800/40 relative\" data-purpose=\"cumulative-profit-chart-panel\">\n<!-- Chart Header & Timeframe Switchers -->\n<div class=\"flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4\">\n<div class=\"flex items-start gap-2\">\n<div class=\"p-1.5 rounded-lg bg-neon-green/10 text-neon-green mt-0.5\">\n<svg class=\"w-4 h-4\" fill=\"currentColor\" viewbox=\"0 0 24 24\"><path d=\"M5 9.2h3V19H5zM10.6 5h2.8v14.2h-2.8zm5.6 8h3V19h-3z\"></path></svg>\n</div>\n<div>\n<div class=\"flex items-center gap-2\">\n<h2 class=\"text-sm font-bold tracking-wide text-white uppercase font-mono\">\n                    CUMULATIVE NET PROFIT TRAJECTORY\n                  </h2>\n<span class=\"w-3.5 h-3.5 rounded-full border border-slate-500 text-slate-400 flex items-center justify-center text-[9px] cursor-pointer\" title=\"Calculated across all settled positions\">ℹ</span>\n</div>\n<p class=\"text-xs text-slate-400 font-mono\">\n                  Profit (USD) — Settled Bets\n                </p>\n</div>\n</div>\n<!-- Timeframe Pills: 7D, 30D, 90D (Active), 1Y, ALL -->\n<div class=\"flex items-center gap-1 bg-dark-900/90 p-1 rounded-full border border-slate-800 self-start sm:self-auto font-mono text-xs\">\n<button class=\"px-2.5 py-0.5 rounded-full text-slate-400 hover:text-white transition\" data-chart-tf=\"7\">7D</button>\n<button class=\"px-2.5 py-0.5 rounded-full text-slate-400 hover:text-white transition\" data-chart-tf=\"30\">30D</button>\n<button class=\"px-2.5 py-0.5 rounded-full text-white font-bold bg-neon-magenta shadow-[0_0_10px_rgba(217,22,128,0.6)] transition\" data-chart-tf=\"90\">90D</button>\n<button class=\"px-2.5 py-0.5 rounded-full text-slate-400 hover:text-white transition\" data-chart-tf=\"365\">1Y</button>\n<button class=\"px-2.5 py-0.5 rounded-full text-slate-400 hover:text-white transition\" data-chart-tf=\"ALL\">ALL</button>\n</div>\n</div>\n<!-- Dual Axis SVG Chart Display -->\n<div class=\"relative w-full h-[280px] bg-dark-950/80 rounded-xl border border-slate-800/80 p-3 pt-4 overflow-hidden\" data-purpose=\"dual-axis-svg-chart\">\n<!-- Left Y-Axis Values (Profit USD) -->\n<div class=\"absolute left-3 top-4 bottom-8 flex flex-col justify-between text-[10px] font-mono text-slate-500 pointer-events-none select-none\" id=\"staYLeft\"><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span></div>\n<!-- Right Y-Axis Values (Edge %) -->\n<div class=\"absolute right-3 top-4 bottom-8 flex flex-col justify-between text-[10px] font-mono text-purple-400/80 pointer-events-none select-none text-right\" id=\"staYRight\"><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span><span>—</span></div>\n<!-- End Callout Chip (Final Settled Point) -->\n<div class=\"absolute left-[84%] top-[46%] -translate-x-1/2 z-20 bg-dark-900/95 border border-purple-500/60 rounded-lg p-2.5 shadow-[0_0_15px_rgba(176,38,255,0.4)] pointer-events-none font-mono text-[11px] whitespace-nowrap\">\n<div class=\"flex items-center gap-1.5 text-slate-300 font-semibold mb-1 pb-1 border-b border-slate-800\" id=\"staCalloutDate\">\n<svg class=\"w-3 h-3 text-slate-400\" fill=\"none\" stroke=\"currentColor\" viewbox=\"0 0 24 24\"><rect height=\"18\" rx=\"2\" ry=\"2\" width=\"18\" x=\"3\" y=\"4\"></rect><line x1=\"16\" x2=\"16\" y1=\"2\" y2=\"6\"></line><line x1=\"8\" x2=\"8\" y1=\"2\" y2=\"6\"></line><line x1=\"3\" x2=\"21\" y1=\"10\" y2=\"10\"></line></svg>\n                DATE\n              </div>\n<div class=\"flex items-center justify-between gap-3 text-[#FF3B5C]\" id=\"staCalloutNetRow\">\n<span class=\"flex items-center gap-1\"><span class=\"w-2 h-2 rounded-full bg-[#FF3B5C]\"></span> Cum. Profit:</span>\n<span class=\"font-bold\" id=\"staCalloutNet\">$0.00 NET</span>\n</div>\n<div class=\"flex items-center justify-between gap-3 text-purple-300\">\n<span class=\"flex items-center gap-1\"><span class=\"w-2 h-2 rounded-full bg-neon-purple\"></span> Record:</span>\n<span class=\"font-bold\" id=\"staCalloutRec\">0 W / 0 L</span>\n</div>\n</div>\n<!-- SVG Curves and Grid Area -->\n<div class=\"w-full h-full pl-10 pr-10 pb-6\">\n<svg class=\"w-full h-full overflow-visible\" preserveaspectratio=\"none\" viewbox=\"0 0 800 240\">\n<defs>\n<!-- Gradient for Net Profit Area -->\n<lineargradient id=\"profitAreaGrad\" x1=\"0\" x2=\"0\" y1=\"0\" y2=\"1\">\n<stop offset=\"0%\" stop-color=\"#FF3B5C\" stop-opacity=\"0.38\"></stop>\n<stop offset=\"60%\" stop-color=\"#FF3B5C\" stop-opacity=\"0.10\"></stop>\n<stop offset=\"100%\" stop-color=\"#FF3B5C\" stop-opacity=\"0.0\"></stop>\n</lineargradient>\n<!-- Neon Glow Filters -->\n<filter height=\"140%\" id=\"neonGlowGreen\" width=\"140%\" x=\"-20%\" y=\"-20%\">\n<fegaussianblur result=\"blur\" stddeviation=\"3\"></fegaussianblur>\n<femerge>\n<femergenode in=\"blur\"></femergenode>\n<femergenode in=\"SourceGraphic\"></femergenode>\n</femerge>\n</filter>\n<filter height=\"140%\" id=\"neonGlowMagenta\" width=\"140%\" x=\"-20%\" y=\"-20%\">\n<fegaussianblur result=\"blur\" stddeviation=\"2.5\"></fegaussianblur>\n<femerge>\n<femergenode in=\"blur\"></femergenode>\n<femergenode in=\"SourceGraphic\"></femergenode>\n</femerge>\n</filter>\n</defs>\n<!-- Horizontal Subtle Gridlines -->\n<line stroke=\"#1f1833\" stroke-dasharray=\"3 3\" stroke-width=\"1\" x1=\"0\" x2=\"800\" y1=\"20\" y2=\"20\"></line>\n<line stroke=\"#1f1833\" stroke-dasharray=\"3 3\" stroke-width=\"1\" x1=\"0\" x2=\"800\" y1=\"55\" y2=\"55\"></line>\n<line stroke=\"#1f1833\" stroke-dasharray=\"3 3\" stroke-width=\"1\" x1=\"0\" x2=\"800\" y1=\"90\" y2=\"90\"></line>\n<line stroke=\"#1f1833\" stroke-dasharray=\"3 3\" stroke-width=\"1\" x1=\"0\" x2=\"800\" y1=\"125\" y2=\"125\"></line>\n<line stroke=\"#1f1833\" stroke-dasharray=\"3 3\" stroke-width=\"1\" x1=\"0\" x2=\"800\" y1=\"160\" y2=\"160\"></line>\n<line stroke=\"#1f1833\" stroke-dasharray=\"3 3\" stroke-width=\"1\" x1=\"0\" x2=\"800\" y1=\"195\" y2=\"195\"></line>\n<line stroke=\"#261f3e\" stroke-width=\"1\" x1=\"0\" x2=\"800\" y1=\"230\" y2=\"230\"></line>\n<!-- Vertical Indicator Line for Final Point -->\n<line opacity=\"0.8\" stroke=\"#b026ff\" stroke-dasharray=\"2 3\" stroke-width=\"1.5\" x1=\"800\" x2=\"800\" y1=\"10\" y2=\"230\"></line>\n<!-- Profit Area Fill -->\n<path d=\"M 0.0 125.0 C 44.4 109.4, 177.8 31.7, 266.7 31.7 C 355.6 31.7, 444.4 99.7, 533.3 125.0 C 622.2 150.3, 755.6 173.6, 800.0 183.3 L 800 230 L 0 230 Z\" fill=\"url(#profitAreaGrad)\" id=\"staChartArea\"></path>\n<!-- Net Profit Surge Curve (Emerald Neon) -->\n<path d=\"M 0.0 125.0 C 44.4 109.4, 177.8 31.7, 266.7 31.7 C 355.6 31.7, 444.4 99.7, 533.3 125.0 C 622.2 150.3, 755.6 173.6, 800.0 183.3\" fill=\"none\" filter=\"url(#neonGlowGreen)\" id=\"staChartLine\" stroke=\"#FF3B5C\" stroke-width=\"3\"></path>\n<!-- Model Edge Trajectory Line (Dashed/Dotted Magenta Neon) -->\n<path d=\"M 0 125.0 L 800 125.0\" fill=\"none\" filter=\"url(#neonGlowMagenta)\" id=\"staChartBase\" stroke=\"#e025a8\" stroke-dasharray=\"4 4\" stroke-width=\"2.5\"></path>\n<!-- Tooltip Highlight Circle Markers -->\n<circle cx=\"800\" cy=\"183.3\" fill=\"#FF3B5C\" id=\"staChartDot\" filter=\"url(#neonGlowGreen)\" r=\"5\" stroke=\"#07050d\" stroke-width=\"2\"></circle>\n<circle cx=\"800\" cy=\"125.0\" fill=\"#e025a8\" id=\"staChartBaseDot\" r=\"4.5\" stroke=\"#07050d\" stroke-width=\"2\"></circle>\n</svg>\n</div>\n<!-- X-Axis Dates Row -->\n<div class=\"absolute bottom-1.5 left-12 right-12 flex justify-between text-[9px] font-mono text-slate-500\" id=\"staXAxis\"><span>—</span></div>\n</div>\n<!-- Bottom Micro Metric Legend Pill Bar -->\n<div class=\"grid grid-cols-2 md:grid-cols-4 gap-2.5 mt-3 pt-3 border-t border-purple-900/30 text-xs font-mono\" data-purpose=\"chart-legend-metrics\">\n<div class=\"flex items-center gap-2 bg-dark-900/60 p-2 rounded-lg border border-slate-800\">\n<span class=\"text-neon-green text-sm\">✦</span>\n<div>\n<div class=\"text-[10px] text-slate-400\">SETTLED BETS</div>\n<div class=\"font-bold text-neon-green\" id=\"staLegSettled\">0 · 0 W / 0 L</div>\n</div>\n</div>\n<div class=\"flex items-center gap-2 bg-dark-900/60 p-2 rounded-lg border border-slate-800\">\n<span class=\"text-neon-green text-sm\">📈</span>\n<div>\n<div class=\"text-[10px] text-slate-400\">WIN RATE</div>\n<div class=\"font-bold text-neon-green\" id=\"staLegRate\">—</div>\n</div>\n</div>\n<div class=\"flex items-center gap-2 bg-dark-900/60 p-2 rounded-lg border border-slate-800\">\n<span class=\"text-amber-400 text-sm\">⚖</span>\n<div>\n<div class=\"text-[10px] text-slate-400\">AVG STAKE SIZE</div>\n<div class=\"font-bold text-amber-400\" id=\"staLegAvg\">—</div>\n</div>\n</div>\n<div class=\"flex items-center gap-2 bg-dark-900/60 p-2 rounded-lg border border-slate-800\">\n<span class=\"text-purple-400 text-sm\">⚅</span>\n<div>\n<div class=\"text-[10px] text-slate-400\">OPEN POTENTIAL</div>\n<div class=\"font-bold text-purple-300\" id=\"staLegPot\">$0.00</div>\n</div>\n</div>\n</div>\n</article>\n<!-- END: ProfitAndTrajectoryCard -->\n<!-- BEGIN: WagerLedgerCard -->\n<article class=\"glass-panel rounded-2xl p-5 border border-purple-800/40\" data-purpose=\"recent-wager-ledger-panel\">\n<!-- Table Controls Header -->\n<div class=\"flex flex-col lg:flex-row lg:items-center justify-between gap-3 mb-4\">\n<div class=\"flex items-start gap-2\">\n<div class=\"p-1.5 rounded-lg bg-purple-500/10 text-purple-300 mt-0.5\">\n<svg class=\"w-4 h-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" viewbox=\"0 0 24 24\"><path d=\"M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z\"></path><polyline points=\"14 2 14 8 20 8\"></polyline><line x1=\"16\" x2=\"8\" y1=\"13\" y2=\"13\"></line><line x1=\"16\" x2=\"8\" y1=\"17\" y2=\"17\"></line><polyline points=\"10 9 9 9 8 9\"></polyline></svg>\n</div>\n<div>\n<div class=\"flex items-center gap-2\">\n<h2 class=\"text-sm font-bold tracking-wide text-neon-orange uppercase font-mono\">\n                    RECENT WAGER LEDGER &amp; AUDIT TRAIL\n                  </h2>\n<span class=\"w-3.5 h-3.5 rounded-full border border-slate-500 text-slate-400 flex items-center justify-center text-[9px] cursor-pointer\" title=\"Settled wagers from your tracker\">ℹ</span>\n</div>\n<p class=\"text-xs text-slate-400 font-mono\">\n                  All settled wagers — results and profit / loss\n                </p>\n</div>\n</div>\n<!-- Ledger Status Filter Pills & Result Counter -->\n<div class=\"flex items-center gap-2 flex-wrap font-mono text-xs\">\n<div class=\"flex items-center bg-dark-900/90 p-0.5 rounded-full border border-slate-800\" id=\"status-pill-group\">\n<button class=\"status-btn px-2.5 py-0.5 rounded-full text-white font-bold bg-neon-magenta shadow-[0_0_10px_rgba(217,22,128,0.5)] transition-all\" data-status=\"ALL\">ALL</button>\n<button class=\"status-btn px-2.5 py-0.5 rounded-full text-slate-400 hover:text-white transition-all\" data-status=\"WON\">WON</button>\n<button class=\"status-btn px-2.5 py-0.5 rounded-full text-slate-400 hover:text-white transition-all\" data-status=\"LOST\">LOST</button>\n<button class=\"status-btn px-2.5 py-0.5 rounded-full text-slate-400 hover:text-white transition-all\" data-status=\"PUSH\">PUSH</button>\n</div>\n<!-- Live Counter Badge -->\n<div class=\"px-2.5 py-1 bg-dark-900/90 rounded-full border border-slate-800 text-[11px] text-slate-300 flex items-center gap-1.5\">\n<span class=\"w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse\"></span>\n<span class=\"text-neon-green font-bold\" id=\"ledger-counter\">Showing 0 of 0</span>\n</div>\n</div>\n</div>\n<!-- Interactive Secondary Filter Toolbar -->\n<div class=\"p-3 mb-3.5 rounded-xl bg-dark-900/85 border border-purple-900/40 font-mono text-xs space-y-2.5\" data-purpose=\"wager-ledger-filters\">\n<div class=\"grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-2.5 items-center\">\n<!-- Search Input -->\n<div class=\"relative xl:col-span-2\">\n<span class=\"absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400\">\n<svg class=\"w-3.5 h-3.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" viewbox=\"0 0 24 24\"><circle cx=\"11\" cy=\"11\" r=\"8\"></circle><path d=\"m21 21-4.35-4.35\"></path></svg>\n</span>\n<input class=\"w-full pl-8 pr-3 py-1.5 bg-dark-950/90 border border-slate-800 focus:border-neon-green focus:ring-1 focus:ring-neon-green rounded-lg text-slate-200 placeholder-slate-500 text-xs transition\" id=\"filter-search\" placeholder=\"Search team, player, matchup...\" type=\"text\"/>\n</div>\n<!-- Sport / League Select -->\n<div class=\"relative\">\n<select class=\"w-full py-1.5 pl-2.5 pr-7 bg-dark-950/90 border border-slate-800 focus:border-neon-green focus:ring-1 focus:ring-neon-green rounded-lg text-slate-300 text-xs transition cursor-pointer appearance-none\" id=\"filter-sport\">\n<option value=\"ALL\">All Sports</option>\n<option value=\"NBA\">NBA (Basketball)</option>\n<option value=\"NFL\">NFL (Football)</option>\n<option value=\"EPL\">EPL (Soccer)</option>\n<option value=\"MLB\">MLB (Baseball)</option>\n<option value=\"NHL\">NHL (Hockey)</option>\n</select>\n<div class=\"pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 text-[9px]\">▼</div>\n</div>\n<!-- Market Type Select -->\n<div class=\"relative\">\n<select class=\"w-full py-1.5 pl-2.5 pr-7 bg-dark-950/90 border border-slate-800 focus:border-neon-green focus:ring-1 focus:ring-neon-green rounded-lg text-slate-300 text-xs transition cursor-pointer appearance-none\" id=\"filter-market\">\n<option value=\"ALL\">All Markets</option>\n<option value=\"Spread\">Spread</option>\n<option value=\"Moneyline\">Moneyline</option>\n<option value=\"Total\">Total (Over/Under)</option>\n<option value=\"Player Prop\">Player Prop</option>\n</select>\n<div class=\"pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 text-[9px]\">▼</div>\n</div>\n<!-- Date Range Selector -->\n<div class=\"relative\">\n<select class=\"w-full py-1.5 pl-2.5 pr-7 bg-dark-950/90 border border-slate-800 focus:border-neon-green focus:ring-1 focus:ring-neon-green rounded-lg text-slate-300 text-xs transition cursor-pointer appearance-none\" id=\"filter-timeframe\">\n<option value=\"ALL\">All Time</option>\n<option value=\"7D\">Last 7 Days</option>\n<option value=\"30D\">Last 30 Days</option>\n<option selected=\"\" value=\"90D\">Last 90 Days</option>\n</select>\n<div class=\"pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-slate-400 text-[9px]\">▼</div>\n</div>\n</div>\n<!-- Sort Controls & Active Badges Row -->\n<div class=\"flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/70\">\n<div class=\"flex items-center gap-2 flex-wrap\">\n<span class=\"text-[11px] text-slate-400 flex items-center gap-1\">\n<svg class=\"w-3 h-3 text-purple-400\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" viewbox=\"0 0 24 24\"><path d=\"M3 6h18M6 12h12m-9 6h6\"></path></svg>\nSORT BY:\n</span>\n<div class=\"inline-flex rounded-lg bg-dark-950 border border-slate-800 p-0.5\" id=\"sort-control-group\">\n<button class=\"sort-btn px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-950/80 text-purple-300 border border-purple-500/40 transition\" data-sort=\"date\">Date (Newest)</button>\n<button class=\"sort-btn px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-white transition\" data-sort=\"profit\">Profit/Loss</button>\n<button class=\"sort-btn px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-white transition\" data-sort=\"stake\">Stake Size</button>\n<button class=\"sort-btn px-2 py-0.5 rounded text-[11px] text-slate-400 hover:text-white transition\" data-sort=\"edge\">Model Edge</button>\n</div>\n</div>\n<!-- Active Filter Badges & Reset Trigger -->\n<div class=\"flex items-center gap-2 flex-wrap\">\n<div class=\"flex items-center gap-1.5 flex-wrap\" id=\"active-filter-chips\"></div>\n<button class=\"px-2 py-0.5 rounded text-[11px] text-rose-400 hover:text-rose-300 hover:bg-rose-500/10 border border-rose-500/30 transition flex items-center gap-1\" id=\"reset-filters-btn\">\n<svg class=\"w-2.5 h-2.5\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" viewbox=\"0 0 24 24\"><path d=\"M18 6L6 18M6 6l12 12\"></path></svg>\nReset Filters\n</button>\n</div>\n</div>\n</div>\n<!-- Dense Responsive Data Table -->\n<div class=\"overflow-x-auto rounded-xl border border-slate-800/80 bg-dark-950/70\" data-purpose=\"ledger-table-container\">\n<table class=\"w-full text-left font-mono text-xs whitespace-nowrap\" id=\"wager-ledger-table\">\n<thead>\n<tr class=\"bg-dark-900/95 text-[10px] uppercase tracking-wider text-slate-400 border-b border-slate-800\">\n<th class=\"py-2.5 px-3 font-semibold\">SETTLED ▼</th>\n<th class=\"py-2.5 px-3 font-semibold\">EVENT / MARKET</th>\n<th class=\"py-2.5 px-2 font-semibold\">SPORT</th>\n<th class=\"py-2.5 px-2 font-semibold\">MARKET TYPE</th>\n<th class=\"py-2.5 px-3 font-semibold\">ODDS (DEC / AMER)</th>\n<th class=\"py-2.5 px-3 font-semibold text-right\">STAKE</th>\n<th class=\"py-2.5 px-3 font-semibold text-center\">RESULT</th>\n<th class=\"py-2.5 px-2 font-semibold\">CLOSING LINE</th>\n<th class=\"py-2.5 px-2 font-semibold text-right\">CLV (PTS)</th>\n<th class=\"py-2.5 px-2 font-semibold text-right\">MODEL EDGE</th>\n<th class=\"py-2.5 px-2 font-semibold text-right\">EV</th>\n<th class=\"py-2.5 px-3 font-semibold text-right\">PROFIT / LOSS</th>\n</tr>\n</thead>\n<tbody class=\"divide-y divide-slate-800/60 text-slate-300\" id=\"ledger-tbody\"></tbody>\n</table>\n<!-- Empty State Element -->\n<div class=\"hidden flex-col items-center justify-center py-12 px-4 text-center\" id=\"ledger-empty-state\">\n<div class=\"w-12 h-12 rounded-xl bg-purple-900/30 border border-purple-500/40 flex items-center justify-center text-purple-400 mb-3 shadow-[0_0_15px_rgba(176,38,255,0.25)]\">\n<svg class=\"w-6 h-6\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" viewbox=\"0 0 24 24\"><circle cx=\"11\" cy=\"11\" r=\"8\"></circle><path d=\"m21 21-4.35-4.35\"></path><line x1=\"8\" x2=\"14\" y1=\"11\" y2=\"11\"></line></svg>\n</div>\n<div class=\"text-sm font-bold text-slate-200 font-mono tracking-wide\">No matching wagers found</div>\n<p class=\"text-xs text-slate-400 font-mono max-w-sm mt-1\">Try adjusting your filters, searching for another team or player, or resetting criteria to view settled wagers.</p>\n<button class=\"mt-4 px-3.5 py-1.5 rounded-lg bg-neon-green/20 text-neon-green border border-neon-green/50 hover:bg-neon-green hover:text-dark-950 font-mono font-bold text-xs transition shadow-[0_0_12px_rgba(57,255,136,0.25)]\" id=\"empty-reset-btn\">\nReset All Filters\n</button>\n</div>\n</div>\n</article>\n<!-- END: WagerLedgerCard -->\n</div>\n<!-- RIGHT COLUMN: Live Edge Radar (4 of 12 columns, ~30-33%) -->\n<div class=\"lg:col-span-4 flex flex-col gap-4\">\n<!-- BEGIN: LiveEdgeRadarCard -->\n<article class=\"glass-panel rounded-2xl p-5 border border-purple-700/50 flex flex-col justify-between h-full relative\" data-purpose=\"live-edge-radar-panel\">\n<div>\n<!-- Radar Header -->\n<div class=\"flex items-center justify-between pb-3 mb-3 border-b border-purple-900/40\">\n<div class=\"flex items-center gap-2\">\n<span class=\"relative flex h-3 w-3\">\n<span class=\"animate-ping absolute inline-flex h-full w-full rounded-full bg-neon-green opacity-75\"></span>\n<span class=\"relative inline-flex rounded-full h-3 w-3 bg-neon-green\"></span>\n</span>\n<h2 class=\"text-sm font-black tracking-wide text-white uppercase font-mono flex items-center gap-1.5\">\n                  LIVE EDGE RADAR\n                </h2>\n</div>\n<span class=\"px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-neon-green/15 text-neon-green border border-neon-green/40 shadow-[0_0_10px_rgba(57,255,136,0.3)]\" id=\"staRadarBadge\">● 0 OPEN</span>\n</div>\n<!-- Opportunities List -->\n<div class=\"space-y-3 font-mono\" data-purpose=\"radar-opportunities-list\" id=\"staRadarList\"></div>\n</div>\n<!-- CTA Button: View All Open Bets -->\n<div class=\"pt-4 mt-3 border-t border-purple-900/30\">\n<button id=\"staRadarCta\" data-go=\"Bet Tracker\" class=\"w-full py-2.5 rounded-xl border-2 border-neon-green bg-emerald-950/40 text-neon-green hover:bg-neon-green hover:text-dark-950 transition-all font-mono font-bold text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(57,255,136,0.3)]\">\n<span id=\"staRadarCtaLabel\">VIEW ALL OPEN BETS (0)</span>\n<span class=\"text-sm font-black\">›</span>\n</button>\n</div>\n</article>\n<!-- END: LiveEdgeRadarCard -->\n</div>\n</div>\n<!-- END: MainDashboardSplitGrid -->\n<!-- BEGIN: HotTakesPanel (AI Scout — TASK-0049 live port; behavior in ai-scout-live.js) -->\n<section class=\"glass-panel rounded-2xl p-5 border border-purple-800/40\" data-purpose=\"hot-takes-panel\" id=\"staHotTakes\">\n<div class=\"flex flex-col lg:flex-row lg:items-start justify-between gap-3 mb-3\">\n<div class=\"flex items-start gap-2\">\n<div class=\"p-1.5 rounded-lg bg-amber-500/10 text-neon-orange mt-0.5\">\n<svg class=\"w-4 h-4\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" viewbox=\"0 0 24 24\"><path d=\"M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z\"></path></svg>\n</div>\n<div>\n<div class=\"flex items-center gap-2 flex-wrap\">\n<h2 class=\"text-sm font-bold tracking-wide text-neon-orange uppercase font-mono\">\n                    HOT TAKES — TOP MARKET ACTIVITY\n                  </h2>\n<span class=\"px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-neon-orange/20 text-orange-400 border border-neon-orange/40\">UNCALIBRATED</span>\n</div>\n<p class=\"text-xs text-slate-400 font-mono\">\n                  Ranked by real market activity (volume + liquidity) from public feeds that actually load — not by a model pick. No calibrated model exists yet, so no Hot Take carries a model hit probability or model edge. Nothing here is a wager recommendation and nothing is auto-bet.\n                </p>\n</div>\n</div>\n<div class=\"flex items-center gap-2 font-mono text-xs flex-shrink-0\">\n<button class=\"px-3 py-1.5 rounded-full bg-dark-900/90 border border-slate-700 text-slate-300 hover:text-white transition\" id=\"staHotRefresh\" type=\"button\">REFRESH</button>\n<button class=\"px-3 py-1.5 rounded-full bg-neon-green/20 text-neon-green border border-neon-green/50 hover:bg-neon-green hover:text-dark-950 font-bold transition\" data-go=\"AI Scout\" id=\"staHotViewAll\" type=\"button\">VIEW ALL IN AI SCOUT ›</button>\n</div>\n</div>\n<div class=\"grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3\" id=\"staHotGrid\">\n<p class=\"text-xs font-mono text-slate-400\">Loading real markets…</p>\n</div>\n<p class=\"text-xs font-mono text-slate-500 mt-3\" id=\"staHotMeta\"></p>\n<p class=\"text-xs font-mono text-slate-500\" id=\"staHotNote\"></p>\n</section>\n<!-- END: HotTakesPanel -->\n</main>";
var STA_FOOTER = "<footer class=\"fixed bottom-0 inset-x-0 z-50 glass-panel border-t border-purple-900/60 bg-dark-950/95 py-2\" data-purpose=\"persistent-command-bar\">\n<div class=\"max-w-[1720px] mx-auto px-4 lg:px-6 flex flex-col md:flex-row items-center justify-between gap-3 text-xs font-mono\">\n<!-- Brand & Metric Ribbon -->\n<div class=\"flex items-center gap-4 flex-wrap\">\n<!-- Left Quantitative Identifier -->\n<div class=\"flex items-center gap-2 border-r border-slate-800 pr-4\">\n<div class=\"w-5 h-5 rounded border border-neon-green/70 flex items-center justify-center text-neon-green text-[10px]\">\n            ⚛\n          </div>\n<div>\n<div class=\"font-black text-white text-[11px] leading-tight\">BET LAB</div>\n<div class=\"text-[9px] text-neon-green tracking-widest leading-none\">QUANTITATIVE</div>\n</div>\n</div>\n<!-- Metric Capsules -->\n<div class=\"flex items-center gap-4 text-[11px] overflow-x-auto py-0.5\">\n<div class=\"flex items-center gap-1.5\">\n<span class=\"text-slate-400\">TOTAL BETS</span>\n<span class=\"font-bold text-white\" id=\"staFBets\">0</span>\n</div>\n<div class=\"flex items-center gap-1.5\">\n<span class=\"text-slate-400\">NET PROFIT</span>\n<span class=\"font-bold text-[#FF3B5C]\" id=\"staFNet\">$0.00</span>\n</div>\n<div class=\"flex items-center gap-1.5\">\n<span class=\"text-slate-400\">ROI</span>\n<span class=\"font-bold text-[#FF3B5C]\" id=\"staFRoi\">—</span>\n</div>\n<div class=\"flex items-center gap-1.5\">\n<span class=\"text-slate-400\">WIN RATE</span>\n<span class=\"font-bold text-white\" id=\"staFRate\">—</span>\n</div>\n<div class=\"flex items-center gap-1.5\">\n<span class=\"text-slate-400\">TOTAL WAGERED</span>\n<span class=\"font-bold text-white\" id=\"staFWagered\">$0.00</span>\n</div>\n<div class=\"flex items-center gap-1.5\">\n<span class=\"text-slate-400\">OPEN POTENTIAL</span>\n<span class=\"font-bold text-neon-green\" id=\"staFPot\">$0.00</span>\n</div>\n<div class=\"flex items-center gap-1.5 border-l border-slate-800 pl-3\">\n<span class=\"text-slate-400\">OPEN BETS</span>\n<span class=\"font-bold text-white\" id=\"staFOpen\">0</span>\n</div>\n</div>\n</div>\n<!-- Right System Engine Status & Timestamp -->\n<div class=\"flex items-center gap-4 text-[11px] text-slate-400 flex-shrink-0\">\n<div class=\"flex items-center gap-2\">\n<span class=\"text-[10px] text-slate-400\">SYSTEM STATUS</span>\n<span class=\"flex items-center gap-1 text-neon-green font-bold\">\n<span class=\"w-2 h-2 rounded-full bg-neon-green shadow-[0_0_8px_#39FF88]\"></span>\n            ONLINE\n          </span>\n</div>\n<span class=\"text-slate-700\">|</span>\n<div class=\"flex items-center gap-1 text-slate-400\">\n<svg class=\"w-3 h-3 text-slate-400\" fill=\"none\" stroke=\"currentColor\" viewbox=\"0 0 24 24\"><path d=\"M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67\"></path></svg>\n<span>Last Updated: <span id=\"staFUpdated\">—</span></span>\n</div>\n</div>\n</div>\n</footer>";

/* ================= Bet Lab LIVE — Stitch integration runtime =================
 * Wires the exact Stitch design markup (constants above) to the app's
 * production bet store. All figures are computed live from localStorage
 * on every render and re-rendered on the app's own change signals (the
 * legacy KPI mutation, the board-rendered event, storage events, a slow
 * interval). Bet-derived strings reach the DOM via textContent /
 * createElement only; the single innerHTML use is the chart SVG, built
 * exclusively from computed numbers and the two semantic color
 * constants. This script NEVER writes to storage. */
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
  const KPI_VAL_BASE = "text-2xl sm:text-3xl font-extrabold font-mono tracking-tight";
  function paintKpiValue(node, v) {
    if (!node) return;
    node.className = KPI_VAL_BASE + (v < 0 ? " text-[#FF3B5C]" : v > 0 ? " text-neon-green neon-text-green" : " text-white");
    node.style.textShadow = v < 0 ? "0 0 12px rgba(255, 59, 92, 0.65), 0 0 24px rgba(255, 59, 92, 0.35)" : "";
  }
  function paintFooterValue(node, v) {
    if (!node) return;
    node.className = "font-bold " + (v < 0 ? "text-[#FF3B5C]" : v > 0 ? "text-neon-green" : "text-white");
  }

  /* ---------- KPI cards ---------- */
  function renderKPIs(s) {
    const net = $("staKpiNet");
    if (net) { net.textContent = fmtKpi(s.net); paintKpiValue(net, s.net); }
    const nc = $("staKpiNetChip"); if (nc) nc.textContent = "REC " + s.won + "–" + s.lost;
    const rate = $("staKpiRate"); if (rate) rate.textContent = s.winRate === null ? "—" : s.winRate.toFixed(1) + "%";
    const rc = $("staKpiRateChip"); if (rc) rc.textContent = s.settledCount + " SETTLED";
    const rs = $("staKpiRateSub"); if (rs) rs.textContent = s.won + " W / " + s.lost + " L" + (s.push ? " / " + s.push + " P" : "");
    const roi = $("staKpiRoi");
    if (roi) { roi.textContent = s.roi === null ? "—" : fmtPct(s.roi); paintKpiValue(roi, s.roi === null ? 0 : s.roi); }
    const oc = $("staKpiRoiChip"); if (oc) oc.textContent = "STAKED " + fmtMoney(s.settledStakes);
    const pot = $("staKpiPot"); if (pot) pot.textContent = fmtMoney(s.openPotential);
    const pc = $("staKpiPotChip"); if (pc) pc.textContent = s.pending + " PENDING";
    const ps = $("staKpiPotSub"); if (ps) ps.textContent = s.pending + " Open Bets | " + fmtMoney(s.wagered) + " Total Wagered";
  }

  /* ---------- hero hologram captions ---------- */
  function holoCaption(b) {
    const sel = String(b.selection || "").toUpperCase().replace(/RUSHING YARDS/g, "RUSH YDS").replace(/RECEIVING YARDS/g, "REC YDS");
    return sel + " · " + fmtMoney(Number(b.stake) || 0);
  }
  function renderHolograms(bets) {
    const open = bets.filter((b) => b.status === "Open");
    const left = open[0];
    const right = open[1] || open[0];
    const L = $("staHoloLeft"), R = $("staHoloRight");
    if (L && left) L.textContent = holoCaption(left);
    if (R && right) R.textContent = holoCaption(right);
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
    const line = $("staChartLine"), area = $("staChartArea");
    if (!line || !area) return;
    const settled = bets.filter(isSettled)
      .map((b) => ({ t: new Date(b.placedAt || b.createdAt || 0).getTime(), v: pnl(b) }))
      .filter((x) => Number.isFinite(x.t))
      .sort((a, b) => a.t - b.t);
    const setTicks = (step) => {
      const labels = [3 * step, 2 * step, step, 0, -step, -2 * step, -3 * step]
        .map((v) => (v > 0 ? "+$" + v : v === 0 ? "$0" : "−$" + Math.abs(v)));
      [$("staYLeft"), $("staYRight")].forEach((col) => {
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
    const grad = $("profitAreaGrad");
    if (grad) grad.querySelectorAll("stop").forEach((st) => st.setAttribute("stop-color", color));
    const dot = $("staChartDot");
    if (dot) { dot.setAttribute("cy", Y(finalV).toFixed(1)); dot.setAttribute("fill", color); }
    const base = $("staChartBase"); if (base) base.setAttribute("d", "M 0 125.0 L 800 125.0");
    const baseDot = $("staChartBaseDot"); if (baseDot) baseDot.setAttribute("cy", "125.0");
    /* callout chip */
    const lastDate = new Date(end);
    const cd = $("staCalloutDate");
    if (cd) {
      const txt = [...cd.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());
      if (txt) txt.nodeValue = " " + MONTHS[lastDate.getMonth()].toUpperCase() + " " + lastDate.getDate() + ", " + lastDate.getFullYear() + " ";
    }
    const cn = $("staCalloutNet"); if (cn) cn.textContent = fmtKpi(finalV) + " NET";
    const crow = $("staCalloutNetRow"); if (crow) crow.className = crow.className.replace(/text-\[#FF3B5C\]|text-neon-green/g, "").trim() + (finalV < 0 ? " text-[#FF3B5C]" : " text-neon-green");
    const cr = $("staCalloutRec"); if (cr) cr.textContent = s.won + " W / " + s.lost + " L";
    /* x-axis labels: first in-window settlement carries the date */
    const xa = $("staXAxis");
    if (xa) {
      xa.replaceChildren();
      inside.forEach((x, i) => {
        const d = new Date(x.t);
        xa.appendChild(el("span", null, i === 0 ? MONTHS[d.getMonth()] + " " + d.getDate() + " · " + fmtTime(d) : fmtTime(d)));
      });
      xa.appendChild(el("span", "text-[#FF3B5C] font-bold", "Final"));
    }
    /* legend pills */
    const l1 = $("staLegSettled"); if (l1) l1.textContent = s.settledCount + " · " + s.won + " W / " + s.lost + " L";
    const l2 = $("staLegRate"); if (l2) l2.textContent = s.winRate === null ? "—" : s.winRate.toFixed(1) + "%";
    const l3 = $("staLegAvg"); if (l3) l3.textContent = s.total ? "$" + (s.wagered / s.total).toFixed(2) + " avg" : "—";
    const l4 = $("staLegPot"); if (l4) l4.textContent = fmtMoney(s.openPotential);
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
      ? "px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-neon-green border border-neon-green/40 shadow-[0_0_8px_rgba(57,255,136,0.25)]"
      : b.status === "Lost"
        ? "px-2 py-0.5 rounded text-[10px] font-bold bg-[#FF3B5C]/20 text-[#FF3B5C] border border-[#FF3B5C]/40"
        : "px-2 py-0.5 rounded text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/40";
    rc.appendChild(el("span", pillCls, tr.dataset.status));
    tr.appendChild(rc);
    tr.appendChild(el("td", "py-2 px-2 text-slate-400", "—"));
    tr.appendChild(el("td", "py-2 px-2 text-right text-slate-400 font-bold", "—"));
    tr.appendChild(el("td", "py-2 px-2 text-right text-slate-400", "—"));
    tr.appendChild(el("td", "py-2 px-2 text-right text-slate-400", "—"));
    const plCls = "py-2 px-3 text-right font-bold " + (b.status === "Won" ? "text-neon-green" : b.status === "Lost" ? "text-[#FF3B5C]" : "text-slate-300");
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
      btn.className = "status-btn px-2.5 py-0.5 rounded-full transition-all " + (on ? "text-white font-bold bg-neon-magenta shadow-[0_0_10px_rgba(217,22,128,0.5)]" : "text-slate-400 hover:text-white");
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
          b.className = "px-2.5 py-0.5 rounded-full transition " + (on ? "text-white font-bold bg-neon-magenta shadow-[0_0_10px_rgba(217,22,128,0.6)]" : "text-slate-400 hover:text-white");
        });
        update();
      });
    });
  }

  /* ---------- radar (open positions from the store) ---------- */
  function radarItem(b) {
    const item = el("div", "p-3 rounded-xl bg-dark-900/90 border border-slate-800 hover:border-neon-green/50 transition-all cursor-pointer group");
    item.addEventListener("click", () => { if (typeof window.go === "function") window.go("Bet Tracker"); });
    const row = el("div", "flex items-start justify-between gap-2");
    const left = el("div", "flex items-start gap-2.5");
    left.appendChild(el("span", "p-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 text-xs", "🏈"));
    const mid = el("div");
    mid.appendChild(el("div", "text-xs font-semibold text-slate-400", (b.sport || "—") + " • " + betType(b) + " · " + (b.book || "—")));
    mid.appendChild(el("div", "text-sm font-bold text-white group-hover:text-neon-green transition-colors", b.game || b.selection || "Bet"));
    mid.appendChild(el("div", "text-xs text-slate-400 font-semibold mt-0.5", b.selection || ""));
    left.appendChild(mid);
    const right = el("div", "text-right");
    right.appendChild(el("div", "text-xs font-bold text-neon-green", "Pays: " + fmtMoney(payoutFor(b))));
    right.appendChild(el("div", "text-[10px] text-slate-400", "Stake: " + fmtMoney(Number(b.stake) || 0)));
    right.appendChild(el("span", "text-xs text-slate-500 group-hover:text-neon-green transition-colors font-bold", "›"));
    row.append(left, right);
    item.appendChild(row);
    return item;
  }
  function renderRadar(bets, s) {
    const list = $("staRadarList");
    if (!list) return;
    const open = bets.filter((b) => b.status === "Open")
      .sort((a, b) => String(b.placedAt || "").localeCompare(String(a.placedAt || "")));
    list.replaceChildren();
    if (!open.length) list.appendChild(el("div", "p-3 rounded-xl bg-dark-900/90 border border-slate-800 text-xs text-slate-400 font-mono", "No open bets."));
    open.forEach((b, i) => {
      list.appendChild(radarItem(b));
      if (i === 0) {
        const banner = el("div", "px-3.5 py-2 rounded-xl bg-gradient-to-r from-purple-900/60 via-pink-900/40 to-dark-900 border border-purple-500/50 shadow-[0_0_18px_rgba(176,38,255,0.3)] flex items-center justify-between");
        banner.setAttribute("data-purpose", "strong-edge-callout");
        const bl = el("div", "flex items-center gap-2");
        bl.appendChild(el("span", "text-amber-400 text-sm", "⚡"));
        bl.appendChild(el("span", "text-xs font-black tracking-wider text-purple-200 uppercase", "OPEN POTENTIAL — " + fmtMoney(s.openPotential)));
        banner.append(bl, el("span", "text-[10px] text-neon-green font-bold", s.pending + " OPEN"));
        list.appendChild(banner);
      }
    });
    const badge = $("staRadarBadge"); if (badge) badge.textContent = "● " + s.pending + " OPEN";
    const cta = $("staRadarCtaLabel"); if (cta) cta.textContent = "VIEW ALL OPEN BETS (" + s.pending + ")";
  }

  /* ---------- footer ribbon ---------- */
  function renderFooter(s) {
    const set = (id, text) => { const n = $(id); if (n) n.textContent = text; };
    set("staFBets", String(s.total));
    const fn = $("staFNet"); if (fn) { fn.textContent = fmtKpi(s.net); paintFooterValue(fn, s.net); }
    const fr = $("staFRoi"); if (fr) { fr.textContent = s.roi === null ? "—" : fmtPct(s.roi); paintFooterValue(fr, s.roi === null ? 0 : s.roi); }
    set("staFRate", s.winRate === null ? "—" : s.winRate.toFixed(1) + "%");
    set("staFWagered", fmtMoney(s.wagered));
    set("staFPot", fmtMoney(s.openPotential));
    set("staFOpen", String(s.pending));
    set("staFUpdated", fmtTime(new Date()));
  }

  /* ---------- top-bar pill sync (router owns navigation) ---------- */
  const PILL_ON = "flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-neon-green text-dark-950 font-bold shadow-[0_0_14px_rgba(57,255,136,0.5)] transition-all";
  const PILL_OFF = "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-slate-300 hover:text-white hover:bg-dark-700/60 transition-colors";
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
    renderKPIs(s);
    renderHolograms(bets);
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

  function mount() {
    const main = document.querySelector(".main");
    const dashboard = $("dashboard");
    if (!main || !dashboard || document.body.classList.contains("stl-on")) return;
    try {
      document.body.insertAdjacentHTML("afterbegin", STA_AMBIENT);
      main.insertAdjacentHTML("afterbegin", STA_HEADER);
      dashboard.insertAdjacentHTML("afterbegin", STA_HERO + STA_MAIN);
      document.body.insertAdjacentHTML("beforeend", STA_FOOTER);
      document.body.classList.add("stl-on");
      document.body.dataset.stitchLive = "live";
      wireLedger();
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
      console.error("Stitch live integration could not initialize; app unchanged.", err);
      document.body.classList.remove("stl-on");
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", mount, { once: true });
  else mount();
})();

