#!/usr/bin/env node
// Source extension installer. Preflight every file before writing any; never execute downloaded code.
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync, renameSync, unlinkSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const home = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const command = args[0] || 'status';
const rootAt = args.indexOf('--root');
const root = path.resolve(rootAt < 0 ? path.join(home, '../..') : args[rootAt + 1]);
const payload = JSON.parse(readFileSync(path.join(home, 'payload.json'), 'utf8'));
const hash = (text) => text == null ? null : createHash('sha256').update(text).digest('hex');
const temp = mkdtempSync(path.join(tmpdir(), 'sp-20p-'));
const changes = [];
const conflicts = [];
let installed = 0;
let vanilla = 0;

function resolveFile(rel) {
  if (typeof rel !== 'string' || rel.includes('\\') || rel.split('/').some((part) => !part || part === '..' || part === '.')) throw new Error(`Unsafe path: ${rel}`);
  const full = path.resolve(root, rel);
  if (!full.startsWith(root + path.sep)) throw new Error(`Outside checkout: ${rel}`);
  return full;
}

try {
  if (!['status', 'check', 'install', 'uninstall'].includes(command)) throw new Error('Usage: node manage.mjs status|check|install|uninstall [--root <checkout>]');
  if (!existsSync(path.join(root, 'package.json')) || !existsSync(path.join(root, '.git'))) throw new Error('Target must be a Stronghold Protocol Git checkout.');
  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'));
  if (pkg.name !== 'stronghold-protocol-alliance') throw new Error('Wrong project.');
  for (const entry of payload.files) {
    for (const side of ['before', 'after']) if (hash(entry[side]) !== entry[side + 'Hash']) throw new Error(`Corrupt payload: ${entry.path} ${side}`);
    const full = resolveFile(entry.path);
    const current = existsSync(full) ? readFileSync(full, 'utf8').replace(/\r\n/g, '\n') : null;
    if (current === entry.after) installed++;
    if (current === entry.before) vanilla++;
    if (command === 'status') continue;
    const from = command === 'uninstall' ? entry.after : entry.before;
    const to = command === 'uninstall' ? entry.before : entry.after;
    if (current === to) continue;
    let result = to;
    if (current !== from) {
      if (current == null || from == null || to == null) { conflicts.push(entry.path); continue; }
      const files = ['current', 'base', 'extension'].map((name) => path.join(temp, name));
      [current, from, to].forEach((text, i) => writeFileSync(files[i], text));
      const merge = spawnSync('git', ['merge-file', '-p', ...files], { encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
      if (merge.status !== 0) { conflicts.push(entry.path); continue; }
      result = merge.stdout;
    }
    changes.push({ full, text: result, previous: current, path: entry.path });
  }
  if (conflicts.length) {
    console.error('No files changed. Resolve these upstream/local conflicts first:\n' + conflicts.join('\n'));
    process.exitCode = 1;
  } else if (command === 'status') {
    console.log(JSON.stringify({ extension: payload.id, version: payload.version, testedApp: payload.app, currentApp: pkg.version,
      files: payload.files.length, installed, vanilla, state: installed === payload.files.length ? 'installed' : vanilla === payload.files.length ? 'vanilla' : 'modified; run check' }, null, 2));
  } else if (command === 'check') {
    console.log(`Compatible merge: ${changes.length} files would change; no files written. Tested base ${payload.app}, current ${pkg.version}. Run regression tests after installing on another version.`);
  } else {
    // Preserve exact pre-operation bytes for rollback; version-control remains the long-term rollback point.
    const backup = path.join(root, '.cache', '20p-endless', `${Date.now()}-${command}.json`);
    mkdirSync(path.dirname(backup), { recursive: true });
    writeFileSync(backup, JSON.stringify(changes.map(({ path, previous }) => ({ path, previous })), null, 2));
    for (const item of changes) {
      if (item.text == null) { if (existsSync(item.full)) unlinkSync(item.full); continue; }
      mkdirSync(path.dirname(item.full), { recursive: true });
      const next = item.full + '.20p-next';
      writeFileSync(next, item.text);
      renameSync(next, item.full);
    }
    console.log(`${command}: ${changes.length} files changed. Backup: ${backup}. Restart the server and reload clients.`);
  }
} finally {
  rmSync(temp, { recursive: true, force: true });
}
