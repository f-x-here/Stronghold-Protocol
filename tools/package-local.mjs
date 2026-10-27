#!/usr/bin/env node
// Local release batches: one Shanghai timestamp pairs the application and importable art.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { plan, assetPackPlan, build, buildAssetPack, buildUpdate, readBases, parseArgs,
  formatSummary, formatAssetSummary, packageOutIsUnsafe, isDevVersion } from './package.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const defaultReleaseDir = (root = ROOT) => path.resolve(root, '../release');

export function releaseInfo(version, { now = new Date(), variant = 'full', commit = null, manifests = {} } = {}) {
  if (!/^\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/.test(version)) throw new Error('Invalid application version');
  if (!['full', 'lite', 'update', 'assets'].includes(variant)) throw new Error('Invalid release variant');
  const fields = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Shanghai',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(now).map(p => [p.type, p.value]));
  const id = `${fields.year}${fields.month}${fields.day}-${fields.hour}${fields.minute}${fields.second}-${String(now.getUTCMilliseconds()).padStart(3, '0')}`;
  const prefix = `Stronghold-Protocol-v${version}-20P-${id}`;
  return { id, builtAt: now.toISOString(), timeZone: 'Asia/Shanghai',
    builtAtLocal: `${fields.year}-${fields.month}-${fields.day} ${fields.hour}:${fields.minute}:${fields.second}.${String(now.getUTCMilliseconds()).padStart(3, '0')} +08:00`,
    appVersion: version, variant, commit, manifests,
    programFile: variant === 'assets' ? null : `${prefix}-${variant}.zip`, assetsFile: `${prefix}-assets.zip` };
}

async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of fs.createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}

export async function run(argv = process.argv.slice(2)) {
  try {
    let options;
    try { options = parseArgs(argv); } catch (error) { console.error(`package: ${error.message}`); return 2; }
    if (options.help) {
      console.log('npm run package | package:lite | package:assets [-- --dry-run|--out <release directory>|--allow-dirty]\nDefault: paired application + assets, timestamped in ../release/<Shanghai timestamp>/. --update --from <base> is also supported.');
      return 0;
    }
    const root = options.root;
    const out = options.out || defaultReleaseDir(root);
    if (packageOutIsUnsafe(out, root)) throw new Error(`refusing to write into the repository or a parent of it: ${out}`);
    const app = options.assets ? null : plan(root, { lite: options.lite, allowDirty: options.allowDirty });
    const art = assetPackPlan(root, { allowDirty: options.allowDirty });
    if (app) process.stdout.write(formatSummary(app));
    process.stdout.write(formatAssetSummary(art));
    if ((app?.problems.length || 0) + art.problems.length) throw new Error('Release preflight failed; no archives written.');
    if (isDevVersion(art.version) && !options.allowDev) throw new Error('development version requires --allow-dev.');
    const manifests = {};
    for (const rel of ['data/assets.json', 'data/local-assets.json', 'data/local-fx.json']) {
      if (fs.existsSync(path.join(root, rel))) manifests[rel] = await sha256(path.join(root, rel));
    }
    const git = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' });
    const info = releaseInfo(art.version, { variant: options.assets ? 'assets' : options.update ? 'update' : options.lite ? 'lite' : 'full',
      commit: git.status === 0 ? git.stdout.trim() : null, manifests });
    const dest = path.join(path.resolve(out), info.id);
    console.log(`Build time: ${info.builtAtLocal}\nRelease batch: ${dest}\nApplication: ${info.programFile || '(assets only)'}\nMatching assets: ${info.assetsFile}`);
    if (options.dryRun) {
      if (options.list) for (const rel of app?.files || [...art.files, 'README.txt']) console.log(`file ${rel}`);
      return 0;
    }
    // A batch is never overwritten, even with --force. Existing versions remain independently identifiable.
    fs.mkdirSync(path.resolve(out), { recursive: true });
    fs.mkdirSync(dest, { recursive: false });
    const metadata = path.join(dest, 'BUILD-INFO.json');
    fs.writeFileSync(metadata, JSON.stringify({ ...info, status: 'building', artifacts: [] }, null, 2) + '\n');
    const artifacts = [];
    try {
      if (app) {
        app.buildInfo = info;
        const settings = { out: dest, install: options.install, keepStage: options.keepStage };
        const result = options.update ? buildUpdate(root, app, readBases(options.from, app.version), settings) : build(root, app, settings);
        artifacts.push({ file: path.basename(result.zipPath), bytes: result.zipBytes, sha256: await sha256(result.zipPath) });
      }
      art.buildInfo = info;
      art.name = info.assetsFile.slice(0, -4);
      const assets = buildAssetPack(root, art, { out: dest, keepStage: options.keepStage });
      artifacts.push({ file: path.basename(assets.zipPath), bytes: assets.zipBytes, sha256: await sha256(assets.zipPath) });
      fs.writeFileSync(metadata, JSON.stringify({ ...info, status: 'complete', artifacts }, null, 2) + '\n');
      fs.writeFileSync(path.join(dest, 'SHA256SUMS.txt'), artifacts.map(a => `${a.sha256}  ${a.file}`).join('\n') + '\n');
      console.log(`Complete: ${dest}`);
      if (options.assets) console.log('not a release asset: offer it for download elsewhere (docs/DEPLOY.md §7)');
      return 0;
    } catch (error) {
      fs.writeFileSync(metadata, JSON.stringify({ ...info, status: 'failed', artifacts, error: error.message }, null, 2) + '\n');
      throw error;
    }
  } catch (error) {
    console.error(`package: ${error.message}`);
    return 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await run();
