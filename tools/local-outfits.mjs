// Rebuild a native cosmetic plugin from this installation's existing optional art.
// No downloads, no changes to generated data/*.json, no game art in Git.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export function prepareOutfits(root = ROOT) {
  const catalog = JSON.parse(fs.readFileSync(path.join(root, 'tools/outfits/catalog.json'), 'utf8'));
  const base = JSON.parse(fs.readFileSync(path.join(root, 'data/assets.json'), 'utf8'));
  const folders = ['a', 'b'].map(suffix => path.join(root, `plugins/local-outfits-${suffix}`));
  const groups = [{}, {}];
  let folder = folders[0];
  let charIndex = 0;
  let count = 0, models = 0;
  const copy = (source, dest) => {
    if (!fs.existsSync(source)) return null;
    const target = path.join(folder, dest);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.copyFileSync(source, target);
    return dest;
  };
  for (const [charId, outfits] of Object.entries(catalog.skins)) {
    if (!base.chars?.[charId]) continue;
    folder = folders[charIndex % 2];
    const chars = groups[charIndex++ % 2];
    const skins = {};
    for (const skin of outfits) {
      const record = { name: skin.name, group: skin.group };
      for (const kind of ['avatar', 'portrait']) {
        const rel = `char/${kind}/skin/${skin.stem}.png`;
        const copied = copy(path.join(root, 'public/assets', rel), `art/${rel}`);
        if (copied) record[kind] = copied;
      }
      const spine = {};
      for (const view of ['front', 'back']) {
        const rel = `spine/op/${charId}/${skin.stem}/${view}`;
        const source = path.join(root, 'public/assets', rel);
        if (!fs.existsSync(path.join(source, `${skin.stem}.skel`)) || !fs.existsSync(path.join(source, `${skin.stem}.atlas`))) continue;
        for (const file of fs.readdirSync(source)) if (/\.(skel|atlas|png)$/i.test(file)) copy(path.join(source, file), `art/${rel}/${file}`);
        spine[view] = { skel: `art/${rel}/${skin.stem}.skel`, pma: false };
      }
      if (spine.front) { record.spine = spine; models++; }
      if (!record.avatar && !record.portrait && !record.spine) continue;
      skins[skin.skinId] = record;
      count++;
    }
    if (Object.keys(skins).length) chars[charId] = { skins };
  }
  if (!count) return { count, models, folders: [] };
  for (let i = 0; i < folders.length; i++) {
    folder = folders[i];
    const chars = groups[i];
    if (!Object.keys(chars).length) continue;
    fs.mkdirSync(folder, { recursive: true });
    const manifest = { $schema: '../../schemas/plugin.schema.json', manifest: 2, name: { zh: `本地官方时装 ${i + 1}/2`, en: `Local operator outfits ${i + 1}/2` },
      version: '1.0.0', app: '>=0.3.3 <0.4.0', api: 2, class: 'cosmetic', scope: ['personal'],
      permissions: ['assets.override'], assets: 'outfits.json' };
    fs.writeFileSync(path.join(folder, 'outfits.json'), JSON.stringify({ chars }, null, 2) + '\n');
    fs.writeFileSync(path.join(folder, 'plugin.json'), JSON.stringify(manifest, null, 2) + '\n');
    fs.writeFileSync(path.join(folder, 'README.md'), '# 本地官方时装\n\n从本机已有的官方时装素材生成，仅供非商业同人使用。素材版权归原权利人；不提交美术到 Git。\n\n设置 → 外观插件可启用/关闭；干员调配 → 皮肤选择外观。\n');
    const packed = spawnSync(process.execPath, [path.join(root, 'tools/plugin.mjs'), 'pack', path.basename(folder)], { cwd: root, encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
    if (packed.status !== 0) throw new Error(`Outfit plugin validation/packing failed:\n${packed.stdout}\n${packed.stderr}`);
  }
  return { count, models, folders };
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) console.log(JSON.stringify(prepareOutfits()));
