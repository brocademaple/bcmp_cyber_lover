const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..');
const registryPath = path.join(repoRoot, 'src/utils/characterAssets.ts');
const sourceRoot = path.join(repoRoot, 'src');
const manifest = JSON.parse(fs.readFileSync(path.join(__dirname, 'visual-asset-manifest.json'), 'utf8'));

function assetPath(...parts) {
  return parts.join('/');
}

function characterAssetPath(characterId, fileName) {
  return assetPath(manifest.characterAssetRoot, characterId, fileName);
}

function docsCharacterAssetPath(characterId, fileName) {
  return assetPath(manifest.docsCharacterAssetRoot, characterId, fileName);
}

function read(relativePath) {
  return fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
}

function walkSourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(dir, entry.name);
    if (entry.isDirectory()) return walkSourceFiles(absolute);
    if (!entry.isFile()) return [];
    return /\.(ts|tsx)$/.test(entry.name) ? [absolute] : [];
  });
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function main() {
  const registry = read('src/utils/characterAssets.ts');
  const chatStore = read('src/store/chatStore.ts');

  for (const [characterId, config] of Object.entries(manifest.characters)) {
    assert(registry.includes(`${characterId}: {`), `Missing registry entry for ${characterId}`);
    assert(
      chatStore.includes(`DEFAULT_CHARACTER_ASSETS.${characterId}.assetSet`),
      `DEFAULT_CHARACTERS.${characterId} must use the centralized asset registry`
    );

    for (const alias of config.aliases) {
      assert(registry.includes(`'${alias}'`), `Missing alias '${alias}' for ${characterId}`);
    }

    for (const fileName of config.files) {
      const relativeAsset = characterAssetPath(characterId, fileName);
      const absoluteAsset = path.join(repoRoot, relativeAsset);
      assert(fs.existsSync(absoluteAsset), `Missing asset file: ${relativeAsset}`);
      assert(
        registry.includes(relativeAsset.replace('assets/', '../../assets/')),
        `Registry does not reference ${relativeAsset}`
      );
      const docsMirrorAsset = docsCharacterAssetPath(characterId, fileName);
      assert(fs.existsSync(path.join(repoRoot, docsMirrorAsset)), `Missing docs asset mirror: ${docsMirrorAsset}`);
    }
  }

  const scatteredRequires = walkSourceFiles(sourceRoot)
    .filter((file) => file !== registryPath)
    .flatMap((file) => {
      const body = fs.readFileSync(file, 'utf8');
      const matches = body.match(/require\(['"]\.\.\/\.\.\/assets\/characters\//g) ?? [];
      return matches.map(() => path.relative(repoRoot, file));
    });

  assert(
    scatteredRequires.length === 0,
    `Character asset require() calls must stay centralized in src/utils/characterAssets.ts. Found: ${[...new Set(scatteredRequires)].join(', ')}`
  );

  console.log('Verified centralized character asset registry.');
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
