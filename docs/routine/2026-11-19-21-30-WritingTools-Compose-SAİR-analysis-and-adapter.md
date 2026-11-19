# 2026-11-19 21:30 — WritingTools Compose 源协议研究与 Siri 双场景 DeepSeek 适配（开发记录）

## 用户目标与目前证据
- 用户明确要求**Siri 与系统写作工具均尽可能由 DeepSeek 生成答案**，不是仅仅修 Siri。用户的 `qwen.log` 与 `deepseek.log` 显示目标 Qwen 网关收到了 `WritingTools (iPad - Version 27.3.0)` 的请求；旧 60 明确输出 `WRITINGTOOLS_SKIPPED`，因此对应请求未调用 DeepSeek。
- **本机仍没有 WritingTools 的完整脱敏请求/响应 JSON/SSE 样例**，所以不能声称所有写作功能（校对、改写、摘要、Compose）共享同一网络协议。
- 原项目 [boitar/sair](https://github.com/boitar/sair/blob/main/scripts/sair_adapter.js) 通过 `configuration.response_configuration_group_id` 中的 `compose` / `selectedAndAllText` 推断写作场景，向客户端输出 SSE 包装的 `{"body":"...","refinements":[...]}`；Siri 则输出 `{"content":"...","suggestions":[],"summary":"..."}`。这是**SAIR 第三方逆向而非 Apple 官方稳定协议**。
- 官方 [Apple Writing Tools](https://developer.apple.com/documentation/uikit/writing-tools) 确认写作功能存在场景/上下文区分，但不提供 Qwen 私有字段。独立研究 [Eclectic Light AIR](https://eclecticlight.co/2026/09/22/read-an-apple-intelligence-report/) 说明 Apple 自有模型与第三方桥接服务并非同一网络日志层，不能用它来猜千问 SSE。
- 浏览器上可核查的社区 [V2EX 国行体验](https://www.v2ex.com/t/1254313)、[V2EX 千问入口](https://v2ex.com/t/1232913) 与 [Lumia AppleStorm](https://www.lumia.security/blog/applestorm) 提供 UI/隐私边界参考，但**不提供独立可复验的 Compose 请求 JSON**。详见 [社区证据分级文档](../COMMUNITY_APPLE_INTELLIGENCE_REQUESTS_2026-11-19_ZH.md)。

## 当前开发分支代码修改
1. `scripts/aies_siri_deepseek_v06.js` 增加 `parseWritingToolsRequest()` 与 `parseApplePrompt()`：保留 Siri `siri.multimodal.noRTI`/历史 tqa 解析；写作工具只有 UA=WritingTools 且 group **精确等于** `compose_selectedAndAllText`、请求为已知纯文本包装时进入 DeepSeek。
2. 合成 SSE 用场景参数输出两种答案 JSON：WritingTools `body/refinements`，Siri `content/suggestions/summary`。仅从真正 HTTP 200、finish_reason=stop 的 DeepSeek 答案生成所有可见文本；成功时保留 `【DeepSeek · AIES】` 来源标识。
3. 临时请求状态存储 `scene`，响应阶段必须与同一事务请求/组别一致；**不借鉴 SAIR 全局最近请求 fallback**，因为两个入口可以同时调用，错误关联会造成私密内容串答。
4. 增加 WritingTools Compose 成功、未知 group 拒绝、工具/媒体/未知字段拒绝、Siri/WritingTools 不允许交叉关联的 mock 回归用例；本轮代码尚需 CI 与真机验证，不能宣布 WritingTools 已完成。
5. 正在更新模块的固定运行 SHA、安装/安全/当前状态文档及整合源链接。旧 61 只读诊断未改动，60 的已确认 Qwen SSE 注释校验保持现状。

## 未完成项与下一步计划
1. **必须先完成 mock CI**：确保新测试与现有 Siri 复杂注释、失败关闭、隐私测试均通过；任何失败都不能简单放宽全部工具/媒体/非目标请求检查。
2. 核对写作工具的 `response_format`/SSE 兼容性。当前仅根据 SAIR 协议实现 `compose_selectedAndAllText`，本机真实 Compose 仍需通过受控且不含个人信息的字段类型探针确认。Unknown group 应固定失败关闭而非猜。
3. 写作工具与 Siri 间的响应事务关联尤其重要；响应没有 UA 时，只有可以证明与原请求属于同一事务的随机 Token 或本事务 body 才能恢复场景。**不复制 SAIR 的 `SAIR_LATEST_PROMPT` 逻辑**。
4. 同步 60 的全部三个 Hook 到不可变单一 JS commit，并在测试里验证。61 仍保持独立只读。
5. 用户在 iPad 的写作工具“创作”中选择一条非隐私文本，实际验证固定阶段码、DeepSeek 真实 API 和编辑器可见结果；再回归一次 Siri 简单/复杂问句。UI 验收前，项目仍标注 Beta，不能宣称每种写作工具操作都已 DeepSeek 化。
6. 本项目的每一次 GitHub 更新都在 `docs/routine/` 添加日期和变更简介及下一步计划，避免先前调试历史缺少维护索引。

## 不直接照搬 SAIR 的部分
- 全局最近提问/最近场景缓存（并发、跨任务串答风险）。
- `fallback=true` 把原生 Qwen 文字当作改写结果的路径。
- 递归抓取多媒体/隐藏上下文或把完整请求、私人写作内容、认证头、API Key 放入日志。
- 用 Siri 的 `content/suggestions/summary` 替代写作工具的 `body/refinements`，或向未知组套用一个“通用”写作结构。

**状态**：研究与开发分支进行中，尚未合并到 `main`；生产设备上 60 仍沿用原行为。
