import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { releaseInfo, defaultReleaseDir } from '../tools/package-local.mjs';
import { build, assetPackReadme, scanFiles } from '../tools/package.mjs';

test('one Shanghai timestamp pairs archives across the UTC date boundary', () => {
  const info = releaseInfo('0.3.3', { now: new Date('2026-10-26T16:05:09.007Z') });
  assert.equal(info.id, '20261027-000509-007');
  assert.equal(info.builtAtLocal, '2026-10-27 00:05:09.007 +08:00');
  assert.equal(info.programFile, 'Stronghold-Protocol-v0.3.3-20P-20261027-000509-007-full.zip');
  assert.equal(info.assetsFile, 'Stronghold-Protocol-v0.3.3-20P-20261027-000509-007-assets.zip');
  assert.equal(defaultReleaseDir(path.join(os.tmpdir(), 'workspace', 'code')), path.join(os.tmpdir(), 'workspace', 'release'));
  assert.throws(() => releaseInfo('../wrong'), /version/);
});

test('both archive variants and the asset README identify the matching batch', () => {
  for (const variant of ['full', 'lite', 'update']) {
    const info = releaseInfo('0.3.3', { now: new Date('2026-10-27T00:00:00Z'), variant });
    assert.ok(info.programFile.endsWith(`-${variant}.zip`));
    const text = assetPackReadme({ version: '0.3.3', files: [], bytes: { art: 0 }, buildInfo: info });
    assert.ok(text.includes(info.builtAtLocal));
    assert.ok(text.includes(info.programFile));
  }
});

test('numeric account scanning retains names and home paths without flagging mesh decimals', (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-numeric-scan-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(dir, 'mesh.json'), '{"coordinate":0.3166902,"negative":-1.3166902}');
  fs.writeFileSync(path.join(dir, 'name.txt'), 'Account: 31669');
  fs.writeFileSync(path.join(dir, 'home.txt'), 'C:\\Users\\31669\\Desktop');
  const hits = scanFiles(dir, ['mesh.json', 'name.txt', 'home.txt'], { names: ['31669'], home: true });
  assert.deepEqual(hits, ['name.txt (account name)', 'home.txt (home-directory path)']);
});

test('an actual application archive contains build information tracked by MANIFEST', (t) => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-release-time-'));
  t.after(() => fs.rmSync(base, { recursive: true, force: true }));
  const root = path.join(base, 'code');
  fs.mkdirSync(path.join(root, 'server'), { recursive: true });
  fs.writeFileSync(path.join(root, 'server/index.js'), 'export const ok = true;\n');
  fs.writeFileSync(path.join(root, 'package.json'), JSON.stringify({ name: 'fixture', version: '0.3.3', scripts: { start: 'node server/index.js' } }));
  const info = releaseInfo('0.3.3', { now: new Date('2026-10-27T00:00:00Z') });
  const files = ['package.json', 'server/index.js'];
  const result = build(root, { version: '0.3.3', files, tracked: files, problems: [], buildInfo: info },
    { out: path.join(base, 'release'), install: false, keepStage: true, env: { SP_PACKAGE_SCAN_USER: '0' }, log() {} });
  assert.equal(path.basename(result.zipPath), info.programFile);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(result.stage, 'BUILD-INFO.json'), 'utf8')), info);
  assert.ok(fs.readFileSync(path.join(result.stage, 'MANIFEST.json'), 'utf8').includes('BUILD-INFO.json'));
});
