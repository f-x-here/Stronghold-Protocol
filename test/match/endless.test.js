import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EndlessGameData } from '../../server/match/endless.js';
import { GameData } from '../../server/match/gamedata.js';
import { setupMatchWaves, buildNormalWave, buildBossWave } from '../../server/match/waves.js';
import { bossPoolHp } from '../../server/match/finalAssault.js';
import { attachAudit } from '../../server/match/audit.js';
import { createRng } from '../../server/sim/rng.js';
import { DATA, makeMatch, give, legalTileFor } from './harness.js';

test('all official modes retain campaign waves and generate deterministic, nonempty endless waves', () => {
  for (const id of Object.keys(DATA.config.modes)) {
    const gd = new EndlessGameData(DATA, id);
    const ordinary = new GameData(DATA, id);
    const setup = setupMatchWaves(gd, createRng(42));
    assert.ok(gd.endlessTemplates.length);
    for (let r = 1; r < gd.bossRound; r++) {
      assert.deepEqual(buildNormalWave(gd, createRng(r), setup, r), buildNormalWave(ordinary, createRng(r), setup, r));
    }
    gd.endlessStartRound = gd.bossRound + 1;
    for (let r = gd.endlessStartRound; r < gd.endlessStartRound + 30; r++) {
      const build = () => gd.isEndlessBossRound(r) ? buildBossWave(gd, createRng(r), setup, r, { bossId: setup.bossId, solo: gd.isSolo }) : buildNormalWave(gd, createRng(r), setup, r);
      const wave = build();
      assert.ok(wave.spawns.length > 0, `${id} R${r}`);
      assert.deepEqual(wave, build());
      const n = gd.endlessStep(r);
      assert.equal(gd.isEndlessBossRound(r), n % 15 === 0);
      if (n % 15 === 0) assert.ok(wave.spawns.some(s => s.tag === 'boss'));
      else assert.equal(wave.templateId, ordinary.roundCfg(gd.sourceRound(r)).template);
      const base = ordinary.enemyScale(n % 15 === 0 ? gd.bossRound : gd.endlessTemplates.at(-1));
      assert.equal(gd.enemyScale(r).hpMul, base.hpMul * (1 + 0.15 * n));
      assert.equal(gd.enemyScale(r).atkMul, base.atkMul * (1 + 0.08 * n));
      assert.equal(gd.income(r), ordinary.income(gd.endlessTemplates.at(-1)));
    }
  }
});

for (const clientCombat of [false, true]) test(`20-player recurring bosses grow every 15 endless rounds and resume without resetting growth (client=${clientCombat})`, () => {
  const h = makeMatch({ endless: true, humans: 20, difficulty: 'FUNNY', fake: true, clientCombat,
    script: b => b.kind === 'boss' ? { bossDps: 1e9 } : {} }).start();
  try {
    const m = h.m;
    const audit = attachAudit(m);
    assert.ok(h.drive(() => m.phase === 'PREP' && m.round === 29));
    assert.equal(m.gd.endlessStartRound, 15);
    assert.equal(m.gd.bossRoundFor(m.round), 29);
    assert.equal(m.publicView().bossRound, 29);
    assert.equal(m.bossWaves.length, 10);
    assert.ok(m.order.every(p => p.deployCap === m.gd.deployCap + 1));
    assert.equal(m.wave, null);
    const bossSpawn = m.bossWaves[0].wave.spawns.find(s => s.tag === 'boss');
    assert.equal(bossSpawn.mods.atkMul, new GameData(DATA, m.modeId).enemyScale(14).atkMul * 2.2);
    assert.ok(h.drive(() => m.phase === 'FINAL_ASSAULT' && m.round === 29));
    assert.equal(m.bossPool.maxHp, Math.round(bossPoolHp(m.gd, m.bossId, 20) * 3.25));
    assert.equal(m.fields.length, 10);
    const shares = m.order.map(p => p.lp);
    assert.ok(h.drive(() => m.phase === 'PREP' && m.round === 30));
    assert.equal(m.gd.endlessStartRound, 15);
    assert.equal(m.teamLp, null);
    assert.equal(m.hiddenReached, false);
    assert.deepEqual(m.order.map(p => p.lp), shares);
    assert.ok(m.order.every(p => p.deployCap === m.gd.deployCap + 2));
    assert.ok(m.wave.spawns.length);
    h.invariants();
    assert.ok(h.drive(() => m.phase === 'FINAL_ASSAULT' && m.round === 44));
    assert.equal(m.bossPool.maxHp, Math.round(bossPoolHp(m.gd, m.bossId, 20) * 5.5));
    assert.ok(h.drive(() => m.phase === 'PREP' && m.round === 45));
    assert.equal(m.gd.endlessStep(45), 31);
    assert.equal(m.gd.bossRoundFor(45), 59);
    assert.equal(m.publicView().bossRound, 59);
    assert.ok(m.order.every(p => p.deployCap === m.gd.deployCap + 3));
    assert.deepEqual(audit.violations, [], audit.violations.join('\n'));
    h.invariants();
    assert.equal(h.logs.error.length, 0, h.logs.error.join('\n'));
  } finally { h.m.dispose(); }
});

