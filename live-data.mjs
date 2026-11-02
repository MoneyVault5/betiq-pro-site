// BetIQ Pro — live stat tracking + automatic settlement engine (pure functions)
// Companion to settlement.mjs: this module grades legs from a normalised game
// snapshot. It does NOT fetch from any provider itself — a provider adapter
// supplies snapshots in the shape below, so the provider choice stays reversible
// (see LIVE-DATA.md). No stat, outcome, or latency is ever invented here:
//
// Snapshot shape:
// {
//   game_id, status: 'scheduled' | 'in_progress' | 'final',
//   source: 'therundown' | 'sportsdataio' | 'balldontlie' | 'demo' | ...,
//   updated_at: ISO string, latency_note: string (e.g. 'vendor claims real-time;
//   unverified' — never blanked into a promise),
//   players: { 'Player Name': {
//     snaps, receptions, receiving_yards, rushing_yards, passing_yards,
//     receiving_tds, rushing_tds, passing_tds,
//     scoring_tds,        // TDs the player personally scored (rush/rec/return/recovery)
//                          // from scoring plays. REQUIRED for Anytime TD grading.
//     longest_rush, longest_reception } },
//   void_leg_keys: ['Player|Market|Line', ...],  // ONLY legs a book/provider has
//                          // verified as void (DNP, cancellation). Never inferred.
//   binary_results: { '<event key>': true | false }  // Polymarket-style contracts
// }
//
// HARD RULES (from TASK-0021 research + book house rules):
// - Anytime TD is graded ONLY from scoring_tds. A QB's passing TDs never count:
//   grading from a total-TD column would mark every passing QB a winner.
// - Unknown / 'Unspecified' markets are NEVER graded: leg stays pending.
// - Injury voids are NEVER inferred: a player who played (snaps > 0) and fell
//   short at final is lost, unless the leg key is in void_leg_keys.
// - DNP voids at final apply only when the ticket is linked to this game
//   (ticket.game_id === snapshot.game_id). An unlinked ticket's legs are never
//   voided by a snapshot from another game.
// - DraftKings may re-settle after final (stat corrections); Novig may NOT
//   re-grade after grading. A corrected Novig snapshot therefore keeps the
//   original grade and raises a book_disagreement flag instead of overwriting.
// - Under lines cannot clinch mid-game (yards only grow); they settle at final.
// - At-least / Over lines clinch the moment the threshold is reached, but the
//   ticket's settlement_state stays 'provisional' until the game is final.

import { applySettlement } from './settlement.mjs';

export const BOOK_RULES = {
  DraftKings: { resettle_after_final: true, dnp_void: true, novig_fmv_void: false },
  Novig: { resettle_after_final: false, dnp_void: true, novig_fmv_void: true },
  Polymarket: { resettle_after_final: false, dnp_void: true, novig_fmv_void: false },
  Other: { resettle_after_final: false, dnp_void: true, novig_fmv_void: false },
};

const MARKET_STAT = {
  'receptions': 'receptions',
  'receiving yards': 'receiving_yards',
  'rushing yards': 'rushing_yards',
  'passing yards': 'passing_yards',
  'receiving tds': 'receiving_tds',
  'rushing tds': 'rushing_tds',
  'passing tds': 'passing_tds',
  'longest rush': 'longest_rush',
  'longest reception': 'longest_reception',
  'longest rec': 'longest_reception',
};

