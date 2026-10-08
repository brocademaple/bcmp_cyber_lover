import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');
const docsDir = path.join(rootDir, 'docs');
const docsAssetsDir = path.join(docsDir, 'assets');

const canvas = {
  width: 3200,
  height: 1600,
};

const output = {
  hero: path.join(docsAssetsDir, 'cyberlover-home-hero.webp'),
  preview: path.join(docsAssetsDir, 'cyberlover-home-hero-preview.webp'),
};

const source = {
  main: path.join(docsAssetsDir, 'characters/v2/qingning/main.png'),
  soft: path.join(docsAssetsDir, 'characters/v2/qingning/expression-soft.png'),
  memory: path.join(docsAssetsDir, 'characters/v2/qingning/scene-memory.png'),
  waiting: path.join(docsAssetsDir, 'characters/v2/qingning/action-waiting.png'),
  wave: path.join(docsAssetsDir, 'characters/v2/qingning/action-wave.png'),
  avatar: path.join(docsAssetsDir, 'characters/v2/qingning/avatar.png'),
  comic: path.join(docsAssetsDir, 'memories/comics/qingning-comic-grid.png'),
  comicMagazine: path.join(docsAssetsDir, 'memories/comics/qingning-comic-magazine.png'),
  evening: path.join(docsAssetsDir, 'memories/qingning-convenience-evening.png'),
};

const esc = (value) =>
  String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

function svg(input) {
  return Buffer.from(input);
}

function baseSvg() {
  const { width, height } = canvas;
  return svg(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="lime" cx="48%" cy="42%" r="68%">
          <stop offset="0%" stop-color="#ffe2ec" stop-opacity="0.5"/>
          <stop offset="48%" stop-color="#ff9fc6" stop-opacity="0.3"/>
          <stop offset="100%" stop-color="#050811" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="rose" cx="18%" cy="30%" r="58%">
          <stop offset="0%" stop-color="#ff80b7" stop-opacity="0.52"/>
          <stop offset="62%" stop-color="#73264f" stop-opacity="0.24"/>
          <stop offset="100%" stop-color="#050811" stop-opacity="0"/>
        </radialGradient>
        <radialGradient id="blue" cx="88%" cy="22%" r="60%">
          <stop offset="0%" stop-color="#ffc4de" stop-opacity="0.32"/>
          <stop offset="64%" stop-color="#4c2448" stop-opacity="0.16"/>
          <stop offset="100%" stop-color="#050811" stop-opacity="0"/>
        </radialGradient>
        <linearGradient id="night" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="#321a32"/>
          <stop offset="46%" stop-color="#211525"/>
          <stop offset="100%" stop-color="#431a2f"/>
        </linearGradient>
        <filter id="noise">
          <feTurbulence type="fractalNoise" baseFrequency="0.86" numOctaves="3" stitchTiles="stitch"/>
          <feColorMatrix type="saturate" values="0"/>
          <feComponentTransfer>
            <feFuncA type="table" tableValues="0 0.09"/>
          </feComponentTransfer>
        </filter>
        <filter id="softGlow" x="-35%" y="-35%" width="170%" height="170%">
          <feGaussianBlur stdDeviation="36"/>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#night)"/>
      <rect width="${width}" height="${height}" fill="url(#lime)"/>
      <rect width="${width}" height="${height}" fill="url(#rose)"/>
      <rect width="${width}" height="${height}" fill="url(#blue)"/>
      <g opacity="0.04">
        ${Array.from({ length: 28 })
          .map((_, index) => {
            const y = 100 + index * 52;
            return `<path d="M0 ${y} C 520 ${y - 48}, 760 ${y + 68}, 1320 ${y + 4} S 2420 ${y - 58}, 3200 ${y + 26}" fill="none" stroke="#ffd3e5" stroke-opacity="0.22" stroke-width="1"/>`;
          })
          .join('')}
      </g>
      <g opacity="0.035">
        ${Array.from({ length: 30 })
          .map((_, index) => {
            const x = 80 + index * 108;
            return `<line x1="${x}" y1="0" x2="${x - 260}" y2="${height}" stroke="#ffd6e8" stroke-opacity="0.16" stroke-width="1"/>`;
          })
          .join('')}
      </g>
      <rect width="${width}" height="${height}" filter="url(#noise)" opacity="0.7"/>
      <rect x="54" y="54" width="${width - 108}" height="${height - 108}" rx="78" fill="none" stroke="#ffd7e8" stroke-opacity="0.12" stroke-width="2"/>
      <rect width="${width}" height="${height}" fill="none" stroke="#160812" stroke-width="92" opacity="0.18"/>
      <rect width="${width}" height="${height}" fill="url(#night)" opacity="0.04"/>
    </svg>
  `);
}

function cardChrome({ width, height, radius = 48, stroke = '#ffd7e8', opacity = 0.22 }) {
  return svg(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="edge" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stop-color="${stroke}" stop-opacity="${opacity}"/>
          <stop offset="48%" stop-color="#ffc1dc" stop-opacity="${opacity * 0.72}"/>
          <stop offset="100%" stop-color="#fff0f6" stop-opacity="${opacity * 0.46}"/>
        </linearGradient>
      </defs>
      <rect x="1.5" y="1.5" width="${width - 3}" height="${height - 3}" rx="${radius}" fill="none" stroke="url(#edge)" stroke-width="3"/>
      <rect x="14" y="14" width="${width - 28}" height="${height - 28}" rx="${Math.max(radius - 14, 8)}" fill="none" stroke="#ffe8f1" stroke-opacity="0.08" stroke-width="1"/>
    </svg>
  `);
}

