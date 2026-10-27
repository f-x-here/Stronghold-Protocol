#!/usr/bin/env node
// Maintainer tool: refresh reviewed source payloads after adapting to another upstream commit.
import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const home = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(home, '../..');
const args = process.argv.slice(2);
const file = path.join(home, 'payload.json');
const payload = JSON.parse(readFileSync(file, 'utf8'));
const value = (key, fallback) => args.includes(key) ? args[args.indexOf(key) + 1] : fallback;
const base = value('--base', payload.base);
const ref = spawnSync('git', ['rev-parse', '--verify', `${base}^{commit}`], { cwd: root, encoding: 'utf8' });
if (ref.status !== 0) throw new Error(`Unknown base commit: ${base}`);
const sha = (s) => s == null ? null : createHash('sha256').update(s).digest('hex');
const paths = [...new Set([...payload.files.map(f => f.path), ...args.filter((arg, i) => args[i - 1] === '--add')])].sort();
const files = paths.map((rel) => {
  if (!/^(?:server\/|shared\/|public\/(?:js|css|i18n)\/|test\/|docs\/|tools\/|scripts\/|package\.json$|README\.md$|eslint\.config\.js$|启动20人无尽版\.bat$)/.test(rel)
    || rel.includes('..') || rel.includes('\\')) throw new Error(`Refusing non-source path: ${rel}`);
  const previous = spawnSync('git', ['show', `${ref.stdout.trim()}:${rel}`], { cwd: root, encoding: 'utf8', maxBuffer: 16 * 1024 * 1024 });
  const before = previous.status === 0 ? previous.stdout.replace(/\r\n/g, '\n') : null;
  const after = readFileSync(path.join(root, rel), 'utf8').replace(/\r\n/g, '\n');
  return { path: rel, before, after, beforeHash: sha(before), afterHash: sha(after) };
});
const app = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')).version;
writeFileSync(file, JSON.stringify({ ...payload, base: ref.stdout.trim(), app, version: value('--version', payload.version), files }, null, 2) + '\n');
console.log(`Refreshed ${files.length} reviewed files against ${ref.stdout.trim()} (${app}). Run installer regression tests before packing.`);
