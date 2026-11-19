# AIES 当前架构与 2026-11-19 协议对齐版

> **v0.6 Beta**。两模块互斥，功能与数据边界如下；离线检查并非 Siri 原生 UI 证据。最新真实请求与响应字段见 [请求协议](OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md)、[SSE 协议](OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md)。

## 仓库主要结构

```text
.github/workflows/ci.yml
README.md / README_EN.md / CHANGELOG.md
shadowrocket/
  60-AIES-SIRI-DEEPSEEK-V06.sgmodule      实验 DeepSeek 回答改写：两条主 Hook + 第三条 SSE Guard
  61-AIES-QWEN-PASSIVE-DIAG.sgmodule      互斥的原生 Qwen 被动协议诊断：双 Hook
scripts/
  aies_siri_deepseek_v06.js                60 三个 Hook 使用的同一个不可变 JS
  aies_qwen_passive_diag.js                61 四个 Hook 使用的同一个不可变 JS
  provision_key_ONCE.js / clear_key_ONCE.js    DeepSeek Key 手动本机管理
  siri_group_probe_ONCE.js / siri_group_probe_STOP_ONCE.js
  siri_schema_probe_ONCE.js / siri_schema_probe_STOP_ONCE.js
  siri_qwen_body_probe_ONCE.js / siri_qwen_body_probe_STOP_ONCE.js
  qwen_passive_probe_ONCE.js / qwen_passive_probe_STOP_ONCE.js
tests/
  siri-deepseek-v06.test.js               60 模拟两阶段、模型、SSE、隐私、并发等回归
  qwen-passive-diag.test.js               61 无副作用、结构摘要和严格预检
  fixtures/siri-sse.js                    **合成测试资料，不是真机原始包**
tools/check-docs.js                        文件/文档/固定 SHA/互斥模块一致性
docs/
  OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md
  OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md
  DEBUG_HISTORY_2026-11-19_ZH.md
  ROOT_CAUSE_DECISIONS_2026-11-19_ZH.md
  VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md
```

## 60 请求与响应阶段

```text
Siri 用户请求
  │  HTTPS /v1/sessions/responses
  ▼
60 Request Hook
  ├─ URL 目标检查、WritingTools 旁路
  ├─ 严格组名、用户角色、纯文本包装与长度约束
  ├─ 提取 input[].message.content[] 中的文本
  ├─ 本地独立随机 token 关联记录（短期）
  └─ 尝试为本次请求加入 X-AIES-Request-ID
               │ 原始请求可能仍发到 Qwen
               ▼
        Qwen 原生 SSE Response
               ▼
60 Response Hook
  ├─ HTTP 200 和完整 SSE 严格预检
  ├─ 用同一事务 Request ID + store 或本钩子 Request body 恢复问题
  │     两者同时存在且内容不一致 → 失败；都不存在 → 失败
  ├─ 有效 Key、DeepSeek HTTP 正常返回 stop/非空文本
  ├─ 在内存中按真实 Qwen 13 事件字段布局构造完整 SSE
  │     只复用安全有界 Session/Response ID/时间和经约束 continuation URL
  │     所有答案路径一律由 DeepSeek 文本生成
  ├─ 成功时加固定正文来源前缀 【DeepSeek · AIES】
  └─ $done({status:200, headers..., body:重建 SSE})
       ↳ Siri 是否接受、是否显示由真实 UI 验收
```

**无法安全关联时**：脚本不会将“最近一次问题”作为关联依据，因为会在并发或 Pending→Forward 转发中造成潜在串答。遇到缺失 Header 和不可用 Request body，只能失败关闭。这不是已解决的 Shadowrocket 宿主限制，见[根因决策](ROOT_CAUSE_DECISIONS_2026-11-19_ZH.md)。

## 60 SSE 答案生成器的信任边界

- 原生 Qwen SSE 先过**事件名、严格帧格式、事件次序、Session ID/Response ID 相互关系、时间整数字段**检查。
- 请求相关的 `session.id` 和 `response.id` 仅用于保留 Siri 当前会话骨架；不输出到日志，不发送 DeepSeek。时间戳整数有限制；原响应 `object` 只接受受限类别字符串。
- 结构重建会生成新的 `notices:[]`、`choices:[]`、`choice.id`、`continue_url`、`message.content`、`annotations:[]` 等**真实被动摘要观测到的字段结构**。来自不信任主机的 `continue_url` 会被清空。
- 明确拒绝工具调用、非文本消息和非空审核/通知；对未经证实的 SSE 变体不进行有损猜测。
- 构造回答 JSON 时统一生成 `content`、`suggestions`、`summary`（当前 `summary="DeepSeek"`），所有 `delta`、`done.value`、`content.done`、`items.done`、`choice.completed/done`、`response.done` 都基于这一个来源值。
- 旧版 60 曾只生成简化字段，离线 SSE 事件测试无法识别这类兼容性差异；现在加入按真实字段名称/类型对齐的测试。**仍需真实 Siri 验收。**

