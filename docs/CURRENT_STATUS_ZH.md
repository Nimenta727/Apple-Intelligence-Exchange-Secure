# AIES v0.6 当前状态（2026-11-19，真机证据归档后）

> **2026-11-20 11:25 最新真机结论：v0.7 63 已失败并默认禁用，推荐恢复 v0.6 62 LOCAL。** 在六次 Siri 主请求中，63 的 DeepSeek 请求、合成 SSE 生成和 Shadowrocket 提前返回均成功记录；然而 Siri UI 均未得到 DeepSeek 答案，并且未观察到 session followup 请求。不能把 `LOCAL_SSE_RESPONSE_READY` 视为客户端接收成功。v0.7 请求优先架构仅保留供研究，仍需有设备证据才能确定拒绝发生在应用层还是合成协议层。详见 [问题复盘与后续方案](routine/2026-11-20-11-25-v07-synthetic-sse-real-device-failure.md)。

> **真实功能状态：实验性 Beta、已证实至少一次 Siri 可见 DeepSeek 标记，但复杂问题尚未稳定验收。** 60 模块的 Siri 请求解析在真机曾成功，DeepSeek API 曾至少一次进入有效响应的脚本处理路径，61 模块已两次观测真实 Qwen SSE，其中一次满足 60 严格预检。**最新 60 已至少一次在 Siri UI 显示带来源标记的答案，复杂问答仍待验证**。不要将离线 CI 或“Qwen 卡片出现”误写成完整成功。

## 一张表看清进展

| 层级 | 最新证据与结果 | 当前结论 |
|---|---|---|
| 模块分工 | 60 DeepSeek 改写、61 Qwen 原生只读诊断；设备必须互斥启用 | 两套模式已存在，不能同时启用 |
| Siri 组名 | `siri.multimodal.noRTI`，本机组名探针已验证 | 已知主要支持场景；其他 Siri 组未知 |
| Siri 请求格式 | 11:54、12:07 字段摘要和 12:26 一次性脱敏请求体 | 文本包络及主要元数据类型已掌握 |
| 请求解析 | 12:25 `REQUEST_CAPTURED ×4`、12:40 `REQUEST_CAPTURED ×2` | **至少六次成功解析**，不代表随后回答成功 |
| 请求—响应关联 | 12:40 一次 `RESPONSE_TAG_MISSING`、一次成功从 store 恢复 | **间歇性不可靠；未证实修复**，缺少可验证事务标识时仍失败关闭 |
| DeepSeek API | 12:25 一次 `DEEPSEEK_STARTED` + `DEEPSEEK_RESPONSE_ATTEMPTED` | 有一次脚本层有效模型输出处理证据；UI 未验证 |
| Qwen 原生响应 | 13:50 与 14:49 两次 HTTP 200、13 个 SSE JSON 事件、两次文本 delta | 真实主要 SSE 事件序列及字段类型已掌握 |
| 60 的 SSE 前置校验 | 14:49 `strict60Preflight=MATCHES_60_PREFLIGHT` | 对**该次**原生 Qwen 响应通过全部当前已知前置条件 |
| 合成 DeepSeek SSE | 本轮按真实字段类型补齐 Session/Response/Choice/Item/Content/Done，离线测试 | 代码和 mock 通过；真实 Siri 是否接受 **待测** |
| Siri UI 标识 | 新截图已显示 DeepSeek 来源标记，但底部 Qwen 服务标识仍在 | 不能推断哪些回答由哪个模型生成 |
| 安全限制 | 非纯文本、工具、审核分支拒绝；61 一律 `$done({})` | 保持失败关闭；系统级旁路仍可能显示 Qwen |
| 稳定版 | 无充分真机成功率和回滚验证 | **未发布** |

## 最新代码实际做了什么

1. 60 **不再只生成字段极简的 12/13 SSE 事件**，而是按已经从真机观察到的对象键名和数组结构构造所有回答承载事件；只复用上游有界 ID/时间及经限制的 Qwen 同域 continuation 元数据，所有回答文本由经过校验的 DeepSeek 输出生成。
2. 对 `notices`、`moderation`、工具调用、媒体内容的多处后期 SSE 位置增加了拒绝条件，防止错误的强制回答或 Qwen 数据泄漏。
3. 原有的不可混淆请求关联保护未被弱化：必须有有效 Header+本地 store，或同一响应 Hook 内完整且受支持的 Request body；同时有两者时必须一致。缺失两者则 **502，不猜“最后一条问题”**。
4. 61 被动诊断代码仍然不改写请求/响应，不调用 DeepSeek，不将问答正文写入仓库或额外服务器；它仍是独立的、手动授权才采样的实验工具。