function norm(s) {
  return String(s ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

// Parse a slip line into a test. '10+' / '25+' (Novig milestone) and
// 'Over 24.5' are both "reach at least this value". '' / null => no test.
export function parseLine(line) {
  const raw = String(line ?? '').trim();
  if (!raw) return null;
  if (/^under\b/i.test(raw)) {
    const v = parseFloat(raw.replace(/^under\b/i, ''));
    return Number.isNaN(v) ? null : { kind: 'under', value: v };
  }
  const m = raw.match(/^(?:over\s+)?(\d+(?:\.\d+)?)\+?$/i);
  if (!m) return null;
  return { kind: 'at_least', value: parseFloat(m[1]) };
}

function legKey(leg) {
  return `${leg.player}|${leg.market}|${leg.line}`;
}

// Current stat value for a leg, or { unavailable, reason } when it cannot be
// graded honestly from this snapshot.
export function statForLeg(leg, playerStat) {
  const market = norm(leg.market);
  if (!market || market === 'unspecified') {
    return { unavailable: true, reason: 'market unspecified on screen — not graded' };
  }
  if (market === 'anytime td scorer' || market === 'anytime td' || market === 'anytime touchdown scorer') {
    if (playerStat == null || playerStat.scoring_tds == null) {
      return { unavailable: true, reason: 'scoring-play data unavailable — anytime TD never graded from total TDs' };
    }
    return { value: Number(playerStat.scoring_tds) || 0, kind: 'anytime_td' };
  }
  if (market.startsWith('polymarket')) {
    return { value: null, kind: 'binary' };
  }
  const field = MARKET_STAT[market];
  if (!field) return { unavailable: true, reason: `unknown market "${leg.market}" — not graded` };
  if (playerStat == null || playerStat[field] == null) {
    return { unavailable: true, reason: `no ${market} stat in snapshot yet` };
  }
  return { value: Number(playerStat[field]) || 0, kind: 'stat' };
}

// Grade ONE leg against a snapshot. Never returns won/lost without evidence.
export function gradeLeg(leg, snapshot, book = 'Other') {
  const rules = BOOK_RULES[book] || BOOK_RULES.Other;
  const base = { current: null, lineValue: null, progress: 0, reason: '' };
  if (!snapshot || snapshot.status === 'scheduled') {
    return { ...base, status: 'pending', reason: 'game has not started' };
  }
  const playerStat = snapshot.players ? snapshot.players[leg.player] : undefined;
  const verifiedVoid = Array.isArray(snapshot.void_leg_keys) && snapshot.void_leg_keys.includes(legKey(leg));
  if (verifiedVoid) {
    return { ...base, status: 'void', reason: 'void verified by book/provider (DNP, cancellation, or verified void)' };
  }
  const parsed = parseLine(leg.line);
  if (parsed) base.lineValue = parsed.value;

  // Polymarket-style binary contract: needs an explicit event result.
  if (norm(leg.market).startsWith('polymarket')) {
    const key = leg.binary_key || leg.event_key || legKey(leg);
    const result = snapshot.binary_results ? snapshot.binary_results[key] : undefined;
    if (result === undefined) return { ...base, status: 'pending', reason: 'binary event result not in snapshot yet' };
    const expectedYes = norm(leg.line) === 'yes' || norm(leg.expected) === 'yes';
    if (snapshot.status !== 'final') return { ...base, status: 'pending', reason: 'binary contract settles at final only' };
    return { ...base, status: result === expectedYes ? 'won' : 'lost', reason: 'binary event settled at final' };
  }

  // Did-not-play: only at final, only with a stat row absent / zero snaps.
  // Checked BEFORE stat availability: a DNP player has no stat line at all,
  // and that absence at final is itself the void evidence.
  const dnp = playerStat == null || (Number(playerStat.snaps) || 0) === 0;
  if (dnp && snapshot.status === 'final' && rules.dnp_void) {
    return { ...base, current: 0, status: 'void', reason: 'player did not play (0 snaps at final) — void per book rules' };
  }
  if (dnp && snapshot.status !== 'final') {
    return { ...base, status: 'pending', reason: 'player has no stat line yet — may still enter the game' };
  }

  const stat = statForLeg(leg, playerStat);
  if (stat.unavailable) return { ...base, status: 'pending', reason: stat.reason };

  const current = stat.value;
  base.current = current;
  if (parsed) base.progress = parsed.value > 0 ? Math.min(1, current / parsed.value) : (current > 0 ? 1 : 0);

  if (stat.kind === 'anytime_td') {
    if (current >= 1) return { ...base, status: 'won', reason: 'scoring TD confirmed from scoring plays' };
    if (snapshot.status === 'final') return { ...base, status: 'lost', reason: 'no scoring TD at final' };
    return { ...base, status: 'pending', reason: 'no scoring TD yet, game in progress' };
  }
  if (parsed.kind === 'at_least') {
    if (current >= parsed.value) return { ...base, status: 'won', reason: 'threshold reached', clinched: true };
    if (snapshot.status === 'final') return { ...base, status: 'lost', reason: 'threshold not reached at final' };
    return { ...base, status: 'pending', reason: 'below threshold, game in progress' };
  }
  if (parsed.kind === 'under') {
    if (snapshot.status !== 'final') return { ...base, status: 'pending', reason: 'under lines settle at final only' };
    return { ...base, status: current < parsed.value ? 'won' : 'lost', reason: 'final stat vs under line' };
  }
  // No line (e.g. a bare market leg): nothing to test against.
  return { ...base, status: 'pending', reason: 'no line to test against — not graded' };
}

// Grade a whole ticket. Returns { ticket, grades, book_disagreement }.
// ticket.game_id links a ticket to a snapshot game; without a link, final
// DNP voids are skipped (see header) and reported in grades as pending.
export function gradeTicketFromSnapshot(ticket, snapshot) {
  const book = ticket.book || 'Other';
  const rules = BOOK_RULES[book] || BOOK_RULES.Other;
  const grades = (ticket.legs || []).map((leg, i) => {
    if (snapshot.status === 'final' && ticket.game_id && ticket.game_id !== snapshot.game_id) {
      return { status: 'pending', reason: 'snapshot is for a different game — leg untouched' };
    }
    const g = gradeLeg(leg, snapshot, book);
    // Unlinked ticket: never let another game's final void a leg via DNP.
    if (!ticket.game_id && g.status === 'void' && /did not play/.test(g.reason)) {
      return { ...g, status: 'pending', reason: 'game not linked to ticket — DNP void skipped, needs ticket.game_id' };
    }
    // Settlement is sticky: a pending re-grade never erases a leg that was
    // already settled with evidence (only an evidenced re-grade at final
    // may change it, handled by the resettle logic below).
    const prev = leg.status;
    if (g.status === 'pending' && ['won', 'lost', 'void'].includes(prev)) {
      return { ...g, status: prev, reason: `${g.reason} — previous settled grade kept` };
    }
    return g;
  });
  const previouslyFinal = ticket.settlement_state === 'final' || ticket.settlement_state === 'resettled';
  const legResults = grades.map((g, i) => ({ index: i, status: g.status }));
  // Only settled legs feed applySettlement; pending legs keep the ticket open.
  const next = applySettlement(ticket, { legResults });
  // applySettlement sets leg statuses from legResults — restore 'pending'
  // handling: legs graded pending stay pending (applySettlement already does
  // this via its partial logic).
  next.live_grades = grades.map((g, i) => ({ ...g, index: i }));
  next.live_snapshot_at = snapshot.updated_at || null;
  next.live_source = snapshot.source || null;
  next.live_latency_note = snapshot.latency_note || null;

  let book_disagreement = null;
  if (snapshot.status === 'final') {
    if (previouslyFinal && rules.resettle_after_final) {
      const changed = (ticket.legs || []).some((l, i) => l.status !== grades[i].status && grades[i].status !== 'pending');
      if (changed) next.settlement_state = 'resettled';
      else next.settlement_state = 'final';
    } else if (previouslyFinal && !rules.resettle_after_final) {
      const changed = (ticket.legs || []).some((l, i) => l.status !== grades[i].status && grades[i].status !== 'pending');
      if (changed) {
        // Novig/Polymarket: keep the original grade; flag, never overwrite.
        book_disagreement = `book does not re-grade after final; corrected stats would change leg(s) but original grade is kept`;
        next.legs = ticket.legs.map((l) => ({ ...l }));
        next.status = ticket.status;
        next.settlement_state = ticket.settlement_state;
      } else {
        next.settlement_state = 'final';
      }
    } else {
      next.settlement_state = 'final';
    }
  } else if (snapshot.status === 'in_progress') {
    next.settlement_state = 'provisional';
  }
  return { ticket: next, grades, book_disagreement };
}

// Apply one snapshot to many tickets. Duplicate protection is untouched:
// tickets are matched by id and never duplicated by this function.
export function applyLiveSnapshot(tickets, snapshot) {
  return tickets.map((t) => {
    // Only touch tickets that have at least one leg for a player in this
    // snapshot, or that are explicitly linked to this game.
    const linked = t.game_id && t.game_id === snapshot.game_id;
    const touches = linked || (t.legs || []).some((l) => snapshot.players && l.player in snapshot.players);
    if (!touches) return t;
    return gradeTicketFromSnapshot(t, snapshot).ticket;
  });
}

// ---- Feed transport: error / retry / staleness state (no provider secrets) ----
// fetchFn: async () => snapshot. Keys must NEVER be passed to this layer from
// browser code: a paid provider key lives server-side (Edge Function proxy)
// and the browser calls the proxy, never the provider directly (LIVE-DATA.md).
export async function fetchWithRetry(fetchFn, { retries = 3, baseDelayMs = 1000, sleep = (ms) => new Promise((r) => setTimeout(r, ms)) } = {}) {
  let attempts = 0;
  let lastError = null;
  while (attempts <= retries) {
    attempts++;
    try {
      const data = await fetchFn();
      return { ok: true, data, attempts, error: null };
    } catch (e) {
      lastError = e;
      if (attempts > retries) break;
      await sleep(baseDelayMs * 2 ** (attempts - 1));
    }
  }
  return { ok: false, data: null, attempts, error: String(lastError && lastError.message ? lastError.message : lastError) };
}

export function feedStatus(lastUpdatedAt, nowMs = Date.now(), staleAfterMs = 120000) {
  if (!lastUpdatedAt) return { status: 'idle', stale: false };
  const age = nowMs - new Date(lastUpdatedAt).getTime();
  if (Number.isNaN(age)) return { status: 'error', stale: true, error: 'bad updated_at timestamp' };
  return age > staleAfterMs ? { status: 'stale', stale: true, age_ms: age } : { status: 'live', stale: false, age_ms: age };
}

// ---- Migration: existing browser tickets (betiq_v1) gain live fields only ----
// Money fields, statuses, and ids are never rewritten by migration.
export function migrateTicket(ticket) {
  if (ticket.live_migrated) return ticket;
  return {
    ...ticket,
    settlement_state: ticket.settlement_state || null,
    live_grades: ticket.live_grades || null,
    live_snapshot_at: ticket.live_snapshot_at || null,
    live_source: ticket.live_source || null,
    live_migrated: true,
  };
}

export function migrateState(state) {
  if (!state || !Array.isArray(state.tickets)) return state;
  return { ...state, tickets: state.tickets.map(migrateTicket) };
}
