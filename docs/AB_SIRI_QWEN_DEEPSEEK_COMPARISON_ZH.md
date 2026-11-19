# Siri 同题 A/B 实验：原生 Qwen vs DeepSeek AIES（2026-11-19）

> **目标**：把用户在 Siri 中问的**同一道非私密问题**，分别交给纯原生 Qwen、原生 Qwen 只读诊断和 AIES→DeepSeek；比较 Siri 实际显示、HTTP/SSE 协议、DeepSeek 模型返回 `finish_reason`、token 用量、回答长度及客户端可见的**测试答案正文**。**不可把三种配置的结果混为一谈。**
>
> 本工具由用户**手动**开启 10 分钟单次测试窗口，不主动上传答案、请求、Header、密钥、认证 Token、session ID、隐藏系统提示词或原始 SSE。仅在本机 `$persistentStore` 暂存受限答案片段/安全结构；脚本测试读取前先逻辑清除。**即使脱敏，也必须人工审阅后再分享。**

## 为什么要拆为 A / A' / B？

**A：真正的完全关闭对照**——Shadowrocket 中的 **60、61、旧 REJECT、同域 HTTP Rewrite 都停用**（必要时恢复原生网络配置）。此时不会有 AIES HTTP Hook，**不能同时要求“所有改写关闭”又读取完整请求/响应体**；只记录 Siri 是否正常显示 Qwen 回答、耗时体感及不含隐私的回答截图。此组是**纯原生行为基线**。

**A'：原生 Qwen 的协议对照**——**60 停用、61 启用**。61 的四条 Hook（主请求/响应 + 会话级请求/响应）永远以 `$done({})` 结束，不调用 DeepSeek、不修改内容；手动开启一次性采样才能在本机记录请求**字段名/类型**、Qwen SSE 结构（事件名称、顺序、长度、状态、严格前置预检）和本次**客户端可见的回答文本**。此组是 A 的“有仪器”近似，**MITM/完整响应缓冲本身仍可能影响时序**，不能称其与 A 完全相同。

**B：DeepSeek 改写实验**——**61 停用、60 启用**（60 的三条规则同一 SHA）。手动开启 DeepSeek 侧 A/B 探针，记录 Siri 请求结构摘要、响应关联阶段码、原始 Qwen SSE 事件与长度、DeepSeek API 状态/finish_reason/用量/模型答案、最终 AIES 合成 SSE 的结构及来源前缀、会话级 Guard 的拦截事件。探针本身不决定是否拦截，60 现有防漏策略仍可能导致 Siri“无法获得回答”。

## 推荐使用这一道问题（请三组逐字相同）

> **“请用三点解释为什么傍晚天空容易呈红色，说明瑞利散射和太阳光传播路径的关系，最后举一个生活中的例子。”**

这是不涉及个人数据、具有一定复杂度、可以辨认答案完整性的问题。**不要选择**私人通讯、姓名住址、账号、医疗、定位、密钥或私人文件内容。三组都需从**新的 Siri 会话**发起，避免上一轮的会话级后续请求串入下一轮；同一 VPN/网络、同一设备和尽量相近的时间，勿并发提问。不同模型不需要逐字回答一致，比较的是**内容完整性、结构与失败阶段**。

## 操作顺序

### 1. A：完全关闭，确认原生 Qwen

1. 备份 Shadowrocket 配置，停用 60、61、旧同域 REJECT/Rewrite，确认当前没有 AIES HTTP 钩子。若目标 MITM 仅用于 AIES，按备份恢复原生设置。
2. 向 Siri **逐字**问上面的测试问题。记下是否正常显示原生 Qwen 回答。可以记录**不含私人信息**的 UI 截图。
3. 此组无法自动取得原生 SSE 或完整 HTTP 报文：**不要声称拿到了不存在的抓包**，也不必上传整个 PacketTunnel。

### 2. A'：只开启 61，采集原生 SSE 和 Qwen 客户端可见答案

1. 确认 **60 关闭**；刷新或导入 `61-AIES-QWEN-PASSIVE-DIAG.sgmodule`。当前四条 Hook 的固定运行脚本 SHA 以本页下文和模块实际值为准。
2. 从 [`ab_native_trace_ONCE.js`](../scripts/ab_native_trace_ONCE.js) 下载到 iPad Shadowrocket **本地 Script 文件夹**；只在**脚本测试 / Script Test**中手动运行，不能设为 HTTP/event/cron。
3. 第一次手动运行，见：
   ```text
   [AIES_AB_NATIVE_LOCAL] ARMED_600_SECONDS
   [AIES_AB_NATIVE_LOCAL] PERSISTENCE_ROUNDTRIP_OK
   ```
4. 立即用 Siri 提**完全相同的问题**，等待 Qwen 回答结束（或错误）。
5. 再次手动运行**同一个** `ab_native_trace_ONCE.js`，预计得到：
   ```text
   [AIES_AB_NATIVE_LOCAL] CAPTURED_LOCAL_READOUT
   [AIES_AB_NATIVE_LOCAL] RECORDS=...
   [AIES_AB_NATIVE_LOCAL] TRACE_PARTS=...
   [AIES_AB_NATIVE_LOCAL] TRACE_PART_001=...
   ...
   [AIES_AB_NATIVE_LOCAL] CAPTURE_CLEARED
   ```
   多个 `TRACE_PART_*` 按编号拼接为一份 JSON。里面 `route` 为 `MAIN` 或 `SESSION_FOLLOWUP`；`shape` 是原生请求/响应字段结构，`answerChars`、`answerText` 是受限的客户端可见**测试答案**。有些 SSE 变体可能无法提取 `answerText`，不代表模型没输出。
