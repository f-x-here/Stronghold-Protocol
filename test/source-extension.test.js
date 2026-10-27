import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const manager = path.join(root, 'extensions/20p-endless/manage.mjs');
const payload = JSON.parse(fs.readFileSync(path.join(root, 'extensions/20p-endless/payload.json'), 'utf8'));

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp-source-extension-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, '.git'));
  fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify({ name: 'stronghold-protocol-alliance', version: '0.3.3' }));
  for (const file of payload.files) if (file.before != null) {
    const full = path.join(dir, file.path);
    fs.mkdirSync(path.dirname(full), { recursive: true });
    fs.writeFileSync(full, file.before);
  }
  return { dir, run: (cmd) => spawnSync(process.execPath, [manager, cmd, '--root', dir], { encoding: 'utf8' }) };
}

test('source extension installs and uninstalls idempotently, retaining unrelated upstream edits', (t) => {
  const { dir, run } = fixture(t);
  const constants = path.join(dir, 'shared/constants.js');
  const extra = '\n// unrelated upstream addition retained by the source extension\n';
  fs.appendFileSync(constants, extra);
  for (const cmd of ['check', 'install', 'install']) {
    const result = run(cmd);
    assert.equal(result.status, 0, result.stderr);
  }
  assert.match(fs.readFileSync(constants, 'utf8'), /MAX_SEATS = 20/);
  assert.ok(fs.readFileSync(constants, 'utf8').endsWith(extra));
  for (const cmd of ['uninstall', 'uninstall']) {
    const result = run(cmd);
    assert.equal(result.status, 0, result.stderr);
  }
  for (const file of payload.files) {
    const full = path.join(dir, file.path);
    if (file.before == null) assert.equal(fs.existsSync(full), false, file.path);
    else assert.equal(fs.readFileSync(full, 'utf8'), file.before + (file.path === 'shared/constants.js' ? extra : ''), file.path);
  }
});

test('source extension refuses every write when one upstream file conflicts', (t) => {
  const { dir, run } = fixture(t);
  const constants = path.join(dir, 'shared/constants.js');
  fs.writeFileSync(constants, fs.readFileSync(constants, 'utf8').replace('export const MAX_SEATS = 4;', 'export const MAX_SEATS = 12;'));
  const before = payload.files.map((f) => [f.path, fs.existsSync(path.join(dir, f.path)) ? fs.readFileSync(path.join(dir, f.path), 'utf8') : null]);
  const result = run('install');
  assert.equal(result.status, 1);
  assert.match(result.stderr, /shared\/constants.js/);
  for (const [rel, text] of before) {
    const full = path.join(dir, rel);
    assert.equal(fs.existsSync(full) ? fs.readFileSync(full, 'utf8') : null, text, rel);
  }
});
