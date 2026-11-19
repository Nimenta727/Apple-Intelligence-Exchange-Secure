# 2026-11-19 Siri → Qwen → DeepSeek 全程排障纪要

> 本文件以**用户设备已上传的 PacketTunnel 日志、手动执行的本地探针输出和 GitHub 已合并 PR** 为依据；按用户设备日志上的时刻记述（设备截图与日志时区可能与 GitHub UTC 提交时间不同）。**不存日志原文**：日志可能带 Cookie、Authorization、请求内容、代理路由及设备标识；仅摘取固定的 AIES 状态码、脚本版本前缀和验证结论。另有不确定内容单独标出。

## 1. 总体演进

| 阶段 | 设备证据与时间 | 定位/修复结论 | 性质 |
|---|---|---|---|
| A. 组名阻塞 | 09:30–10:49，多次 `REQUEST_DIAG_GROUP_UNSUPPORTED` | 初版 `siri.tqa`、`siri_tqa` 白名单缺少设备真实组 `siri.multimodal.noRTI`；随后从本机一次性组名探针确认 | 真实错误及本机探针 |
| B. noRTI 入参阻塞 | 11:06，2 次 `REQUEST_DIAG_INPUT_UNSUPPORTED` | 修复组名后并未自动支持真实 JSON，不能盲目放宽“multimodal” | 真实失败 |
| C. 请求字段位置确认 | 11:14 `NORTI_SHAPE_ROOT_FIELDS` + `NORTI_SHAPE_ITEM_WRAPPER_FIELDS` | 新固定原因码定位顶层和消息包装层，不记录 raw JSON | 真实分类 |
| D. 字段类型收集 | 11:54 本地结构探针；11:53 日志 `NORTI_SCHEMA_CAPTURED_LOCAL` | 确认 `client_tools:array`、`response_format:object`、`server_tools:array`、`stream:boolean`、包装 `type:string`、内层 `content:array` 与 `role:string` | 真机本地摘要 |
| E. 另一种字段变体 | 12:03 `NORTI_SHAPE_ROOT_FIELDS` + `GROUP_UNSUPPORTED`，12:07 本机新摘要 | 至少一条真实请求有额外 `input_hint:string`，因此不能把全部旧失败归因于“出现了新的组名”；另一条未支持组名的**具体值仍不明** | 混合证据，保留未知 |
| F. 完整文本元素确认 | 12:26:57，本机 `BODY_PART_001/002` | 精确位置 `input[0].message.content[0]={"type":"text","text":"<测试问题>"}`，`message.role=user`、包装 `type=message`；脱敏工具不抓 HTTP 认证头 | 真机本地受控采样 |
| G. 首次模型处理 | 12:25:41–12:25:44 的 PacketTunnel | `REQUEST_CAPTURED` → `DEEPSEEK_STARTED` → `DEEPSEEK_RESPONSE_ATTEMPTED`；但用户没在 Siri 确认看到 DeepSeek 来源，曾出现一次 Qwen 卡片标识、数次“无法获得回答” | 真实处理尝试，**UI 未验证** |
| H. 关联和 SSE 两个独立问题 | 12:39–12:40，升级后的固定原因码 | 12:40:18 请求成功，12:40:20 `RESPONSE_TAG_MISSING`、`ERROR_PROMPT_UNAVAILABLE`；12:40:40 请求成功，12:40:43 关联命中，但 `ERROR_SSE_REWRITE_UNSUPPORTED` | 真实失败 |
| I. 恢复原生 Qwen | 13:50，独立 61 被动模块 | `REQUEST_SCHEMA_CAPTURED_LOCAL` + `RESPONSE_SSE_SCHEMA_CAPTURED_LOCAL`，Qwen HTTP 200、13 个 SSE JSON 事件（其中 2 个 `delta`），无不完整帧 | 真机受控被动采样 |
| J. 严格预检验证 | 14:49，新 61 `strict60Preflight` | **`MATCHES_60_PREFLIGHT`**：这次 Qwen 原生流满足 60 对事件、ID 格式/关联、有效期的检查；这**不能**推导其他响应都相同，也不能证明合成 SSE 被 Siri 接受 | 真机值级预检 |
| K. 代码与归档重构 | 14:56 之后，PR #25 | 改写器生成与真实 SSE 字段名称/类型对齐的全量答案承载事件；以隐私安全、错误路径和并发隔离测试作为合并前条件，另立协议/决策/验收文档 | 实现与离线验证，真机尚待验收 |

## 2. 逐份 PacketTunnel 日志的最小事件索引

下表保留文件名、主要事件及数量，不包含任何 HTTP 请求或认证内容。`(1)` 是重复文件，没有计作不同测试。