## 15:51 新真实设备记录与 60 轻量 Guard

原始 PacketTunnel 日志共 1,135 行：主请求 `REQUEST_CAPTURED ×5`；其中 `DEEPSEEK_RESPONSE_ATTEMPTED ×2`，`RESPONSE_TAG_MISSING ×2`，`ERROR_SSE_REWRITE_UNSUPPORTED ×1`。Siri 截图的正文出现 `DeepSeek · AIES`，表明至少有一次脚本生成的 DeepSeek 文本进入可见界面；但系统卡片底部仍标“千问”。

本机 `proxy-2026-11-19-155107.db` 共 40 条代理记录；7 条为目标 Qwen 主机，其中 5 条是原先覆盖的主接口，2 条是之前未覆盖的 `/v1/sessions/{id}/responses`。新增第三条响应 Hook 只对这条会话级 URL 的 Siri SSE 回包返回 502；不覆盖整个域名。这能减少部分 Qwen 原文穿透，但可能提高复杂问题失败率。

主请求的跨 Hook 自定义 Header 丢失仍属未解决 P0。主 SSE 解析器增加合法分帧兼容，DeepSeek 最长 1000 token、等待上限 15 秒，成功回答的正文与 summary 都有来源标记。按用户要求本轮不进行人工或真机测试。

## 建议查阅顺序

