# Qwen 原生通行 + Siri SSE 被动协议诊断

**2026-11-19 同题实验更新：** 61 模块现在包括两条原主接口 Hook 和两条会话级 Followup Hook，**全部原样放行**；原有 `qwen_passive_probe_ONCE.js` 仍按原方式采集主接口结构。想在同一道普通测试问题上同时采集 Qwen 客户端可见文字和会话级 SSE，请改用 [同题 A/B 实验指南](AB_SIRI_QWEN_DEEPSEEK_COMPARISON_ZH.md) 的 `ab_native_trace_ONCE.js`。两种探针的本机状态互不干扰，但不建议同时开启。


> **实验性、临时诊断模式。** 不替换 Qwen 的回答，不调用 DeepSeek，不注入 Header，不改 URL、状态码、请求体或响应体。核心脚本的 Request / Response 两阶段**只返回 `$done({})`**，让原始 Qwen 通信继续。只有你手动开启本地 600 秒采样时才写入协议结构摘要。

## 一、先恢复 Qwen 正常工作

1. 在 Shadowrocket 中**停用**现有 `60-AIES-SIRI-DEEPSEEK-V06.sgmodule`。旧的 `00 REJECT`、任何阻断 `prod-yabuli.qianwen.com` 的规则、旧版同域改写脚本都必须**停用**。不能同时启用 60 和 61；否则 60 仍可能返回 502。
2. 保留网络连接与必要的 Qwen 服务可用性。先**不安装 61**，使用一个不涉及隐私的 Siri 问题确认原生 Qwen 至少能够回复。如果这一步依然失败，就先检查 VPN、系统 Siri→Qwen 集成或原服务；不能归咎于 SSE 改写。
3. 若基线正常，再导入并启用**独立 61 被动诊断模块**：
   
   `https://raw.githubusercontent.com/Nimenta727/Apple-Intelligence-Exchange-Secure/main/shadowrocket/61-AIES-QWEN-PASSIVE-DIAG.sgmodule`

   模块中的两条脚本路径都应固定到 `9ea939df59a95b471b7034f5b1bf71a755d8bf88`。

4. 61 模块只对 `https://prod-yabuli.qianwen.com/v1/sessions/responses` 的 HTTP POST 启用 Request 和 Response 诊断钩子，仅允许 User-Agent 以 `Siri (` 开头。仍需在用户设备上对目标主机启用 HTTPS MITM，**不要将 MITM 扩展到更多域名**。HTTP 脚本可能影响流式响应缓冲与时间，故“代码不改写”**不等于**与完全关闭 MITM 的连接行为完全相同。首次测试后如 Qwen 失败，停用 61 并恢复基线。

## 二、手动采集一次真实协议结构

1. 将 [`qwen_passive_probe_ONCE.js`](../scripts/qwen_passive_probe_ONCE.js) 保存到 iPad 的 Shadowrocket 本地 `Script` 文件夹，仅在**脚本测试 / Script Test**中手动运行，不要把它添加为 event、cron 或额外 HTTP 规则。

2. 第一次手动运行：

   ```text
   [AIES_QWEN_PASSIVE_LOCAL] ARMED_600_SECONDS
   [AIES_QWEN_PASSIVE_LOCAL] PERSISTENCE_ROUNDTRIP_OK
   ```

3. **10 分钟内用 Siri 发起一次不含个人信息的问题**，例如“什么是光合作用？”，等待正常 Qwen 回复完成。**不要同时进行多次或并发 Siri 会话**；本版故意不修改 Header，因而**无法证明**一次 Request 与一次 Response 一定属于同一会话。

4. 手动再次运行**同一个** `qwen_passive_probe_ONCE.js`。捕获成功时大致会得到：

   ```text
   [AIES_QWEN_PASSIVE_LOCAL] CAPTURED_LOCAL_PROTOCOL_SCHEMA
   [AIES_QWEN_PASSIVE_LOCAL] REQUEST_PRESENT=true
   [AIES_QWEN_PASSIVE_LOCAL] RESPONSE_PRESENT=true
   [AIES_QWEN_PASSIVE_LOCAL] REQUEST_SCHEMA_PARTS=...
   [AIES_QWEN_PASSIVE_LOCAL] REQUEST_SCHEMA_PART_001=...
   [AIES_QWEN_PASSIVE_LOCAL] RESPONSE_SSE_PARTS=...
   [AIES_QWEN_PASSIVE_LOCAL] RESPONSE_SSE_PART_001=...
   [AIES_QWEN_PASSIVE_LOCAL] CAPTURE_CLEARED
   ```

   **请先在本地查看，再分享安全的这些 `[AIES_QWEN_PASSIVE_LOCAL]` 行。** 不要上传 PacketTunnel 全文、proxy 数据库、原始 SSE、请求头或认证信息。

5. 若出现 `ACTIVE_REMAINING_SECONDS=...` 和 `STILL_ARMED`，表示还没观察到符合条件的 Siri POST 或 SSE。重复检查不会关闭采样。若已经收到 Qwen 回答但只显示 `REQUEST_PRESENT=true`、`RESPONSE_PRESENT=false`，说明 **Response Hook 没有观测到满足条件的完整响应**，可能是响应未被拦截、缓存/流式缓冲超限、Siri User-Agent 未带入响应等；这并不证明 Qwen 没有回答。

