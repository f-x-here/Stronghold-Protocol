import { test } from 'node:test';
import assert from 'node:assert/strict';
import { RefLru, spineCachePolicy } from '../../public/js/assets.js';
import { boardFetchOptions } from '../../public/js/render/board3d/load.js';

test('desktop cache tiers retain recent models while low-memory devices preserve upstream limits', () => {
  const desktop = spineCachePolicy({ deviceMemory: 8, hardwareConcurrency: 8 });
  assert.equal(desktop.max, 240);
  assert.equal(desktop.idleBytes, 192 * 1024 * 1024);
  assert.equal(desktop.quietBytes, 64 * 1024 * 1024);
  assert.equal(spineCachePolicy({ deviceMemory: 4 }).max, 96);
  const low = spineCachePolicy({ deviceMemory: 2, hardwareConcurrency: 8 });
  assert.equal(low.max, 60);
  assert.equal(low.idleGrace, 15000);
  assert.equal(low.quietBytes, 0);
  assert.equal(spineCachePolicy(undefined).max >= 60, true);
});

test('a reconnect gap and repeated teammate switches reuse 80 models; retention remains bounded', async () => {
  let now = 0, loads = 0;
  const timers = { set: () => null, clear() {} };
  const policy = spineCachePolicy({ deviceMemory: 8, hardwareConcurrency: 8 });
  const cache = new RefLru({ load: async key => ({ key, serial: ++loads }), max: policy.max,
    weigh: () => 1024 * 1024, maxIdleWeight: policy.idleBytes, quietWeight: policy.quietBytes,
    idleGrace: policy.idleGrace, quietDelay: policy.quietDelay, now: () => now, timers });
  const first = [];
  for (let i = 0; i < 80; i++) first.push(await cache.acquire(String(i)));
  for (let i = 0; i < 80; i++) cache.release(String(i));
  now = 20000;
  cache._evict();
  for (let i = 0; i < 80; i++) {
    assert.equal(await cache.acquire(String(i)), first[i]);
    cache.release(String(i));
  }
  assert.equal(loads, 80, 'no parse/load repeated after reconnect or returning to an observed team');
  now = 150000;
  cache._evict();
  assert.ok(cache.stats().idleWeight <= policy.quietBytes);
  cache.clear();
});

test('hashed board files use HTTP cache; mutable manifests still revalidate', () => {
  assert.equal(boardFetchOptions('/assets/~0123456789abcdef/local/scene/a.bin').cache, 'default');
  assert.equal(boardFetchOptions('https://example.com/assets/~0123456789abcdef/a.obj').cache, 'default');
  assert.equal(boardFetchOptions('/data/local-assets.json').cache, 'no-cache');
  assert.equal(boardFetchOptions('/assets/local/scene/a.bin').cache, 'no-cache');
});
