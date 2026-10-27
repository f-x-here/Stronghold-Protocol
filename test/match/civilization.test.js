import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeMatch, give, DATA } from './harness.js';
import { createRegistry } from '../../server/match/effectsMeta.js';
import { CIVILIZATION, SURVIVAL_MON3TR } from '../../shared/civilization.js';
import { pieceGarrisonIds } from '../../server/match/civilization.js';
import { validateData } from '../../shared/plugins/validate.js';

function setup(band = CIVILIZATION) {
  const h = makeMatch({ mode: 'solo', seed: 41, fake: true, registry: createRegistry() }).start();
  h.toPrep(1);
  const ps = h.ps('p_0');
  ps.board.clear(); ps.hand.fill(null); ps.temp.fill(null); ps.offers.length = 0;
  ps.bandId = band; ps.funds = 100; ps.recompute();
  return { h, ps, m: h.m };
}
const normal = tier => Object.values(DATA.chess).find(c => c.visible && !c.isGolden && c.tier === tier && c.goldenId);
function sellTier(m, ps, tier, golden = true) {
  const c = normal(tier);
  const p = give(m, ps, golden ? c.goldenId : c.chessId);
  assert.deepEqual(ps.sell(p.uid), { ok: true });
}
function unlock(m, ps, level = 5) {
  ps.shop.level = level;
  m.dispatch(ps, 'onLevelUp', { level, price: 0 });
  return ps.find(ps.civilization.mon3trUid)?.piece;
}

test('normal sales do not qualify; each elite tier independently records its normal traits once', () => {
  const { m, ps } = setup();
  sellTier(m, ps, 1, false);
  assert.equal(ps.civilization.legacies.length, 0);
  for (let tier = 1; tier <= 6; tier++) {
    sellTier(m, ps, tier);
    sellTier(m, ps, tier);
  }
  assert.equal(ps.civilization.legacies.length, 6);
  for (const l of ps.civilization.legacies) assert.deepEqual(l.garrisonIds, normal(l.tier).garrisonIds);
  assert.equal(ps.civilization.granted, false);
});

test('level >= 5 grants once, inherits past and future legacies, keeps fixed skill and original DIY unchanged', () => {
  const { m, ps } = setup();
  const diy = JSON.stringify(DATA.backups.units.char_4179_monstr);
  for (const tier of [1, 2, 3]) sellTier(m, ps, tier);
  const p = unlock(m, ps, 6);
  assert.equal(p.id, SURVIVAL_MON3TR);
  assert.equal(ps.gd.chess(p.id).name, '存续·Mon3tr');
  assert.deepEqual(ps.civilization.inherited, [1, 2, 3]);
  assert.equal(ps.loadoutFor(ps.gd.chess(p.id)).skillIndex, 2);
  const uid = p.uid;
  unlock(m, ps);
  assert.equal(ps.civilization.mon3trUid, uid);
  sellTier(m, ps, 5);
  assert.deepEqual(ps.civilization.inherited, [1, 2, 3, 5]);
  assert.equal(ps.find(uid).piece, p);
  assert.equal(JSON.stringify(DATA.backups.units.char_4179_monstr), diy);
  assert.ok(!m.gd.visibleChess.includes(p.id));
  assert.deepEqual(ps.privateView().civilization, JSON.parse(JSON.stringify(ps.civilization)));
});

test('direct promotion qualifies just like an elite gift', () => {
  const { m, ps } = setup();
  const p = give(m, ps, normal(2).chessId);
  assert.equal(ps.promote(p), true);
  assert.deepEqual(ps.sell(p.uid), { ok: true });
  assert.equal(ps.civilization.legacies[0].tier, 2);
});

test('gain effects initialize once; explicit retriggers run later without recreating a legacy', () => {
  const { m, ps } = setup();
  const c = Object.values(DATA.chess).find(c => c.visible && !c.isGolden && c.goldenId && c.garrisonIds.some(id => DATA.garrisons[id].eventType === 'SERVER_GAIN'));
  const p = unlock(m, ps);
  const calls = [];
  const original = m.dispatcher.triggerGarrisons.bind(m.dispatcher);
  m.dispatcher.triggerGarrisons = (...args) => { calls.push(args); return original(...args); };
  assert.deepEqual(ps.sell(give(m, ps, c.goldenId).uid), { ok: true });
  const initialized = calls.length;
  m.dispatch(ps, 'onLevelUp', { level: 5 });
  m.dispatch(ps, 'onPrepStart', { round: m.round });
  assert.equal(calls.length, initialized);
  assert.deepEqual(pieceGarrisonIds(ps, p, 'SERVER_GAIN'), c.garrisonIds);
  original(ps, p, 'SERVER_GAIN');
  assert.equal(ps.civilization.legacies.length, 1);
});

test('non-gain traits require Mon3tr on board; no strategy leaves original flow unchanged', () => {
  const { m, ps } = setup();
  sellTier(m, ps, 1);
  const p = unlock(m, ps);
  assert.deepEqual(pieceGarrisonIds(ps, p), []);
  const loc = ps.find(p.uid); ps._detach(loc); ps.board.set('10,3', p);
  assert.deepEqual(pieceGarrisonIds(ps, p), ps.civilization.legacies[0].garrisonIds);
  const other = setup('band_pith');
  sellTier(other.m, other.ps, 1);
  other.ps.shop.level = 5; other.m.dispatch(other.ps, 'onLevelUp', { level: 5 });
  assert.equal(other.ps.civilization, undefined);
});

