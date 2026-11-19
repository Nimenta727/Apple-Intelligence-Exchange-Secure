# 2026-11-19 22:05 — PR #31 合并、回归验证与后续真机计划

## 本次做了什么
- 继续此前“安装项目指南”技术工作，核对 PR #29 WritingTools Compose Beta 和 PR #30 的写作工具只读 schema 探针均已合并。
- 复查 60 发现 response 阶段缺少 `User-Agent` 时，已存储的 WritingTools 请求会被误识别为 Siri。新代码仅在可验证的同事务 `X-AIES-Request-ID`、未过期存储记录及有效场景下恢复 WritingTools；明确客户端冲突仍失败关闭。
- CI 首轮发现有 token 但 response 请求正文属于另一场景时可能误通过。修复为：缺失 UA 的恢复路径中，若 response 阶段仍有完整请求 body，必须严格解析为相同场景，并与存储 prompt 一致，否则 `CORRELATION_MISMATCH`。
- 将 `WRITINGTOOLS_COMPOSE_SCOPED` 调整为成功通过 Compose 纯文本验证后才输出；新增固定 `WRITINGTOOLS_SCENE_RECOVERED_FROM_TAG` 诊断码。
- 更新 60 模块三条 Hook、测试断言、安装说明，统一固定脚本到 `975599163bafeb8c6ba8aa60624577e2a861d9f0`。61 的四条只读诊断 Hook 仍固定 `955fe4f7cec2471042469cdb7de740015db850bf`，未改。
- 新增缺失 UA / tag 有效、tag 冲突、正文修改、跨场景误配、无 tag 等 mock 负例。

## 检查与合并结果
- GitHub Actions [AIES secure offline checks](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/actions/runs/44539513032) 第二轮完成，**93 个测试全部通过**。
- [PR #31](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/31) 已合并至 `main`，merge commit `61b6112f1f912f6f918b15f3d0912474bbee4574`。
- 合并后对 `main` 的 [docs/CURRENT_STATUS_ZH.md](../CURRENT_STATUS_ZH.md) 补充了已合并状态、固定版本及设备级限制，更新提交 `5dd0221abf4f7632ffb087d284e763f950278cbf`。
- **CI/mock 并不等于真机显示成功**。仅能声称静态和模拟逻辑通过。没有取得这台 iPad 的 Compose 原始 schema、Qwen SSE 或实际 UI 接收证据。

## 未完成 / 下一步具体规划
1. 关闭 60 和其它同域拦截，只使用 61；手动在 Shadowrocket Script Test 运行 `scripts/writing_schema_probe_ONCE.js` 开启 600 秒窗口。使用不含真实个人信息的写作工具千问 Compose 文本，第二次运行同脚本读取**仅字段类型、固定安全分组 ID、SSE 事件名/顺序**的记录，报告完自动清除。避免上传原文、Header、Cookie 或 API Key。
2. 根据脱敏结构核对 `compose_selectedAndAllText`、`stream`、`input`，以及 WritingTools 的原生 SSE 是否与现有保守预检一致；如不一致，先做针对 schema 的 mock 用例，不能泛化为任意 WritingTools 功能。
3. 60 和 61 互斥切换，确认 60 主请求 `REQUEST_CAPTURED` → `SSE_PREFLIGHT_PASSED` → `DEEPSEEK_STARTED` → `WRITINGTOOLS_DEEPSEEK_PAYLOAD_READY`，以及**写作编辑器实际显示正文**；回归 Siri 简单文字和复杂引用注释。
4. 若响应阶段缺少 `User-Agent`，关注 `WRITINGTOOLS_SCENE_RECOVERED_FROM_TAG`；若 `X-AIES-Request-ID` 也丢失则保留失败关闭，继续寻找同事务可信关联，不使用最新 prompt 共享缓存。
5. 真机稳定验证之前，保持 v0.6 Beta，发布页不得声称已替换 Siri 和写作工具的所有调用。

本维护记录不包含用户文本、模型输出、认证信息或 Qwen 原生报文。