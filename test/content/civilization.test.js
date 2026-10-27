import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeBattle } from '../helpers/battleHarness.js';
import { SURVIVAL_MON3TR } from '../../shared/civilization.js';
import { buildBattleSpec, createBattleFromSpec } from '../../server/sim/spec.js';

const state = { active: true, tier: 1, count: 3, layers: 30 };
const input = ids => ({ playerId: 'p1', seat: 0, side: 'L', colOffset: 0,
  units: [{ uid: 1, kind: 'chess', chessId: SURVIVAL_MON3TR, row: 10, col: 4, skillIndex: 2, legacyGarrisonIds: ids }],
  bonds: { sargonShip: { ...state }, yanShip: { ...state }, maniShip: { ...state }, emptyShip: { ...state } },
});

test('real Mon3tr S3 and reconstruction kit install alongside multiple independent inherited traits', () => {
  const h = makeBattle({ players: [input(['garrison_43_a', 'garrison_03_a', 'garrison_09_a'])], autoFinish: false });
  h.step(1);
  const u = h.unit(SURVIVAL_MON3TR);
  assert.ok(u.alive && u.deployed);
  assert.equal(u.def.skill.id, 'skchr_monstr_3');
  assert.ok(u.findBuff('gar:garrison_03_a'));
  assert.ok(u.findBuff('gar:garrison_09_a'));
  const gain = () => h.result().perPlayer.p1.layerGains.sargonShip ?? 0;
  const before = gain();
  h.b.emit('skillStart', { unit: u, skill: u.skill });
  assert.equal(gain(), before + 6);
  u.alive = false;
  h.b.emit('death', { unit: u, reason: 'killed' });
  assert.equal(u.findBuff('gar:garrison_03_a'), null);
  h.b.emit('skillStart', { unit: u, skill: u.skill });
  assert.equal(gain(), before + 6);
  u.alive = true;
  h.b.emit('deploy', { unit: u });
  assert.ok(u.findBuff('gar:garrison_03_a'));
  h.b.emit('skillStart', { unit: u, skill: u.skill });
  assert.equal(gain(), before + 12);
  assert.deepEqual(h.b.errors, []);
});

test('BattleSpec round trip preserves the inherited traits and installs the same skill', () => {
  const spec = buildBattleSpec({ players: [input(['garrison_43_a'])], seed: 7 });
  const b = createBattleFromSpec(JSON.parse(JSON.stringify(spec)));
  assert.deepEqual(spec.players[0].units[0].legacyGarrisonIds, ['garrison_43_a']);
  assert.ok(b);
});

test('strategy reconstruction uses the real normal-form stats and Mon3tr actually casts S3', () => {
  const player = input([]);
  player.units.push({ uid: 2, kind: 'token', tokenId: 'token_10050_monstr_prosts', ownerUid: 1, row: 10, col: 6 });
  player.units.push({ uid: 3, kind: 'chess', chessId: 'chess_char_1_02_a', row: 11, col: 4 });
  const h = makeBattle({ players: [player], autoFinish: false, flags: { dpInit: 99, dpMax: 99 } });
  h.step(1);
  const u = h.unit(1), reconstruction = h.unit(2), ally = h.unit(3);
  assert.equal(reconstruction.base.maxHp, 4292);
  assert.equal(reconstruction.base.def, 181);
  assert.ok(reconstruction.kit && !reconstruction.kit.generic);
  ally.hp = ally.s.maxHp / 2;
  u.skill.gainSp(999);
  h.run(3);
  assert.ok(u.skill.activations >= 1);
  assert.deepEqual(h.b.errors, []);
});
