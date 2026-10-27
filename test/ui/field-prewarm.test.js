import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../../public/js/ui/fieldHost.js', import.meta.url), 'utf8')
  .replace(/^import .*;$/gm, '').replace(/^export /gm, '')
  .replaceAll("import('../assets.js')", 'loadAssets()')
  .replaceAll("import('../render/board3d/load.js')", 'loadBoard()');

function fixture({ search = '', saveData = false, webgl = true } = {}) {
  const calls = [];
  const assets = { seed() {}, seedLocal() {} };
  const loader = { webgl2Available: () => webgl, boardArtListed: async () => true,
    loadThree: async () => { calls.push('three'); return {}; },
    loadBoardPack: async store => { assert.equal(store, assets); calls.push('board'); return { cached: true }; },
    loadScenePack: async (_store, stage) => { calls.push(stage); return { stage }; } };
  const context = vm.createContext({ URLSearchParams, navigator: { connection: { saveData } }, location: { search },
    data: { getRaw: () => ({}) }, loadAssets: async () => ({ assets }), loadBoard: async () => loader });
  const warm = vm.runInContext(source + '\nwarmFieldResources;', context);
  return { warm, calls };
}

test('room warm-up loads installed board only; match warm-up includes the selected stage without a renderer', async () => {
  const f = fixture();
  assert.equal((await f.warm()).board.cached, true);
  assert.deepEqual(f.calls, ['three', 'board']);
  f.calls.length = 0;
  assert.equal((await f.warm('act2autochess_m01')).scene.stage, 'act2autochess_m01');
  assert.deepEqual(f.calls, ['three', 'board', 'act2autochess_m01']);
});

test('2D, simplified rendering, data saver and missing WebGL skip background art loading', async () => {
  for (const options of [{ search: '?board=2d' }, { search: '?render=fallback' }, { saveData: true }, { webgl: false }]) {
    const f = fixture(options);
    assert.equal(await f.warm('act2autochess_m01'), null);
    assert.deepEqual(f.calls, []);
  }
});
