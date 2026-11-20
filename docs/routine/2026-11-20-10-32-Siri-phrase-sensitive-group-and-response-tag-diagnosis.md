# 2026-11-20 10:32 — Siri 提问方式敏感：多组路由与首次响应 tag 丢失

## 用户观察与 10:15 真机日志的独立证据

用户报告：以“请问一下千问”开头较易成功；直接提问时偶尔不成功；初次及后续会话都可能显示“无法从千问获得回答”，整体失败概率下降。随附 `PacketTunnel-20261120101542.log` 为 10:15:42–10:29:37（5,636 行）的 Shadowrocket 隧道日志。

仅从 `[AIES_V06]` 固定状态码计数，未收集用户问题内容、真实 group 值、会话 ID、任何请求/响应原文：
- `REQUEST_CAPTURED` 29 次，`DEEPSEEK_STARTED`、`SIRI_CONTEXT_STORED`、`DEEPSEEK_RESPONSE_ATTEMPTED` 均各 23 次；这只能证明发起并尝试提交改写结果，**Siri UI 是否显示要独立验证**。
- `FOLLOWUP_PREVIOUS_CHOICE_MISSING` 16 次，`FOLLOWUP_SESSION_CONTEXT_RECOVERED` 16 次；证明此前 PR #38 的缺失字段的同会话上下文适配已**在真机命中**。10:18:00、10:18:13、10:18:25 连续后续请求进入 DeepSeek 并完成响应改写尝试。
- `ERROR_UNSUPPORTED_SIRI_REQUEST` 10 次：其中 `REQUEST_DIAG_FOLLOWUP_GROUP_UNVERIFIED` **9 次**、`REQUEST_DIAG_GROUP_UNSUPPORTED` **1 次**。这证明 Siri 产生了超出当前配置组白名单的请求，但日志未包含原始 group 值，**不能证明必然是 TQA**。
- `RESPONSE_TAG_MISSING`、`RESPONSE_PROMPT_BODY_UNAVAILABLE`、`ERROR_PROMPT_UNAVAILABLE` 各 **5 次**。其中多次发生在 Shadowrocket 对新建立连接使用 `script http request save data to pending data` / `send script pending data` 的首个请求期间，随后同一连接复用的请求可正常关联；这是时间上的相关性，**尚不能证明 Shadowrocket 丢弃改写头的确切机制**。
- 29 次请求捕获与 23 次成功改写 + 5 次关联失败并非完全一一对应：至少有一个捕获请求在此日志范围内未观察到完整响应回调，不能将它算为成功或失败。
- 用户口头观察与不同 Siri 服务路由的时机相符，但日志没有记录哪一句话对应哪个 group，不能断言“请问一下千问”这个短语对系统路由有稳定决定性影响。

## 修复方案与仓库变更

1. 在 `scripts/aies_siri_deepseek_v06.js` 中**仅**将项目原本已允许主 Siri 请求的 `siri.tqa` / `siri_tqa` 组纳入**后续纯文本**白名单；严格运行与 `siri.multimodal.noRTI` 相同的观测文本包装结构校验。仍须 Siri User-Agent、同 URL 会话的短期已验证 DeepSeek 上下文、事务 tag 关联及原生 SSE 预检全部成立，DeepSeek 真正成功才返回带来源标记的输出。不同群组不自动共享其他 session。
2. `followupIds()` 在读入后续请求时仅接受 `siri.multimodal.noRTI` 或 **精确两种 TQA 标识**；其他未知组不做隐性 fallback。
3. 新增严格、**不披露原 group 值**的 `FOLLOWUP_GROUP_TQA_TEXT`、`FOLLOWUP_GROUP_OTHER_SIRI`、`FOLLOWUP_GROUP_OTHER_UNVERIFIED`、`MAIN_GROUP_OTHER_SIRI`、`MAIN_GROUP_OTHER_UNVERIFIED` 固定诊断码，先搞清楚被拒的实际类型范围。对未知组、媒体/工具内容、非 Siri 客户端和不匹配会话保持失败关闭，**不把其内容转发 DeepSeek**。
4. `tests/siri-deepseek-v06.test.js` 添加已验证 TQA 的后续问答、缺失指针恢复、跨会话与其他客户端/媒体/工具/未知组阻断，以及主请求其他组的隐私安全分类测试。
5. 60 Remote 四 Hook 固定运行时更新至 `637484295c10627f06e610bfe040dd58e67d309a`；62 LOCAL 规则及 `Script/` 相对路径**不变**，只更新本地 JS 新版 SHA 注释；同步静态检查和安装指南。用户 62 LOCAL 必须从固定 SHA **手动覆盖** `iCloud 云盘/Shadowrocket/Script/aies_siri_deepseek_v06.js`，不需要重新装 62 或重新配 Key/证书。

