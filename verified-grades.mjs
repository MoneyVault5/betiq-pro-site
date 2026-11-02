// BetIQ Pro — operator-verified final grades.
// Grades are STAT-DERIVED: they settle tickets through the normal
// settlement path, are labelled stat-derived in the UI and history, and
// NEVER populate book-confirmed fields (book_confirmed_status stays
// null). This public build ships with no preloaded grades.

export const GRADE_SOURCE = 'ESPN final box scores (operator-verified) — stat-derived, not book-confirmed';

// Keyed by fixture_id. Empty in the public build.
export const VERIFIED_GRADES = {};

// Apply one ticket's verified grade. No-ops (returns the ticket
// unchanged) when: no grade exists for its fixture_id, the ticket is
// already settled with a book-confirmed result, or it was already
// stat-graded. Money fields are never rewritten.
export function applyVerifiedGrade(ticket) {
  const grade = ticket && VERIFIED_GRADES[ticket.fixture_id];
  if (!grade) return ticket;
  if (ticket.settlement_source === 'book-confirmed' || ticket.book_confirmed_status) return ticket;
  if (ticket.settlement_source === 'stat-derived') return ticket;
  if (!['pending', 'partial'].includes(ticket.status)) return ticket;
  const next = JSON.parse(JSON.stringify(ticket));
  next.legs = (next.legs || []).map((leg, i) => {
    const g = grade.legs[i];
    if (!g) return leg;
    const out = { ...leg, stat_line: g.stat_line || leg.stat_line || null };
    if (g.status) out.status = g.status;
    return out;
  });
  next.status = grade.status;
  next.settlement_source = 'stat-derived';
  next.book_confirmed_status = null;
  next.stat_grade = {
    source: GRADE_SOURCE,
    event_id: grade.event_id ?? null,
    graded_at: '2026-11-01',
    note: grade.note || null,
  };
  return next;
}

// One-time, flag-guarded state migration: grade any still-pending
// fixture tickets in an existing betiq_v1 state. Book-confirmed and
// manually settled tickets are never overwritten.
export function applyVerifiedGradesToState(state) {
  if (!state || !Array.isArray(state.tickets) || state.verified_grades_v1) return state;
  return {
    ...state,
    tickets: state.tickets.map(applyVerifiedGrade),
    verified_grades_v1: true,
  };
}