function shadowSvg({ width, height, radius = 48, opacity = 0.5 }) {
  const pad = 130;
  return svg(`
    <svg width="${width + pad * 2}" height="${height + pad * 2}" viewBox="0 0 ${width + pad * 2} ${height + pad * 2}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="blur" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="46"/>
        </filter>
      </defs>
      <rect x="${pad}" y="${pad}" width="${width}" height="${height}" rx="${radius}" fill="#000000" opacity="${opacity}" filter="url(#blur)"/>
    </svg>
  `);
}

async function roundedImage(file, { width, height, radius, fit = 'cover', position = 'attention', brightness = 0.92, saturation = 1.08 }) {
  const image = await sharp(file)
    .resize(width, height, { fit, position })
    .modulate({ brightness, saturation })
    .sharpen(0.6)
    .png()
    .toBuffer();

  const mask = svg(`
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${width}" height="${height}" rx="${radius}" fill="#ffffff"/>
    </svg>
  `);

  return sharp(image).composite([{ input: mask, blend: 'dest-in' }]).png().toBuffer();
}

async function blurredBackdrop(file, { x, y, width, height, blur = 34, brightness = 0.82, saturation = 1.06, opacity = 0.32, position = 'center' }) {
  const image = await sharp(file)
    .resize(width, height, { fit: 'cover', position })
    .modulate({ brightness, saturation })
    .blur(blur)
    .ensureAlpha(opacity)
    .png()
    .toBuffer();

  return {
    input: image,
    left: Math.round(x),
    top: Math.round(y),
  };
}

async function imageCard(file, options) {
  const { x, y, width, height, radius = 48, shadow = 0.44 } = options;
  const pad = 130;
  const image = await roundedImage(file, options);

  return [
    {
      input: shadowSvg({ width, height, radius, opacity: shadow }),
      left: Math.round(x - pad),
      top: Math.round(y - pad),
    },
    {
      input: image,
      left: Math.round(x),
      top: Math.round(y),
    },
    {
      input: cardChrome({ width, height, radius }),
      left: Math.round(x),
      top: Math.round(y),
    },
  ];
}

function textPanel({ x, y, width, height, title, body, align = 'left' }) {
  const titleAnchor = align === 'right' ? 'end' : 'start';
  const textX = align === 'right' ? width - 54 : 54;
  return {
    input: svg(`
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="panel" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#effff9" stop-opacity="0.2"/>
            <stop offset="100%" stop-color="#ffbed7" stop-opacity="0.1"/>
          </linearGradient>
          <filter id="blur" x="-20%" y="-20%" width="140%" height="140%">
            <feGaussianBlur stdDeviation="22"/>
          </filter>
        </defs>
        <rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="34" fill="#071019" fill-opacity="0.62"/>
        <rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="34" fill="url(#panel)"/>
        <rect x="10" y="10" width="${width - 20}" height="${height - 20}" rx="34" fill="none" stroke="#dfffee" stroke-opacity="0.18" stroke-width="2"/>
        <text x="${textX}" y="78" fill="#dcfff6" fill-opacity="0.92" font-family="PingFang SC, Noto Sans CJK SC, Arial, sans-serif" font-size="42" font-weight="700" text-anchor="${titleAnchor}">${esc(title)}</text>
        <text x="${textX}" y="132" fill="#b5ccc8" font-family="PingFang SC, Noto Sans CJK SC, Arial, sans-serif" font-size="26" font-weight="500" text-anchor="${titleAnchor}">${esc(body)}</text>
      </svg>
    `),
    left: Math.round(x),
    top: Math.round(y),
  };
}

