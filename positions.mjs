// BetIQ Pro — Polymarket positions (pure functions, shared with Node tests)
// A position is a settled-history record distinct from a sportsbook parlay
// ticket: { type: 'position', book: 'Polymarket', description, side,
// stake (CASH only — never trade credit), potential_payout, status }.
// It carries legs: [] and flows through settlement.mjs profitForTicket /
// computeStats exactly like a settled ticket (won: payout − stake;
// lost: −stake). This public build seeds no positions.

export function polymarketSeedPositions() {
  return [];
}

// Migration: an existing betiq_v1 state predates positions. Append any
// missing seed positions exactly once (flag-guarded) without touching
// existing tickets, money, or statuses. A state the user explicitly
// cleared carries positions_v1: true and stays cleared.
export function ensurePositions(state) {
  if (!state || !Array.isArray(state.tickets) || state.positions_v1) return state;
  const existing = new Set(state.tickets.map((t) => t.id));
  const additions = polymarketSeedPositions().filter((p) => !existing.has(p.id));
  return { ...state, tickets: [...state.tickets, ...additions], positions_v1: true };
}
