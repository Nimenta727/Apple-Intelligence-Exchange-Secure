# 2026-11-20 10:32 — AIES v0.7 请求优先执行基座、Siri SSE 本地生成与回滚隔离

## 触发依据

用户要求“根据这几个新的信息，进行深度修改和重组”。依据 10:15 / 10:44 PacketTunnel 本地日志的固定状态码：已看到多轮 Siri 追问能够正常完成 DeepSeek 改写尝试；但仍有两类独立问题：
1. 多次 `FOLLOWUP_GROUP_OTHER_SIRI` / `REQUEST_DIAG_FOLLOWUP_GROUP_UNVERIFIED`：Siri 续答落到其他 `siri.*` 配置组，原 62 仅识别少数组；真实组值从未公开、不能凭猜测追加白名单。
2. 多次 `RESPONSE_TAG_MISSING` / `RESPONSE_PROMPT_BODY_UNAVAILABLE` / `ERROR_PROMPT_UNAVAILABLE`：首个新连接请求已被 `REQUEST_CAPTURED`，响应钩子却无法取回 `X-AIES-Request-ID` 或请求正文。结合 `send script pending data` 高度相关，但**未证明**客户端私有实现究竟在哪层丢失标记。

用户观察“请问一下千问”较容易请求成功、直接提问可能失败，属于用户真机经验；本轮日志并未将逐字文本与配置组或代理路由精确关联，不能推导稳定的触发词规则。

## 已实施的独立 v0.7 实验架构

- **新 Runtime** `scripts/aies_siri_deepseek_v07_request_first.js`：从 v0.6 的已审核纯文本解析、SSE 严格 rewrite、Verified DeepSeek 历史等部件演进，但将整个事务收敛到**一次 `http-request` Hook**：验证 Siri UA/POST/目标路径/纯文本输入/同会话历史 → 自建 session / response / choice ID 与 12/11 帧 SSE 骨架 → 用现有 `rewriteSse` 做首次结构预检 → 调用 DeepSeek API → 校验 `stop` 完成及回答文字 → 强制写入 `【DeepSeek · AIES】` → 再次 SSE 重写审查 → 保存 5 分钟以内 verified DeepSeek-only 本机会话 → `$done({response:{status:200,...}})` 直接回给 Siri。没有 `http-response` Hook，也不依赖 `X-AIES-Request-ID`，避免原始新连接标记丢失的逻辑前提。
- **新 Shadowrocket 模块** `shadowrocket/63-AIES-SIRI-DEEPSEEK-V07-REQUEST-FIRST-LOCAL.sgmodule`：仅两条主/后续 `http-request`，`requires-body=true`、`enable=true` 且 `script-path=Script/aies_siri_deepseek_v07_request_first.js`。本地加载，避免 GitHub Raw 连接不稳定；**与稳定 62、60 远程、61 被动诊断互斥**。只有本地 JS 更新，不会更改 62 及 v0.6 生产 Runtime。
- **改为按严格能力识别续答**：已验证的 Siri UA、无工具/媒体正文、严格根/消息/content JSON 形态，以及**精确相同 URL session 的本地 DeepSeek 历史**是必要条件。在 v0.7 中，非白名单但满足窄 `siri.*` 格式的 followup 进入试验性 `FOLLOWUP_STRUCTURAL_GROUP_CANDIDATE`；明显带 tool/action/audio/video/image/location/media 的组名、陌生首轮组或未知消息类型依然拒绝。由于具体组语义未知，此路径只能放在隔离实验版，不能提升为 62 默认行为。
- **模拟测试** `tests/siri-deepseek-v07-request-first.test.js`：覆盖请求钩子直接 200 SSE/DeepSeek 来源、首轮与后两轮完整同会话延续、未知 Siri 纯文本续答、非 Siri、媒体/工具/跨会话/错误指针/过期历史拒绝、网络及模型不正常时 fail-closed、伪响应 hook 不执行。
- **仓库机制** `tools/check-docs.js` 由 3 个模块扩展为**4 个（63 是独立 OPT-IN）**、脚本 21 个、测试 3 套；静态检查 63 **2 条 request + 0 response**、本地路径且互斥，并保持请求正则和参数与已验证 60 一致。 `package.json` CI 加入 v0.7 JS 语法验证。
- **指南** `docs/INSTALL_SIRI_DEEPSEEK_V07_REQUEST_FIRST_ZH.md`：包括架构流程、按版本隔离启用、同 iCloud Script 目录、证书和 Key 无需重配、一次性真机检验、停用 63 恢复 62 的快速回滚。

## 不能夸大的结果

1. `$done({response:{status:200,body:SSE}})` 的请求拦截方式已有项目 502 失败回退行为基础，但 **200 本地 SSE 是否被真机 Siri 当成合法 session、是否真能续答**，仍未测。测试通过只证明模拟 JS、SSE 结构，不证明 iPad 端到端 UI。
2. 成功拦截的请求在此次脚本路径中不需要联系 Qwen；但 iOS/VPN/MITM 绕过、非 Siri 或不匹配 URL 情况仍可能走原生千问，**不是系统级防穿透保证**。
3. 在未知组上使用文本结构判断是一种比完全放开组名更严格的**实验**，而非 Qwen/Siri 官方协议的保证。
4. 旧 62 的 `RESPONSE_TAG_MISSING` **没有修复**，只是新 63 采用不同执行模型来绕开；用户保留原稳定 62 便于回滚。
5. 不上传原始 PacketTunnel、问题正文、Key、认证头、会话或 Choice ID，不把 SSE 上游原始回答携带到 DeepSeek。

## 下一步规划

1. 运行 GitHub PR CI：所有 v0.6 / v0.7 / 被动诊断回归，以及 docs/check-docs/语法；修复失败再合并。
2. 对 63 的直接 SSE 确认真实 Siri 端：需要**一次**普通无隐私提问及一次同会话追问。核对 `[AIES_V07] REQUEST_VALIDATED`、`SYNTHETIC_SSE_PREFLIGHT_PASSED`、`DEEPSEEK_STARTED`、`SIRI_CONTEXT_STORED`、`LOCAL_SSE_RESPONSE_READY`，最终以 Siri 界面真实显示 `【DeepSeek · AIES】` 为准。
3. 若 Siri 不接受合成 SSE/未生成会话或继续出现“无法从千问获得回答”，立即停用 63、恢复 62，不反复进行无意义测试；确认具体 `[AIES_V07] ERROR_*` 后才做协议适配。
4. 若 63 真实端有效，继续做两轮/三轮、无“千问”前缀与带前缀对照、并发/断连，记录脱敏阶段统计；再评估是否将请求优先引擎升级为默认产品。
5. 如果 63 真机不可行，另行研究更可靠的 response Hook 事务载体，而不是把“最近一次提问”作为相关性依据。
