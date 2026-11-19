# Apple Intelligence Exchange Secure (AIES)

**实验性 Shadowrocket Siri + Apple 写作工具 → DeepSeek 文本回答改写项目。**

> **v0.6.0-beta · 2026-11-19 真实协议已观测，至少一次可见 DeepSeek 标记已成功；复杂问答仍不稳定。**
>
> 60 模块支持已实测的 Siri 文本，以及根据 SAIR 公开逆向结构新增的**实验性 WritingTools `compose_selectedAndAllText` 文本创作分支**：分别生成 `content/suggestions/summary` 和 `body/refinements` 结构；WritingTools 仍**未获本机真实端到端验证**。61 模块只用于原生 Qwen 协议观测。**两者必须互斥启用。** 本项目不是 Apple、Shadowrocket、Qwen 或 DeepSeek 官方产品，也不能保证系统层不会绕过改写直接显示 Qwen。

[English](README_EN.md) · [文档中心](docs/README.md) · [安装与回滚](docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md) · [真机验收](docs/VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md)

## WritingTools 新增说明与跨站协议来源

用户设备已确认 `WritingTools` UA 访问千问主接口；此前代码无条件输出 `WRITINGTOOLS_SKIPPED`。新版 60 不再对**所有** WritingTools 一概跳过，而是只允许**精确**的 `compose_selectedAndAllText` 纯文本创作协议进入 DeepSeek，使用独立的 `body/refinements` SSE 答案 schema。其他校对、摘要、未知写作分组、媒体仍未支持，不应误以为所有 Apple Intelligence 功能均已更换模型。写作正文会包含强制 `【DeepSeek · AIES】` 标记，可能不适合直接粘贴到文稿；请求可能先到 Qwen，再把文本发至用户授权的 DeepSeek API。

公开参考：[跨浏览器社区与 Apple 协议研究](docs/COMMUNITY_APPLE_INTELLIGENCE_REQUESTS_2026-11-19_ZH.md) · [GitHub routine 修改和下一步](docs/routine/2026-11-19-AppleIntelligence-web-community-and-WritingTools-Compose.md)。

## 最新真实设备进展

| 已验证的证据 | 实际状态 |
|---|---|
| Siri 请求组名 | `siri.multimodal.noRTI` |
| 纯文本请求 | `input[].message.content[].text`，含明确的 `type:"text"` |
| Qwen 原生响应 | 13 个已解析 SSE 事件、2 个文本 delta、HTTP 200 |
| 严格 SSE 前置检查 | 一条真实响应在 14:49 返回 `MATCHES_60_PREFLIGHT` |
| DeepSeek 调用 | 15:51 日志有 2 次 DeepSeek 提交，截图至少 1 次显示标记 |
| 请求关联 | 曾发生 `RESPONSE_TAG_MISSING`，**仍是 P0 未解决的真实设备问题** |
| 新合成 SSE | 按两次真实 Qwen 结构采样补齐字段；离线 CI 测试通过，**真机显示待证实** |

历史的 `GROUP_UNSUPPORTED`、`INPUT_UNSUPPORTED`、`SSE_REWRITE_UNSUPPORTED` 并不是一种根因。详见[15 份日志的调试历史](docs/DEBUG_HISTORY_2026-11-19_ZH.md)，所有历史版本可通过 GitHub PR 与提交记录还原，但**原始含敏感信息的日志不存放在仓库**。

## 两个模式

| 模式 | GitHub 模块 | 用途与限制 |
|---|---|---|
| **60 实验 DeepSeek 改写** | [60-AIES-SIRI-DEEPSEEK-V06.sgmodule](shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule) | 两条主改写钩子加一条会话级 SSE Guard。Siri 文本 → DeepSeek → 重建完整 SSE。无可靠请求绑定或模型异常时 502 失败关闭；不能保证 Siri UI 最终展示 |
| **61 原生 Qwen 被动诊断** | [61-AIES-QWEN-PASSIVE-DIAG.sgmodule](shadowrocket/61-AIES-QWEN-PASSIVE-DIAG.sgmodule) | 两个只读 `$done({})` HTTP 钩子；手动授权后只记录协议结构，不更改 Qwen 回答，不调用 DeepSeek |