function chatBubble({ x, y, width, height, title, body, align = 'left' }) {
  const textX = align === 'right' ? width - 36 : 36;
  const anchor = align === 'right' ? 'end' : 'start';
  return {
    input: svg(`
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bubble" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#fff0f6" stop-opacity="0.5"/>
            <stop offset="58%" stop-color="#ff9fc6" stop-opacity="0.28"/>
            <stop offset="100%" stop-color="#ffd9e9" stop-opacity="0.18"/>
          </linearGradient>
        </defs>
        <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="34" fill="#2a1724" fill-opacity="0.5"/>
        <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="34" fill="url(#bubble)"/>
        <rect x="1" y="1" width="${width - 2}" height="${height - 2}" rx="34" fill="none" stroke="#ffd3e4" stroke-opacity="0.22" stroke-width="2"/>
        <text x="${textX}" y="62" fill="#fff3f8" font-family="Hiragino Sans GB, PingFang SC, Noto Sans CJK SC, Arial, sans-serif" font-size="30" font-weight="700" text-anchor="${anchor}">${esc(title)}</text>
        <text x="${textX}" y="108" fill="#ffdce8" font-family="Hiragino Sans GB, PingFang SC, Noto Sans CJK SC, Arial, sans-serif" font-size="22" font-weight="500" text-anchor="${anchor}">${esc(body)}</text>
      </svg>
    `),
    left: Math.round(x),
    top: Math.round(y),
  };
}

function memoryWord({ x, y, title, detail, rotate = 0, scale = 1, opacity = 0.88, align = 'middle' }) {
  const detailLine = detail
    ? `<text x="0" y="${48 * scale}" fill="#ffd5e4" fill-opacity="0.72" font-family="Hiragino Maru Gothic ProN, Yuanti SC, PingFang SC, Noto Sans CJK SC, Arial, sans-serif" font-size="${18 * scale}" font-weight="500" text-anchor="${align}">${esc(detail)}</text>`
    : '';

  return {
    input: svg(`
      <svg width="520" height="130" viewBox="-260 -54 520 130" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="memoryGlow" x="-40%" y="-80%" width="180%" height="260%">
            <feGaussianBlur stdDeviation="5" result="blur"/>
            <feMerge>
              <feMergeNode in="blur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <g opacity="${opacity}" filter="url(#memoryGlow)" transform="rotate(${rotate})">
          <text x="0" y="0" fill="#fff3f8" fill-opacity="0.94" font-family="Hiragino Maru Gothic ProN, Yuanti SC, PingFang SC, Noto Sans CJK SC, Arial, sans-serif" font-size="${34 * scale}" font-weight="700" text-anchor="${align}">${esc(title)}</text>
          ${detailLine}
        </g>
      </svg>
    `),
    left: Math.round(x),
    top: Math.round(y),
  };
}

function pinkWashLayer() {
  return {
    input: svg(`
      <svg width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="wash" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#ff8fbd" stop-opacity="0.22"/>
            <stop offset="48%" stop-color="#ffd5e6" stop-opacity="0.12"/>
            <stop offset="100%" stop-color="#8d3b68" stop-opacity="0.18"/>
          </linearGradient>
        </defs>
        <rect width="${canvas.width}" height="${canvas.height}" fill="url(#wash)"/>
      </svg>
    `),
    left: 0,
    top: 0,
    blend: 'soft-light',
  };
}

function headlineLayer() {
  return {
    input: svg(`
      <svg width="${canvas.width}" height="${canvas.height}" viewBox="0 0 ${canvas.width} ${canvas.height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="title" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#fff4f8"/>
            <stop offset="48%" stop-color="#ffd2e3"/>
            <stop offset="100%" stop-color="#ff8ebd"/>
          </linearGradient>
        </defs>
        <text x="180" y="206" fill="#ffc4db" fill-opacity="0.86" font-family="Manrope, Arial, sans-serif" font-size="28" font-weight="700" letter-spacing="5">CYBERLOVER / 鹿芽记忆墙</text>
        <text x="180" y="300" fill="url(#title)" font-family="Hiragino Maru Gothic ProN, Yuanti SC, PingFang SC, Noto Sans CJK SC, Arial, sans-serif" font-size="72" font-weight="700">鹿芽把你的小事记住了</text>
        <text x="180" y="370" fill="#ffdce8" font-family="Hiragino Maru Gothic ProN, Yuanti SC, PingFang SC, Noto Sans CJK SC, Arial, sans-serif" font-size="31" font-weight="500">睡前提醒、便利店灯光、慢慢变厚的关系感</text>
      </svg>
    `),
    left: 0,
    top: 0,
  };
}