for (const clientCombat of [false, true]) test(`campaign clear continues into 20-player endless waves; defeat records actual rounds (client=${clientCombat})`, () => {
  const h = makeMatch({ endless: true, humans: 20, difficulty: 'FUNNY', fake: true, clientCombat,
    script: b => b.kind === 'boss' ? { bossDps: 1e9 } : b.round >= 19 ? { leaks: Object.fromEntries(b.players.map(id => [id, 2])) } : {} }).start();
  try {
    const m = h.m;
    assert.ok(h.drive(() => m.phase === 'PREP' && m.round === 15));
    assert.equal(m.ended, false);
    assert.equal(m.teamLp, null);
    assert.equal(m.gd.hiddenRound, null);
    assert.ok(m.wave.spawns.length);
    assert.equal(m.bossWaves, null);
    const lp = m.order.map(p => p.lp);
    assert.ok(lp.every(n => n > 0));
    assert.ok(h.drive(() => m.phase === 'PREP' && m.round === 19));
    h.invariants();
    for (const p of m.order) p.lp = 1;
    assert.ok(h.drive(() => !!h.ended));
    const result = h.lastTo('p_0', 'm.result');
    assert.equal(result.endless, true);
    assert.equal(result.victory, false);
    assert.equal(result.roundsPassed, 18);
    assert.ok(result.players.every(p => p.roundsPassed === 18));
    assert.equal(h.logs.error.length, 0, h.logs.error.join('\n'));
  } finally { h.m.dispose(); }
});

test('eligible hidden core is played once; clearing it returns to the normal field with LP shares preserved', () => {
  const h = makeMatch({ endless: true, humans: 4, difficulty: 'HARD', fake: true,
    script: b => ['boss', 'hidden'].includes(b.kind) ? { bossDps: 1e9 } : {} }).start();
  try {
    const m = h.m;
    assert.ok(h.drive(() => m.phase === 'PREP' && m.round === 14));
    for (const p of m.order) { p.bondCountBonus.yanShip = 3; p.layers.yanShip = 400; p.recompute(); }
    assert.ok(h.drive(() => m.phase === 'PREP' && m.round === 15));
    assert.ok(m.bossWaves);
    assert.ok(m.order.every(p => p.endlessDeployCapBonus === 1));
    assert.ok(h.drive(() => m.phase === 'PREP' && m.round === 16));
    assert.equal(m.endlessHiddenCleared, true);
    assert.ok(m.order.every(p => p.endlessDeployCapBonus === 2));
    assert.equal(m.teamLp, null);
    assert.equal(m.bossWaves, null);
    assert.ok(m.wave.spawns.length);
    h.invariants();
    assert.ok(h.drive(() => m.phase === 'FINAL_ASSAULT' && m.round === 30));
    assert.equal(m.gd.endlessStep(30), 15);
    assert.ok(h.drive(() => m.phase === 'PREP' && m.round === 31));
    assert.equal(m.endlessHiddenCleared, true);
    assert.equal(m.gd.endlessStartRound, 16);
    assert.ok(m.order.every(p => p.endlessDeployCapBonus === 3));
    assert.equal(m.gd.hiddenRound, 15);
    assert.equal(m.gd.isHiddenRound(15), true);
    assert.ok(m.settleExit('p_0').ok);
    assert.equal(h.lastTo('p_0', 'm.result').hiddenReached, true);
    assert.equal(h.lastTo('p_0', 'm.result').hiddenCleared, true);
  } finally { h.m.dispose(); }
});

test('leaving a recurring boss keeps its growth multiplier while rescaling the alive-player pool', () => {
  const h = makeMatch({ endless: true, humans: 4, difficulty: 'FUNNY', fake: true,
    script: b => b.kind === 'boss' ? { bossDps: 1e9 } : {} }).start();
  try {
    const m = h.m;
    assert.ok(h.drive(() => m.phase === 'FINAL_ASSAULT' && m.round === 29));
    const max = m.bossPool.maxHp;
    const ratio = m.bossPool.hp / max;
    m.onLeave('p_3');
    assert.equal(m.bossPool.maxHp, Math.round(bossPoolHp(m.gd, m.bossId, 3) * 3.25));
    assert.ok(Math.abs(m.bossPool.hp / m.bossPool.maxHp - ratio) < 1e-9);
    assert.ok(h.drive(() => m.phase === 'PREP' && m.round === 30));
    assert.equal(h.ps('p_3').endlessDeployCapBonus, 1, 'departed participant keeps only its earlier reward');
    assert.ok(m.alivePlayers().every(p => p.endlessDeployCapBonus === 2));
  } finally { h.m.dispose(); }
});

