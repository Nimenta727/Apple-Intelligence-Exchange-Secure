# 2026-11-20 00:25 — Siri 连续提问：基于真机 schema 的 DeepSeek followup Beta

## 新增真机证据
用户先前安装新版 61 的 Siri 会话级无正文探针，并手动分享 `CAPTURED_LOCAL_PROTOCOL_SCHEMA`、`RECORDS=2`、`CAPTURE_CLEARED` 及共 15 段结构报告。报告中：后续会话的 POST 请求属于 `/v1/sessions/{id}/responses`，JSON `configuration.response_configuration_group_id=siri.multimodal.noRTI`，新字段 `previous_choice_id:string`，`input` 是单条消息包裹的纯文本结构。上游 HTTP 200，18 个 SSE JSON 事件，从 `session.response.created` 开始，无 `session.created`，包含 4 个文本 delta 和 4 个 `text.annotations[].added`；原生 Qwen 的引用事件在 `text.value.done` 后。初代主接口 preflight 返回 `EVENT_ORDER_UNSUPPORTED`，应按 followup 的独立事件形状处理。

**隐私**：未将用户 PacketTunnel 报文、身份、API 密钥、选中文本、问题/回答原文、URL session/choice 标识提交仓库。已观察报告仅公开非敏感字段名与类型、事件名/计数。

## 代码 / 配置变更
1. `scripts/aies_siri_deepseek_v06.js` 增加 followup 请求路径支持，只准 Siri 已知 noRTI 组、严格纯文本、合法 `previous_choice_id`；响应阶段同事务 `X-AIES-Request-ID`/本地 45s 临时存储必须可验证。
2. 由已经**成功**由 DeepSeek 生成且被本地改写器验证的 choice ID 建立短期同会话关联，最多三轮历史、逻辑 TTL 五分钟，记录仅存在 Shadowrocket 本机 `$persistentStore`；它包含用户实际问题及 DeepSeek 的完整回答，不向日志、GitHub 或其他服务主动发出。其自动过期为逻辑校验，**并不保证物理擦除**；实际后续轮使用这些历史作为 DeepSeek API 输入。
3. `rewriteSse` 根据主/续答两条协议选择事件序列：续答无 `session.created`；严格要求 response.session_id 匹配 URL session、response.done 的 ID/session 一致、没有工具/审核输出，丢弃所有 Qwen 引用注释及原生回答文本，只构造带 `【DeepSeek · AIES】` 的 DeepSeek 回包。
4. 60 模块由以前主 Request、主 Response、会话 SSE Guard **三 Hook** 调整为主 Request、主 Response、followup Request、followup Response **四 Hook**，全部固定同一不可变 runtime SHA。61 只读诊断模式保持独立不变。
5. 在 `tests/siri-deepseek-v06.test.js` 增加两/三轮续答、无前轮或过期 context、跨 session、非法 previous choice、响应无 tag、SSE session 失配、WritingTools 非串线等隔离测试；更新 `tools/check-docs.js` 约束四条 60 Hook；更新安装/排错/当前状态文档。

## 没有做的事情 / 风险
- 这是**根据 1 份请求+响应 schema 摘要及先前两份故障计数推断**的 Beta；Request 和 Response 在纯观察 61 下并未加事务 tag，因此无法证明观测的两条一定同事务。
- 尚未做 iPad Siri UI 真机两/三轮闭环。真实 `previous_choice_id` 能否等于 AIES 改写所回传的 choice ID 未验证；Shadowrocket 是否在 followup Response Hook 保留新 header 未验证。若失败关闭 502，不能称稳定版。
- 这次将部分对话文本短期保存在设备本地，需明确用户知悉；不进行不安全的全局最新问题/本地原生 Qwen 历史兜底，也不做自动全部 Qwen 流量阻断。

## 下一步规划
1. 提交 PR、运行完整 GitHub Actions CI（静态检查、语法、Node 模拟）；错误先修复，确认无安全回归后合并。
2. 用户在 iPad 备份 Shadowrocket 配置，关闭 61/旧规则，刷新或重装 60；确认**四条 Hook 的固定脚本 SHA**完全相同。已有 Key 无需重复录入。
3. 只使用无个人信息的纯文本，在**同一次 Siri 会话连续问两轮和三轮**。观察每轮 UI 是否有 `【DeepSeek · AIES】`；仅记录固定 `[AIES_V06]` 代码（特别是 `SIRI_CONTEXT_STORED`、`ERROR_FOLLOWUP_* `、`SSE_PREFLIGHT_PASSED`、`DEEPSEEK_RESPONSE_ATTEMPTED`）。
4. 若出现 `ERROR_FOLLOWUP_CONTEXT_UNAVAILABLE`，先研究真实 `previous_choice_id` 与合成 choice ID 关联（仅对比是否匹配，勿记录/外泄值）；若 `ERROR_SSE_REWRITE_UNSUPPORTED`，继续只读、安全的 SSE 结构归类，不导出原文。
5. 真机确认两/三轮后，再研究网络断联、响应 UA 丢失、快速连续问题、不同 Qwen 会话、上下文清理及可撤销数据保留等边界，避免宣称系统级零 Qwen。
