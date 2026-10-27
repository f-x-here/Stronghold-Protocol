// User-designed strategy. State belongs to the match, never to the sold unit or global data.
export const CIVILIZATION = 'band_kalts_survival';
export const SURVIVAL = 'survivalShip';
export const SURVIVAL_MON3TR = 'chess_kalts_survival_mon3tr_a';

export function legacyIds(state) {
  return (state?.legacies ?? []).flatMap(l => l.garrisonIds);
}

/** Native traits remain available; inherited gain effects may also be explicitly retriggered off board. */
export function effectiveGarrisonIds(rec, piece, state, { active = false, gain = false } = {}) {
  const native = rec?.garrisonIds ?? [];
  if (piece?.uid !== state?.mon3trUid || (!gain && !active)) return native;
  return [...new Set([...native, ...legacyIds(state)])];
}