## 暂不强行修的独立问题

- **首次连接 `RESPONSE_TAG_MISSING`**：不能因只剩一个 pending 问题、最后提问或 TCP stream ID 猜测其所属用户会话。这会引发不同问句串答或把私人问题发送错对话。继续 fail-closed 返回 502，Siri 可能显示“无法从千问获得回答”；这比未经证实地把 Qwen 内容冒充 DeepSeek 更可控。
- 后续需要单独评估更稳定的请求/响应事务载体，或研究不依赖自定义请求头的**自洽响应方式**；任何方案都必须保证关联可验证且合成 SSE 能被 Siri 真机接受。不能未经验证就发布“首次请求已完全修复”。
- 若 Siri 完全未走目标 Qwen HTTP Hook（系统级意图分类或其他网络通路），本项目无法基于此脚本保证接管，亦不应宣称“请问一下千问”是可靠开关。

## 下一步规划

1. 提交 PR，运行完整 CI，修复所有测试失败后再合并；不能把 mock PASS 当作真机成功。
2. 用户更新本地 JS 到新 SHA 后只进行**一组**普通无隐私的直接提问和同会话后续追问（无需再次运行 61 或其他手动探针）。
3. 若出现 `FOLLOWUP_GROUP_TQA_TEXT` + `REQUEST_CAPTURED` + `SSE_PREFLIGHT_PASSED` + `DEEPSEEK_RESPONSE_ATTEMPTED`，再以 Siri UI 每轮看到 `【DeepSeek · AIES】` 为准确认这条新路由接管；若是 `FOLLOWUP_GROUP_OTHER_SIRI`，只分享固定码，按照**具体组的协议形态**再定准入，而不盲目放开所有组。
4. 若是 `RESPONSE_TAG_MISSING`，不要让用户无限重试：该问题待独立的稳定事务关联方案、可复现 mock 和真实 Shadowrocket 新连接测试。
5. 整理脱敏的分支计数和每阶段成功/失败的本地观测方案（不采集用户问句或会话标识），针对是否直接提问与带唤醒词触发不同路径进一步设计可验证实验。

## PR #39 合并与质量检查确认

- [PR #39](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/39) 已合并到 `main`；merge commit `5922d93ca49064c378ca8c1d8eb88adff20d355f`。
- [GitHub Actions](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/actions/runs/44662425802)：**120 tests / 120 pass / 0 fail**，覆盖新 TQA followup 正例、同会话与 SSE 校验，以及未知组、非 Siri、图像、工具、跨会话拒绝。
- 发布源码的 immutable commit 为 `637484295c10627f06e610bfe040dd58e67d309a`，**60 Remote** 四条 Hook 已 pin 到此版本。**62 LOCAL** 仍采用固定本地路径 `Script/aies_siri_deepseek_v06.js,enable=true`，用户必须人工覆盖本地 JS 才能运行本次新逻辑。
- **下一步**不是重新跑 61 协议探针，而是用新本地 JS 做一次无隐私、直接提问+续答的真实 Siri UI 检验；留意 `FOLLOWUP_GROUP_TQA_TEXT` / `FOLLOWUP_GROUP_OTHER_SIRI` / `RESPONSE_TAG_MISSING` 的固定分类码，并结合每轮来源标记判定。**尚未证明此前 9 次拒绝是 TQA 组，也尚未解决新连接的 header/tag 丢失。**
