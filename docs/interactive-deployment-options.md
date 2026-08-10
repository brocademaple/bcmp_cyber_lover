# 心动伴侣交互式对外展示渠道清单

目标：不一定走正式应用商店发布，但要像一个 Web 项目一样，别人能通过链接访问、交互、试用。

## 推荐优先级

1. **Expo Web 静态构建 + Vercel/Netlify/Cloudflare Pages**
   - 最像普通 Web 项目，适合公开访问、发链接、接自定义域名。
   - 当前项目已有 `react-native-web` 和 `npm run web`，是最值得先验证的路径。
2. **GitHub Pages 交互版**
   - 当前仓库已经有静态展示站，可以扩展成「介绍页 + 进入可交互 App」。
   - 成本低，但 SPA 路由、资源路径、缓存处理要小心。
3. **EAS Hosting**
   - Expo 官方 Web 托管路径，适合想把 Expo 移动端和 Web 部署放在同一套工作流里。
   - 当前项目不是 Expo Router 架构，先跑通 `expo export --platform web` 后再判断适配成本。
4. **Expo Tunnel 临时演示**
   - 最快给人试玩，但依赖本机服务在线，适合临时 Demo。
5. **EAS Android APK 内测链接**
   - 不像 Web 项目，但能完整保留移动端能力，适合给真实用户试用。

## 渠道 1：Expo Web + Vercel/Netlify/Cloudflare Pages

### 适合场景

- 你希望发一个公开 URL，对方直接浏览器打开。
- 想要像常规前端项目一样，有 preview deployment、production deployment、自定义域名。
- 能接受先做一轮 Web 兼容性修补。

### Todo

- 本地启动 Web 版：

```bash
npm run web
```

- 确认首屏、选角、设置、聊天、记忆页都能打开。
- 检查这些移动端能力在 Web 上是否有可接受降级：
  - `expo-secure-store`
  - `expo-notifications`
  - `expo-camera`
  - `expo-image-picker`
  - `expo-file-system`
  - `expo-speech`
- 检查浏览器是否能直接请求模型服务：
  - 如果模型服务允许浏览器 CORS：继续用前端直连，API Key 由用户在设置里填写。
  - 如果模型服务不允许 CORS：加一个轻量 serverless proxy，例如 Vercel Function、Netlify Function、Cloudflare Worker。
- 增加 Web 构建脚本：

```json
{
  "scripts": {
    "build:web": "expo export --platform web"
  }
}
```

- 本地构建：

```bash
npx expo export --platform web
```

- 部署配置：
  - Build command: `npx expo export --platform web`
  - Output directory: `dist`
  - Node version: 使用当前项目能通过构建的 Node 版本
- 验证线上版本：
  - 打开首页
  - 完成 onboarding
  - 填入测试 API Key
  - 发送一条文字消息
  - 刷新页面，确认本地设置和聊天记录是否按预期保留

### 风险

- 模型接口可能被浏览器 CORS 拦截，这是 Web 化最可能遇到的真实阻塞。
- 用户 API Key 保存在浏览器本地，公开 Demo 需要明确提示「不要填高权限生产 Key」。
- 部分 Expo 原生 API 在 Web 上能力不同，需要做 graceful fallback。

## 渠道 2：GitHub Pages 交互版

### 适合场景

- 想沿用当前展示站域名：`brocademaple.github.io/bcmp_cyber_lover/`
- 想把现有 `docs/index.html` 作为介绍页，再提供「进入在线体验」按钮。
- 不需要服务端函数。

### Todo

- 先产出 Web 构建：

```bash
npx expo export --platform web
```

- 决定交互 App 放置位置：
  - `docs/app/`：保留当前展示站首页，交互应用在 `/app/`
  - 或独立 `gh-pages` 分支：把整站切到 Web App
- 如果放到 `docs/app/`，需要确认静态资源路径是否适配 GitHub Pages 的子路径。
- 给当前展示站增加入口按钮：

```html
<a class="button primary" href="./app/">进入在线体验</a>
```

- 处理 SPA 刷新问题：
  - 使用 hash 路由，或
  - 增加 `404.html` 回退到 `index.html`
