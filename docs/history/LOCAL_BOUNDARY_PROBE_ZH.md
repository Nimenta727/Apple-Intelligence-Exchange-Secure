# 阶段三：隔离域名本地响应实验（UNVERIFIED）

> **历史研究记录（不适用于最新 v0.6 安装）**：本文为旧 v0.4 阻断千问路线的研究材料，可能包含已废弃的配置步骤。新需求允许请求到千问，要求 Siri 最终 AI 回答来自 DeepSeek；真实 Siri 尚未验收。请优先查看 [当前文档](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/README.md)、[v0.6 安装](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md) 和 [安全限制](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/SECURITY_CURRENT_ZH.md)。

本实验**仅用于验证 Shadowrocket 的本地响应机制**，不接入 Siri、千问或 DeepSeek，不能证明真实 Siri 请求的私密性。不要修改正式域名的 `REJECT` 规则或打开 `providerEnabled`。

## 测试设计

- 域名：`aies-probe.invalid`。RFC 2606 预留的 `.invalid` 名称，不是可供真实服务部署的互联网域名。
- DNS Host：实验模块尝试把该名称映射至 `127.0.0.1`。
- 路由：仅对实验域名使用 `DIRECT`。本机 loopback 不是原始千问服务器；如果 JS 拦截失败应仅出现本地连接失败，但要用实际连接记录验证。
- HTTPS 脚本：`Script/aies_boundary_probe.js` 的 GET 请求，以 `$done({response})` 返回固定 `AIES_BOUNDARY_PROBE_OK`。
- 模块：`shadowrocket/20-AIES-LOCAL-BOUNDARY-PROBE.sgmodule`，**不能用于真实 Siri 域名**。
- 没有模型调用、密钥、用户文本或上游回退。

## iPhone 人工测试路径（尚未执行）

1. 在测试设备上确认 Shadowrocket 2.2.93 的当前配置可以使用已有的自签 CA。**不要安装陌生 CA**。
2. 将 `scripts/aies_boundary_probe.js` 复制到 iCloud `Shadowrocket/Script/`；通过脚本配置检查 `Script/aies_boundary_probe.js` 无 File not found。
3. 在配置的模块列表中单独导入 20 探针模块。其他含 `example.com` 的临时规则保持关闭；原始 00/10 模块不需要更改。如果保持 00 阻断独立生效，应验证规则无冲突。
4. 确认 MITM 主机列表仅增加 `aies-probe.invalid`，未增加全局通配符。全局路由保持「配置」。
5. Safari 输入 `https://aies-probe.invalid/__aies_probe?case=1`。期望看到 `AIES_BOUNDARY_PROBE_OK`；如果证书错误、无法解析或连接失败，记录失败，不要通过放开真实域名绕过。
6. 查看 Shadowrocket 数据记录及由独立可信网络观测得到的出站信息。关注是否真的映射到了 `127.0.0.1`、是否有非 loopback 上游连接；仅看见 `MITM` 或网页显示文本不构成零上游证明。
7. 测试后关闭/删除 20 模块并从 HTTPS 解密主机名移除 `aies-probe.invalid`，不影响 00 安全阻断。

## 证据判定

将人工观察的脱敏布尔事实保存到仅在本机的 JSON 文件中（不上传原始抓包）：

```json
{
  "testHost": "aies-probe.invalid",
  "scriptBody": "AIES_BOUNDARY_PROBE_OK",
  "hostMapping": "127.0.0.1",
  "independentNetworkObservation": false,
  "nonLoopbackOutboundObserved": null
}
```

`node tools/evaluate-boundary.js evidence.json` 可输出 `PROBE_PASS`、`INCONCLUSIVE`、`FAIL` 或 `INVALID`。只有同时看到本地响应、正确映射、可靠独立的零非 loopback 出站证据才能得到 `PROBE_PASS`，且结果**仅针对虚构测试域名**。

## 局限

- HTTPS MITM 可能要求先建立连接；映射到 loopback 后请求也可能在脚本运行前失败，此时只能得到 `INCONCLUSIVE`。
- 即便 synthetic 域名成功，也不能直接把 Host 映射+DIRECT 套用到 `prod-yabuli.qianwen.com`。当系统内置解析、HTTP/3、代理规则或 VPN 变化时，映射可能被绕过。
- **不得**复制该模块并简单替换成千问域名；那样可能暴露真实 Siri 请求。
- 当前 `src/config.js` 的 `providerEnabled: false` 必须保留。只有经过独立、逐环境验证的网络级接管，才能考虑另外的实现与审核。

参考：RFC 2606 保留 TLD（https://www.rfc-editor.org/rfc/rfc2606）；Shadowrocket 社区配置文档描述 `[Host]` 与 `[Script]` 功能，但**不保证本机测试一定通过**。
