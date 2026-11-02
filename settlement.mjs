// BetIQ Pro — settlement engine (pure functions)
// Used by both the browser app (betiq.js, ES module import) and Node tests.
// No DOM, no storage, no network. All money math lives here so it can be tested.
//
// Ticket model:
// { id, book, external_ticket_id, placed_at, stake, stake_type: 'cash'|'trade_credit'|'bonus',
//   odds, potential_payout, status: 'pending'|'won'|'lost'|'void'|'cashed_out'|'partial',
//   cashout_amount, image_hash, legs: [{player, market, line, team, opponent, status}] }

export const SETTLED_STATUSES = ['won', 'lost', 'void', 'cashed_out'];

export function isSettled(ticket) {
  return SETTLED_STATUSES.includes(ticket.status);
}

// Realized profit for a single ticket. Pending and partial tickets contribute 0
// to realized P&L (partial legs are tracked per-leg, but ticket money only
// realizes when the ticket itself reaches a settled status — see applySettlement).
export function profitForTicket(ticket) {
  const stake = Number(ticket.stake) || 0;
  switch (ticket.status) {
    case 'won':
      return (Number(ticket.potential_payout) || 0) - stake;
    case 'lost':
      return -stake;
    case 'void':
      return 0;
    case 'cashed_out':
      return (Number(ticket.cashout_amount) || 0) - stake;
    case 'pending':
    case 'partial':
    default:
      return 0;
  }
}

// Apply an official settlement result object to a ticket.
// This is THE entry point automatic settlement will use later; the MVP's
// "simulate official result" test harness calls this same function.
// result: { status?, cashout_amount?, legResults?: [{index, status}] }
// Leg logic: any lost leg loses a parlay ticket; all legs won/void with at
// least one won => won (void legs push); all void => void; some legs still
// pending while others are settled => partial (ticket stays partial).
export function applySettlement(ticket, result) {
  const next = JSON.parse(JSON.stringify(ticket));
  if (Array.isArray(result.legResults)) {
    for (const lr of result.legResults) {
      if (next.legs[lr.index]) next.legs[lr.index].status = lr.status;
    }
  }
  if (result.cashout_amount != null) next.cashout_amount = Number(result.cashout_amount);

  if (result.status) {
    next.status = result.status;
    return next;
  }
  if (Array.isArray(result.legResults) && next.legs.length) {
    const statuses = next.legs.map((l) => l.status || 'pending');
    if (statuses.some((s) => s === 'pending')) {
      next.status = statuses.some((s) => s !== 'pending') ? 'partial' : 'pending';
    } else if (statuses.some((s) => s === 'lost')) {
      next.status = 'lost';
    } else if (statuses.every((s) => s === 'void' || s === 'push')) {
      next.status = 'void';
    } else {
      next.status = 'won';
    }
  }
  return next;
}

export function detectDuplicateHash(hash, tickets) {
  if (!hash) return false;
  return tickets.some((t) => t.image_hash && t.image_hash === hash);
}

// Duplicate detection by ticket identity — catches the SAME ticket arriving
// from two DIFFERENT image files (different hashes). Real case from the test
// Note: the same ticket can appear in more than one screenshot; dedupe by book + ticket ID.
export function detectDuplicateExternalId(book, externalTicketId, tickets) {
  if (!externalTicketId) return false;
  return tickets.some((t) => t.book === book && t.external_ticket_id && t.external_ticket_id === externalTicketId);
}

export function detectDuplicateTicket(candidate, tickets) {
  return {
    byHash: detectDuplicateHash(candidate.image_hash, tickets),
    byExternalId: detectDuplicateExternalId(candidate.book, candidate.external_ticket_id, tickets),
    probable: isProbableDuplicate(candidate, tickets),
  };
}

export function isProbableDuplicate(candidate, tickets) {
  return tickets.some((t) =>
    t.book === candidate.book &&
    Number(t.stake) === Number(candidate.stake) &&
    Number(t.potential_payout) === Number(candidate.potential_payout) &&
    (t.legs?.length || 0) === (candidate.legs?.length || 0)
  );
}

// Wilson score interval for a win rate — honest confidence, no invented precision.
export function wilsonInterval(wins, n, z = 1.96) {
  if (!n) return [0, 0];
  const p = wins / n;
  const denom = 1 + (z * z) / n;
  const centre = (p + (z * z) / (2 * n)) / denom;
  const margin = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / denom;
  return [Math.max(0, centre - margin), Math.min(1, centre + margin)];
}

function groupStats(items, keyFn) {
  const map = new Map();
  for (const t of items) {
    const key = keyFn(t);
    if (key == null) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(t);
  }
  const out = [];
  for (const [key, ts] of map.entries()) {
    const settled = ts.filter(isSettled);
    const wagered = settled.reduce((s, t) => s + (Number(t.stake) || 0), 0);
    const profit = settled.reduce((s, t) => s + profitForTicket(t), 0);
    const wins = settled.filter((t) => t.status === 'won').length;
    out.push({
      key, n: settled.length, total: ts.length, wagered, profit,
      roi: wagered > 0 ? profit / wagered : 0,
      winRate: settled.length ? wins / settled.length : 0,
      wins, smallSample: settled.length < 30,
    });
  }
  return out.sort((a, b) => b.n - a.n);
}