- 验证：
  - 访问 `/bcmp_cyber_lover/app/`
  - 刷新深层页面不白屏
  - 静态图片、字体、bundle 都能加载

### 风险

- GitHub Pages 对 SPA 的刷新路径不天然友好。
- 没有后端函数，遇到 CORS 时需要把模型请求转到外部 proxy。

## 渠道 3：EAS Hosting

### 适合场景

- 想使用 Expo 官方的 Web 部署链路。
- 后续可能同时维护 Android、iOS、Web，并希望部署记录都在 Expo/EAS 生态里。
- 需要 preview URL、alias、回滚等部署能力。

### Todo

- 安装并登录 EAS CLI：

```bash
npx eas login
```

- 先构建 Web 静态产物：

```bash
npx expo export --platform web
```

- 部署：

```bash
npx eas deploy
```

- 根据部署结果设置 preview / production alias。
- 如需自定义域名，检查 EAS Hosting 当前套餐与域名限制。
- 验证路径同渠道 1。

### 风险

- Expo 官方文档更强调 Expo Router + React Native Web 项目；当前项目要先验证非 Expo Router 架构的实际兼容性。
- 如果需要 server functions，要注意 EAS Hosting 使用的是 Cloudflare Workers 运行时，Node.js 兼容性不是完整 Node 服务端。

## 渠道 4：Expo Tunnel 临时演示

### 适合场景

- 今天就要给别人看。
- 只需要短时间体验，不要求长期在线 URL。
- 你可以保持本机服务运行。

### Todo

- 启动 tunnel：

```bash
npx expo start --tunnel
```

- 在 Expo Dev Tools 或终端里打开 Web，或让移动端用户用 Expo Go 扫码。
- 准备一组测试模型配置，方便对方快速填入。
- 演示结束后关闭服务。

### 风险

- 链接不稳定，不适合作为正式项目地址。
- 依赖你的电脑、网络和本地 Metro 服务。

## 渠道 5：EAS Android APK 内测链接

### 适合场景

- Web 版兼容成本较高，但你想让别人完整体验聊天、通知、相机、语音等移动端能力。
- 接收方能安装 Android APK。

### Todo

- 当前 `eas.json` 已配置 preview APK。
- 构建：

```bash
npx eas build --platform android --profile preview
```

- 把 EAS 生成的 APK 下载链接发给测试用户。
- 准备测试说明：
  - 如何安装 APK
  - 如何配置服务商和 API Key
  - 如何导出反馈截图或录屏

### 风险

- Android 安装 APK 会有安全提示。
- 不是浏览器访问方式，但交互完整度最高。

## 当前项目建议路线

### 第一阶段：跑通 Web 访问

```bash
npm run web
npx expo export --platform web
```

验收标准：

- Web 首屏可见
- 主要导航可点
- 设置页可保存
- 聊天页能发出一条测试消息
- 刷新后本地数据表现符合预期

### 第二阶段：选择托管平台

- 如果只要最快公开 URL：选 Vercel、Netlify 或 Cloudflare Pages。
- 如果想复用现有展示站：选 GitHub Pages，把交互 App 放到 `docs/app/`。
- 如果想留在 Expo 生态：试 EAS Hosting。

### 第三阶段：补 Web Demo 的产品边界

- 增加 Demo 模式提示。
- 给 API Key 输入区加安全提示。
- 如遇 CORS，增加 serverless proxy。
- 对移动端专属功能加 Web fallback 文案或隐藏入口。
- 给展示站加「进入在线体验」按钮。

## 关键假设

- 目标是「发链接即可访问并互动」，优先级高于正式应用商店发布。
- 公开 Web Demo 不内置服务端 API Key，仍由用户在设置中填写自己的 Key。
- 当前静态 GitHub Pages 展示站继续保留，交互应用可以作为新入口接入。
- 如果模型服务不支持浏览器 CORS，就需要增加一个最小 proxy，否则聊天能力可能无法在 Web 上工作。

## 参考资料

- Expo Web 导出与部署：<https://docs.expo.dev/distribution/publishing-websites/>
- Expo EAS Hosting：<https://docs.expo.dev/eas/hosting/introduction/>
