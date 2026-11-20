# AIES 64 LOCAL v0.8：真实会话 SSE 协议验证版（默认关闭）

> **状态：代码与模拟测试用的候选版；尚未经过真实 iPad Siri 验收，不应替换当前可工作的 62 LOCAL。** 本文依据用户对 SAIR/Apple–Qwen 逆向研究的整理、SAIR [源代码](https://github.com/boitar/sair/blob/main/scripts/sair_adapter.js) 与 [协议文档](https://github.com/boitar/sair/blob/main/docs/protocol_analysis.md)，并对照 AIES 本机 PacketTunnel 的真实阶段码。SAIR 属第三方逆向资料，不是 Apple 官方协议保证。

## 最重要的架构决策

**62 继续保持原样，63 继续禁用；新增完全独立的 64 + JS + 单独测试。**

| 能力 | 62 LOCAL（已观察到部分 Siri 多轮成功） | 64 LOCAL（新实验版） |
|---|---|---|
| HTTP 钩子 | 原生首轮/追问请求与响应，共四条 | 同样四条，**默认全部关闭** |
| SSE 来源 | 千问的真实上游 SSE | **千问的真实上游 SSE**，无客户端伪造会话 |
| session/response/choice | 尽量沿用上游身份信息 | 新增**独立状态审核**，保留来自上游的会话、响应和 choice ID；保留安全格式下的原始 model 识别值 |
| 原始 SSE 事件 | 重建相同事件顺序并替换回答 | 在重写前审核 delta/done、完整状态顺序、session/choice 与场景 Schema；仍只重建经过审查的安全文本输出，不声称字节级保留未知元数据 |
| 多轮追问 | 严格按同一 session 已验证 DeepSeek-only 历史 | 同样；字段缺失/null/空字符串时只恢复同一已验证 session，不跨会话猜测 |
| 未知 Siri 组 | 阻止并输出固定阶段码 | 新增主问/续答/视觉/写作工具**分类诊断**，未知组仍阻止，不将图片或工具信息送 DeepSeek |
| 事务标记丢失 | 固定 tag 或同一响应 Hook 可解析正文；不能证明关联就失败关闭 | **同样保持失败关闭**，但分类更明确；不照搬 SAIR 的“最近一次 prompt”全局回退 |
| 超时 | 模型等待 15 秒上限 | 第三方约 6–8 秒 Siri 窗口假说下，模型等待最多约 6.2 秒，且若可证明请求起始时刻则动态减去上游等待，日志只给分段耗时档位 |
| 当前用户可用性 | 仍可能有间歇性失败 | **未实测，不得宣称更稳定** |

### 请求分类器与安全边界

新分类只输出固定类别：
- `SCENE_SIRI_MAIN_NORTI` / `SCENE_SIRI_FOLLOWUP_NORTI`
- `SCENE_SIRI_MAIN_TQA` / `SCENE_SIRI_FOLLOWUP_TQA`
- `SCENE_WRITING_COMPOSE`（现有 Beta 仅精确支持 Compose 纯文本）
- `SCENE_VISION_UNSUPPORTED`（检测视觉场景，但**不会上传图片或转发视觉请求**）
- `SCENE_SIRI_GROUP_UNVERIFIED`、`SCENE_OTHER_GROUP_UNVERIFIED`（继续拒绝）

**分类不等于授权**：仍然要通过现有 Siri User-Agent、目标 host/路径、POST、严格 JSON 消息包装、纯文本、工具/媒体拒绝以及后续会话上下文精确匹配。未知 Siri 组不会因为名字以 `siri.` 开头就进入模型。

### SSE 上游预检与场景合同

在调用 DeepSeek **之前**读取并审核真实千问的 SSE，检验：
1. 首轮有 `session.created`，追问则从 `session.response.created` 开始；
2. 允许多个 `text.value.delta`，以及已观测到的 `text.annotations[].added`；不把“27 类事件”当成 27 帧固定数量；
3. 原生 `session_id`、`response_id`、若存在的 `choice_id` 与最后完成事件之间一致；追问需等于 URL 中可信 session ID；
4. `delta` 文本拼合与 `text.value.done` 一致，并与已出现的终态文本快照一致；
5. Siri Q&A JSON 的 `content/suggestions/summary`、WritingTools Compose JSON 的 `body/refinements` 类型符合所研究的场景约定；
6. 严格 SSE 校验或重写检查失败，就以 **`SSE_AUDIT_...` / 502** 拒绝，**不调用 DeepSeek**，也不将原生千问文本冒充 DeepSeek 回答。

注意：这是基于有限真实样本建立的保守协议子集。Apple/Qwen 可能返回未验证但合法的额外 SSE 结构；64 会拒绝这些数据，而不是擅自“兼容”。**64 并不承诺字节级转发全量官方流**：它保留经验证的身份/顺序，并严格重建仅包含 DeepSeek 回答的文本 SSE。这个设计是隐私和来源一致性的折中。

### 请求/响应关联与超时

- 事务需要 **`X-AIES-Request-ID` 对应本机保存的同一请求**，或 Shadowrocket 在**同一响应 Hook**直接提供的可验证原始请求正文。只要都没有，就记录 `CORRELATION_NO_TAG_NO_VALID_BODY` 并返回 502。**不会**用“最近一次提问”猜出需要回复什么。
- 只记录 `UPSTREAM_ELAPSED_...`、`MODEL_ELAPSED_...`、`END_TO_END_ATTEMPT_...` 档位；从不在日志中记录实际问题、会话 ID、完整时间戳、密钥、HTTP 原文。
- SAIR 估计 Siri 客户端等待约 6–8 秒，但这个值不是 Apple 官方 SLA。64 的 `7400 ms` 是**实验性总预算**，并预留约 350 ms；缺少可信请求时间则只采用约 6.2 秒模型等待上限。超时可能反而造成拒绝，因此必须以真机对照验证。
- `DEEPSEEK_RESPONSE_ATTEMPTED` **只能证明脚本向客户端提交了结果**，不能证明 Siri 真的展示、朗读或者持续追问。

## 安装方式（仅用户明确决定试验时）

1. **保留并备份**当前可用的 62 LOCAL 和 `aies_siri_deepseek_v06.js`。不要动 63 的禁用状态。
2. 如果要做可回滚测试，把新文件 [`aies_siri_deepseek_v08_native_sse.js`](../scripts/aies_siri_deepseek_v08_native_sse.js) 单独放入 **iCloud 云盘 / Shadowrocket / Script**，不要覆盖旧文件。
3. 在 Shadowrocket 添加新 [`64-AIES-SIRI-DEEPSEEK-V08-NATIVE-SESSION-LOCAL.sgmodule`](../shadowrocket/64-AIES-SIRI-DEEPSEEK-V08-NATIVE-SESSION-LOCAL.sgmodule)。默认 **四条 `enable=false`**，不会自动抢占当前配置。
4. **只在你决定进行真机实验时**，先关闭 62（同时确认 60、61、63 都关闭），然后在 64 本地模块文本中**将四条** `enable=false` 改为 `enable=true`，保存并重新应用配置。使用之前已经保存的 DeepSeek Key 和 MITM 证书，不要重新上传 Key。
5. 先做一组无隐私的 Siri 首轮与一次连续追问，分别观察分类、`SSE_AUDIT_PASSED`、`DEEPSEEK_STARTED`、`DEEPSEEK_RESPONSE_ATTEMPTED`，以及 Siri 界面**实际出现** `【DeepSeek · AIES】`。若新版本报 `SSE_AUDIT_...`、超时或无法回答，停止测试并回滚。
6. **回滚**：关闭 64、启用 62 LOCAL，重新应用配置。原 `aies_siri_deepseek_v06.js`、62 四条规则、DeepSeek Key 和证书一直没有被覆盖。

## 当前还没有完成、不能被 CI 替代的验收

- 真实 Siri 对新增“delta 一致性 / 元数据模型标识”检验的接受度；
- 真实 Qwen 首轮及追问 SSE 是否存在合法却超出审查子集的形式；
- 直接问 Siri 是否压根没进入千问扩展（这由 iOS 路由决定，不能由 HTTP 重写脚本强制）；
- 62 原先新连接 `RESPONSE_TAG_MISSING` 的根因；64 **没有发明新的事务载体**，所以不应宣称修复这个问题；
- 首轮、多轮、并发/断线后的 Siri UI 可见回答、朗读和连续会话状态。

综上，64 是**可回滚的协议验证候选**。它是针对真实会话、状态机和可核实诊断的下一步工程基座，并不是已经稳定的成品。全部技术修改与后续规划记录在 [docs/routine](routine/2026-11-21-00-34-AIES64-native-session-protocol-rebuild.md)。
