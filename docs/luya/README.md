# 鹿芽本地开发交付

2026-09-30。由人物与模型、生活与房间、理解与迁移三个子任务并行完成，主任务集成和页面实测。保留项目原有未提交改动；本次没有推送、部署或替用户勾选最终验收。

## 打开和验收

双击桌面 **鹿芽-启动预览.command**。它先构建当前代码，再用 Comet 打开 `http://127.0.0.1:4177`，关闭终端会停止本次启动的服务器。首次可选“先看看房间，稍后连接”；实际聊天在设置中连接模型。构建不会把本机 `.env.local` 的模型密钥打入 Web 包。

- [逐项验收表](acceptance-report.md)：A01–L10 共 118 个编号项目；原清单另有 3 个最终结论框。
- [原始验收清单](source/acceptance.md)、[原始开发规格](source/specification.md)：保留用于核对。
- [真实模型记录与失败复测](evidence/model-review.md)。模型测试和 UI 模拟服务分开：截图中带“UI 测试用模拟回复”的文字只用于验证按钮与持久化，不能证明人物语气。

复现工程验证：

```bash
cd /Users/eee/Desktop/code/bcmp_cyber_lover
npm run verify
node scripts/verify-luya-life-replay.js
node scripts/verify-luya-migration.js
node scripts/build-luya-preview.mjs
```

真实模型联网验收单独运行，使用本机已有配置并产生调用费用：`LUYA_LIVE_MODEL=1 npx vitest run tests/luyaModelAcceptance.test.ts`。默认 `npm test` 跳过联网测试。

## 实现与数据结构

- `src/config/luyaPersona.ts`：官方人物事实、关系规则、状态与六个场景锚点；Prompt 最终拼装与用户编辑层分离。
- `Character.luyaPersona`：v2 迁移时间、旧定义快照、用户覆盖字段和逐字段迁移日志。
- `Character.luyaRuntime`：v1 的 life（日程与有来源事件）、relationship（阶段与证据）、room（所有权、物品来源与协商）、boundaries（持久边界）、understandings（候选和用户确认）、understandingObservations（仅观察）。保存在原角色记录中，也进入现有备份导出。
- `luyaLifeService`：上海时区每日计划、已发生事件、最多补算最近 3 天离线生活，首页/聊天/日记共用。生成的是虚构角色生活；不会写成用户共同经历，也不会自动获得真实企业 offer。
- `luyaRelationshipService`：多日、多种事件与确认共同驱动阶段；消息数量、缺席、装修不合口味不扣分或自动亲密。旧 intimacy 数字保留用于兼容，普通鹿芽界面显示新关系阶段。
- `luyaRoomService`：三类所有权、私人区协商、重要物品确认、真正保存过的双方对话作为共同纪念物来源。
- `luyaUnderstandingService`：先自然询问，话题结束后才出卡；只在确认后进入相关情境召回。可改写/不保留/撤销，记录支持、反证、历史和影响范围；不推断心理诊断、政治立场等敏感标签。
- `luyaResponsePlanningService` / `luyaStateEvidenceService`：当轮回应顺序、能力限制、情绪主语和事实来源，可在调试快照核查。

## 无损升级

角色 ID 保持 `qingning`。首次写入升级角色前，将原 `@bcmp_characters` 字节完整备份到 `@bcmp_luya_pre_v2_characters`；备份失败会中止升级。仅与已知旧预置值精确相等的字段替换为新默认值，用户修改单独保留。编辑器异步备份后会重新取最新运行状态，只应用设定字段，避免覆盖刚新增的聊天生活数据。

没有清理 AsyncStorage、旧消息键或文件备份。三条聊天恢复来源仍是 `@bcmp_chat_db_v1_${characterId}`、`@bcmp_messages_${characterId}` 与 `bcmp-chat-backups/`。历史记忆、日记和关系事件不再按数量静默截断。其他预置角色及自定义角色仍可通过设置页底部版本文案长按进入开发者模式查看。

[升级前后对比](evidence/migration-comparison.json) 是实际运行迁移函数得到的隔离测试数据：135 条记忆、145 条日记、140 条关系事件、纪念日、用户编辑、原亲密度与旧关系状态保持相同哈希；纪遥/凛夜/自定义人物不变。真实 store 的写入顺序、磁盘失败、重载与并发保护另由 `tests/luyaStore.test.ts` 检验。**未读取或迁移用户真机私有历史，因此真机升级验收仍需在备份后进行。**

## 已验证与边界

- 全量工程日志：[engineering.log](evidence/engineering.log)，包含类型、零警告 lint、单元测试、消息排序、调试时间、素材与兼容检查。
- [14/30 日回放](evidence/life-replay.json)：逐日 JSON 恢复一致、未来事实不泄漏、离线补算有界、物品有来源。属于引擎时间回放，不冒充真实等了 30 天。
- Web 实测：首页与房间人物图片、公共区装修与异议、私人区保护、400×659 小屏、理解卡片改写/来源/撤销及重载。截图在 `evidence/`。
- 实习推进目前由开发者在房间中选择已发生的真实双方对话逐阶段确认；不靠离线日期自动获得企业经历。
- 调试时间可以向前推进；早于已保存 runtime 时间时阻止写入和未来事实投影，不提供完整历史状态回放界面。
- 没有已启动的原生模拟器；本轮以 Web 真实渲染验证界面，未证明 iOS/Android 真机通知送达、后台生命周期和真机旧数据升级。通知关闭逻辑已接入取消排程，K05 仍需真机确认。
- 生成模型的样本通过不能保证所有生成；L 组整体语感、长期关系自然度须由用户确认。保留失败原始输出，针对失败修复后记录复测。
