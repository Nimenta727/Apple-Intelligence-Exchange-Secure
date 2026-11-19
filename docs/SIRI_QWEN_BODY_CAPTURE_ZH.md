# 一次性提取 Siri → Qwen 请求正文（本地脱敏版）

> **历史诊断用途（2026-11-19 14:56）**：已获得一次有效的真实 Siri 文本结构，不需要重复采集；优先阅读[已观测请求 JSON 归档](OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md)。本探针因可能显示本次无隐私测试问题的文本，仅在用户明确授权时使用。

> 只用于你**主动发起的一次非隐私 Siri 测试**，不是长期监听。它采集的是 Siri **尝试发送到** `prod-yabuli.qianwen.com/v1/sessions/responses` 的 HTTP **POST JSON body**；不保证请求已经到达 Qwen。**不是直接抓取 Qwen App 或 Qwen 网页的全部聊天**。

## 能得到什么？

- 请求 JSON 的字段层级、`configuration.response_configuration_group_id`、`input`、`message.content`、文本片段及 `type` / `role` 等字段，帮助定位 Siri 真正发出的文本内容类型。
- 这是**脱敏后的 JSON 正文副本，不是原样的全部网络报文**。本工具不读取或记录 HTTP 头、Authorization、Cookie、Private-Access-Token、DeepSeek API Key。
- 工具定义、服务端工具和响应格式仅保留类型/数量概况，`input_hint`、未知根级元数据和疑似凭据字段的值会被遮挡；媒体、过长文本与 URLs 可能显示为 `[REDACTED_*]` 或限制标志。
- 可能仍包含你本次发给 Siri 的**问题文字**；必须选择普通测试问题，不要问私人信息。收到结果后先在 iPad **检查脱敏情况**，再决定是否分享。

## 一次性准备

1. 备份 Shadowrocket 当前配置。确保 VPN 正常、HTTPS MITM 仅针对 `prod-yabuli.qianwen.com`，旧的同域规则停用。
2. **刷新/重新导入** [唯一 60 模块](../shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule)，模块的请求/响应两条 Hook 固定脚本提交应以 **`95e2a839`** 开头。
3. 从仓库下载新文件 [`siri_qwen_body_probe_ONCE.js`](../scripts/siri_qwen_body_probe_ONCE.js)，存入 iPad Shadowrocket 的本地 `Script` 文件夹。可以另外保存 [`siri_qwen_body_probe_STOP_ONCE.js`](../scripts/siri_qwen_body_probe_STOP_ONCE.js) 用于明确停止。
4. **这些辅助 JS 只允许通过「脚本测试 / Script Test」手动运行，不能作为启用的 HTTP、event 或 cron 自动脚本。** 60 模块内已包含实际请求 Hook，辅助脚本不会自动在 Siri 请求中执行。

## 测试步骤

1. 在 Shadowrocket 手动「脚本测试」运行 **`siri_qwen_body_probe_ONCE.js`**，应看到：

   ```text
   [AIES_QWEN_BODY_LOCAL] ARMED_600_SECONDS
   [AIES_QWEN_BODY_LOCAL] PERSISTENCE_ROUNDTRIP_OK
   ```

2. **马上用 Siri** 问一次没有个人信息的简单问题，比如“什么是光合作用？”。**请通过 Siri 触发，不能改成在 Qwen App / 网页直接发消息**，因为这里只监听已确认的 Siri → Qwen 网络路径。不需要等待 600 秒，期间即使 Siri 仍然提示无法从 Qwen 获取回答，请求正文也可能已在拒绝前采集。
3. 再次手动测试同一个脚本。如果成功，会在**设备本地脚本测试日志**看到：

   ```text
   [AIES_QWEN_BODY_LOCAL] BODY_CAPTURED_REDACTED_JSON
   [AIES_QWEN_BODY_LOCAL] BODY_PARTS=2
   [AIES_QWEN_BODY_LOCAL] BODY_PART_001={"configuration":...
   [AIES_QWEN_BODY_LOCAL] BODY_PART_002=...}
   [AIES_QWEN_BODY_LOCAL] CAPTURE_CLEARED
   ```

   以上内容仅为**输出格式示例**，不代表真实请求字段。将全部 `BODY_PART_001`、`BODY_PART_002` 等依次拼接即可得到**脱敏后的请求 JSON**。每一段最多约 420 字符，且在输出前先从持久化存储中逻辑清除采样结果。
4. 若出现 `STILL_ARMED` 和 `ACTIVE_REMAINING_SECONDS`，采集尚未完成，重复查看**不会取消**。请在剩余时间内用 Siri 实际提问；如果 `EXPIRED_CLEARED`，下次手动执行才重新开启。
5. 如需立即取消，请手动运行 [`siri_qwen_body_probe_STOP_ONCE.js`](../scripts/siri_qwen_body_probe_STOP_ONCE.js)，应看到 `CAPTURE_STOPPED_AND_CLEARED`；它不会删除 API Key。

## 安全与真实性限制

- 仅捕获单条 Siri User-Agent 的目标 URL **POST** 请求正文；结果只存在于 Shadowrocket 本机持久化存储并在手动读取后逻辑清除。**不会主动上传到 GitHub、DeepSeek 或任何额外服务器**。
- 这不是加密存储或底层物理擦除证明，且字段脱敏规则不能保证发现任何一种可能的个人敏感信息。**务必人工检查后再分享**。绝不上传完整 PacketTunnel、proxy.db、请求头、Cookie、密钥或 CA 私钥。
- 采集功能**不会绕过**现有 Siri 解析器的严格校验；因此这个版本仍可能向 Siri 返回 502。“捕获成功”不等于 Qwen 成功回答，也不等于 DeepSeek 已调用。
- 只有 `[AIES_V06] QWEN_BODY_CAPTURED_LOCAL` 会出现在运行 Hook 的固定日志；实际请求正文仅在手动测试输出。默认状态下不会额外采集文本。