for (const clientCombat of [false, true]) test(`a recurring boss defeat ends the match at the actual passed round (client=${clientCombat})`, () => {
  const h = makeMatch({ endless: true, humans: 2, difficulty: 'FUNNY', fake: true, clientCombat,
    script: b => b.kind === 'boss' ? b.round >= 29 ? { lpLossEvents: [{ at: 1, amount: 99999 }] } : { bossDps: 1e9 } : {} }).start();
  try {
    assert.ok(h.drive(() => !!h.ended));
    assert.equal(h.m.round, 29);
    const result = h.lastTo('p_0', 'm.result');
    assert.equal(result.victory, false);
    assert.equal(result.roundsPassed, 28);
    assert.ok(h.m.order.every(p => p.endlessDeployCapBonus === 1), 'defeat gives no new slot');
    assert.equal(result.hiddenReached, false);
  } finally { h.m.dispose(); }
});

test('solo Standard continues after its shorter nine-round campaign', () => {
  const h = makeMatch({ endless: true, mode: 'solo', difficulty: 'FUNNY', fake: true,
    script: b => b.kind === 'boss' ? { bossDps: 1e9 } : {} }).start();
  try {
    assert.ok(h.drive(() => h.m.phase === 'PREP' && h.m.round === 10));
    assert.equal(h.m.gd.endlessStartRound, 10);
    assert.ok(h.m.wave.spawns.length);
    h.invariants();
  } finally { h.m.dispose(); }
});

test('ordinary rooms still finish with a victory after the final assault', () => {
  const h = makeMatch({ humans: 4, difficulty: 'FUNNY', fake: true,
    script: b => b.kind === 'boss' ? { bossDps: 1e9 } : {} }).start();
  try {
    assert.ok(h.drive(() => !!h.ended));
    const result = h.lastTo('p_0', 'm.result');
    assert.equal(result.endless, false);
    assert.equal(result.victory, true);
    assert.equal(result.roundsPassed, 14);
    assert.equal(h.m.round, 14);
    assert.ok(h.m.order.every(p => p.endlessDeployCapBonus === 0), 'ordinary boss wins give no endless reward');
  } finally { h.m.dispose(); }
});

test('a hidden-core defeat ends an endless match rather than granting a campaign victory', () => {
  const h = makeMatch({ endless: true, humans: 4, difficulty: 'HARD', fake: true,
    script: b => b.kind === 'boss' ? { bossDps: 1e9 } : b.kind === 'hidden' ? { lpLossEvents: [{ at: 1, amount: 99999 }] } : {} }).start();
  try {
    assert.ok(h.drive(() => h.m.phase === 'PREP' && h.m.round === 14));
    for (const p of h.m.order) { p.bondCountBonus.yanShip = 3; p.layers.yanShip = 400; p.recompute(); }
    assert.ok(h.drive(() => !!h.ended));
    const result = h.lastTo('p_0', 'm.result');
    assert.equal(result.victory, false);
    assert.equal(result.roundsPassed, 14);
    assert.equal(h.m.round, 15);
    assert.equal(h.m.gd.endlessStartRound, 0);
  } finally { h.m.dispose(); }
});

test('endless enables every bond and bans no operators, including after an opening reroll', () => {
  for (const modeId of Object.keys(DATA.config.modes)) {
    const h = makeMatch({ endless: true, modeId, humans: 1, fake: true }).start();
    try {
      const m = h.m;
      for (let reroll = 0; reroll < 2; reroll++) {
        assert.deepEqual(m.disabledBonds, []);
        assert.deepEqual(m.staticInactiveBonds, []);
        assert.deepEqual(m.bannedChess, []);
        assert.equal(m.gd.modeInactiveBonds.size, 0);
        assert.deepEqual(m.gd.bans(m.gd.difficulty), { core: 0, addon: 0 });
        assert.ok(m.completeSetupReroll().ok);
      }
      if (modeId === 'mode_single_funny') {
        const ps = m.order[0];
        ps.bondCountBonus.arcaneShip = 10;
        ps.recompute();
        assert.equal(ps.bonds.arcaneShip.active, true);
        assert.ok(new GameData(DATA, modeId).modeInactiveBonds.has('arcaneShip'), 'ordinary Standard is unchanged');
      }
    } finally { h.m.dispose(); }
  }
});