export function computeStats(tickets, transactions = [], settings = {}) {
  const settled = tickets.filter(isSettled);
  const open = tickets.filter((t) => !isSettled(t));
  const totalWageredSettled = settled.reduce((s, t) => s + (Number(t.stake) || 0), 0);
  const netProfit = settled.reduce((s, t) => s + profitForTicket(t), 0);
  const wins = settled.filter((t) => t.status === 'won').length;
  const decidable = settled.filter((t) => t.status === 'won' || t.status === 'lost').length;

  const deposits = transactions.filter((x) => x.type === 'deposit').reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const withdrawals = transactions.filter((x) => x.type === 'withdrawal').reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const startingBankroll = Number(settings.startingBankroll) || 0;
  const bankroll = startingBankroll + deposits - withdrawals + netProfit;

  // Cash vs trade-credit / bonus — tracked separately, never blended silently.
  const byStakeType = {};
  for (const type of ['cash', 'trade_credit', 'bonus']) {
    const subset = settled.filter((t) => (t.stake_type || 'cash') === type);
    byStakeType[type] = {
      n: subset.length,
      wagered: subset.reduce((s, t) => s + (Number(t.stake) || 0), 0),
      profit: subset.reduce((s, t) => s + profitForTicket(t), 0),
    };
  }

  // Leg-level breakdowns
  const settledLegs = [];
  for (const t of settled) for (const leg of t.legs || []) settledLegs.push({ ...leg, _ticket: t });
  const decidedLegs = settledLegs.filter((l) => l.status === 'won' || l.status === 'lost');

  const marketMap = new Map();
  for (const leg of decidedLegs) {
    const key = leg.market || 'Unspecified market';
    if (!marketMap.has(key)) marketMap.set(key, { key, n: 0, wins: 0 });
    const row = marketMap.get(key); row.n++; if (leg.status === 'won') row.wins++;
  }
  const marketPerformance = [...marketMap.values()].map((r) => ({
    ...r, winRate: r.n ? r.wins / r.n : 0, smallSample: r.n < 30,
  })).sort((a, b) => b.n - a.n);

  const playerMap = new Map();
  for (const leg of decidedLegs) {
    const key = leg.player || 'Unspecified player';
    if (!playerMap.has(key)) playerMap.set(key, { key, n: 0, wins: 0 });
    const row = playerMap.get(key); row.n++; if (leg.status === 'won') row.wins++;
  }
  const playerPerformance = [...playerMap.values()].map((r) => ({
    ...r, winRate: r.n ? r.wins / r.n : 0, smallSample: r.n < 30,
  })).sort((a, b) => b.n - a.n);

  return {
    totalBets: tickets.length,
    settledCount: settled.length,
    openCount: open.length,
    totalWageredSettled,
    netProfit,
    roi: totalWageredSettled > 0 ? netProfit / totalWageredSettled : 0,
    winRate: decidable ? wins / decidable : 0,
    wins, losses: settled.filter((t) => t.status === 'lost').length,
    voids: settled.filter((t) => t.status === 'void').length,
    cashedOut: settled.filter((t) => t.status === 'cashed_out').length,
    bankroll, deposits, withdrawals, startingBankroll,
    byStakeType,
    perBook: groupStats(tickets, (t) => t.book),
    // Positions (e.g. Polymarket) are not parlays — excluded from leg-count
    // cohorts (groupStats skips null keys) but counted everywhere else.
    parlayPerformance: groupStats(tickets, (t) => (t.type === 'position' ? null : `${(t.legs?.length || 1)}`)),
    marketPerformance,
    playerPerformance,
  };
}

// AI Insights: generated ONLY from actual ticket data. Every insight carries n
// and a confidence note. Small samples are labelled, never dressed up.
export function generateInsights(tickets) {
  const stats = computeStats(tickets, [], {});
  const insights = [];
  if (stats.settledCount === 0) {
    return [{ text: 'No settled tickets yet — insights appear after tickets settle. Nothing to conclude from pending bets.', n: 0, confidence: 'No settled sample.' }];
  }
  for (const row of stats.parlayPerformance.filter((r) => r.n > 0)) {
    insights.push({
      text: `${row.key}-leg tickets: ROI ${row.roi >= 0 ? '+' : ''}${(row.roi * 100).toFixed(1)}% on ${row.n} settled ticket(s), profit $${row.profit.toFixed(2)}.`,
      n: row.n,
      confidence: row.smallSample ? 'Small sample (n < 30) — do not over-read this as a tendency.' : `Win-rate 95% CI shown in Analytics. n=${row.n}.`,
    });
  }
  for (const row of stats.marketPerformance.filter((r) => r.n >= 2)) {
    insights.push({
      text: `Market "${row.key}": ${row.wins}/${row.n} legs won (${(row.winRate * 100).toFixed(1)}%).`,
      n: row.n,
      confidence: row.smallSample ? 'Small sample (n < 30) — do not over-read this as a tendency.' : `n=${row.n}.`,
    });
  }
  for (const row of stats.perBook.filter((r) => r.n > 0)) {
    insights.push({
      text: `${row.key}: ROI ${row.roi >= 0 ? '+' : ''}${(row.roi * 100).toFixed(1)}% across ${row.n} settled ticket(s).`,
      n: row.n,
      confidence: row.smallSample ? 'Small sample (n < 30) — do not over-read this as a tendency.' : `n=${row.n}.`,
    });
  }
  if (!insights.length) insights.push({ text: 'Settled tickets exist, but no cohort has enough data for an insight yet.', n: stats.settledCount, confidence: 'Insufficient cohort data.' });
  return insights;
}