test('Suzuran retriggers the inherited normal gain trait using Mon3tr as the recipient', () => {
  for (const gid of ['garrison_60_a', 'garrison_60_b']) {
    const { m, ps } = setup();
    const donor = Object.values(DATA.chess).find(c => !c.isGolden && c.garrisonIds.includes('garrison_26_a'));
    const suzu = Object.values(DATA.chess).find(c => c.garrisonIds.includes(gid));
    sellTier(m, ps, donor.tier, false);
    assert.deepEqual(ps.sell(give(m, ps, donor.goldenId).uid), { ok: true });
    const before = ps.pendingFunds;
    const p = unlock(m, ps);
    assert.equal(ps.pendingFunds, before + 1);
    ps._detach(ps.find(p.uid)); ps.board.set('10,4', p);
    give(m, ps, suzu.chessId, 'board', [10, 3]);
    m.dispatch(ps, 'onPrepStart', { round: m.round });
    assert.equal(ps.pendingFunds, before + 2, gid);
    assert.equal(ps.civilization.legacies.length, 1);
    m.dispatch(ps, 'onLevelUp', { level: 5 });
    assert.equal(ps.pendingFunds, before + 2);
  }
});

test('battle input and reconnect views carry inherited IDs without replaying initialization', () => {
  const { m, ps } = setup();
  sellTier(m, ps, 3);
  const p = unlock(m, ps);
  ps._detach(ps.find(p.uid)); ps.board.set('10,4', p);
  ps.recompute();
  const before = ps.pendingFunds;
  const a = ps.battleInput();
  const b = ps.battleInput();
  assert.deepEqual(a.units.find(u => u.uid === p.uid).legacyGarrisonIds, ps.civilization.legacies[0].garrisonIds);
  assert.deepEqual(a, b);
  assert.equal(ps.pendingFunds, before);
  assert.equal(ps.pieceView(p).legacyGarrisonIds.length, ps.civilization.legacies[0].garrisonIds.length);
});

test('hidden nonmergeable gift passes content composition; ordinary unpaired records remain invalid', () => {
  assert.deepEqual(validateData(DATA), []);
  const broken = structuredClone(DATA);
  broken.chess[SURVIVAL_MON3TR].isHidden = false;
  assert.ok(validateData(broken).some(e => e.code === 'PLUGIN_DATA_PAIR'));
});

test('inherited refresh trait witnesses only subsequent refreshes and keeps the native per-round limit', () => {
  const { m, ps } = setup();
  const p = unlock(m, ps);
  ps._detach(ps.find(p.uid)); ps.board.set('10,4', p);
  m.dispatch(ps, 'onRefresh', { slots: [], free: false, price: 1 });
  const donor = Object.values(DATA.chess).find(c => !c.isGolden && c.garrisonIds.includes('garrison_123_a'));
  assert.deepEqual(ps.sell(give(m, ps, donor.goldenId).uid), { ok: true });
  ps.bonds.siracusaShip = { active: true, tier: 1, count: 3, layers: 0 };
  const before = ps.layers.siracusaShip ?? 0;
  m.dispatch(ps, 'onRefresh', { slots: [], free: false, price: 1 });
  assert.equal(ps.layers.siracusaShip, before + 4);
  m.dispatch(ps, 'onRefresh', { slots: [], free: false, price: 1 });
  assert.equal(ps.layers.siracusaShip, before + 4);
});

test('a new gain legacy adds only its own effect, and a full hand receives the unique gift in overflow', () => {
  const { m, ps } = setup();
  for (let i = 0; i < ps.hand.length; i++) give(m, ps, normal(1).chessId);
  const p = unlock(m, ps);
  assert.equal(ps.find(p.uid).area, 'temp');
  assert.deepEqual(ps.gd.placeableTokens(p.id, ps.loadoutFor(ps.gd.chess(p.id))),
    [{ tokenId: 'token_10050_monstr_prosts', count: 1 }]);
  // Make room for the two sales while keeping the gifted instance intact.
  ps.hand.fill(null);
  const donors = ['garrison_26_a', 'garrison_32_a'].map(gid => Object.values(DATA.chess)
    .find(c => !c.isGolden && c.garrisonIds.includes(gid)));
  assert.notEqual(donors[0].tier, donors[1].tier);
  const before = ps.pendingFunds;
  assert.deepEqual(ps.sell(give(m, ps, donors[0].goldenId).uid), { ok: true });
  assert.equal(ps.pendingFunds, before + 1);
  assert.deepEqual(ps.sell(give(m, ps, donors[1].goldenId).uid), { ok: true });
  assert.equal(ps.pendingFunds, before + 3);
  assert.equal(ps.civilization.mon3trUid, p.uid);
});

test('inherited sale trait uses Mon3tr and its last on-board event without granting another copy', () => {
  const { m, ps } = setup();
  const donor = Object.values(DATA.chess).find(c => !c.isGolden && c.garrisonIds.includes('garrison_21_a'));
  assert.deepEqual(ps.sell(give(m, ps, donor.goldenId).uid), { ok: true });
  const p = unlock(m, ps);
  ps._detach(ps.find(p.uid)); ps.board.set('10,4', p);
  const before = ps.pendingFunds;
  assert.deepEqual(ps.sell(p.uid), { ok: true });
  assert.equal(ps.pendingFunds, before + 2);
  unlock(m, ps);
  assert.equal(ps.find(p.uid), null);
  assert.equal(ps.civilization.granted, true);
});

