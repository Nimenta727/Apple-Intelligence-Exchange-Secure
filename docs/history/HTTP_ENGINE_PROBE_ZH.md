# 第五阶段：HTTP Engine / Fake-IP 隔离对照实验

> **历史资料（只读研究记录；不适用于 v0.6 安装）**：本文记录旧版网络阻断、候选协议、证书或测试假设。用户最新目标允许问题经过千问，要求尝试由 DeepSeek 提供 Siri 原生界面的最终 AI 回答。部分旧操作建议与新模式矛盾，**不得依本文启用旧模块、修改 REJECT 或配置密钥**。当前入口：[文档中心](../README.md) · [v0.6 安装](../INSTALL_SIRI_DEEPSEEK_V06_ZH.md) · [安全边界](../SECURITY_CURRENT_ZH.md)。

目的：确认 Shadowrocket 是否存在既能本地合成 HTTPS 响应，又能在脚本失败时不连接任何真实原始服务器的路径。

两个模块都仅处理 RFC2606 保留域名 aies-probe.invalid，且共用不含用户数据和 API Key 的固定响应脚本。

方案 A（20 模块）：Host 映射 127.0.0.1，仅 DIRECT 测试域名。
方案 B（21 模块）：Host 映射 RFC2544 基准网络 IP 198.18.41.221，额外添加 force-http-engine-hosts，把测试域名交给 HTTP 引擎处理（这个参数在 Shadowrocket 2.2.93 上的效果未经验证）。

不得同时开启 20 和 21；它们使用同一个测试域名，避免规则互相覆盖。不得把测试域名替换成 prod-yabuli.qianwen.com。

## 应记录的设备证据

- 在两个方案之间切换时，浏览器固定测试请求是否拿到 AIES_BOUNDARY_PROBE_OK。
- MITM 和脚本是否实际触发；请求失败时是否存在外部 TCP、TLS 或 QUIC 出站。
- 映射是否被 DNS、代理或 VPN 绕过；无论成功或失败，只记录脱敏状态，不提交抓包、密钥或真实请求。

本实验可筛掉不可行的 Shadowrocket 接管策略，但即使其成功，也**不能证明** Siri 真实域名已被安全接管或 Siri 接受本地合成 SSE。发布安全闸 providerEnabled:false 和千问 REJECT 保持不变。

参考：Surge Understanding Surge 关于 force-http-engine-hosts 的说明，以及原作者 boitar/sair 的自定义本地控制台模块。其他客户端的相似配置不能替代 Shadowrocket 真机验证。