| 原始文件（均为 2026-11-19） | 固定码要点（出现次数） |
|---|---|
| `PacketTunnel-20261119092948.log` | `GROUP_UNSUPPORTED ×3` |
| `PacketTunnel-20261119095645.log` | `GROUP_UNSUPPORTED ×2`、`SIRI_GROUP_CAPTURED_LOCAL ×1` |
| `PacketTunnel-20261119100228.log` | `WRITINGTOOLS_SKIPPED ×2`、`GROUP_UNSUPPORTED ×1` |
| `PacketTunnel-20261119100944.log` | `GROUP_UNSUPPORTED ×1` |
| `PacketTunnel-20261119102243.log` | `GROUP_UNSUPPORTED ×2` |
| `PacketTunnel-20261119104910.log` | `GROUP_UNSUPPORTED ×1`、`SIRI_GROUP_CAPTURED_LOCAL ×1` |
| `PacketTunnel-20261119104910(1).log` | 与上一文件重复 |
| `PacketTunnel-20261119110628.log` | `INPUT_UNSUPPORTED ×2` |
| `PacketTunnel-20261119111357.log` | `NORTI_SHAPE_ROOT_FIELDS ×1`、`ITEM_WRAPPER_FIELDS ×1` |
| `PacketTunnel-20261119115335.log` | 2 组输入形状错误、1 次本地结构采样 |
| `PacketTunnel-20261119120312.log` | `ROOT_FIELDS ×1`、`GROUP_UNSUPPORTED ×1` |
| `PacketTunnel-20261119122440.log` | `REQUEST_CAPTURED ×4`、`DEEPSEEK_STARTED ×1`、`DEEPSEEK_RESPONSE_ATTEMPTED ×1`、`PROMPT_UNAVAILABLE ×2`、`SSE_REWRITE_UNSUPPORTED ×1` |
| `PacketTunnel-20261119123921.log` | `REQUEST_CAPTURED ×2`、`RESPONSE_TAG_MISSING ×1`、`PROMPT_UNAVAILABLE ×1`、`SSE_REWRITE_UNSUPPORTED ×1` |
| `PacketTunnel-20261119134948.log` | 61 被动请求/响应结构各采样 1 次 |
| `PacketTunnel-20261119144915.log` | 61 被动请求/响应结构各采样 1 次 |

原先合计 **15 个 PacketTunnel 文件，24,895 行**；15:51 新增另一份 **1,135 行** 日志后，累计 **16 份、26,030 行**（含一份重复文件）（包含上述一个重复文件）。总行数只是日志工作量，不代表测试次数或成功率；不可拿这 15 份样本统计总体失败概率。

## 3. 重要的解释修正与“不能直接推断”清单

- **组名**：早期看到 `GROUP_UNSUPPORTED` 时曾推测可能是第二种 Siri 场景；此后确认部分错误来自 `input_hint`，但另一条不支持组的具体值并没有采到。不能宣称所有场景都已支持。
- **请求成功与 UI 成功不同**：`REQUEST_CAPTURED` 仅说明已解析文本；`DEEPSEEK_STARTED` 仅说明发起调用；`DEEPSEEK_RESPONSE_ATTEMPTED` 说明脚本构建并提交了一份响应，但没有 Siri UI 回执。
- **Qwen 卡片不代表回答来自 Qwen**：系统服务品牌可能仍显示 Qwen；只有**回答正文**含脚本在成功 DeepSeek 路径注入的 `【DeepSeek · AIES】`，才说明这个标记进入了显示文本。标记也无法证明模型本身身份；身份应由真实受信 API 回包与脚本检查共同证明。
- **两个 SSE 错误不意味着前置检查永远失败**：14:49 的一条 Qwen 原生响应成功通过值级 `strict60Preflight`；12:40 失败可能是另一条响应结构、运行版本、或其他尚未观测到的分支。
- **生成的 SSE 不是原生 SSE**：过去的 60 代码只模仿外层事件名，内部字段结构显著简化；本次重构依据真实结构补齐，但**字段类型采样不能证明服务端所有枚举值**。
- **PacketTunnel 下载错误不是同一件事**：两次原生采样后曾出现 GitHub Raw 远程脚本下载失败；先前已运行的采样仍成立，但重装/更新脚本时需确认 URL、固定 SHA 与缓存生效情况。
- **不偷换关联**：偶发 `RESPONSE_TAG_MISSING` 没有安全通用的“最近问题”补偿。没有相同事务的 Header 或 Request body 时，必须继续失败关闭，不能把另一问题的回答显示出来。
- **没有做过的事**：未获得完整原始 Qwen SSE/服务器提示词；未验证真实 DeepSeek 的所有模型枚举或套餐规则；未跑跨 iOS 版本大样本；未验证改写后的 Siri 卡片一定能显示。

## 3A. 15:51 以后新增证据：有成功显示，但仍有穿透

新增 `PacketTunnel-20261119155107.log`（1,135 行）和 `proxy-2026-11-19-155107.db`（40 条代理记录）。日志主接口五次 Siri 请求：15:51:27 和 15:52:14 的两次请求经过 `save data to pending data`，响应阶段均 `RESPONSE_TAG_MISSING`、`PROMPT_UNAVAILABLE`；15:51:41 和 15:52:30 两次直接发往远端，响应阶段完成 `DEEPSEEK_LABEL_APPLIED`、`DEEPSEEK_RESPONSE_ATTEMPTED`；15:53:24 的第五次虽关联成功，但被 `SSE_REWRITE_UNSUPPORTED` 拒绝。

