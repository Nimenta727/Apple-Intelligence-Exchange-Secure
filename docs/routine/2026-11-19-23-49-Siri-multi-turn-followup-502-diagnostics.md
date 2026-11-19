# 2026-11-19 23:49 — Siri 第二问失败：两份日志定位 + 会话级无正文探针

## 本次工作与证据边界
用户反馈：iPadOS 27.3 / Shadowrocket 仅启用 60 模块时，Siri 第一次回答能显示 DeepSeek 来源标记，但后续追问无法稳定显示；提供两份本机 PacketTunnel 日志。日志可能含 Authorization 等敏感内容，**未提交原始文件、原始 HTTP 报文、密钥、问答正文或会话 ID 到仓库**。只解析 `[AIES_V06]` 固定阶段码和时间：

| 日志时段 | REQUEST_CAPTURED | SSE_PREFLIGHT_PASSED | DEEPSEEK_STARTED | DEEPSEEK_RESPONSE_ATTEMPTED | RESPONSE_TAG_MISSING + ERROR_PROMPT_UNAVAILABLE | QWEN_SESSION_FOLLOWUP_SSE_BLOCKED |
|---|---:|---:|---:|---:|---:|---:|
| 23:42–23:44 | 4 | 3 | 3 | 3 | 1 | 6 |
| 23:45–23:47 | 6 | 5 | 5 | 5 | 1 | 1 |

**可靠结论**：DeepSeek 并非只能被调用一次；后续多次真实 HTTP 模型回复通过代码校验并合成 / 提交 SSE。用户的“只第一问成功”是 Siri UI 端到端体验；提交并不等于 Siri 接受。60 的第三条 Guard 对 Siri 会话级 SSE 主动返回 502，与“连续提问被中断”存在高度相关性，但日志无法证明七次 Guard 正好对应哪条 UI 失败；另外两次无可信请求关联导致 502，是独立故障。

## 本次代码改动
1. **60 生产脚本保持原状**：不贸然全局关闭 Guard，不将未验证的 Qwen 后续会话当作 DeepSeek 回答，也不引入共享最新提问缓存。
2. **61 被动脚本**新增 `followupShapeProbe()`，单独监听已有 `/v1/sessions/{id}/responses` Hook，前提是手动开启 600s、Siri UA、POST；请求阶段只保留有限 JSON 字段名/类型，响应阶段只保留状态码、SSE 事件名/顺序/数量、严格预检分类；**不保存问答、URL、session ID、Header、Token、Key**。两类事件独立观察，不冒称一一配对。
3. 新增 `scripts/siri_followup_schema_probe_ONCE.js` 和 `scripts/siri_followup_schema_probe_STOP_ONCE.js`，本地 Script Test 手动开启、二次读取、逻辑清空和手动 STOP。默认不采集，61 依旧只执行 `$done({})`，不改写/重路由/调用 DeepSeek。
4. 在 `tests/qwen-passive-diag.test.js` 增加默认关闭、仅同域会话级 Siri POST、字段类型与 SSE 无敏感值、无 DeepSeek API、停止不改动密钥的回归测试；`tools/check-docs.js` 增加两个新辅助脚本的清单要求。
5. 更新 61 的 **四条 Hook 固定不可变 runtime SHA**、安装说明、被动诊断指南、错误分析表。用户应关闭 60，独占启用 61 采集一次不涉及个人内容的原生两问结构。

## 仍未解决 / 不能宣称完成
- 当前只添加后续会话的保守诊断手段，**没有**让 60 自动改写 `/v1/sessions/{id}/responses`；第一问能看到 DeepSeek 不代表之后均可。
- Followup 的真正 prompt、历史上下文、session continuation 语义、请求与响应同事务关联及 iOS UI 接受逻辑尚无可靠证据。若仅全域放行 Qwen 或直接关 Guard，可能恢复部分 Siri 界面但**不是纯 DeepSeek**。
- 真机 61 只读脚本也可能因 Shadowrocket SSE 缓冲/UA 条件而未记录完整响应；不能用未捕获推导未调用。
- [本次 PR](../../README.md) 必须等 CI/审查完成后才能考虑合并；真机状态仍是 Beta。

## 下一步规划
1. 本功能分支跑全量 GitHub Actions：Node syntax + tests + docs links；如失败，先修复缺陷而不是降低安全条件。
2. 用户 iPad 更新 61，保持 60 停用。用 `siri_followup_schema_probe_ONCE.js` 在 Shadowrocket Script Test 手动开启一次 600 秒窗口，做两条普通、无隐私的同会话 Siri 文本问答，第二次执行仅回传经过检查的 `TRACE_PART_*` 结构摘要；若不需要继续则运行 STOP。
3. 分析 Request 的 group/schema 及 SSE event class、文本承载位置、Client UA 是否随阶段传递；针对确证协议增加 followup mock 正/负例并设计 session-safe correlated rewrite，同时不将 Siri/写作工具串答。
4. 真机对比相同两问的 61 原生流、60 主接口改写及真实 UI 显示；确认 SSE 替换在 Siri 全部后续轮次实际可见之前，不发布稳定版。
