# 根因、设计决策、剩余风险（2026-11-19）

## 1. 结论分级

| 问题 | 证据 | 当前判定 |
|---|---|---|
| 真实 Siri 组名曾未支持 | 09:30–10:49 `GROUP_UNSUPPORTED` + 本地组名探针 | **已确认根因，代码已有严格 noRTI 支持** |
| 请求根级和 message wrapper 未支持 | 11:06/11:14 错误分类 + 11:54/12:07 字段探针 | **已确认根因，已按真实字段/类型修复** |
| 请求文本元素未知 | 12:26 脱敏请求正文 `input[].message.content[].type=text` | **已确认形状，已支持文本解析** |
| 60 响应钩子偶发丢失关联 Header | 12:40:20 `RESPONSE_TAG_MISSING`、`RESPONSE_PROMPT_BODY_UNAVAILABLE` | **现象已确认；根因属于请求/响应传递链，具体 Shadowrocket 分支尚未证实** |
| 60 曾拒绝 Qwen SSE | 12:26:32 与 12:40:43 `ERROR_SSE_REWRITE_UNSUPPORTED` | **特定测试下确实发生；不能视为 Qwen 全部 SSE 不兼容** |
| 原生 SSE 结构和旧合成 SSE 不相同 | 13:50/14:49 真机 13 事件字段类型 vs 老 60 `rewriteSse()` | **字段差异已确认，但是否造成 Siri UI 失败仍待实机验证** |
| 原生 Qwen SSE 前置校验无法通过 | 14:49 `MATCHES_60_PREFLIGHT` | **至少该次请求可通过，否定“前置校验必然失败”的说法** |
| 模型实际上产生有效回包 | 12:25:42–12:25:44 `DEEPSEEK_STARTED` + `DEEPSEEK_RESPONSE_ATTEMPTED` | **至少脚本曾处理一次合格响应，不能证明 Siri 已显示** |
| Siri UI Qwen 品牌与回答来源 | 用户反馈一次 Qwen 标识、其他几次无回答 | **无法由卡片品牌推断具体输出来自 DeepSeek 或 Qwen** |

## 2. 60 与 61 的边界

```text
                  [iPad Siri 用户问题]
                            │
                      Qwen HTTPS POST
                            │
        ┌───────────────────┴──────────────────┐
        │ 60：实验改写模式（启用前停用 61）    │
        │ 请求 Hook：严格提取纯文本 + 持久化随机关联标记
        │ 响应 Hook：证明同事务问题来源 + 验证原生 SSE
        │              │
        │              └─ DeepSeek API → 验证 → 重新合成全部回答事件
        │                   │
        │                   └─ Siri (不承诺一定被 UI 接受)
        ├──────────────────────────────────────┤
        │ 61：原生被动诊断（启用前停用 60）    │
        │ 两个 Hook 始终 $done({})，不改写流量 │
        │ 用户手动开启 600s 才采集字段/类型和 SSE 结构
        └──────────────────────────────────────┘
```

60 和 61 **不能同时启用**；旧的同域 `00 REJECT` 也必须停用。61 的脚本不改写数据，但 HTTPS MITM/缓冲仍可能影响流式时序，需对照纯原生基线。60 **不是系统级替换保证**：脚本未运行、MITM 未覆盖或客户端绕行时，Qwen 仍可能原生展示回答。

## 3. 60 本轮核心代码决策

### D1：请求—响应关联必须是可证明的

- 每次 60 请求阶段生成一个随机临时 `X-AIES-Request-ID`，保存问题文本到独立临时本机键；响应阶段只有**标签与存储记录完全匹配**时才使用该记录。
- 如果响应阶段有**同一事务** `$request.body` 且能通过严格文本解析，可直接重建其问题。若两种来源同时存在但内容不同，报 `ERROR_CORRELATION_MISMATCH`。
- 如果响应阶段丢失 Header **且没有可解析的本事务正文**，继续报 `ERROR_PROMPT_UNAVAILABLE`，不调用 DeepSeek、不返回伪装为另一问题的答案。**不使用全局最近问题、模糊时间匹配或随机选取未过期记录**。
- 这意味着 **P0 故障未被神奇修复**：真实 Shadowrocket 可能在“request pending → forward”路径不保留自定义 Header；缺少稳定、官方可验证的跨 Hook 身份标识前，正确的安全行为是失败关闭。后续需独立验证 Shadowrocket 对同一请求的 Header/body/事务 ID 的交付方式，或通过明确受支持的相关 API 建立安全绑定；不要假设存在不可证实的私有 `$request.id`。
- 并发测试必须验证两个问题分别匹配，杜绝“交叉回答”。**接受一部分失败，优于把 A 的私密回答显示到 B 的 Siri 会话。**

### D2：真实 Qwen SSE 前置校验继续严格

- 只能接受已确认的 `session.*`、`session.response.*` 13 事件链；增量 `delta` 可以出现多个。其他事件、顺序、未知 JSON 外壳、非法 ID 字符/关联或非整数 `expires_at` 必须拒绝。
- 14:49 已证实一条真实 Qwen SSE 可通过 `strict60Preflight`，不能再将其当作“必须放宽全部事件”的理由。
- 当原生响应包含非空 `notices` 或 `moderation`、非文本 `tool/function_call` 输出时，不能将其包装成正常模型回答——拒绝修改并返回可诊断的失败关闭状态。
- 本轮**未**接入用户的原始响应字节，不复制模型 Qwen 文本或任意未知字段。

