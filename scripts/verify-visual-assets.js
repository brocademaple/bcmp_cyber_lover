const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const repoRoot = path.resolve(__dirname, '..');
const manifestPath = path.join(__dirname, 'visual-asset-manifest.json');
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const imageExtensions = new Set(['.png', '.jpg', '.jpeg', '.webp']);

function toRepoPath(relativePath) {
  return relativePath.split('/').join(path.sep);
}

function absolutePath(relativePath) {
  return path.join(repoRoot, toRepoPath(relativePath));
}

function walkImages(relativeDir) {
  const absoluteDir = absolutePath(relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    throw new Error(`Missing asset directory: ${relativeDir}`);
  }

  return fs.readdirSync(absoluteDir, { withFileTypes: true }).flatMap((entry) => {
    const relativePath = path.join(relativeDir, entry.name);
    const absolutePath = path.join(repoRoot, relativePath);
    if (entry.isDirectory()) return walkImages(relativePath);
    if (!entry.isFile()) return [];
    return imageExtensions.has(path.extname(entry.name).toLowerCase()) ? [absolutePath] : [];
  });
}

function displayPath(absolutePath) {
  return path.relative(repoRoot, absolutePath).split(path.sep).join('/');
}

function assetPath(...parts) {
  return parts.join('/');
}

