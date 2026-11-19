# AIES 当前维护、代码审查与发布流程

## 两条独立路线

**60**：`scripts/aies_siri_deepseek_v06.js` + `shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule`，实验 Siri → DeepSeek 问答改写。

**61**：`scripts/aies_qwen_passive_diag.js` + `shadowrocket/61-AIES-QWEN-PASSIVE-DIAG.sgmodule`，完全被动的原生 Qwen 结构采集（有手动授权窗口时才持久化）。

两套模块绝不能在设备上同时启用；旧的 `00 REJECT` 和任何同域 Hook 也必须关闭。**从 GitHub 删除旧模块不会自动删除 Shadowrocket 已导入配置。**

## 仓库开发命令

```bash
git clone https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure.git
cd Apple-Intelligence-Exchange-Secure
npm ci
npm run check
npm test
npm run docs:check
```

Node.js >=20；没有旧式 bundle 构建步骤。CI 检查 JS 语法、60 主双钩子模拟及第三条 Guard 的静态一致性、61 只读行为、失败/隐私/并发/SSE 场景、文档链接、模块固定 Git SHA 和文件清单。**全部通过后才能合并**，但仍须按[验收矩阵](VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md)另做真机检查。

## 代码修改原则

1. 先在 [调试史](DEBUG_HISTORY_2026-11-19_ZH.md) 确认真实失败码和脚本 SHA，再提出有限、可测试的修改。
2. 改请求解析时先比对 [实测 JSON](OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md)：仅支持经过证明的纯文本和类型，不盲目接受未知工具/媒体、隐藏 context。
3. 改 SSE 时先比对 [13 事件 schema](OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md)：**原 Qwen 答案在任意 `delta`、`done`、`output` 路径都不得进入新 SSE**；只复用有界的非答案元数据。
4. 改跨 Hook 关联时必须补**两个并发问题错配**的负测试。不能通过扫描 `$persistentStore` 选择“最新一条”解决 `RESPONSE_TAG_MISSING`。
5. 改 60 运行脚本后，必须将 **60 请求和响应的两个 `script-path` 都 pin 到同一个新不可变 commit SHA**，更新对应测试的 pin 和安装指南，检查历史缓存不会误执行旧版。
6. 修改 61 时同理同步两个 61 Hook；运行脚本任何异常必须 `$done({})`，不得主动上传、记录用户正文或调用 DeepSeek。
7. 各个 `*_ONCE.js` 和 `*_STOP_ONCE.js` 只能在 Shadowrocket **手动 Script Test** 使用，不能注册为 HTTP/event/cron 自动采样；首次开启、状态复查、过期、清理与存储失败都要覆盖测试。
8. 代码在 PR 分支完成、CI 成功后合并。**GitHub 主分支 CI 通过也不能代表真机 UI 兼容**；发布必须明确证据和未完成事项。

## 60 的第三条规则（2026-11-19 15:51）

60 现在不是只有两条脚本规则，而是两条主接口 Request/Response 改写钩子，加一条只处理 Siri `/v1/sessions/{opaque-id}/responses` 的 SSE 响应 Guard。三条规则必须使用同一个完整不可变 SHA；61 的两个只读 Hook 保持不变。Guard 可能增加 Siri 失败率，因此严格禁止升级为全域 `REJECT` 或把会话级请求直接猜测关联到主请求。

## 真实调试记录格式与隐私

以文件名和固定状态码做最小来源索引；不要上传原始 PacketTunnel、HTTP 头、Cookie、token、proxy 数据库或私密用户输入。当前已经积累的 15 份日志（含重复文件）已在 [调试史](DEBUG_HISTORY_2026-11-19_ZH.md) 中脱敏归档；不要将日志完整字节提交仓库。

## 快速回滚

先停 60，停 61，停旧 REJECT/冲突 Hook；根据原备份决定是否关闭对应域名 MITM，验证原生 Siri/Qwen，再重新选择调试模式。详细见 [验收与回滚](VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md)。

## 2026-11-19 同题 A/B 探针维护规则

60 的三条 Script Hook 均固定在同一运行脚本 SHA，新增 `ab_deepseek_trace_ONCE.js`/`STOP_ONCE.js`，状态键独立，默认关闭，仅当用户通过本地 Script Test 主动开启才在 10 分钟内采集固定状态码、SSE 事件/长度和经过限制的 DeepSeek 用户可见答案。61 的原主接口双 Hook 不变，另增两条会话级原样放行 Hook，总计四条均固定到同一脚本 SHA。`ab_native_trace_ONCE.js`/`STOP_ONCE.js` 用独立状态键采集原生 Qwen SSE 及用户可见的非私密测试答案。两种模式不能同时启用，新增脚本不能注册自动 HTTP/event/cron。完整流程见 [A/B 同题对照指南](AB_SIRI_QWEN_DEEPSEEK_COMPARISON_ZH.md)。