### D3：合成 SSE 应在结构上接近真实 Qwen

- 已据两次真实 61 字段摘要，补齐 Session 的 `created_at/last_active_at/expires_after`，Response 的 `notices/choices/object/created_at`，Choice 的 `index/id/continue_url/status`，Item 的 `index`，Content 的 `index/text.annotations`，以及最后 `choices[].completed/done/response.done` 的完整可见形状。
- **只从上游继承有界的会话 ID、时间戳及同域 continuation URL**；这些字段只返回原本的 Siri 客户端，不发送 DeepSeek。不可信的 `continue_url` 被清空；未知或复杂的审核/工具输出不透传。
- 所有可展示回答位置，包括 `delta`、`text.value.done`、`content.done`、`items.done`、`choices[].completed/done`、`response.done`，都从同一份**经过 DeepSeek API 验证的回答**重新生成；不会复制 Qwen `text.value` 或 `delta` 原文。
- 成功改写的回答前有 **`【DeepSeek · AIES】`**，并返回 `X-AIES-Answer-Source: deepseek`。提示词要求模型如实解释来源；**单靠提示词无法保证身份来源，Header 或 SSE 提交日志也不是 Siri 显示回执**。
- 字段名和数组类型对齐只是**兼容性改进**，不能自动得出 Siri UI 已经成功接收；某些服务端字段具体枚举与隐含校验仍未知。

### D4：保留端到端安全边界

- 不读取/记录认证 Header 的实际值、DeepSeek API Key、私人请求上下文、Qwen 的答案文本到调试日志。
- 允许的本机手动原文探针须先经用户明确开启；其产出只用于用户选择的非隐私问题，日志可被本地持久化，不能等同物理擦除。
- WritingTools 仍按原来的旁路逻辑；未确认的其他 Siri 场景、音频、图像、工具调用不会被无条件送到 DeepSeek。
- 模型超时、HTTP 失败、空内容、非 `finish_reason=stop`、未知 SSE 和关联缺失都由 60 生成固定错误；**不把未经确认的 Qwen 文字默默放出作为 DeepSeek 回答**。

## 4. 故障阶段与诊断码矩阵

| 阶段 | 固定码举例 | 建议动作 |
|---|---|---|
| 目标/模块生效 | 61 的 `REQUEST_SCHEMA_CAPTURED_LOCAL`、`RESPONSE_SSE_SCHEMA_CAPTURED_LOCAL` | 检查 60/61 冲突、MITM 目标域、脚本 URL 是否固定到正确 SHA |
| 请求组名 | `REQUEST_DIAG_GROUP_UNSUPPORTED` | 先核实真实组名；不要将未知 multimodal 整体放行 |
| 请求形状/内容 | `NORTI_SHAPE_*`、`REQUEST_DIAG_CONTENT_UNSUPPORTED` | 与[请求字段表](OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md)对照，不上传明文 |
| 请求关联 | `RESPONSE_TAG_MISSING`、`RESPONSE_PROMPT_BODY_UNAVAILABLE`、`ERROR_PROMPT_UNAVAILABLE` | 确认两钩子传递；不得靠最新请求猜测 |
| 原生 Qwen SSE | `ERROR_SSE_REWRITE_UNSUPPORTED`、61 的 `strict60Preflight` | 对照原生 [13 事件协议](OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md) |
| DeepSeek 调用 | `DEEPSEEK_STARTED`、`ERROR_MODEL_NETWORK`、`ERROR_MODEL_RESPONSE_INVALID` | 仅在关联/SSE 已通过时排查模型 HTTP、模型标识和密钥 |
| 生成与提交 SSE | `DEEPSEEK_LABEL_APPLIED`、`DEEPSEEK_RESPONSE_ATTEMPTED` | 检查合成输出 schema 和多行文本转义；这是“脚本提交”不是“UI 成功” |
| Siri 原生 UI | 真实显示结果 | 用户手工验证，不能由 HTTP 日志自动证明 |

## 5. 已知局限（对用户必须透明）

1. **原生 Siri 未完成端到端验收**：旧版 60 有一次尝试成功的日志，新版合成 SSE 尚需真实 iPad 复测。
2. **关联偶发丢失仍是 P0**：严格故障保护会导致部分请求显示“无法获得回答”；在无可靠同事务绑定时不能自动给错问题配答案。
3. **兼容性范围有限**：只观测到 iPad iOS 27.3、`zh_CN` 和少量测试问答；包含多模态或工具使用的生产场景不能推断兼容。
4. **DeepSeek 配置与额度随服务变化**：历史环境曾出现成功 API 处理；未来模型标识、额度、网络和服务端协议要在真机单独确认，不能因为离线 mock 成功就宣称模型通了。
5. **原生 Qwen 品牌显示**：脚本不能修改 Siri 系统层的 Qwen 品牌标识；只有回答内容与固定诊断才能帮助判断。
6. **61 无法证明单事务一一对应**：它不添加 Request ID；如果并发会话出现，一份请求概要和一份响应概要可能来自不同网络请求，测试期间应一次只发一个问题。
7. **MITM 本身有副作用**：即使被动 `$done({})` 也可能因响应缓冲超时而改变流式体验，需要基线对照。

后续验收与回滚操作：[测试矩阵](VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md)。相关历史：[完整时间线](DEBUG_HISTORY_2026-11-19_ZH.md)。
