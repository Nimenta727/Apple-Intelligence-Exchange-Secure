# AIES v0.6：Siri 场景标识的一次性本地诊断

> **2026-11-19 真机进度：** iPadOS 27.3 的 Siri 请求命中 `prod-yabuli.qianwen.com/v1/sessions/responses`，但出现 `REQUEST_DIAG_GROUP_UNSUPPORTED`。同一接口也被 WritingTools 使用。具体 Siri `response_configuration_group_id` 尚未知，**不应直接把所有组名放行**。此操作仅用于收集一个明确的配置标识，不修复 SSE，也不会调用 DeepSeek。

## 先了解安全边界

- 不需要修改或重新提交 DeepSeek API Key；`$persistentStore` 和 MITM 已确认工作。
- 本工具**不上传**请求正文、Authorization、Private-Access-Token、问题、SSE 或其他 header，也不访问网络。
- 主运行脚本只在**用户主动开启诊断**、请求头标记为 Siri 且出现 `GROUP_UNSUPPORTED` 时，尝试保存**单个简短的组名**到本机 `$persistentStore`。对 WritingTools 不保存组名；对异常/长得像凭据的标识拒绝保存。实际 `User-Agent` 仅为辅助判断，不能单凭它信任请求或放宽 Siri 白名单。
- 数据存在 `AIES_SIRI_GROUP_PROBE_RESULT`，逻辑有效期为 **180 秒**。读取后会写入空字符串清空；这不保证底层存储物理擦除，因而只用于非隐私测试。
- 除非你主动**再次手动运行**本地工具，诊断结果不会出现在主脚本日志。第二次手动运行会在**设备本机的脚本测试日志**显示组名。即使如此，该值也属于未经验证的原始服务元数据，请先检查是否敏感，不能直接上传整个 PacketTunnel 日志。

## 安全使用步骤：同一个文件只运行两次

1. 备份 Shadowrocket 配置，停用同域旧探针模块。更新 [60 模块](../shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule)，确认两条 hook 指向修订后的固定脚本提交 `ca1842345ea90ce9b2d97e69675852614275404f`；保持 VPN、目标域名的 MITM 和本地 Key 不变。
2. 从仓库下载 [`siri_group_probe_ONCE.js`](../scripts/siri_group_probe_ONCE.js) 到 iPad **本地临时文件**。不要修改文件，也不要在其中填写任何 Key。与之前验证 Key 的方法相同，使用 Shadowrocket 的 **Script Test / 脚本测试** 手动执行；**不要**把它添加为 HTTP、event、cron 或自动运行脚本。
3. **第一次**运行：本机出现 `[AIES_SIRI_GROUP_LOCAL] ARMED_180_SECONDS`，表示已开启一次性 180 秒的采样窗口。
4. 180 秒内只发起**一个不含隐私**的 Siri 纯文本问答（不要使用写作工具）；不要上传此过程的 PacketTunnel 原始日志。正常情况下，Siri 依旧可能显示错误，因为未知组名没有被放行。
5. **第二次**手动运行同一个本地脚本：如捕获了格式安全的标识，将仅在本机显示 `[AIES_SIRI_GROUP_LOCAL] GROUP_ID=...`，并清除本机临时状态；否则显示 `NO_CAPTURE_PROBE_DISARMED` / `NO_SAFE_RESULT_OR_EXPIRED`。在主脚本日志中，仅会出现 `SIRI_GROUP_CAPTURED_LOCAL` 或 `SIRI_GROUP_PROBE_UNSAFE_ID` 的固定码。
6. 删除本地辅助文件。如需取消已启用但尚未命中的采样，再手动运行第二次即可取消；如已超过 180 秒，仍需手动运行以清理本地记录。

## 反馈什么

只反馈**自己检查过、确认不含敏感信息的组名**（例如一个普通的配置标签）和固定错误码。如果组名看起来像 Token、用户身份标识或随机密钥，**不要分享其值**，只描述 `UNSAFE_ID` 或“可能敏感”。**绝不发送**完整请求、抓包、带 Bearer 的截图、API Key 或 CA 私钥。

## 此次仍不能保证的事情

- 当真实 Siri 标识得到确认后，才可**单独审查**是否把它加入白名单；不能仅凭 User-Agent 放行，也不能把 WritingTools 当成 Siri。
- 请求解析后仍需验证原始 SSE、DeepSeek API 实际返回、Shadowrocket Response hook 和 Siri 原生展示。
- VPN、MITM 或脚本被绕过时，系统仍可能展示千问响应；此方案不是系统级来源保证。

相关：[调试手册](DEBUGGING_ZH.md) · [当前状态](CURRENT_STATUS_ZH.md) · [安全说明](SECURITY_CURRENT_ZH.md) · [安装指南](INSTALL_SIRI_DEEPSEEK_V06_ZH.md)。