6. 如果想停止，手动运行 [`ab_native_trace_STOP_ONCE.js`](../scripts/ab_native_trace_STOP_ONCE.js)，显示 `STOPPED_AND_CLEARED`。原有 `qwen_passive_probe_ONCE.js` 的结构型探针与此独立，不用同时开启。

### 3. B：只开启 60，记录 DeepSeek API 和最终合成 SSE

1. **关闭 61**、旧 REJECT/同域冲突规则；刷新 60 模块（三条 Hook 同一固定 SHA）。DeepSeek Key 使用你设备上已经配置的本地 Key，不需要再次上传或修改。
2. 从 [`ab_deepseek_trace_ONCE.js`](../scripts/ab_deepseek_trace_ONCE.js) 下载到本地 Script 文件夹，只用于手动 Script Test。
3. 第一次运行：
   ```text
   [AIES_AB_DEEPSEEK_LOCAL] ARMED_600_SECONDS
   [AIES_AB_DEEPSEEK_LOCAL] PERSISTENCE_ROUNDTRIP_OK
   ```
4. 向 Siri 问**完全相同的问题**。不管出现 DeepSeek 标识、Qwen 回答，还是“无法获得回答”，都等该次交互结束。
5. 第二次运行同一脚本，预计得到：
   ```text
   [AIES_AB_DEEPSEEK_LOCAL] CAPTURED_LOCAL_READOUT
   [AIES_AB_DEEPSEEK_LOCAL] EVENTS=...
   [AIES_AB_DEEPSEEK_LOCAL] TRACE_PARTS=...
   [AIES_AB_DEEPSEEK_LOCAL] TRACE_PART_001=...
   ...
   [AIES_AB_DEEPSEEK_LOCAL] CAPTURE_CLEARED
   ```
6. 若要取消，手动运行 [`ab_deepseek_trace_STOP_ONCE.js`](../scripts/ab_deepseek_trace_STOP_ONCE.js)。不会清除 DeepSeek Key。

## 对照时重点看哪些字段？

| 层级 | A' 原生 Qwen | B AIES→DeepSeek | 解释 |
|---|---|---|---|
| Siri 请求 | `shape.schema`、`device.group` | `SIRI_REQUEST` 的 `rootFields/group/promptChars` | 文字内容是否在同一结构、是否多了工具/格式字段 |
| Qwen SSE | `shape.format/strict60Preflight/eventCounts/orderFirst` | `MAIN_UPSTREAM` 的 `eventNames/eventCount/unparsedFrames` | 哪种响应变体导致 60 的 `SSE_REWRITE_UNSUPPORTED` |
| 原生额外会话 | `route=SESSION_FOLLOWUP` 和原生答案 | `SESSION_FOLLOWUP_BLOCKED` 及 `QWEN_SESSION_FOLLOWUP_SSE_BLOCKED` | 是否正是防漏 Guard 让复杂 Siri 无法继续显示 |
| 模型 API | 无 | `DEEPSEEK_API.status/finishReason/choiceCount/usage/reasoningType/outputChars` | 区分模型没调用、超时、长度截断、空内容或合法完成 |
| 模型原始文本 | `answerChars/answerText`（只限用户可见答案） | `DEEPSEEK_API.answerText`（最长 7,000 字符的脱敏内容） | 判断回答是否被错误包装、出现多段或缺少来源 |
| 合成 SSE | 不适用 | `AIES_SYNTHETIC` 和 `AIES_OUTPUT.markerPresent` | 脚本输出形态是否正确；**不证明 Siri UI 已接受** |
| Siri 最终结果 | A 的实际显示及 A' 结果 | B 的实际显示结果 | 以真正的 Siri UI 为最后验收标准 |

三组**不可能**自动捕获完整 HTTP 授权头、隐藏系统提示词、模型内部推理、被系统绕过的网络流量，也**不应**捕获这些数据。所谓“完整”在本实验中是指上述**可验证、允许、安全的比较维度**，不是未授权的数据包镜像。答案文字超过 7,000 字符会有明确 `answerTruncated=true` 提示，不能假装完整无截断。对照内容含来源前缀和客户端可见的 JSON 格式时，请记住 Qwen 服务品牌仍由 Siri 控制。

## 分享与回滚

先在本地检查每段 `TRACE_PART_*`，确认不含私人提问、其他用户信息或任何令牌，再将 **A 的 Siri 表现、A' 的 `[AIES_AB_NATIVE_LOCAL]` 结构/内容、B 的 `[AIES_AB_DEEPSEEK_LOCAL]` 结构/内容和 B 实际 Siri 展示现象**发送回来。无需上传原始 PacketTunnel、proxy DB、Cookie、Authorization、Key、CA 私钥或 SSE 全文。

结束后停止所有 A/B 探针，停用 60 和 61 即可恢复纯原生；后续重新选择正常使用模式时**两模块仍不可同时启用**。本实验只负责更精确地定位错误，不承诺已经修好 DeepSeek 复杂问题或系统级 Qwen 绕行。