6. 需要取消时，手动运行 [`qwen_passive_probe_STOP_ONCE.js`](../scripts/qwen_passive_probe_STOP_ONCE.js)，看到 `STOPPED_AND_CLEARED` 即代表本地逻辑状态已清空。它不会修改 DeepSeek Key。

## 三、到底会采集哪些“系统信息”？

在保证正文不可逆删除的前提下，该工具只保留：

| 方向 | 本地保留的结构信息 | 不会保留的内容 |
|---|---|---|
| Siri → Qwen | JSON 字段键名及数据类型（有限嵌套深度、数量），`input` / `message` / `content` 的结构形态，允许列表中的 `platform`、`locale`、OS 大小版本、已确证的 Siri 组名 | 实际提问文本、工具说明文字、私人上下文、Header、Cookie、Authorization、Token |
| Qwen → Siri | HTTP 数字状态码、SSE 事件**名称、顺序、出现次数**、帧数、是否多行 data、是否包含 id/comment/retry、每种事件 JSON 的**键名/数据类型**（限制深度和数量） | Qwen 回答原文、session/response id 值、`delta` 文本、`message.text.value` 字符串、认证信息 |
| 本地流程 | 是否捕获到 Request / Response；捕获成功/失败固定状态码 | HTTP 完整报文、DeepSeek API Key、音频、图像 |

这里的“系统信息”仅指**请求携带的、明确允许显示的 OS/语言/平台版本元数据**，不是 iOS 系统内部提示词、认证凭据或完整设备环境。

采集只存于 Shadowrocket 本机的 `$persistentStore`，读取时先逻辑清除再分段打印，未提供物理擦除保证。脚本不会上传到第三方服务，也不会尝试访问其他 App 的消息。

## 四、解释结果与回滚

- **Siri 能正常收到 Qwen 回答，且 `RESPONSE_SSE` 有事件名称和嵌套结构**：这是下一步精准支持 SSE 重写的主要依据。对照之前 `SSE_REWRITE_UNSUPPORTED` 的模拟解析器要求，就能找出缺失事件、额外事件或不同顺序。
- **Siri 正常回答但只看到 Request**：先检查 61 的 Response Hook 和 MITM/流式完整性，而不是随意放开 SSE 校验。
- **Siri 无法回答**：立即关闭 61 模块、恢复纯原生 Qwen 基线，不要继续重复抓包。这也可能是 HTTPS MITM 或响应缓冲本身干扰了 Siri 的流式连接。
- 测试完成，停用 61、关闭不再需要的 MITM 规则并恢复自己原来的 Shadowrocket 配置；若之后要继续测试 DeepSeek 才重新启用 60，但**61 和 60 永远不要同时启用**。

**现阶段这只是被动观测的离线设计，仍需要真机确认 Shadowrocket 是否真的将完整 SSE 响应交给脚本。**

## 基于真实 Qwen SSE 的 60 模块预检兼容诊断（增量更新）

真实 61 捕获证实 Qwen HTTP 200、13 个可解析 SSE 数据帧（其中 2 个文本 `delta`），事件顺序与 60 当前预期一致；但是仅靠字段名称与**类型**不足以判断 60 对 ID 格式、`session_id` 一致性、`expires_at` 整数性等**值级**校验是否通过。为避免获取任何 ID 的实际值，最新版 61 在响应内存中直接运行一遍当前 60 的**严格预检**，只向本地报告固定枚举：

| `strict60Preflight` | 含义 |
|---|---|
| `MATCHES_60_PREFLIGHT` | **当前这份**响应通过 60 的 SSE 前置结构检查，不意味着改写内容一定会被 Siri UI 接受 |
| `FRAME_LAYOUT_UNSUPPORTED` | 帧格式、额外行、多行 data 等超出 60 的两行要求 |
| `EVENT_UNKNOWN` / `EVENT_ORDER_UNSUPPORTED` / `EVENT_COUNT_UNSUPPORTED` | 事件名称、次序或计数不匹配 |
| `EVENT_JSON_INVALID` / `EVENT_ENVELOPE_INVALID` | 事件 JSON 无法解析或事件包装不匹配 |
| `SESSION_OR_RESPONSE_ID_INVALID` | ID 不符合 60 的受限字符格式（不保存 ID 值） |
| `SESSION_LINK_MISMATCH` | Response 关联的 session ID 与 Session 不一致（不保存双方 ID） |
| `SESSION_EXPIRY_INVALID` | Session 过期字段类型/范围不符合 60 代码要求 |
| `STREAM_UNAVAILABLE` | 非有效长度的原始响应文本 |

此字段出现在手动读取的 `RESPONSE_SSE_PART_*` 拼接 JSON 里；正常 Hook 日志仍只出现 `RESPONSE_SSE_SCHEMA_CAPTURED_LOCAL`。只需刷新 **61 模块到固定提交 `9ea939df59a95b471b7034f5b1bf71a755d8bf88`**，再次手动启动十分钟窗口、用 Siri 问一个非隐私问题、手动读取；**保持 60 停用**。没有泄露问题、回答、ID 或 Headers。一次采集满足当前检查，不代表其他 Siri 问答同样兼容；如果预检通过但 DeepSeek 改写后原生 Siri 仍显示失败，则主要需审查**合成 SSE 内部字段结构与真实 Qwen Schema 的差异**。