test('exit snapshot preserves lineup and stats before elimination, without ending teammates or duplicating a final result', () => {
  const h = makeMatch({ endless: true, humans: 2, difficulty: 'FUNNY', fake: true,
    script: b => b.kind === 'boss' ? { bossDps: 1e9 } : {} }).start();
  try {
    const m = h.m;
    assert.ok(h.drive(() => m.phase === 'PREP' && m.round === 17));
    const ps = h.ps('p_0');
    const id = m.gd.visibleChess[0];
    const at = legalTileFor(m, ps, id);
    give(m, ps, id, 'board', at);
    ps.stats.kills = 123;
    assert.ok(m.settleExit(ps.playerId).ok);
    const result = h.lastTo(ps.playerId, 'm.result');
    assert.equal(result.reason, 'quit');
    assert.equal(result.roundsPassed, 16);
    assert.ok(result.players.find(p => p.playerId === ps.playerId).lineup.some(p => p.id === id));
    assert.equal(result.players.find(p => p.playerId === ps.playerId).stats.kills, 123);
    assert.equal(h.lastTo('p_1', 'm.result'), null);
    m.onLeave(ps.playerId);
    assert.equal(ps.board.size, 0);
    assert.equal(m.ended, false);
    assert.ok(h.drive(() => m.phase === 'PREP' && m.round === 18));
    assert.equal(h.allTo(ps.playerId, 'm.result').length, 1);
  } finally { h.m.dispose(); }
});

test('exiting after settlement counts the just-cleared round; during a boss it counts previous rounds', () => {
  const h = makeMatch({ endless: true, humans: 2, difficulty: 'FUNNY', fake: true,
    script: b => b.kind === 'boss' ? { bossDps: 1e9 } : {} }).start();
  try {
    assert.ok(h.drive(() => h.m.phase === 'SETTLE' && h.m.round === 16));
    h.m.settleExit('p_0');
    assert.equal(h.lastTo('p_0', 'm.result').roundsPassed, 16);
    assert.ok(h.drive(() => h.m.phase === 'FINAL_ASSAULT' && h.m.round === 29));
    h.m.settleExit('p_0');
    assert.equal(h.lastTo('p_0', 'm.result').roundsPassed, 28);
  } finally { h.m.dispose(); }
});

test('boss slots stack above equipment minimums, update the private view and unlock actual placement exactly once', () => {
  const h = makeMatch({ endless: true, mode: 'solo', difficulty: 'FUNNY', fake: true,
    script: b => b.kind === 'boss' ? { bossDps: 1e9 } : {} }).start();
  try {
    const m = h.m;
    assert.ok(h.drive(() => m.phase === 'PREP' && m.round === 9));
    const ps = h.ps('p_0');
    ps.deployCapMin = 12;
    assert.equal(ps.deployCap, 12);
    assert.ok(h.drive(() => m.phase === 'PREP' && m.round === 10));
    assert.equal(ps.endlessDeployCapBonus, 1);
    assert.equal(ps.deployCap, 13);
    m.flush(true);
    assert.equal(h.lastTo(ps.playerId, 'm.private').deployCap, 13);
    const toast = h.allTo(ps.playerId, 'm.toast').find(msg => msg.msgid === '击败领袖，部署上限 +1（当前 {n}）');
    assert.equal(toast?.params.n, 13);
    m.round = 9;
    m._rewardEndlessBossDeploy();
    m.round = 10;
    assert.equal(ps.endlessDeployCapBonus, 1, 'duplicate settlement must not grant another slot');
    const deployedIds = new Set();
    for (const id of m.gd.visibleChess) {
      const at = legalTileFor(m, ps, id);
      if (!at) continue;
      give(m, ps, id, 'board', at);
      deployedIds.add(id);
      if (ps.deployCount === 12) break;
    }
    assert.equal(ps.deployCount, 12);
    const candidate = m.gd.visibleChess.find(id => !deployedIds.has(id) && legalTileFor(m, ps, id));
    assert.ok(candidate);
    const at = legalTileFor(m, ps, candidate);
    const piece = give(m, ps, candidate);
    ps.endlessDeployCapBonus = 0;
    assert.equal(ps.move(piece.uid, { area: 'board', row: at[0], col: at[1] }).error, 'BOARD_FULL');
    ps.endlessDeployCapBonus = 1;
    assert.ok(ps.move(piece.uid, { area: 'board', row: at[0], col: at[1] }).ok);
    assert.equal(ps.deployCount, 13);
    h.invariants();
  } finally { h.m.dispose(); }
});
