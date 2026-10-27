// Rebuild only the local additions from the installed generated official records (offline).
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync, statSync } from 'node:fs';
import { addCivilizationData } from './civilization-data.mjs';
import { contentHash } from './assets/manifest.mjs';
const names = ['chess', 'bands', 'bonds', 'effects', 'backups'];
const data = Object.fromEntries(await Promise.all(names.map(async name => [name,
  JSON.parse(await readFile(new URL(`../data/${name}.json`, import.meta.url), 'utf8'))])));
addCivilizationData(data);
for (const name of names.filter(n => n !== 'backups')) {
  await writeFile(new URL(`../data/${name}.json`, import.meta.url), JSON.stringify(data[name]));
}
// Preserve the installed art inventory and add the user-supplied local badge without downloading anything.
const manifestUrl = new URL('../data/assets.json', import.meta.url);
const badgeUrl = new URL('../public/assets/bond/survivalShip.png', import.meta.url);
if (existsSync(manifestUrl) && existsSync(badgeUrl)) {
  const manifest = JSON.parse(await readFile(manifestUrl, 'utf8'));
  const badge = '/assets/bond/survivalShip.png';
  const added = manifest.bonds.survivalShip !== badge;
  manifest.bonds.survivalShip = badge;
  manifest.bands.band_kalts_survival = manifest.chars.char_003_kalts.avatar;
  manifest.stats.bonds = Object.keys(manifest.bonds).length;
  manifest.stats.bands = Object.keys(manifest.bands).length;
  if (added) { manifest.stats.files++; manifest.stats.bytes += statSync(badgeUrl).size; }
  const { version, hash, generator, stats, ...body } = manifest;
  manifest.hash = contentHash(body);
  await writeFile(manifestUrl, JSON.stringify(manifest));
}
