#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(scriptDir, '..');
const outputDir = path.join(projectRoot, 'docs', 'app');
const docsDir = path.join(projectRoot, 'docs');
const npxBin = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function read(filePath) {
  return fs.readFileSync(filePath, 'utf8');
}

function write(filePath, content) {
  fs.writeFileSync(filePath, content);
}

function walkFiles(dir, predicate, results = []) {
  if (!fs.existsSync(dir)) return results;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walkFiles(fullPath, predicate, results);
    } else if (!predicate || predicate(fullPath)) {
      results.push(fullPath);
    }
  }
  return results;
}

fs.rmSync(outputDir, { recursive: true, force: true });

const exportResult = spawnSync(
  npxBin,
  ['expo', 'export', '-p', 'web', '--output-dir', 'docs/app'],
  {
    cwd: projectRoot,
    stdio: 'inherit',
    env: {
      ...process.env,
      EXPO_NO_DOTENV: '1',
      EXPO_PUBLIC_DEEPSEEK_API_KEY: '',
    },
  }
);

if (exportResult.status !== 0) {
  process.exit(exportResult.status ?? 1);
}

const indexPath = path.join(outputDir, 'index.html');
let indexHtml = read(indexPath)
  .replaceAll('href="/favicon.ico"', 'href="./favicon.ico"')
  .replaceAll('src="/_expo/', 'src="./_expo/')
  .replaceAll('href="/_expo/', 'href="./_expo/');

if (!indexHtml.includes('<base href="./"')) {
  indexHtml = indexHtml.replace('<title>心动伴侣</title>', '<title>心动伴侣</title>\n    <base href="./" />');
}

write(indexPath, indexHtml);

for (const jsFile of walkFiles(outputDir, (file) => file.endsWith('.js'))) {
  const patched = read(jsFile)
    .replaceAll('uri:"/assets/', 'uri:"./assets/')
    .replaceAll("uri:'/assets/", "uri:'./assets/")
    .replaceAll('import.meta.env?import.meta.env.MODE:void 0', 'undefined');
  write(jsFile, patched);
}

const leakedSecretFiles = walkFiles(outputDir, (file) => /\.(?:html|js|json)$/i.test(file))
  .filter((file) => /\bsk-[A-Za-z0-9_-]{20,}\b/.test(read(file)));
if (leakedSecretFiles.length > 0) {
  console.error('Refusing to publish: the web export contains a DeepSeek-style API key.');
  process.exit(1);
}

write(path.join(outputDir, '404.html'), indexHtml);
write(path.join(docsDir, '.nojekyll'), '');
write(
  path.join(docsDir, '404.html'),
  `<!doctype html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>心动伴侣 · 页面跳转</title>
    <script>
      (function () {
        var pathname = window.location.pathname;
        var marker = '/app/';
        var markerIndex = pathname.indexOf(marker);
        if (markerIndex >= 0 || pathname.endsWith('/app')) {
          var appRoot = markerIndex >= 0
            ? pathname.slice(0, markerIndex + marker.length)
            : pathname.replace(/\\/app\\/?$/, '/app/');
          window.location.replace(appRoot + window.location.search + window.location.hash);
        }
      })();
    </script>
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        color: #4b4540;
        background: #fbfaf7;
      }
      main {
        width: min(520px, calc(100vw - 40px));
      }
      a {
        color: #8e7652;
        font-weight: 800;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>页面没有找到</h1>
      <p>如果你在访问在线体验，页面会自动回到应用入口。</p>
      <p><a href="./app/">进入在线体验</a> · <a href="./">返回首页</a></p>
    </main>
  </body>
</html>
`
);

console.log('Expo Web app exported for GitHub Pages at docs/app/');
