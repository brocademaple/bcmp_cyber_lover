import fs from 'node:fs';
import crypto from 'node:crypto';
import sharp from 'sharp';

const manifest = JSON.parse(fs.readFileSync('docs/luya/ip-v1/manifest.json', 'utf8'));
const sha256 = file => crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
if (manifest.assets.length !== 17) throw new Error('Expected 17 IP assets: 2 approved boards, 6 turnarounds, 3 scenes, 6 story pages');
const registry = fs.readFileSync('src/config/luyaStoryLibrary.ts', 'utf8');
for (const item of manifest.assets) {
  if (sha256(item.path) !== item.sha256) throw new Error(`Unrecorded asset change: ${item.path}`);
  const metadata = await sharp(item.path).metadata();
  if (metadata.width !== item.width || metadata.height !== item.height) throw new Error(`Size mismatch: ${item.path}`);
  if (!registry.includes(`require('../../${item.path}')`)) throw new Error(`Unregistered asset: ${item.path}`);
}
for (const [file, hash] of Object.entries(manifest.preservedOriginals)) {
  if (sha256(file) !== hash) throw new Error(`Original asset changed: ${file}`);
}
for (const [file, hash] of Object.entries(manifest.preservedDataSources)) {
  if (sha256(file) !== hash) throw new Error(`Data or persona source changed: ${file}`);
}
console.log(`PASS ${manifest.assets.length} IP assets decoded, hashed and registered`);
console.log(`PASS ${Object.keys(manifest.preservedOriginals).length} original asset hashes unchanged`);
console.log(`PASS ${Object.keys(manifest.preservedDataSources).length} persona, chat and memory source hashes unchanged`);
