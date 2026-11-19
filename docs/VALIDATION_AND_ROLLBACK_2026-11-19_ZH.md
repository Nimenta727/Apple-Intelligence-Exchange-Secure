# 60 改写 / 61 被动诊断：测试矩阵与回滚手册

## 0. 当前验收口径

> 此文档定义**尚未完成的真机验收标准**，不表示测试已全部完成。CI 只能证明模拟 HTTP Hook 与已观测 SSE 字段结构下的函数行为，**不能证明真实 Siri 原生 UI 能成功展示合成 DeepSeek 文本**。

**验收成功必须同时满足**：目标 Siri 问题正常被请求 Hook 解析、关联到**同一事务**、原生 SSE 预检通过、DeepSeek API 正常返回、60 构造完整 SSE、Shadowrocket 成功向客户端提交、**Siri 真正显示带 `【DeepSeek · AIES】` 的答案正文**。仅有 Qwen 卡片品牌、`DEEPSEEK_STARTED`、`DEEPSEEK_RESPONSE_ATTEMPTED` 或模型 HTTP 200 均不算完成。

## 1. 安全基线和设备准备

1. 在 Shadowrocket 备份原有模块配置；确认旧同域 `00 REJECT`、其他 Rewrite/脚本不会与当前目标冲突。
2. **原生基线**：停用 60 和 61（不启用诊断），问 Siri 一次非隐私纯文本问题，记录 Siri 是否能正常用原生 Qwen 回答。若失败，优先处理网络/系统集成，不要把它算作 DeepSeek 代码错误。
3. **被动基线**：可选启用 61（两钩子 `$done({})`，只读结构），60 仍保持停用；同样用一个简单问题验证流式回答是否正常。诊断后关闭 61。
4. **60 改写模式**：**确保 61 已关闭**，仅启用固定 SHA 的 60；保持目标 HTTPS MITM、脚本 URL 和本机 DeepSeek API Key 设置正确。不要扩大 MITM 域名。
5. 不应在多次重试之间同时开启几套同域诊断器，以免两份脚本同时处理响应体或写入不同本地状态。

## 2. 真机测试用例

| ID | 场景 | 预期行为 | 可认定结果的证据 |
|---|---|---|---|
| L1 | 原生 Siri→Qwen，60/61 均停用 | Qwen 能正常答复 | Siri 实际显示 |
| L2 | 61 被动只读，60 停用，单条纯文本 | 仍可正常原生答复；SSE 结构一份 | `REQUEST_SCHEMA_CAPTURED_LOCAL`、`RESPONSE_SSE_SCHEMA_CAPTURED_LOCAL`；原生 Siri 实显 |
| L3 | 60 单个纯文本问题（短问） | DeepSeek 正常回答，正文出现来源前缀 | `REQUEST_CAPTURED`、`SSE_PREFLIGHT_PASSED`、`DEEPSEEK_STARTED`、`DEEPSEEK_LABEL_APPLIED` 与 Siri 实显 |
| L4 | 同环境中的长答案/多行段落 | SSE JSON 转义正确、无 502 | Siri 实显正确换行与来源前缀 |
| L5 | 连续单题 3–5 轮（非并发） | 关联稳定，错答和上下文串线为 0 | 每轮来源前缀及固定状态码；无 `PROMPT_UNAVAILABLE` |
| L6 | **并发**两个不同的无隐私提问（受控测试） | 不能把 A 答案配给 B | 若无法安全关联，宁可拒绝，也不能显示另一问题的回答 |
| L7 | WritingTools 已知 Compose 纯文本 | **Beta**：精确 `compose_selectedAndAllText`，模型成功时生成 `body/refinements` 且 Siri 回归不受影响 | `WRITINGTOOLS_COMPOSE_SCOPED`、`WRITINGTOOLS_DEEPSEEK_PAYLOAD_READY`、编辑器实际显示（**真机待验**） |
| L7b | WritingTools 未知组/媒体、其它非 Siri 同域事件 | 未证实场景不向 DeepSeek 转发，失败关闭；同域非 Siri 仍不接受 | `REQUEST_DIAG_WRITING_*` 或 `REQUEST_DIAG_GROUP_UNSUPPORTED`，无模型调用 |
| L8 | 工具/音频/图片/未知组名 | 安全拒绝，不转发私密或非文本数据到 DeepSeek | 固定 `REQUEST_DIAG_*` 或错误码 |
| L9 | 原生 SSE 内含审核/通知或工具事件 | 不输出伪造正常 DeepSeek 答案，不含原 Qwen 正文 | 502 和固定错误码；无模型调用 |
| L10 | DeepSeek 超时、非 200、空回答 | 固定失败关闭，不以 Qwen 回答冒充 DeepSeek | `ERROR_MODEL_*`，无来源标记 |
| L11 | 关闭 MITM 或 60 脚本失败 | 检查可能有 Qwen 系统级回退 | 只记录实际 Siri UI，不声称系统级禁止 Qwen |
| L12 | 目标主机外的普通流量 | 不匹配、无副作用 | 普通 App/网络功能保持正常 |
| L13 | iPad 休眠、VPN 重连、HTTP 连接待发路径 | 查明关联 Header 是否被保留 | `RESPONSE_TAG_* / RESPONSE_PROMPT_*`，无串答 |
| L14 | Shadowrocket Script 更新错误 | 不使用未经核对的旧缓存误判版本 | 比对两条脚本 URL 的完整 SHA、Github Raw 加载状态 |

