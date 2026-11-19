# AIES v0.6 当前状态（2026-11-19，真机证据归档后）

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
