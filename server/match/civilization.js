import { CIVILIZATION, SURVIVAL_MON3TR, effectiveGarrisonIds } from '../../shared/civilization.js';

export function survivalActive(ps) {
  const loc = ps.civilization && ps.find(ps.civilization.mon3trUid);
  return loc?.area === 'board';
}

export function pieceGarrisonIds(ps, piece, eventType = null, activeAtSale = false) {
  return effectiveGarrisonIds(ps.gd.chess(piece.id), piece, ps.civilization,
    { active: activeAtSale || survivalActive(ps), gain: eventType === 'SERVER_GAIN' });
}

/** Uses existing sale/level/prep events; mark before reentrant grants and effects. */
export function dispatchCivilization(dispatcher, ps, hook, ev) {
  if (ps.bandId !== CIVILIZATION || !ps.alive) return;
  const state = ps.civilization ??= { legacies: [], granted: false, mon3trUid: null, inherited: [] };
  if (hook === 'onSold' && ev.piece?.kind === 'chess') {
    const sold = ps.gd.chess(ev.piece.id);
    const base = sold && ps.gd.chess(ps.gd.baseIdOf(ev.piece.id));
    if (sold?.isGolden && base && base.tier >= 1 && base.tier <= 6 && !state.legacies.some(l => l.tier === base.tier)) {
      state.legacies.push({ tier: base.tier, chessId: base.chessId, name: base.name,
        garrisonIds: [...(base.garrisonIds ?? [])] });
    }
  }
  if (['onLevelUp', 'onPrepStart'].includes(hook) && ps.shop.level >= 5 && !state.granted) {
    state.granted = true;
    const piece = ps.acquireChess(SURVIVAL_MON3TR, { source: CIVILIZATION, fromPool: false });
    if (piece) state.mon3trUid = piece.uid;
    else state.granted = false;
  }
  const piece = ps.find(state.mon3trUid)?.piece;
  if (!piece) return;
  for (const legacy of state.legacies) {
    if (state.inherited.includes(legacy.tier)) continue;
    state.inherited.push(legacy.tier);
    dispatcher.triggerGarrisons(ps, piece, 'SERVER_GAIN', { garrisonIds: legacy.garrisonIds });
  }
}