用户截图首次确认 Siri 正文显示 `【DeepSeek · AIES】`，因此过去“从未验证 Siri UI 可见 DeepSeek”的结论需要修正为“至少一次成功、复杂问答和稳定性未通过”。底部依然是系统 Qwen 服务标识，不能通过提示词更改。

代理数据库的七条目标域记录包括**五条主接口、两条额外的 `/v1/sessions/{id}/responses`**（15:52:47、15:53:06）；没有保留任何 ID、请求内容或代理数据库原文。额外路径以前不在 60 匹配范围内，构成一次**可能的** Qwen 原文穿透渠道，但尚无完整响应证据证明每次 Qwen 显示都来自这里。

基于此，后续 60 版本添加第三条**仅对 Siri 会话级 SSE**生效的响应保护规则、固定 DeepSeek 来源标记、较宽容的标准 SSE 分帧和 1000 token/15 秒复杂问答预算。安全关联失败仍保留 502；用户明确要求这轮不再做人工测试。

## 4. GitHub 修改历史与用途

| PR | 核心目的 | 状态 |
|---|---|---|
| [#17](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/17) | 仅限 Siri 纯文本地允许 `siri.multimodal.noRTI` | 已合并 |
| [#18](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/18) | 输入结构拒绝原因 `NORTI_SHAPE_*` 细分 | 已合并 |
| [#19](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/19) | 600 秒自愿开启的本地字段名与类型采集 | 已合并 |
| [#20](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/20) | 实测根级工具/格式字段及 `type=message` 包装的严格适配 | 已合并 |
| [#21](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/21) | `input_hint` 严格处理，一次性脱敏请求体探针 | 已合并 |
| [#22](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/22) | DeepSeek 可视来源前缀、换行 SSE 序列化修复、响应关联日志 | 已合并 |
| [#23](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/23) | 独立 **61 Qwen 原生只读**请求/SSE 字段类型诊断 | 已合并 |
| [#24](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/24) | 在 61 本机计算 60 SSE 前置条件的固定结果分类 | 已合并 |
| [#25](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/25) | 本轮对真实事件字段的 60 SSE 重构、测试与历史/协议文档归档 | 以 GitHub 实际状态为准 |

## 5. 其他应保留的历史材料

- **架构与威胁模型**：60 生产实验改写、61 被动诊断严格互斥；两条 HTTP Hook 的版本固定、脚本本地持久化状态与隐藏凭据的边界。
- **协议文档**：请求 JSON 的顶层、用户文本、设备允许元数据、工具/响应格式的**字段类型**；响应 SSE 13 事件的键名和回包流程；不同 iOS 版本未证实的可变性。
- **错误状态矩阵**：Parser、关联、原始 SSE、DeepSeek API、合成 SSE、Siri UI 六层分别排障，不能用 UI 品牌猜模型来源。
- **接受标准**：真机成功与失败的每一次都需记录日期、60/61 脚本 SHA、模块启用情况、Siri UI 的具体表现、固定 AIES 状态码；绝不包含个人信息。
- **安全与回滚**：如果 DeepSeek 代理不稳定，停用 60 恢复原生 Qwen；不要同时启用 60 与 61；在诊断完成后关闭无须继续使用的目标域 MITM。

相关文档：[请求结构](OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md)、[响应 SSE](OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md)、[决策与待办](ROOT_CAUSE_DECISIONS_2026-11-19_ZH.md)、[验收矩阵](VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md)。

## 16:15–16:17：新一轮复杂 Siri 故障与 A/B 实验准备

用户额外上传 `PacketTunnel-20261119161456.log`（2,987 行）及 `proxy-2026-11-19-161456.db`（175 条代理记录）。由固定诊断码确认：16:15:16 的主请求在 16:15:17 因缺少 Header/Request body 关联失败；16:15:31 的主请求在 16:15:33 提交 DeepSeek SSE；16:15:50、16:16:03、16:16:15 的会话级请求均被 Guard 拒绝；16:16:33 的主请求在 16:16:36 因 SSE 预检失败；16:16:51 的主请求在 16:16:53 再次提交 DeepSeek SSE；16:17:08 的会话级请求在 16:17:11 被 Guard 拒绝。**这是三类并存的故障，不能把所有复杂失败归为 DeepSeek 模型内容不一致。**

用户要求用同一道问题在**完全停用 60/61 的原生 Qwen**与**仅启用 60 的 DeepSeek 实验**作对照。由于完全停用脚本时无法取得 HTTPS SSE 正文，实验增加第三个可比组：61 只读插桩的原生 Qwen，在非私密单题测试时手动采集客户端可见 Qwen 答案与 SSE 事件结构；60 侧则手动记录 DeepSeek API 的 HTTP 状态、`finish_reason`、usage、受限答案、合成 SSE 与失败阶段。操作详见[三阶段同题 A/B 指南](AB_SIRI_QWEN_DEEPSEEK_COMPARISON_ZH.md)。原始日志/代理库与会话 ID 值不进入 Git 仓库。