**真机测试记录模版（只填非敏感内容）：**

```text
日期/时间（设备时区）:
系统版本（只写主/次/补丁版本）:
Shadowrocket 模块: 60 / 61 / 两者均停用
60 runtime SHA（只写前 10 位）:
61 runtime SHA（只写前 10 位）:
是否存在旧 REJECT/同域冲突: 否 / 不确定
Siri UI 实际表现: 带 DeepSeek 来源的回答 / Qwen 原生回答 / 无法获取回答 / 其他
AIES 固定诊断码（只写名称，按时间排序）:
是否与预期一致: 是 / 否 / 未证实
公开备注（不写提问原文、IP、手机号、API Key 或 request ID）:
```

## 3. 离线回归覆盖

现有 Node `npm run check`、`npm test` 测试应覆盖：

- noRTI 和旧版 `siri.tqa` 的纯文本及未知字段/角色/媒体拒绝；
- 双 HTTP Hook 的请求/响应分段、每条请求独立随机 token、持久化读/清空、并发正确关联与孤儿响应失败；
- SSE 原始帧格式、事件名称/序列、Session ID 关联、时间戳、**多个文本 delta**；
- 合成 SSE 的完整 Session/Response/Choice/Item/Content/Done 字段，以及 `annotations:[]` 等与真实 Qwen 摘要一致的形状；
- Qwen 原文不会出现在合成 SSE 的任意答案路径；非空 `notices/moderation`、工具输出绝不生成正常 DeepSeek 答案；
- DeepSeek 非 200、网络异常、非 stop、超时、空回答时只有固定错误；
- `【DeepSeek · AIES】` 仅在模型验证及 SSE 完整生成成功时出现，多行回答不因 JSON 转义而 502；
- 61 请求/响应永远 `$done({})`，默认不开启、600 秒一次性手动采样、只保存字段名/类型及 allowlist 系统版本、不读写真实文本值；
- 文档相对链接、两模块互斥说明、模块双钩子同一固定完整 SHA、不得出现原始 Token 或私密抓包。

**无法从离线测试证明的事项**：Shadowrocket 的 Header 传递、WebView/JSC 运行差异、实时 SSE 时序、服务端模型响应合法性、Siri 系统 UI 的业务逻辑。测试出错时必须记录是哪一层，不应通过放宽全部校验来“修”通过率。

## 4. 如何安全分享日志

