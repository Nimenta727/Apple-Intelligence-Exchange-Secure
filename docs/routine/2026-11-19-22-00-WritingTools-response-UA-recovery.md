# 2026-11-19 22:00 — WritingTools 响应阶段 User-Agent 丢失的安全场景恢复

## 本次排查
- 已在 `main` 确认 PR #29（Siri + WritingTools Compose Beta）及 PR #30（手动开启的 WritingTools 无正文 schema/SSE 观察器）合并。
- 静态审查发现：60 的响应 Hook 在 `$request.headers` 缺少 `User-Agent` 时，一律把 `activeScene` 视作 Siri，即使请求阶段保存的同一事务 token 实际指向 WritingTools，从而把 `body/refinements` 的场景误当成 `content/suggestions/summary`；这属于可复现的代码边界，**并非宣称真机已出现此故障**。
- 另发现 `WRITINGTOOLS_COMPOSE_SCOPED` 曾在 WritingTools UA 命中但 group/正文尚未解析前就输出；未知组也显示成功进入 Compose，易误导设备诊断。

## 已在功能分支修改
1. `scripts/aies_siri_deepseek_v06.js`：在 response hook 里，仅当 `X-AIES-Request-ID` 与持久层短期记录匹配，且记录含有效 `scene/prompt/TTL`，**同时真实响应 UA 为空**，才允许恢复 WritingTools 的场景选择。保持 Siri 的原有场景和结构化 SSE。
2. CI 首轮指出原有跨场景测试会在“无 UA + 正文明确属于 Siri + token 属于 WritingTools”组合下误放行；已加防护：缺 UA 恢复场景时，如响应阶段存在请求正文，该正文也必须严格通过当前恢复场景的解析，否则 `CORRELATION_MISMATCH`，不允许使用 stored prompt 继续回包。明确 Siri/其他 UA 与 token 记录冲突时，仍 `CORRELATION_MISMATCH`。缺 token、过期、无完整可信上下文时不采用最近请求或最近正文 fallback。
3. 增加 `WRITINGTOOLS_SCENE_RECOVERED_FROM_TAG` 固定状态码；`WRITINGTOOLS_COMPOSE_SCOPED` 延后到纯文本 Compose 请求验证成功才输出。
4. `tests/siri-deepseek-v06.test.js` 增加：仅凭有效 token 在 response UA 缺失时恢复 WritingTools（带/不带响应期 body）、冲突 UA 拒绝、改写的请求 body 拒绝、无 token 拒绝；同步更新未知组的日志断言。
5. `shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule` 的三条 Hook 统一固定到本轮脚本不可变提交 `975599163bafeb8c6ba8aa60624577e2a861d9f0`，安装文档与测试固定 SHA 一并同步。61 不改变。
6. 本记录保留历史故障判定和设计取舍；不收集私人写作内容或 Qwen/DeepSeek 凭据。

## 仍然存在的限制
- 恢复逻辑只能处理 **UA 丢失但事务 token 保留** 的情况；如果 Header 中 token 同样丢失，且 response hook 无法可靠验证同一事务，依旧失败关闭。
- PR #30 的 61 新 WritingTools schema 探针只保存分组白名单、字段类型和 SSE 事件结构，不能以此证明已有原生 UI / API 成功。
- 以上是代码推导与 mock 路径；尚需 GitHub CI 和真实 iPad 验收，不能发布成稳定版。

## 下一步规划
1. 首轮 GitHub CI 92/93 通过，其中原有 Siri/WritingTools 跨场景测试暴露上述缺陷；修复后重新运行本分支 `npm run check` 的 GitHub Actions CI；如有失败，修复后再考虑合并 PR。
2. 确认 60 模块的 3 条 Hook 均固定到同一脚本 SHA，61 的 4 条不受影响；核对 README/安装文档并更新发布矩阵。
3. 手动互斥启用 61，使用无个人信息的 WritingTools Compose 文本运行一次 `writing_schema_probe_ONCE.js`：获得真实组名、请求字段类型与 SSE 事件名称，不上传完整原文、认证头或 API Key。
4. 然后只开启 60 对同一非隐私问题运行 Compose，核对 `REQUEST_CAPTURED` → `SSE_PREFLIGHT_PASSED` → `DEEPSEEK_STARTED` → `WRITINGTOOLS_DEEPSEEK_PAYLOAD_READY` 与编辑器实际正文；必要时检查新 `WRITINGTOOLS_SCENE_RECOVERED_FROM_TAG`，验证是否发生 Header 丢失。
5. 如 token 也缺失，应以**设备支持的同事务关联标识**设计后续适配，而不是全局最近请求缓存；旧 Siri 简单/复杂 SSE 和跨场景泄漏负例都要回归。

**状态：GitHub 功能分支验证中；真机端到端未验证。**
