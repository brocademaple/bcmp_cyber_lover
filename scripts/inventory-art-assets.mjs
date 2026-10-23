import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

// Read source artwork only. Writes review artifacts; never edits app assets or data.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'docs/luya/art-inventory-2026-10-05');
fs.mkdirSync(out, { recursive: true });
const walk = dir => fs.existsSync(dir) ? fs.readdirSync(dir, { withFileTypes: true }).flatMap(e => e.isDirectory() ? walk(path.join(dir, e.name)) : [path.join(dir, e.name)]) : [];
const relative = p => path.relative(root, p).split(path.sep).join('/');
const hash = p => crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const imageFiles = dir => walk(path.join(root, dir)).filter(p => /\.(png|jpe?g|webp|svg)$/i.test(p));
const sources = [...imageFiles('assets'), ...imageFiles('docs/assets').filter(p => !/\/characters\/|\/memories\/|\/favicon\.png$/.test(p))].sort();
const textFiles = [...walk(path.join(root, 'src')), path.join(root, 'app.json'), path.join(root, 'docs/index.html'), path.join(root, 'docs/styles.css')].filter(p => /\.(tsx?|json|html|css)$/.test(p));
const references = new Map();
for (const p of textFiles) {
  fs.readFileSync(p, 'utf8').split('\n').forEach((line, i) => {
    for (const match of line.matchAll(/['"]([^'"\n]+\.(?:png|jpg|jpeg|webp|svg))['"]/g)) {
      const resolved = path.resolve(path.dirname(p), match[1]);
      const key = relative(resolved);
      references.set(key, [...(references.get(key) ?? []), `${relative(p)}:${i + 1}`]);
    }
  });
}
const labels = { qingning: '鹿芽', sakura: '纪遥', luna: '凛夜' };
const roles = { main: '经典主立绘', avatar: '完整方形头像', headshot: '轻量人脸头像', 'expression-happy': '兴致不错', 'expression-soft': '安静陪着', 'expression-low-energy': '低电量', 'action-wave': '有些兴奋（文件名：挥手）', 'action-waiting': '有些在意（文件名：等待）', 'scene-memory': '记忆插画回退' };
function describe(p) {
  const stem = path.basename(p, path.extname(p));
  if (p.includes('/characters/')) {
    const id = p.split('/').at(-2);
    return { group: `${labels[id]} · 经典人物`, title: `${labels[id]} / ${roles[stem]}`, status: id === 'qingning' ? '当前／回退' : '管理员／保留', usage: stem === 'scene-memory' ? '记忆页图片加载失败时备用' : ['avatar', 'headshot'].includes(stem) ? '首页、聊天、档案、通话头像；具体优先级随页面变化' : '经典展示与状态抽屉；六帧按状态索引选择' };
  }
  if (p.includes('life-')) return { group: '鹿芽 · 生活插画', title: ({ 'life-focus': '专注做事', 'life-reading': '翻一会儿书', 'life-rest': '把节奏放慢' })[stem], status: '条件展示', usage: '首页生活画面：对应居家日程时展示；缺图或无对应日程时回退经典立绘' };
  if (p.includes('room-')) return { group: '鹿芽 · 共同房间', title: `${stem.includes('night') ? '夜间' : '日间'}房间 · ${stem.includes('portrait') ? '竖版 v2' : '横版 v1'}`, status: stem.includes('portrait') ? '当前' : '备用回退', usage: '共同房间按上海时间 07:00–18:00 日景，其余夜景；竖图优先，旧横图回退' };
  if (p.includes('/memories/')) {
    const id = stem.split('-')[0];
    const magazine = stem.includes('magazine');
    return { group: '记忆 · 插画与漫画', title: `${labels[id]} / ${magazine ? '竖版漫画' : stem.includes('grid') ? '方格漫画' : '单幅情景插画'}`, status: magazine ? (id === 'qingning' ? '当前示例／回退' : '管理员／保留') : '未见当前入口', usage: magazine ? '无记忆时的预置示例；已有记忆无 visualUri 时作背景；不等同于真实共同经历' : '源码未见直接引用；文档镜像保留' };
  }
  if (p.includes('/style/')) return { group: '主题 · 装饰切片', title: `${p.includes('soft-sweet') ? '甜系' : '都市'} / ${stem}`, status: '未见当前入口', usage: ['avatar-frame-pink', 'night-city-card'].includes(stem) ? '当前源码未见引用；原始切片板目录 design/figma/exports 当前无文件' : 'ThemeArtworkLayer 内有 require；当前 src 中没有该组件的调用。原始切片板目录 design/figma/exports 当前无文件' };
  if (p.startsWith('docs/assets/')) return { group: '网站 · 宣传与概念', title: stem, status: '网站使用', usage: stem.includes('preview') ? '网站分享预览图' : stem.includes('concept') ? '网站六屏概念图，不代表当前运行界面' : '宣传站 hero，不属于 Expo 页面背景' };
  return { group: '应用 · 图标与启动', title: stem, status: '配置使用', usage: 'app.json 原生／Web 配置；icon、adaptive-icon、splash 文件内容完全相同' };
}
const assets = [];
const thumbnailMap = new Map();
for (const p of sources) {
  const rel = relative(p);
  const meta = await sharp(p).metadata();
  const sha256 = hash(p);
  const mirrored = imageFiles('docs/assets').filter(q => relative(q) !== rel && hash(q) === sha256).map(relative);
  const thumbnail = await sharp(p).resize({ width: 480, height: 640, fit: 'inside', withoutEnlargement: true }).webp({ quality: 83 }).toBuffer();
  thumbnailMap.set(rel, thumbnail);
  assets.push({ path: rel, ...describe(rel), width: meta.width, height: meta.height, hasAlpha: meta.hasAlpha, bytes: fs.statSync(p).size, sha256, directReferences: references.get(rel) ?? [], mirrors: mirrored, preview: `data:image/webp;base64,${thumbnail.toString('base64')}` });
}
const docsMirrors = imageFiles('docs/assets').filter(p => /\/characters\/|\/memories\/|\/favicon\.png$/.test(p));
const mismatch = docsMirrors.filter(p => {
  const source = path.join(root, relative(p).replace(/^docs\//, ''));
  return !fs.existsSync(source) || hash(source) !== hash(p);
}).map(relative);
const sourceAssets = assets.filter(a => a.path.startsWith('assets/'));
const byHash = Object.groupBy(sourceAssets, a => a.sha256);
const evidencePaths = ['home-life-390.jpg', 'home-classic-390.jpg', 'room-day-final-390.jpg', 'room-night-final-390.jpg', 'memory-fullscreen-final.jpg', 'profile-avatar-390.jpg', 'chat-state-final.jpg'];
const evidence = [];
for (const file of evidencePaths) {
  const p = path.join(root, 'output/playwright/experience-2026-10-05', file);
  if (!fs.existsSync(p)) continue;
  const b = await sharp(p).resize({ width: 390, height: 844, fit: 'inside' }).webp({ quality: 80 }).toBuffer();
  evidence.push({ path: relative(p), preview: `data:image/webp;base64,${b.toString('base64')}` });
}
const inventory = { date: '2026-10-05', scope: 'Local source assets, docs mirrors, website art; user-device uploads excluded', sourceAssetCount: sourceAssets.length, sourceBytes: sourceAssets.reduce((s, a) => s + a.bytes, 0), websiteOnlyCount: assets.length - sourceAssets.length, docsMirrorCount: docsMirrors.length, mirrorMismatches: mismatch, exactDuplicates: Object.values(byHash).filter(v => v.length > 1).map(v => v.map(a => a.path)), assets: assets.map(({ preview, ...a }) => a), historicalScreenshotPaths: evidence.map(e => e.path) };
fs.writeFileSync(path.join(out, 'inventory.json'), JSON.stringify(inventory, null, 2) + '\n');
const groups = ['鹿芽 · 经典人物', '鹿芽 · 生活插画', '鹿芽 · 共同房间', '记忆 · 插画与漫画', '纪遥 · 经典人物', '凛夜 · 经典人物', '主题 · 装饰切片', '应用 · 图标与启动', '网站 · 宣传与概念'];
const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const html = `<!doctype html><html lang="zh-CN"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>鹿芽 · 已有美术盘点</title><style>
*{box-sizing:border-box}body{margin:0;background:#f5f5f3;color:#292f2d;font:15px/1.6 -apple-system,BlinkMacSystemFont,"PingFang SC",sans-serif}main{max-width:1400px;margin:auto;padding:32px}h1{font-size:30px;margin:0}h2{font-size:22px;margin-top:36px}.intro{max-width:920px;color:#555f5b}.stats{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}.stats span{background:white;padding:10px 18px;border-radius:12px}nav{position:sticky;top:0;background:#f5f5f3ee;backdrop-filter:blur(12px);padding:12px 0;z-index:2;display:flex;gap:8px;flex-wrap:wrap}button,input{font:inherit;border:1px solid #d3d9d4;border-radius:9px;padding:8px 12px;background:white;color:inherit}button{cursor:pointer}button[aria-pressed=true]{background:#466456;color:white}input{flex:1;min-width:200px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:14px}.card{background:white;border-radius:14px;overflow:hidden;min-width:0}.image{height:270px;background:repeating-conic-gradient(#edf0ed 0% 25%,#f8f9f7 0% 50%) 50%/16px 16px;display:flex;justify-content:center;align-items:center;border:0;border-radius:0;padding:12px;width:100%}.image img{max-width:100%;max-height:100%;object-fit:contain}.info{padding:15px}.info h3{font-size:15px;margin:0 0 7px}.path{font:11px/1.5 ui-monospace,monospace;overflow-wrap:anywhere;color:#66736b}.meta{font-size:12px;color:#606d64}.badge{font-size:11px;padding:3px 7px;background:#eaf0e9;border-radius:5px}.usage{font-size:12px;margin:10px 0}.refs{font-size:11px;overflow-wrap:anywhere;color:#6d7671}details{margin-top:10px}dialog{border:0;border-radius:16px;max-width:95vw;width:1050px;max-height:93vh;overflow:auto;background:#fff;padding:22px}dialog::backdrop{background:#15221c99}dialog img{width:100%;max-height:70vh;object-fit:contain;background:#eef0ec}.hidden{display:none}footer{padding:30px 0;color:#68716a}.evidence img{height:440px;max-width:100%;object-fit:contain}.evidence{padding:16px}.hint{border-left:3px solid #90a697;padding:8px 16px;background:#edf1eb}a{color:#466456}@media(max-width:600px){main{padding:18px}.grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}.image{height:210px;padding:5px}.info{padding:10px}.stats span{padding:8px 12px}h1{font-size:24px}} </style><main>
<h1>已有美术素材盘点</h1><p class="intro">2026-10-05 · 按当前工作区源码核对。素材采用完整构图预览，点击可放大；透明图用棋盘底。引用记录是静态源码证据，页面是否展示还取决于角色、日程、存档、自定义图与模式。</p>
<div class="stats"><span><b>60</b> 应用源图 · ${(inventory.sourceBytes / 1048576).toFixed(1)} MiB</span><span><b>3</b> 网站专用图</span><span><b>37</b> 文档镜像 · ${mismatch.length} 不一致</span><span><b>7</b> 既有界面截图</span></div>
<p class="hint">主要混乱点：横向生活画面与竖向经典立绘交替；房间横版/竖版并存；动作文件名与状态文案不完全对应；漫画存在三种版式但当前主要用竖版；旧装饰组件已无页面调用。人物 v2 与房间 art-v2 是不同版本体系。普通模式只显示鹿芽，另两位保留给管理员。</p>
<nav><button aria-pressed="true" data-filter="全部">全部</button>${groups.map(g => `<button data-filter="${esc(g)}" aria-pressed="false">${esc(g)}</button>`).join('')}<input id="search" type="search" aria-label="搜索素材" placeholder="搜索名称、路径、用途、状态"></nav><p id="count"></p>
${groups.map(g => `<section data-section="${esc(g)}"><h2>${esc(g)}</h2><div class="grid">${assets.filter(a => a.group === g).map(a => `<article class="card" data-group="${esc(g)}" data-search="${esc(JSON.stringify({ ...a, preview: undefined }).toLowerCase())}"><button class="image" aria-label="放大 ${esc(a.title)}"><img src="${a.preview}" alt="${esc(a.title)}" loading="lazy"></button><div class="info"><h3>${esc(a.title)}</h3><span class="badge">${esc(a.status)}</span><p class="meta">${a.width} × ${a.height} · ${(a.bytes / 1048576).toFixed(2)} MiB · ${a.hasAlpha ? '含 Alpha 通道' : '无 Alpha 通道'}</p><p class="path">${esc(a.path)}</p><p class="usage">${esc(a.usage)}</p><details><summary>直接引用 ${a.directReferences.length} · 镜像 ${a.mirrors.length}</summary><p class="refs">${a.directReferences.map(esc).join('<br>') || '未见直接引用'}</p><p class="refs">${a.mirrors.map(esc).join('<br>')}</p><p class="refs">SHA-256 ${a.sha256}</p></details></div></article>`).join('')}</div></section>`).join('')}
<section id="evidence"><h2>既有界面证据 · 2026-10-05</h2><p>以下是链接聊天上轮验收保存的截图，帮助区分源图与页面组合；本次没有重新运行应用。</p><div class="grid">${evidence.map(e => `<article class="card evidence"><img src="${e.preview}" alt="${esc(path.basename(e.path))}" loading="lazy"><p class="path">${esc(e.path)}</p></article>`).join('')}</div></section><footer>只读盘点：没有移动、删除、覆盖原图，没有访问用户设备存档或 API 配置。JSON 包含全部文件尺寸、SHA-256、引用及镜像。<a href="inventory.json">下载清单</a> · <a href="README.md">查看报告</a></footer>
<dialog id="viewer"><button id="close">关闭</button><h3 id="caption"></h3><img id="large" alt=""></dialog></main><script>
let selected='全部';const cards=[...document.querySelectorAll('.card[data-group]')];function filter(){const q=document.querySelector('#search').value.toLowerCase();let n=0;for(const c of cards){const visible=(selected==='全部'||c.dataset.group===selected)&&c.dataset.search.includes(q);c.classList.toggle('hidden',!visible);if(visible)n++}for(const s of document.querySelectorAll('[data-section]'))s.classList.toggle('hidden',![...s.querySelectorAll('.card')].some(c=>!c.classList.contains('hidden')));document.querySelector('#count').textContent='显示 '+n+' / '+cards.length+' 张源图';document.querySelector('#evidence').classList.toggle('hidden',selected!=='全部'||Boolean(q))}document.querySelector('#search').addEventListener('input',filter);for(const b of document.querySelectorAll('[data-filter]'))b.addEventListener('click',()=>{selected=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));filter()});for(const b of document.querySelectorAll('.image'))b.addEventListener('click',()=>{const img=b.querySelector('img');document.querySelector('#large').src=img.src;document.querySelector('#large').alt=img.alt;document.querySelector('#caption').textContent=img.alt;document.querySelector('#viewer').showModal()});document.querySelector('#close').onclick=()=>document.querySelector('#viewer').close();filter();</script></html>`;
fs.writeFileSync(path.join(out, 'index.html'), html);
const selected = assets.filter(a => a.path.includes('/qingning/') || a.path.includes('/luya-art-') || a.path.includes('qingning-comic') || a.path.includes('qingning-convenience')).sort((a,b)=>a.path.localeCompare(b.path));
const tiles = [];
const columns = 5, tileW = 240, tileH = 330;
for (const [i,a] of selected.entries()) {
  const photo = await sharp(thumbnailMap.get(a.path)).resize(220, 270, {fit:'contain',background:'#f1f2ee'}).png().toBuffer();
  tiles.push({input:photo,left:(i%columns)*tileW+10,top:Math.floor(i/columns)*tileH+10});
  const label = Buffer.from(`<svg width="240" height="48"><text x="10" y="19" font-family="sans-serif" font-size="12" fill="#2c3931">${esc(path.basename(a.path))}</text><text x="10" y="36" font-family="sans-serif" font-size="11" fill="#607065">${a.width} x ${a.height}</text></svg>`);
  tiles.push({input:label,left:(i%columns)*tileW,top:Math.floor(i/columns)*tileH+280});
}
await sharp({create:{width:columns*tileW,height:Math.ceil(selected.length/columns)*tileH,channels:3,background:'#fafaf7'}}).composite(tiles).png().toFile(path.join(out,'luya-contact-sheet.png'));
console.log(JSON.stringify({ sourceAssetCount: inventory.sourceAssetCount, websiteOnlyCount: inventory.websiteOnlyCount, docsMirrorCount: inventory.docsMirrorCount, mirrorMismatches: mismatch, exactDuplicates: inventory.exactDuplicates, groups: Object.fromEntries(groups.map(g => [g, assets.filter(a => a.group === g).length])), output: relative(out) }, null, 2));