## 60 新增会话级 SSE 防漏响应钩子

代理库 15:52:47 与 15:53:06 有 Siri `/v1/sessions/{opaque-id}/responses`，旧 60 只覆盖 `/v1/sessions/responses`。第三条响应脚本规则在会话级路径、Siri User-Agent、HTTP 200 且确认为 SSE 时返回固定 502。它不是 DeepSeek 改写，不封锁普通 Qwen 域名和非 SSE 信息；可以阻断部分原文，却也可能让复杂问答无法显示。

主路径 SSE 解析现在接受规范的注释、`id:`、`retry:`、多行 `data:` 和换行方式，但仍严格校验事件白名单、顺序、会话关联和媒体/工具类型，不能把未知 Qwen 事件直接复制到 DeepSeek SSE。

## 61 被动诊断与本地临时探针

- 61 Request 与 Response Hook 始终 `$done({})`。匹配 URL + Siri UA + POST，但**不注入身份标记**、不改写 HTTP 数据。
- 只有在用户手动运行本地 Script Test 打开 600 秒窗口后，才保存一次请求的字段类型、白名单系统元数据和一次响应的 SSE 事件顺序/个数/类型结构；没有用户问答正文或认证信息。
- `strict60Preflight` 在本地短暂解析真实响应后仅返回受限分类枚举，内存外不保存实际 `session_id`、模型回答、Cookie 或原始 body。
- 因为不能改动消息去做跨事务 ID 绑定，这两个**独立一次性捕获可能不属于同一个会话**；一次只提一个问题。HTTPS MITM 和完整响应缓冲仍可能影响原生 Qwen 的时序，需要独立基线。

## 同题对照诊断的新增边界

61 增加两条**会话级** request/response pass-through Hook，整体四条钩子仍一律 `$done({})`；原有结构探针默认行为不变，用户另行手动授权 `ab_native_trace_ONCE.js` 时才本机记录该次测试的可见 Qwen 答案及 SSE 字段结构。60 不改拦截决策，但手动授权 `ab_deepseek_trace_ONCE.js` 后记录 DeepSeek HTTP/finish_reason/usage、受限答案和重建 SSE 的状态。所有本机读取数据均可能包含**用户主动选择的普通测试题的答案**，须自行检查后才可分享。参见[同题 A/B 指南](AB_SIRI_QWEN_DEEPSEEK_COMPARISON_ZH.md)。

## 仍需完成的工程任务

1. 验证 Shadowrocket 在 **Pending → Forward** 和复用 HTTP 连接时有没有公开、可靠的跨 Request/Response Hook 事务标识；没有时继续拒绝，而不是猜。
2. 在真机上用新 60 对一条简单问题进行完整 DeepSeek 真实 API + Qwen SSE → Siri UI 验收。
3. 测试多 delta、长文换行、错误/工具/媒体/审核、连续问答、并发、VPN 断线、脚本缺席与系统级回退。
4. 单独验证合成 SSE 的 `choice.id`、`continue_url`、`object` 字段实际枚举是否被 Siri 严格要求；本次只掌握字段类型，不能对未公开枚举作必然保证。

发布门槛见[验收回滚](VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md)，历史原始依据见[调试时间线](DEBUG_HISTORY_2026-11-19_ZH.md)。

## 新增 WritingTools 的双场景适配层（2026-11-19）

主接口 `/v1/sessions/responses` 请求根据 UA 进入独立解析：Siri 按实测 `siri.multimodal.noRTI`/遗留 `siri.tqa`，WritingTools 仅接受 SAIR 逆向的 `compose_selectedAndAllText` 纯文本 user 消息。原主 SSE 预检、请求-响应 token 隔离、DeepSeek API 完成检查保持不变；区别只在模型的写作任务提示词与最后答案 JSON 的 `body/refinements` 或 Siri 的 `content/suggestions/summary`。关联存储保存 `scene` 并在响应钩子比较，不接受跨场景缓存；不会把 Qwen 的答案、引用、工具输出作为 DeepSeek 文本。后续其他写作模式必须先有真机 schema 类型采样，不能照搬 SAIR 的全局最近请求兜底或大范围 fallback。来源：[外部协议研究](COMMUNITY_APPLE_INTELLIGENCE_REQUESTS_2026-11-19_ZH.md)。