只分享 `[AIES_V06]`、`[AIES_QWEN_PASSIVE]` 的**固定状态码**、手动辅助脚本的**经过本地审查的字段类型结构**；不要分享 PacketTunnel 整份原文、代理数据库、认证 Header、Cookie、Qwen 及 DeepSeek API Key、设备地址、session ID、原始 SSE、私人 Siri 问句、音频附件。若需要调试新字段，优先扩展**默认关闭且只记录结构类型**的一次性探针。任何异常的私密字段名必须遮挡。

## 5. 回滚策略（优先恢复正常 Siri）

- **立即停止实验 DeepSeek 改写**：禁用 `60-AIES-SIRI-DEEPSEEK-V06.sgmodule`；确认旧 REJECT 关闭。
- **恢复纯原生 Qwen**：禁用 `61-AIES-QWEN-PASSIVE-DIAG.sgmodule` 和其它同域 Hook，确认 Siri 能按系统默认路径正常回答。
- **停止诊断采样**：手动运行相应的 `*_STOP_ONCE.js` 清理本地活动状态。需要时再关闭目标域 HTTPS MITM（注意不要影响用户其他需要的代理设置）。
- **保留证据但不留私密日志**：只记录失败的固定诊断码、模块固定 SHA、Siri 显示现象。没有必要再次上传包含凭据的 PacketTunnel。
- **恢复到实验版旧逻辑（不推荐）**：GitHub 的已合并 commit 可以用于审计/重现，但已确认旧版合成 SSE 结构不充分，不能仅为回退而宣称“更稳定”。

## 6. 升级与关闭条件

升级到“端到端已验证”之前，必须有至少一条真实 iPad Siri 完整闭环（包括原生界面显示带来源前缀的 DeepSeek 文本）；对生产可靠性则需要更多轮独立测试，特别是请求转发待发路径和并发场景。若 `RESPONSE_TAG_MISSING` 重复出现且没有 Request body，按 [根因决策](ROOT_CAUSE_DECISIONS_2026-11-19_ZH.md)继续维持失败关闭，直到找到可验证的跨 Hook 关联能力。

相关：[全部调试历史](DEBUG_HISTORY_2026-11-19_ZH.md)、[请求协议](OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md)、[SSE 响应协议](OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md)。

## 2026-11-20 新版 60 四 Hook 多轮验收（替代历史 Guard-only 检查）

当前 60 是主 Request / Response 加 session followup Request / Response **四条 Hook**，共同 pin `7a698fbaadeb37431d9bd1d43df359292ee78ba0`。此前“只需三 Hook、followup 永远返回 502”的测试流程描述属于旧版本。先保证 61/旧 REJECT 同域规则关闭。

最小验收：**同一次 Siri 交互中连续问两次普通纯文本问题，再验证三轮**。每轮都应在 Siri UI 实际显示 `【DeepSeek · AIES】`；仅见 `DEEPSEEK_RESPONSE_ATTEMPTED` 不算通过。验证每轮固定日志 `REQUEST_CAPTURED`、`SSE_PREFLIGHT_PASSED`、`DEEPSEEK_STARTED`、`DEEPSEEK_RESPONSE_ATTEMPTED`；第一轮应有 `SIRI_CONTEXT_STORED`，后续若 `FOLLOWUP_CONTEXT_UNAVAILABLE`，优先检查前轮 DeepSeek choice 与 followup previous_choice_id 是否在**同一 session** 正确关联，而不是打印任何原始 ID。若后续只显示原生 Qwen、错误或无答案，**立即关闭 60 并恢复原生基线**，不要以未知 Qwen 数据透传代替修复。

隐私：新版为保障连续对话，会将少量原始问题和已验证的 DeepSeek 回答临时存于本机 `$persistentStore`，逻辑 TTL 5 分钟，不保证物理擦除；最多三轮历史随续答发往 DeepSeek。不要用私人问答开展这一轮 Beta 真机测试。
