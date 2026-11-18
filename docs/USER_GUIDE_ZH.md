# AIES v0.6 使用手册

> 当前是 Beta 真机实验，不建议用涉及身份、医疗、财务或账户信息的问题。原始问题可能同时被千问和 DeepSeek 处理。

## 你将得到什么

项目尝试在 Siri 原生界面保留标准文本问答交互，让响应脚本调用 DeepSeek 并重建答案。不会出现独立聊天页面，也不支持视觉、写作工具、图像附件或系统级流量隔离。

## 使用前

按照 [安装与回滚指南](INSTALL_SIRI_DEEPSEEK_V06_ZH.md) 先完成设备配置备份、本地 Key 设置、VPN 与目标 MITM 信任检查。确认设备上已停用同域旧规则，**删除 GitHub 旧文件不等于从 Shadowrocket 删除旧配置**。

## 首次使用

1. 启用 60 模块并确认 VPN 已连接。
2. 向 Siri 提一个非隐私的、答案容易核验的文本问题。
3. 打开 Shadowrocket 日志，仅检查固定阶段码：`REQUEST_CAPTURED`、`DEEPSEEK_STARTED`、`DEEPSEEK_RESPONSE_ATTEMPTED`、`REQUEST_DIAG_*` 或 `ERROR_*`；不要复制原始请求或响应。若出现 `REQUEST_DIAG_*`，参照[调试手册](DEBUGGING_ZH.md)查看原因；不需重新写入已确认有效的 Key。
4. 查看 **Siri 原生界面**实际显示的文字。若为空、报错、千问回答或与当前问题不对应，记为未通过。
5. 遇到错误按照 [调试手册](DEBUGGING_ZH.md) 分类，暂停测试；不需要重复无关的网络探针。

## 目前的能力边界

- 只接受已知的 Siri 文本 POST 与 SSE 事件顺序；未知协议结构会导致失败。
- `deepseek-flash` 已获 DeepSeek 官方文档确认支持，但用户账户、真实 Key、网络/额度及实际 API 返回均尚未真机验证。
- Shadowrocket 未运行、HTTPS MITM 未命中、网络切换、系统缓存和 Siri 原生回退都可能绕过替换逻辑；**不能保证最终显示内容始终来自 DeepSeek**。
- 请求文本目前会短期存于设备本地 `$persistentStore`，逻辑到期不一定自动清除物理记录。
- 只使用自己授权的 API Key，注意 API 配额与调用费用。

## 停用

关闭 60 模块，恢复原 Shadowrocket 配置；如不再使用 API Key，在设备本地运行 [清除脚本](../scripts/clear_key_ONCE.js) 并删除含 Key 的临时文件。测试后关闭不需要的 MITM 规则。不要分享 CA 私钥或完整日志。

下次升级前先查看 [维护与升级流程](OPERATIONS_ZH.md) 和 [变更日志](../CHANGELOG.md)。