**切换前必须停用另一模式和旧的同域 `00 REJECT` 或冲突 Rewrite。** 61 没有修改正文，不代表 MITM/响应缓冲不会影响流式时序；请先验证完全关闭模块时的原生 Qwen 基线。

## 15:51 真机截图与轻量 Qwen 防漏更新

截图已证实 Siri 至少一次真正显示带 `【DeepSeek · AIES】` 的回答，底部仍是系统控制的“千问”服务品牌。当前并非零成功。

最新日志 5 次主请求：2 次有效 DeepSeek SSE 已提交、2 次 `RESPONSE_TAG_MISSING` + `PROMPT_UNAVAILABLE`、1 次 `SSE_REWRITE_UNSUPPORTED`。代理数据库还发现 2 条以前**未被 60 模块覆盖**的 `/v1/sessions/{会话标识}/responses` Siri 访问。

新版 60 新增 **1 条仅处理该会话级 Siri SSE 响应的轻量拒绝规则**，避免未经 DeepSeek 验证的 Qwen SSE 直接显示；同时提高主路径 SSE 标准分帧兼容性、将 DeepSeek 输出上限改为 1000 token，成功回答正文/摘要均强制带来源标记。

注意：该 Guard 可能让某些复杂 Siri 请求从 Qwen 回答变成“无法获得回答”；并不是全域封锁或完整 DeepSeek 替换。跨 Hook 关联偶发丢失仍未安全修复。本轮按用户要求不做额外人工或设备测试。

## 16:15 真机故障后新增同题对照实验

最新上传的 2,987 行日志与 175 条代理记录显示：4 次主请求、2 次 DeepSeek 重建提交、1 次请求关联丢失、1 次上游 SSE 不兼容，以及 **4 次由当前 Guard 主动阻断的会话级 Qwen SSE**。扩大 Qwen 拦截可能降低复杂提问可用性。因此现在提供[原生 Qwen 与 DeepSeek 同题 A/B 实验](docs/AB_SIRI_QWEN_DEEPSEEK_COMPARISON_ZH.md)：先关闭全部模块观察真实原生 Siri；再分别只启用 61 和 60，以手动短期探针比较 SSE、客户端可见答案、模型完成原因/用量、合成输出和 Guard 错误。**这是诊断能力，不代表复杂问题已修复。**

## 对开发者最重要的文档

- [真实 Siri → Qwen 请求 JSON 结构及 OS 元数据](docs/OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md)
- [真实 Qwen SSE 13 事件、嵌套字段结构及替换约束](docs/OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md)
- [全日调试时间线、日志证据和 PR #17–25](docs/DEBUG_HISTORY_2026-11-19_ZH.md)
- [根因、设计决策、安全边界与遗留 P0](docs/ROOT_CAUSE_DECISIONS_2026-11-19_ZH.md)
- [真机验收矩阵、故障回滚和脱敏反馈](docs/VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md)
- [当前状态](docs/CURRENT_STATUS_ZH.md) · [安全](docs/SECURITY_CURRENT_ZH.md) · [维护](docs/OPERATIONS_ZH.md)

## 安全承诺的适用边界

脚本只尝试把**明确的 Siri 纯文本**发送给用户配置的 DeepSeek API；原始问题本身**也可能先送到 Qwen**。未识别的多模态或工具请求、未知 SSE、模型失败以及缺少同事务关联时，60 的代码路径尝试失败关闭，不返回包含 Qwen 原答案的替换正文。**系统、VPN、脚本缺席或 MITM 失效时，不承诺系统级来源强制控制。**

DeepSeek 本地 Key 不应写入仓库、模块 URL 或问题诊断日志。请不要公开 PacketTunnel 原始全文、认证 Header、Proxy DB、CA 私钥、真实私人提问。稳定版尚未发布，任何 CI 通过都不能替代真实 Siri 原生界面验收。

## 开发

```sh
npm ci
npm run check
npm test
```

`npm run check` 包含脚本语法、Node mock、隐私/并发/SSE 用例及文档链接、固定脚本 SHA 校验。**仓库当前的两个安装模块只可择一启用。**