function readText(relativePath) {
  return fs.readFileSync(absolutePath(relativePath), 'utf8');
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function requiredCharacterAssetPaths() {
  return Object.entries(manifest.characters).flatMap(([characterId, config]) => {
    return config.files.flatMap((fileName) => [
      assetPath(manifest.characterAssetRoot, characterId, fileName),
      assetPath(manifest.docsCharacterAssetRoot, characterId, fileName),
    ]);
  });
}

function forbiddenRootCharacterPaths() {
  return manifest.forbiddenRootCharacterIds.flatMap((id) => {
    return manifest.forbiddenRootCharacterExtensions.flatMap((extension) => [
      assetPath('assets/characters', `${id}.${extension}`),
      assetPath('docs/assets/characters', `${id}.${extension}`),
    ]);
  });
}

function assertRequiredFilesExist(relativePaths) {
  for (const relativePath of relativePaths) {
    if (!fs.existsSync(absolutePath(relativePath))) {
      throw new Error(`Missing required visual asset: ${relativePath}`);
    }
  }
}

function assertForbiddenFilesAbsent(relativePaths) {
  for (const relativePath of relativePaths) {
    if (fs.existsSync(absolutePath(relativePath))) {
      throw new Error(`Forbidden legacy visual asset is still present: ${relativePath}`);
    }
  }
}

function assertDocsMirrorMatchesSource() {
  for (const [characterId, config] of Object.entries(manifest.characters)) {
    for (const fileName of config.files) {
      const source = fs.readFileSync(absolutePath(assetPath(manifest.characterAssetRoot, characterId, fileName)));
      const mirror = fs.readFileSync(absolutePath(assetPath(manifest.docsCharacterAssetRoot, characterId, fileName)));
      if (!source.equals(mirror)) {
        throw new Error(`Docs character asset mirror is stale: ${characterId}/${fileName}`);
      }
    }
  }
}

function assertMirroredAssetsMatchSource() {
  for (const mirrorPair of manifest.mirroredAssets) {
    const source = fs.readFileSync(absolutePath(mirrorPair.source));
    const target = fs.readFileSync(absolutePath(mirrorPair.target));
    if (!source.equals(target)) {
      throw new Error(`Mirrored asset is stale: ${mirrorPair.target}`);
    }
  }
}

function shouldSkipTextPath(relativePath) {
  return manifest.scanTextExcludes.some((excluded) => {
    return relativePath === excluded || relativePath.startsWith(`${excluded}/`);
  });
}

function walkTextFiles(relativePath) {
  if (shouldSkipTextPath(relativePath)) return [];
  const fullPath = absolutePath(relativePath);
  if (!fs.existsSync(fullPath)) return [];
  const stats = fs.statSync(fullPath);
  if (stats.isDirectory()) {
    return fs.readdirSync(fullPath).flatMap((entry) => {
      return walkTextFiles(assetPath(relativePath, entry));
    });
  }
  if (!stats.isFile()) return [];
  return /\.(html|css|js|json|md|ts|tsx|mjs|cjs)$/.test(relativePath) ? [relativePath] : [];
}

function assertForbiddenTextAbsent() {
  const forbiddenFileNames = manifest.forbiddenRootCharacterIds.flatMap((id) => {
    return manifest.forbiddenRootCharacterExtensions.map((extension) => `${id}.${extension}`);
  });
  const forbiddenTerms = [
    ...forbiddenFileNames,
    ...manifest.forbiddenTextFragments.map((parts) => parts.join('')),
  ];
  const textFiles = manifest.scanTextRoots.flatMap(walkTextFiles);

  for (const relativePath of textFiles) {
    const body = fs.readFileSync(absolutePath(relativePath), 'utf8');
    for (const term of forbiddenTerms) {
      if (body.includes(term)) {
        throw new Error(`Forbidden legacy asset text '${term}' found in ${relativePath}`);
      }
    }
  }
}

function assertSourceCompatibilityGuards() {
  const registry = readText('src/utils/characterAssets.ts');
  const chatStore = readText('src/store/chatStore.ts');
  const homeScreen = readText('src/screens/HomeScreen.tsx');
  const editorScreen = readText('src/screens/CharacterEditorScreen.tsx');
  const memoryVisuals = readText('src/utils/memoryVisuals.ts');

  for (const [characterId, config] of Object.entries(manifest.characters)) {
    for (const alias of config.aliases) {
      assert(
        registry.includes(`'${alias}'`),
        `Character asset registry no longer covers alias '${alias}' for ${characterId}`
      );
    }
  }

  for (const legacyId of manifest.forbiddenRootCharacterIds) {
    assert(
      !registry.includes(`${legacyId}.${manifest.forbiddenRootCharacterExtensions[0]}`),
      `Legacy root asset file name must stay generated, not hard-coded: ${legacyId}`
    );
  }

  assert(
    registry.includes('LEGACY_ROOT_CHARACTER_IDS') &&
      registry.includes('LEGACY_ROOT_CHARACTER_DIRS') &&
      registry.includes('endsWith(fragment)'),
    'Character asset registry must keep old root asset URI compatibility guards'
  );
  assert(
    chatStore.includes('findPersistedDefaultCharacter') &&
      chatStore.includes('usedPersistedCharacterIds') &&
      chatStore.includes('resolveDefaultCharacterAssetKey(character) === defaults.id'),
    'chatStore must keep old default-id local data merged into the matching default slot'
  );
  assert(
    homeScreen.includes('resolveDefaultCharacterAssetKey(settings.selectedCharacterId)') &&
      homeScreen.includes('resolveDefaultCharacterAssetKey(character) ?? character.id'),
    'HomeScreen must keep old selectedCharacterId and status-line compatibility'
  );
  assert(
    editorScreen.includes('getInitialSelectedCharacterId') &&
      editorScreen.includes('resolveDefaultCharacterAssetKey(character) === defaults.id') &&
      editorScreen.includes('resolveDefaultCharacterAssetKey(selectedId)'),
    'CharacterEditorScreen must keep old id aliases editable through the default roster'
  );
  assert(
    memoryVisuals.includes('resolveDefaultCharacterAssetKey(character) ?? character.id'),
    'Memory visuals must resolve old character ids before choosing default comics'
  );
}

async function verifyImage(absolutePath) {
  const relativePath = displayPath(absolutePath);
  const image = sharp(absolutePath, { failOn: 'error' });
  const metadata = await image.metadata();
  if (!metadata.width || !metadata.height) {
    throw new Error(`${relativePath}: unreadable image dimensions`);
  }

  if (relativePath.startsWith('assets/characters/') && Math.min(metadata.width, metadata.height) < 64) {
    throw new Error(`${relativePath}: character asset is too small (${metadata.width}x${metadata.height})`);
  }

  const stats = await image.stats();
  const alpha = stats.channels[3];
  if (alpha && alpha.mean < 2) {
    throw new Error(`${relativePath}: image appears fully transparent`);
  }

  const rgbSpread = stats.channels.slice(0, 3).reduce((sum, channel) => sum + (channel.stdev ?? 0), 0);
  const shouldCheckBlankness =
    relativePath.startsWith('assets/characters/') ||
    relativePath.startsWith('assets/memories/');

  if (shouldCheckBlankness && rgbSpread < 8) {
    throw new Error(`${relativePath}: image appears nearly blank`);
  }

  return `${relativePath} (${metadata.width}x${metadata.height})`;
}

async function main() {
  const requiredAssets = [
    ...manifest.appShellAssets,
    ...requiredCharacterAssetPaths(),
  ];
  assertRequiredFilesExist(requiredAssets);
  assertForbiddenFilesAbsent(forbiddenRootCharacterPaths());
  assertDocsMirrorMatchesSource();
  assertMirroredAssetsMatchSource();
  assertSourceCompatibilityGuards();
  assertForbiddenTextAbsent();

  const images = [
    ...new Set([
      ...manifest.visualAssetRoots.flatMap(walkImages),
      ...requiredAssets.map(absolutePath),
    ]),
  ].sort();
  if (images.length === 0) {
    throw new Error('No visual assets found');
  }

  const verified = [];
  for (const imagePath of images) {
    verified.push(await verifyImage(imagePath));
  }

  console.log(`Verified ${verified.length} visual assets.`);
  console.log('Verified character docs mirrors and forbidden legacy asset entries.');
  console.log(verified.map((item) => `- ${item}`).join('\n'));
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
