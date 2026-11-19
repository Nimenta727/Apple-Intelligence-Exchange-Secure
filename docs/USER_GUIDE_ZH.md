# AIES v0.6 Siri 使用手册（2026-11-19）

> **Beta**，只用于非敏感纯文本 Siri 测试。原始问题可能到 Qwen，提取的文本随后可能发送 DeepSeek；不保证系统层不会绕过代理。

## 请选择一个模式

- [60 实验 DeepSeek 改写](INSTALL_SIRI_DEEPSEEK_V06_ZH.md)：目标是在 Siri 原生界面显示带 `【DeepSeek · AIES】` 的 DeepSeek 回答。要求 VPN、对目标域名的 MITM、设备本地有效 DeepSeek Key 和双 Hook 同一版本。
- [61 原生 Qwen 被动诊断](QWEN_PASSIVE_DIAG_ZH.md)：先停用 60、旧 REJECT，验证 Siri 原生 Qwen 可以正常回答，再按指南用一次性手动脚本观测 SSE 结构。**不调用 DeepSeek，不改写答案**。

**同一时间只启用其中一种模块。**

## 60 第一次真机验证

1. 按[安装指南](INSTALL_SIRI_DEEPSEEK_V06_ZH.md)备份配置、配置本地 Key 和 MITM。确保 61 与所有同域旧拦截模块关闭。
2. 用 Siri 问一句没有隐私、容易核对的纯文本问题。不要用私人通讯、账号、健康或位置内容。
3. 只看包含 `[AIES_V06]` 的**固定诊断码**：`REQUEST_CAPTURED`、`RESPONSE_TAG_*`、`SSE_PREFLIGHT_PASSED`、`DEEPSEEK_STARTED`、`DEEPSEEK_LABEL_APPLIED`、`DEEPSEEK_RESPONSE_ATTEMPTED`、`ERROR_*`。
4. 再看 Siri **实际显示的正文**，是否有 `【DeepSeek · AIES】`。如果只是 Qwen 品牌卡片、没有回复或显示“无法获得回答”，都不能认定 DeepSeek 端到端成功。
5. 若出现 `RESPONSE_TAG_MISSING` 和 `RESPONSE_PROMPT_BODY_UNAVAILABLE`，说明请求与响应无法安全对应：脚本会失败关闭，**不要用最新问题去猜测当前响应**。若 SSE 不支持，则参考 [错误分类](DEBUGGING_ZH.md) 和 [真实 SSE 协议](OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md)。

## 当前已知能力与限制

- 已观察到 Siri 的 `siri.multimodal.noRTI` 组及纯文本 `input[].message.content[]`；工具调用、图像、音频和未知类型不属于支持范围。
- 曾在真机观测 `DEEPSEEK_RESPONSE_ATTEMPTED`，但**尚未亲眼确认 Siri 新版本的重建 SSE 可正常显示 DeepSeek 文本**。
- 曾在 Shadowrocket 的转发路径丢失跨钩子关联 Header；无法恢复同一事务请求正文时返回固定错误，这是避免串答的必要保护。
- DeepSeek 的 `deepseek-flash` 名称在[官方 API 文档](https://api-docs.deepseek.com/api/create-chat-completion/)中可用；本项目显式选择非思考模式缩短 Siri 交互等待，但**不保证时延或配额**。
- 即使脚本重建的答案内容来自 DeepSeek，Siri 的固定 Qwen 服务品牌也可能不改变；只有当前问答正文 + 固定日志能作为验收证据。

## 停止与回滚

如果实验不稳定，**停用 60 和 61，以及旧 REJECT/同域冲突规则**，回到正常 Siri→Qwen。需要时关闭只用于调试的 HTTPS MITM，并根据原设备备份恢复设置。日志中只摘固定状态码，不上传含私人令牌的 PacketTunnel 全文。完整测试表见 [验收与回滚](VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md)，全部历史归档见[调试史](DEBUG_HISTORY_2026-11-19_ZH.md)。