async function build() {
  await Promise.all(
    Object.entries(source).map(async ([name, file]) => {
      try {
        await fs.access(file);
      } catch {
        throw new Error(`Missing ${name} source image: ${file}`);
      }
    })
  );

  const composites = [
    await blurredBackdrop(source.evening, {
      x: 0,
      y: 0,
      width: 3200,
      height: 1600,
      blur: 58,
      brightness: 0.78,
      saturation: 1.06,
      opacity: 0.26,
    }),
    await blurredBackdrop(source.main, {
      x: 0,
      y: 0,
      width: 3200,
      height: 1600,
      blur: 72,
      brightness: 0.72,
      saturation: 1.08,
      opacity: 0.18,
      position: 'center',
    }),
    await blurredBackdrop(source.comicMagazine, {
      x: 0,
      y: 0,
      width: 3200,
      height: 1600,
      blur: 64,
      brightness: 0.76,
      saturation: 1.02,
      opacity: 0.12,
      position: 'right',
    }),
    pinkWashLayer(),
    headlineLayer(),
    ...(await imageCard(source.memory, {
      x: 150,
      y: 430,
      width: 720,
      height: 455,
      radius: 52,
      brightness: 0.82,
      saturation: 0.96,
      position: 'center',
    })),
    ...(await imageCard(source.comicMagazine, {
      x: 250,
      y: 920,
      width: 430,
      height: 455,
      radius: 42,
      brightness: 0.88,
      saturation: 1.05,
    })),
    ...(await imageCard(source.evening, {
      x: 660,
      y: 1020,
      width: 470,
      height: 320,
      radius: 42,
      brightness: 0.82,
      saturation: 0.96,
    })),
    ...(await imageCard(source.main, {
      x: 1120,
      y: 126,
      width: 1010,
      height: 1280,
      radius: 82,
      brightness: 0.95,
      saturation: 1.12,
      position: 'top',
      shadow: 0.5,
    })),
    ...(await imageCard(source.comicMagazine, {
      x: 2272,
      y: 215,
      width: 570,
      height: 820,
      radius: 54,
      brightness: 0.9,
      saturation: 1.02,
      position: 'top',
    })),
    ...(await imageCard(source.waiting, {
      x: 2518,
      y: 1020,
      width: 500,
      height: 335,
      radius: 46,
      brightness: 0.88,
      saturation: 1.05,
      position: 'top',
    })),
    ...(await imageCard(source.wave, {
      x: 2064,
      y: 1028,
      width: 420,
      height: 332,
      radius: 42,
      brightness: 0.88,
      saturation: 1.04,
      position: 'top',
      shadow: 0.36,
    })),
    memoryWord({
      x: 470,
      y: 1348,
      title: '晚饭提醒',
      rotate: -5,
      scale: 1.08,
      opacity: 0.78,
    }),
    memoryWord({
      x: 850,
      y: 1440,
      title: '便利店灯',
      rotate: 3,
      scale: 0.86,
      opacity: 0.54,
    }),
    memoryWord({
      x: 1200,
      y: 1330,
      title: '睡前聊天',
      rotate: -2,
      scale: 1.02,
      opacity: 0.8,
    }),
    memoryWord({
      x: 1600,
      y: 1450,
      title: '随口一说',
      rotate: 5,
      scale: 0.98,
      opacity: 0.62,
    }),
    memoryWord({
      x: 2005,
      y: 1342,
      title: '关系记忆',
      rotate: -4,
      scale: 1.04,
      opacity: 0.78,
    }),
    memoryWord({
      x: 2360,
      y: 1430,
      title: '慢慢变熟',
      rotate: 2,
      scale: 0.9,
      opacity: 0.52,
    }),
  ];

  const hero = await sharp(baseSvg())
    .composite(composites)
    .webp({ quality: 88, effort: 5 })
    .toBuffer();

  await fs.writeFile(output.hero, hero);

  await sharp(hero)
    .resize(1920, 960, { fit: 'cover' })
    .webp({ quality: 86, effort: 5 })
    .toFile(output.preview);

  const heroMeta = await sharp(output.hero).metadata();
  const previewMeta = await sharp(output.preview).metadata();
  console.log(`wrote ${path.relative(rootDir, output.hero)} ${heroMeta.width}x${heroMeta.height}`);
  console.log(`wrote ${path.relative(rootDir, output.preview)} ${previewMeta.width}x${previewMeta.height}`);
}

build().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