- [一日全部调试时间线与 PR #17–25](DEBUG_HISTORY_2026-11-19_ZH.md)
- [真实 Siri → Qwen 请求 JSON 结构](OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md)
- [真实 Qwen 13 事件 SSE 响应结构](OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md)
- [根因、信任边界与遗留 P0](ROOT_CAUSE_DECISIONS_2026-11-19_ZH.md)
- [真机验收矩阵和回滚](VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md)
- [安装 60](INSTALL_SIRI_DEEPSEEK_V06_ZH.md) / [被动 61 指南](QWEN_PASSIVE_DIAG_ZH.md)

**补充边界**：无法证明 Shadowrocket 在所有连接阶段都把临时请求 Header 原样带入 Response Hook；这依赖真实设备而非 Node mock。若要继续验证来源和显示效果，使用少量不涉及个人信息的 Siri 测试即可；不需要重复向仓库提交 PacketTunnel、代理数据库或私密请求值。

## 16:15 复杂问题仍不稳定：新增 A/B 可比性实验

最新 `PacketTunnel-20261119161456.log` 共有 **2,987 行**，主接口四次请求中两次最终提交 DeepSeek SSE、一次关联标记丢失、一次上游 SSE 严格校验失败。四次会话级 Qwen SSE 被 60 新增 Guard 主动拦截。对应代理数据库有 175 条记录，其中四条主接口 Siri 记录、四条会话级 Siri 记录。**这提示轻量屏蔽会破坏部分复杂会话的后续流程，但不证明所有失败都只因 Guard。**

新增[同题 A/B 实验](AB_SIRI_QWEN_DEEPSEEK_COMPARISON_ZH.md)：(A) 60/61 全关闭基线，(A') 61 只读采集真实 Qwen 可见答案与 SSE，(B) 60 记录 DeepSeek 模型完成原因/用量/正文、合成 SSE 和失败阶段。所有数据只在用户手动授权的 600 秒窗口本机保存，官方密钥/原始请求/响应 Header 不采集。此功能与修复复杂问题是不同任务。

## 17:04 三条复杂请求的新协议变体

原始 Qwen 上游均为 HTTP 200，SSE 事件数约 26/24/24，新增 `text.annotations[].added`（引用注释）。第一条 `RESPONSE_TAG_MISSING` + `ERROR_PROMPT_UNAVAILABLE`，另两条 `ERROR_SSE_REWRITE_UNSUPPORTED`；**没有任何一次进入 `DEEPSEEK_API`**。因此问题首先发生在 AIES 的关联与预检阶段。新代码将处于已观测合法位置的注释事件丢弃后合成 DeepSeek SSE，防止 Qwen 注释文本泄漏，仍待 Siri 真机验证。3 份 PacketTunnel 中，实验1 是未执行 AIES 的基线，实验2 实际启用 61，实验3 实际启用 60（而所开启的采集脚本是 61 原生探针）；因此**还没有合格的 A' 与 B 同题答案文本对照**。详见 [routine 日志](routine/2026-11-19-17-12-Siri-complex-annotations-ab-diagnosis.md)。

## WritingTools Compose Beta：外部技术社区逆向适配（2026-11-19）

之前两份日志确定 UA 为 `WritingTools`，但旧 60 输出 `WRITINGTOOLS_SKIPPED`，不会进入模型。根据 SAIR 公开逆向的场景识别与 `{body,refinements}` 输出，新增**精确 `compose_selectedAndAllText`、纯文本、WritingTools UA** 分支；Siri 使用既有 `{content,suggestions,summary}`。两种客户端的本地请求关联增加 `scene`，严禁混用。**当前仅有外部逆向和离线测试条件，尚未通过此用户设备的 WritingTools 完整 JSON/SSE 或真实 UI 验收**。跨站社区分析详见 [研究表](COMMUNITY_APPLE_INTELLIGENCE_REQUESTS_2026-11-19_ZH.md)。

## 22:05 PR #31 已合并：WritingTools 响应场景的受限恢复（仍是 Beta）

- [PR #31](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/31) 已合并至 `main`（`61b6112f1f912f6f918b15f3d0912474bbee4574`），GitHub Actions [检查](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/actions/runs/44539513032) **93/93 tests 通过**。
- 60 的三条 Hook 统一固定到新增的 `975599163bafeb8c6ba8aa60624577e2a861d9f0` 脚本提交。若响应阶段的 `User-Agent` 被 Shadowrocket 省略，但请求阶段的有效同事务 `X-AIES-Request-ID` 仍存在，则恢复存储的 WritingTools/Siri 场景；明确冲突 UA、不同请求正文、过期或缺失关联仍失败关闭。
- `WRITINGTOOLS_COMPOSE_SCOPED` 现在只在请求通过确切 Compose 纯文本 schema 校验后出现，且新增 `WRITINGTOOLS_SCENE_RECOVERED_FROM_TAG` 作为受限恢复的固定诊断码。
- 本次修复**并未证明**响应阶段真的有 UA 丢失，也**不能解决 token 也丢失的情形**；真实 WritingTools Qwen 协议、SSE 和编辑器显示继续待真机验证。61 提供只读、手动开启、仅保存字段类型与事件名称的 WritingTools 探针。完整维护记录：[PR #31 代码和测试](routine/2026-11-19-22-00-WritingTools-response-UA-recovery.md)。

## 23:49 Siri 后续追问失败：两份新设备日志与 PR #32 诊断工具

两份只开启 60 的 PacketTunnel 日志显示 10 次 `REQUEST_CAPTURED`、8 次 `DEEPSEEK_RESPONSE_ATTEMPTED`、2 次 `ERROR_PROMPT_UNAVAILABLE` 和 7 次 `QWEN_SESSION_FOLLOWUP_SSE_BLOCKED`。**用户真机观察到只有第一问显示 DeepSeek**，但模型脚本确实多次产生了新答案；最终 Siri UI 是否接收改写响应不能靠日志推断。阻断 Guard 导致会话级 502 是需要验证的重要问题，但并未证明它是所有失败的唯一原因。

[PR #32](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/32) 已合并到 `main`（`49c7556b921525319e6e89bda5ab39e6c18b3aff`），GitHub Actions 96/96 模拟测试通过；新增可手动开启 600 秒、只记录字段类型与 SSE 事件的 61 Siri followup 探针和 `siri_followup_schema_probe_ONCE.js` / `STOP_ONCE.js`。61 四条 Hook 新 pin：`506e51ad1ad549722242611f174b527cc12c4d21`。**60 仍保持旧的 Guard 和单轮适配，不声称修复多轮。**

下一步必须由用户在设备上使用 61（关闭 60）进行一次不含私密内容的连续两问会话级 schema/SSE 采样，再决定如何进行支持同事务关联的后续 DeepSeek 重写。详情 [61 诊断指南](QWEN_PASSIVE_DIAG_ZH.md) 与 [维护记录](routine/2026-11-19-23-49-Siri-multi-turn-followup-502-diagnostics.md)。

## 2026-11-20：Siri followup 真实协议已采样，四 Hook DeepSeek Beta 进入 CI

用户本人已运行新版 61 `siri_followup_schema_probe_ONCE.js`，输出 `CAPTURED_LOCAL_PROTOCOL_SCHEMA`、`RECORDS=2`，一条会话级 Siri 请求（`siri.multimodal.noRTI`、`previous_choice_id:string`）和一条 HTTP 200 SSE 响应（共 18 帧，开头 `session.response.created`、4 个 delta、4 个注释、0 解析失败），并经本地清理。**这些是事实，不代表原生 Siri 已成功接受合成 SSE，也不代表两条诊断记录已被严格证实属于同事务。**

基于该结构，新增 60 四 Hook 续答 Beta 适配：严格解析 previous_choice / session、临时 tag 关联与短期同会话 DeepSeek-only 历史、支持 followup SSE 不存在 session.created 的事件序列、丢弃原生引用、失败关闭；拒绝跨会话与非纯文本。主接口/WritingTools 的行为保留。CI 与 PR 发布状态以 GitHub Actions 为准，**真机多轮验收仍待用户执行**。完整记录见 [routine](routine/2026-11-20-00-25-Siri-verified-followup-DeepSeek-beta.md)。

## 2026-11-20 最新：PR #33 已合并，106/106 tests 通过，真实多轮 UI 仍待验收

[PR #33](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/33) 已合并（`345ec50c45c8966ed3ad5ec005148ba3203318cc`），[CI](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/actions/runs/44567918717) 通过 106/106。60 四条 Request/Response Hook 统一固定 `7a698fbaadeb37431d9bd1d43df359292ee78ba0`；61 四条保持 `506e51ad1ad549722242611f174b527cc12c4d21`。最新 60 会尝试将同一 Siri session、可信 choice / tag 的后续纯文本请求重写为 DeepSeek 回答并保留最多三轮短期本地对话上下文；不具备可靠关联时仍失败关闭。用户当前仅完成 61 的真实 followup 结构诊断，**尚未安装并验收此新版 60 的第二问/第三问实际显示**。这不是稳定版，短期本地历史的逻辑 TTL 也不等于物理清除。详见 [维护记录](routine/2026-11-20-00-25-Siri-verified-followup-DeepSeek-beta.md)。

## 2026-11-20 00:47：用户真机 60 发生远程脚本更新 CFNetwork 310，Qwen 原生透传

用户提供四张截图显示 60 对 `raw.githubusercontent.com` 固定脚本 `7a698fba...` 反复下载失败（`kCFErrorDomainCFNetwork Code=310`，即 HTTPS 代理连接失败）、`script exception`，随后请求与响应发出。在截图范围内没有 `[AIES_V06] REQUEST_CAPTURED` 或 `DEEPSEEK_STARTED`；因此当次 Qwen 穿透首先是**脚本未正常加载**，尚不能判断新四 Hook 多轮解析代码能否成功。

[PR #34](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/34) 已合并（`909f2169ed404b1bd9e74156af8959e85f798fe9`），[CI](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/actions/runs/44571160641) **107/107 pass**。新增与 60 互斥的 [62 LOCAL 模块](../shadowrocket/62-AIES-SIRI-DEEPSEEK-V06-LOCAL.sgmodule)：使用四条相同 HTTP Hook，但从设备本地 `Script/aies_siri_deepseek_v06.js` 加载固定 `7a698fba...` 版本，以避免 GitHub Raw 在运行时失败。**本地路径仍待用户 iPad 验证**，不能宣称修复或系统级零 Qwen。步骤及边界见[安装说明](INSTALL_SIRI_DEEPSEEK_V06_ZH.md)和[维护记录](routine/2026-11-20-00-47-Shadowrocket-runtime-CFNetwork-310-local-fallback.md)。

## 2026-11-20 10:01：多轮 Siri 真机 `previous_choice_id` 类型不匹配（PR #38 已合并）

来自用户新上传的 `PacketTunnel-20261120100109.log`：62 LOCAL 已可靠执行单轮 DeepSeek 改写尝试；但 5 次后续会话请求均在 `FOLLOWUP_PREVIOUS_CHOICE_NOT_STRING` / `ERROR_UNSUPPORTED_SIRI_REQUEST` 阶段被拒，未调用第二轮 DeepSeek。不能从 `NOT_STRING` 直接判断是 JSON null、字段缺失还是其他非字符串。现已通过 [PR #38](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/38) 合并严格的 same-session `previous_choice_id` **null/缺失/空字符串**本地 DeepSeek 历史恢复，其他非法类型继续 fail closed；[CI](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/actions/runs/44658856364) **115/115 tests passing**。60 Remote 四条 Hook pin `c3a7014cdd8ec47841001748c615e704059d9370`；62 LOCAL 的 Script 路径保持不变，但**必须人工覆盖本地 JS 内容至该固定版本**。新日志分类用于识别真实情况，**Siri 真机连续多轮仍未验收**。详情见 [routine](routine/2026-11-20-10-01-Siri-followup-null-missing-choice-id.md)。

## 2026-11-20 10:32：多轮已可连续改写，但配置组与事务关联造成间歇失败（PR #39）

用户真机 `PacketTunnel-20261120101542.log` 中出现 16 次缺失 `previous_choice_id` 的同会话 DeepSeek 上下文恢复和 23 次 `DEEPSEEK_RESPONSE_ATTEMPTED`；但还有 **9 次后续配置组未验证、1 次主请求配置组不支持、5 次响应事务标记丢失**。其中多个成功的后续问题连续发生，证明新多轮路径至少能实际触发；不等于 Siri UI 每次成功。用户观察“请问一下千问”开头成功率高，但日志无法把具体问句与组名关联，不能宣称这是稳定系统路由规则。

[PR #39](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/39)（merge `5922d93ca49064c378ca8c1d8eb88adff20d355f`）把已知 `siri.tqa` / `siri_tqa` 组纳入**严格同会话、同原生 SSE 校验的纯文本 followup**；其余未知配置组继续拒绝，但新增固定类别码以定位差异。不更改首次请求 `RESPONSE_TAG_MISSING` 的 fail-closed 行为，也不通过全球“最近提问”猜测关联。CI [120/120 passed](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/actions/runs/44662425802)。60 Remote 四条 Hook pin 到 `637484295c10627f06e610bfe040dd58e67d309a`；62 LOCAL 用户须手工更新同 SHA 本地 JS。详情见 [维护记录](routine/2026-11-20-10-32-Siri-phrase-sensitive-group-and-response-tag-diagnosis.md)。多轮成功率和 Siri UI 真实结果仍需使用新 JS 确认。

## 2026-11-20 10:32：新 v0.7 请求优先执行基座，非默认版

基于 10:15 / 10:44 iPad 真机日志里未知 Siri followup 配置组与新连接首次响应丢失 `X-AIES-Request-ID` 的问题，独立新增 [63 请求优先 LOCAL 实验模块](../shadowrocket/63-AIES-SIRI-DEEPSEEK-V07-REQUEST-FIRST-LOCAL.sgmodule)。它仅采用两条请求 Hook，将 DeepSeek 回答生成与合成 12/11 帧 SSE 收敛在单次 Hook 内，不等待 Qwen 原始响应，也不依赖跨 Hook 请求头。严格文本、同 URL session 的本地已验证历史、未知组结构门控和 fail-closed 保持；其他非 Siri 流量旁路。与 62 稳定版互斥。**真实 iPad Siri UI 对合成 SSE 的接受情况仍未知；绝不能视为已经修好稳定性。** 安装/回滚见 [v0.7 指南](INSTALL_SIRI_DEEPSEEK_V07_REQUEST_FIRST_ZH.md)，修改/后续验收见 [routine](routine/2026-11-20-10-32-v07-request-first-siri-engine-refactor.md)。

## 2026-11-21 00:34：新增 64 真实会话 SSE 协议验证版（不覆盖 62）

按照用户的连续对话协议研究方向，新建 [64 LOCAL v0.8](../shadowrocket/64-AIES-SIRI-DEEPSEEK-V08-NATIVE-SESSION-LOCAL.sgmodule)，严格利用上游 Qwen 的**真实**会话 SSE，而非 63 失败的伪造会话。新增分层请求场景分类、状态事件序列和 delta/done/终态文本一致性校验、响应模型及 session/response/choice 身份保留、基于可信开始时刻的分段时延诊断。未知组/视觉保持未支持；缺失事务 tag 且无可信本次请求正文时仍拒绝，不引入 SAIR 的全局最新提问回退。**64 全部四条 Hook 默认关闭；62 当前可用版、63 禁用版均未修改；尚无真实 Siri UI 验收，不能说稳定性已修好。** 参考 [新指南](INSTALL_SIRI_DEEPSEEK_V08_NATIVE_ZH.md) 及 [routine](routine/2026-11-21-00-34-AIES64-native-session-protocol-rebuild.md)。
