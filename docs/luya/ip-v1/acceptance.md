# 鹿芽 IP v1 验收记录

2026-10-05。验收对象为本轮当前完整Web构建，非旧静态包。未启动iOS模拟器，也没有更改设备存储。

## 自动检查

| 检查 | 结果与证据 |
| --- | --- |
| TypeScript | `npx tsc --noEmit`通过，`output/luya-ip-v1/typecheck.log` |
| 本轮组件、配置、进度服务、记忆屏幕、进度测试lint | 零警告通过，`output/luya-ip-v1/lint.log` |
| Vitest | 100通过，1项真实模型验收跳过；14测试文件通过，1跳过。`output/luya-ip-v1/tests.log` |
| 独立阅读记录 | 9个测试：多作品连续写入、立即重开等待保存、版本与损坏数据保留、页码收缩、读失败恢复、非法页码拒绝 |
| IP素材 | 17张可解码、尺寸与哈希匹配、静态require登记；60个原图哈希不变，5个人设／聊天／记忆源码哈希不变。`ip-assets.log` |
| 素材总检查 | 114项通过，含新IP包与旧luya-art-v1/v2。`visual-assets.log` |
| 聊天顺序与恢复 | 通过，`chat-history.log` |
| 调试时间 | 通过，`debug-now.log` |
| 记忆设置 | 9项通过，`memory-settings.log`。修正通用角色测试误用qingning ID的旧用例，并新增鹿芽普通分享不走LLM、明确要求记住仍可处理的检查；未修改记忆决策服务 |
| 当前安全Web构建 | 成功；17张新包图片与旧角色、房间、记忆图片均出现在65项Expo打包资产列表。`export.log` |

完整日志在仓库的`output/luya-ip-v1/`，清单与截图在本目录。`scripts/verify-luya-ip-assets.mjs`可重复验证原图和关键数据源码是否改变；合法后续变动应更新保留基线。

## 实际浏览器验收

浏览器来源`http://127.0.0.1:4187/`；通过正常引导的离线预览入口进入真实首页和MemorySettings路由。实际CSS视口为389×845、358×569、1280×900，均无页面水平溢出。浏览器缩放使截图接口多出右侧／底部白色画布，保留`*-raw.jpg`，展示图仅按实际CSS视口裁去画布；处理记录见`evidence/screenshots.json`，没有合成应用内容。

| 路径 | 实测结果 | 图像证据 |
| --- | --- | --- |
| 首页 → 故事与漫画 | 三入口可见；手机缩略封面书架，桌面三列书架 | `bookshelf-mobile.jpg`、`bookshelf-small.jpg`、`bookshelf-desktop.jpg` |
| 《年份不详》 | 第一／第二页切换、目录跳页、文字稿、纵向下一页、插画150%与恢复100%均可用 | `reader-mobile.jpg`、`text-mobile.jpg`、`zoom-mobile.jpg` |
| 关闭重开／完整页面重载 | 重回第二页；《蓝色明天改》从自己的第一页开始，进度互不覆盖 | 桌面书架与手机书架的续读标签 |
| 《蓝色明天改》 | 两页均加载1086×1448原图，小屏上一页／下一页可用 | `reader-small.jpg` |
| 《先合上电脑》 | 两页可读，放大模式适应桌面高度完整显示 | `picturebook-desktop.jpg`、`zoom-desktop.jpg` |
| 设定图集 | 背景展开／收起、三视图六项筛选、场景三项筛选、大图可打开；修正后的包与脚部构图生效 | `background-mobile.jpg`、`turnarounds-mobile.jpg`、`art-zoom-mobile.jpg`、`scene-mobile.jpg` |
| 共同记忆 | 原漫画示例仍可全屏打开与返回；长期记忆区保留。该独立验收来源0条记忆，未给真实用户记忆写入测试数据 | `memories-mobile.jpg` |
| 浏览器错误 | 最终构建阅读过程中console error为空 | CUA读取结果 |

旧记忆修正／锁定／删除逻辑保持原样；本轮未在真实用户数据上操作CRUD。已有迁移、存储与角色保留测试通过，但不把这等同于真实设备操作验收。

## 剩余边界

- 本轮完成鹿芽的首批素材包与本地Web阅读体验，尚无iPhone真机对本次构建的验收；触摸滚动、系统字体、Android返回等需要原生设备复核。
- 真实模型测试未运行。未推进AI关系、实习或生活运行状态，新增故事没有进入AI提示词和长期记忆。
- 三视图背／侧面、匿名地点与道具是依据已认可正面形象作出的创作补充；这一批新图和故事仍需作者审阅，不冒充全IP已最终定稿。
- 新开Metro开发端口因`EMFILE: too many open files, watch`失败；用Expo完整导出验证与展示，桌面启动脚本亦走完整导出。
- 未发布网页、提交或推送；既有未提交工作保留。
