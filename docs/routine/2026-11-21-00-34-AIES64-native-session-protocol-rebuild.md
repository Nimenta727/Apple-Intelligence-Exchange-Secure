# 2026-11-21 00:34 — AIES 64 Native Session 重写：Siri/DeepSeek 协议内核隔离重构

## 用户要求与证据范围

用户整理 8 项技术结论，要求重做模块并明确强调“**一定不要盖坏了**”。核心需求是连续对话协议、真实上游 SSE 状态机、会话身份一致性、场景 JSON Schema、耗时与错误分类，而非再次凭空伪造会话。研究依据：

- 用户提供的 SAIR/Apple–Qwen 技术总结，以及本仓库此前 60/61/62/63 的日志/代码验收结论；其中 62 已观察到部分真实 Siri 多轮成功，63 请求优先合成 SSE 在 11:25 真机失败并禁用。
- [boitar/sair README](https://github.com/boitar/sair)、[第三方协议分析](https://github.com/boitar/sair/blob/main/docs/protocol_analysis.md) 和 [`sair_adapter.js`](https://github.com/boitar/sair/blob/main/scripts/sair_adapter.js)：它使用官方千问上游响应作为 SSE 基础；约 6–8 秒 Siri 等待窗口是经验估计；SSE 列举 27 种事件并不意味着每条响应严格 27 帧；各场景有不同 JSON 合同。其实现也含 `SAIR_LATEST_PROMPT` 全局回退，AIES 没有照搬，以免跨会话串答。
- AIES 已有的真机证据：首轮 URL 与 `/v1/sessions/{session_id}/responses` 追问 URL、缺失/null/无效 choice 指针、`FOLLOWUP_GROUP_OTHER_SIRI`、`RESPONSE_TAG_MISSING`、原生多轮 SSE、63 失败时客户端不接受本地伪造会话。均不能推出 Apple 官方完整协议、未知组必然是纯文本、脚本最后提交就等于 Siri UI 已接收。

## 本次修改（独立新增，不覆盖旧文件）

1. **新运行时** `scripts/aies_siri_deepseek_v08_native_sse.js`：基于 AIES 原来的 v0.6 已验证逻辑建立独立 v0.8 版本，保留官方千问 SSE 首轮/追问、真实上游 session/response/choice 标识与本地 DeepSeek-only 会话历史。不再采用在真实设备失败的 63 “请求侧自造 SSE/session”。
2. **协议审核**：在 HTTP response Hook 中，DeepSeek 请求发起前执行 `auditNativeSse`：检查 SSE 事件白名单与首轮/追问状态顺序、delta 次数与 done 一致性、终态文本一致性、session/response/choice 跨帧关联、Siri `content/suggestions/summary` 与 WritingTools `body/refinements` 类型。注释事件在已观测位置可重复；新/未知事件或协议异常以 `SSE_AUDIT_...` 固定码失败关闭，避免预检不足造成错答、串答与无意义的 DeepSeek 费用。SSE 仍采用安全文本重写与新的原生身份字段，不把上游 Qwen 内容作为 DeepSeek 输出，也不声称字节级保留未知字段。
3. **分层路由分类**：`classifyScene()` 将已知 Siri 首轮/追问 noRTI、TQA、WritingTools Compose、视觉智能（禁止当前实现转换）与未知 Siri 组分类成固定状态码。分类只是日志诊断；**不放宽实际 parser 的纯文本及组名白名单**。因此可观察缺失路由，不能因此无意调用 DeepSeek。
4. **耗时与限额**：新增本地请求关联 `capturedAt`（仅存 Shadowrocket 本地记录，不打印），用于推算 `UPSTREAM_ELAPSED_...`、`MODEL_ELAPSED_...`、`END_TO_END_ATTEMPT_...` 有限耗时档位。Siri 总预算估计 `7400ms`，保留 `350ms` 转换缓冲，DeepSeek 等待上限约 `6200ms`。该数值是 SAIR 经验值假说，不是 Apple 确认的官方固定截止时间；若因预算不足返回 502，须真机验证调整。
5. **事务失败可解释且继续 fail-closed**：新增 `CORRELATION_NO_TAG_NO_VALID_BODY`、`CORRELATION_NO_VALID_PROMPT`；如果 Shadowrocket 同时没有事务 tag 和同一响应钩子可验证的请求正文，不从所谓“最近问题”猜测，不把千问内容冒充 DeepSeek。无法证明第一请求的关联问题已被治愈。对已经生成 DeepSeek 答案却无法保存可靠 session 的情况改为失败关闭，避免产生无法续答的错误会话。
6. **新增 `shadowrocket/64-AIES-SIRI-DEEPSEEK-V08-NATIVE-SESSION-LOCAL.sgmodule`**，独立 iCloud 文件名 `Script/aies_siri_deepseek_v08_native_sse.js`，四条请求/响应匹配规则与 62 的已验证规则相同，**全部 `enable=false`**，绝不自动抢占现存可用模块。
7. **新增 `tests/siri-deepseek-v08-native.test.js`**，验证原生 Siri session/model ID 保留、第二问同一会话、重复增量不等于固定 27 帧、错误顺序、正文 delta/done 冲突、最终文本不一致、场景 Schema 非法、未知组/视觉阻断、跨会话、关联标记缺失、超时预算、模型失败后的不透传。
8. 修改 `tools/check-docs.js`、`package.json`，给 64 新文件和 JS 语法/单测增加 CI，静态断言 64 **四条关闭**、本地路径和匹配正则与 62 一致，同时继续保护 62 的 `enable=true` 与 63 的 `enable=false`。
9. 新文档 `docs/INSTALL_SIRI_DEEPSEEK_V08_NATIVE_ZH.md`：详细边界、独立安装、互斥配置、一次性真机验收和立即回滚。

## 绝不覆盖的内容

本 PR **不得修改**：`scripts/aies_siri_deepseek_v06.js`、`scripts/aies_siri_deepseek_v07_request_first.js`、原 60/61/62/63 `.sgmodule`、任何用户本地 DeepSeek Key/MITM 证书、原始 PacketTunnel 日志。每次 CI 必须继续运行原有 v0.6/0.7 测试。

## 未解决与风险

- 现有 62 的间歇 `RESPONSE_TAG_MISSING` **不是**本版已解决的故障，v0.8 仅新增了安全失败分类，不能伪造跨响应关联。
- 如果原生 Qwen SSE 存在尚未观测的合法事件、混合文本或 JSON 结构，新增审计会拒绝；必须根据设备实测重新标定子集，不能在未经审查时放宽。
- SAIR 对 6–8 秒的陈述仅是第三方估计；客户端接收/朗读/Siri 唤醒路由不能由本地日志证明，也无法靠代理脚本保证 iOS 一定调用千问扩展。
- 历史真实协议含隐私数据，**不上传任何原始请求、日志、session ID、用户提示词、DeepSeek Key 或 Apple 私人字段至 GitHub**。
- 64 属研发候选版：哪怕 CI 通过，也必须等到 Siri 真机出现可见来源标记且至少连续追问两轮，才能评估默认化，暂时不能覆盖 62。

## 下一步规划

1. 创建 PR，运行全部 v0.6、v0.7、v0.8 测试及静态检查，修复 CI 失败后才合并。若无法通过，则保留分支，不修改 main。
2. 核验 main 62 四条 Hook 原本的 `enable=true` 与 63 已禁用，64 四条都仍 `enable=false`。
3. 用户明确自愿测试 64 时，将新 JS **单独保存**到 iCloud Script 目录，备份后关闭 62、再启用 64，先进行一组无隐私 Siri 首轮和紧随其后的一次追问。
4. 记录固定日志 `SCENE_*`、`SSE_AUDIT_*`、`UPSTREAM_ELAPSED_*`、`MODEL_ELAPSED_*` 和最终 Siri UI 是否展示 `【DeepSeek · AIES】`，若失败立即回滚 62，避免继续让用户耗时试错。
5. 以真机抓到的**脱敏事件类别、数量和序列**扩展协议状态机，不收集真实内容；专门研究 Shadowrocket 新连接 `pending data` 下无 tag 的可靠事务载体，不能用 global latest 回退替代验证。
6. 通过两轮/三轮、直问与显式千问唤醒、并发、弱网、延迟的真机回归后，才考虑 v0.8 生产版。完整场景视觉及其他写作工具功能仍需各自独立协议验证。

## 续答标识一致性二次审查与补充测试

用户提出“必须维护 Apple 期待的会话生命周期”，因此在初版 147 项测试通过后进一步审查了 `choice_id`。发现最初从 62 派生的 `rewriteSse` 仍留有 `choice_aies_<response_id>` 的本地 ID fallback。这个行为可能造成类似 63 的未经验证 continuation 身份，所以 **64 现已删除该 fallback**：SSE 审核必须在真实上游 `session.response.choices[].added.choice.id` 中获得合规 ID，最终重新构建后的 SSE 仍使用这个原生 ID；缺失时直接记录 `SSE_AUDIT_CHOICE_ID_MISSING` 并返回 502，**在 DeepSeek 计费之前终止**。先前 62 保留原逻辑未动。

独立测试 `nativeSse` 的模拟样本明确附加跨 added/completed/done/final 一致的 choice ID，并新增“上游缺失 ID → 拒绝 → DeepSeek 不调用”的反向回归。**此测试用例是人工模拟，不是用户真实 iPad SSE 包**；尚不确定真实 Qwen 在每种事件中都提供 ID，因此 64 可能拒绝一些真实但不完整的会话骨架，仍应保持默认禁用。

后续规划更新：先以真实设备的仅类型/事件阶段日志验证 choice identity 的存在性，再评估能否兼容其他已验证的官方指针承载方式；绝不自行猜测或合成会话指针。

## 合并结果与最新测试（2026-11-21）

- [PR #42](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/42) **已合并到 main**，merge commit `d67055bb9bffdc9d8bf9ea7af522de77544f7b17`。
- [GitHub Actions](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/actions/runs/44777642089) 最终 **148 项测试全部通过、0 项失败**，包括新增“原生 choice ID 缺失则拒绝且不调用 DeepSeek”的反向测试、原 ID 无改写的正向断言，以及原 v0.6/0.7 全量回归、Node 语法和静态配置检查。
- PR 修改文件逐项核对：只添加新的 64 运行时、64 本地模块、v0.8 单元测试、中文指南和本 routine，并更新 README（中英）、当前状态、package.json 与 tools/check-docs.js。**未修改** 60/61/62/63、旧 JS 运行时或用户本机配置。
- main 的 64 **四条 Hook 仍为 `enable=false`**，当前推荐继续使用经部分真机验证的 62 LOCAL。63 仍为隔离禁用状态。
- 下一步优先验证真实 SSE 的 choice ID 是否在所有需续答的流中可靠存在、上游终态 JSON 与增量关系是否符合目前的保守审计；在新协议证据出现前，不扩大未知 Siri 组白名单，不采用全局最近问题 fallback，不把 CI 通过视为 iPad Siri 通过。
