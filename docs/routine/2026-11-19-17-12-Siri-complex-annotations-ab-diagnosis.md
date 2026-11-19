# 2026-11-19 17:12 (+08:00) — 复杂 Siri Qwen SSE 注释事件与 A/B 配置错位修复记录

## 本次用户提供的证据（只摘固定诊断/结构，不保留抓包原文）

- 本机附件 `实验1.log`（637 行，17:02:08–17:02:34）：包含 Siri 请求到 `/v1/sessions/responses`，未出现 `[AIES]` 诊断或脚本执行；可作为关闭模块时的**网络层**基线，日志自身不能证明 Siri UI 答案的具体正文。
- `实验2.log`（977 行，17:05:22–17:06:24）：实际使用的是 61 脚本（固定 SHA `52ae2a07...`），约三次 Qwen 主接口响应提交客户端；该期间未见 `[AIES_AB_NATIVE_LOCAL]` 的已捕获报告，无法得出 Qwen 真正回答文本或复杂 SSE 值类型。
- `实验3.log`（858 行，17:08:25–17:09:23）：实际运行的却是 60 脚本（当时 SHA `b2c2ff84...`），出现两次 `WRITINGTOOLS_SKIPPED`。17:09:06、17:09:07 脚本下载还出现网络错误 `310` 与超时 `-1001`。用户 17:08 手动打开的是 **61 原生 A/B 探针**，但活跃网络模块为 **60**，因此这个试验不能算 61 原生协议对照。
- 17:04 用户粘贴的 **60 DeepSeek A/B 本机手动读出**：3 条无隐私提问的结构类型相同，`promptChars=49`；原生 Qwen 3 条 HTTP 200 SSE 分别约 26、24、24 个事件，文本 delta 分别为 10、8、8。第一条在 `RESPONSE_TAG_MISSING`、`RESPONSE_PROMPT_BODY_UNAVAILABLE` 后 `ERROR_PROMPT_UNAVAILABLE`；第二、三条关联成功但 `ERROR_SSE_REWRITE_UNSUPPORTED`。**三条均没有 `DEEPSEEK_API` 采样事件或 `DEEPSEEK_STARTED`**，因此不能归因为 DeepSeek API 回答质量、输出长度或 `finish_reason`。
- 核心新增实证：复杂 Qwen SSE 在 `text.value.done` 与 `content.done` 之间出现多次 **`session.response.choices[].items[].message.content[].text.annotations[].added`**，此前 60 的已知事件白名单没有此类注释事件；这是至少一项确定的严格预检不兼容原因。因为 60 没抓原始 SSE 字节，**不能断言其它字段从未同时不兼容**。

## 本次 GitHub 代码修改

1. `scripts/aies_siri_deepseek_v06.js`：在 Siri/Qwen SSE 白名单新增**明确事件名** `text.annotations[].added`，且只允许它位于 `text.value.done` 和 `content.done` 之间；限定数量与外壳对象类型。读完后**直接丢弃注释内容**，不将 Qwen 引用文本、链接、其他上游信息写入合成 DeepSeek SSE；原有会话/响应 ID、SSE 顺序、工具/媒体/审核、DeepSeek 成功条件及失败关闭保持严格。
2. 对上游完整的纯文本 `item/choice/response.done` 中的 `text.annotations`，只接受有界数组并**不透传其内容**。未知工具和非文本场景仍直接拒绝。
3. `scripts/aies_qwen_passive_diag.js`：同步 61 的 `strict60Preflight`，与 60 的规范 SSE 分帧解析和新增 annotation 安全位置判断保持一致。它仍然只读 `$done({})`；输出仅是固定检查结果，不存原始注释值。
4. 增加 Node 复现用例：24/26 事件带引用注释的复杂 Qwen SSE 可安全合成 DeepSeek 回答，原 Qwen 引用文本和链接不会穿透；注释出现在未验证位置时继续拒绝；61 的 preflight 成功/拒绝结果与 60 保持一致。
5. 更新 60 三条 Shadowrocket Hook、61 四条 Hook 的完整不可变运行版本，相关文档与安全回归保持同步。
6. **不修改 P0 的请求关联策略**：真实 17:04 第一条 `RESPONSE_TAG_MISSING` 没有同事务请求正文，继续拒绝，不用最近一条/时间窗口猜测以免并发串答。

## 此次明确未声称

- 不能凭模拟测试认定 iPad Siri 复杂问题已稳定显示 DeepSeek。
- 不能把前一次诊断缺少 `DEEPSEEK_API` 解释为模型生成错误；模型当时根本没被调用。
- A 组关闭拦截后不能同时自动看到明文请求/SSE；A' 组只有在**61 实际启用**且**手动开启原生探针**时才有可比数据。
- 轻量 Qwen 会话级 Guard 还可能阻断复杂任务后续请求，本次没有取消它，需与 SSE 注释兼容性分开验证。

## 下一步规划

1. 合并前确认全部 GitHub CI、两套模块固定 SHA、只读行为、严格认证和文档链接；复查注释事件在测试中不会携带 Qwen 原文。
2. 设备更新两套模块后，**先只做 B 组**：仅启用 60、停 61、使用无隐私复杂问题，手动打开/读取 `ab_deepseek_trace_ONCE.js`。查看是否有 `SSE_PREFLIGHT_PASSED` 与 `DEEPSEEK_API`，并确认 Siri UI；若无，按固定失败码确定剩余阻塞。
3. 如仍需真正 A/B 对照：完全关闭模块做 A 原生 UI 基线；随后**仅启用 61** 再手动开启/读取 `ab_native_trace_ONCE.js` 做 A'。切换模块后先验证 Script URL SHA，不能在 60 活跃时把原生 A/B 探针开启结果当成 61 的采样。
4. 若 60 的 annotation 支持后仍出现 `SSE_REWRITE_UNSUPPORTED`，进一步增添一个仅输出**受限失败原因分类**的结构探针；切忌采集真实 Qwen 引用链接或原文作为“解决办法”。
5. 单独研究 Shadowrocket `save data to pending data` 路径中请求标记为何不传到响应阶段；未找到受支持的同事务关联方式之前继续 502 失败关闭。

相关：[全日历史](../DEBUG_HISTORY_2026-11-19_ZH.md) · [真实 SSE 协议](../OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md) · [同题 A/B 操作](../AB_SIRI_QWEN_DEEPSEEK_COMPARISON_ZH.md)。
