# Siri 原生 DeepSeek MVP：最小网络接管故障对照

状态：**研究用、仅虚构域名；不是 Siri 可安装替换模块。** 入口：[本轮结论](CURRENT_STATUS_ZH.md) / [问题台账](ISSUES_AND_DECISIONS_ZH.md)。

## 目标与不做什么

- 唯一产品目标：Siri 原生界面文本问题 → 用户授权 DeepSeek → Siri 原生结果；原始问题不透传千问。
- 本轮只查 Shadowrocket 2.2.93 在正常/异常请求阶段能否阻断原始网络连接，并尝试本地合成响应。
- **不**配置 Key、不启用真实 10、不移除 00 的千问 REJECT、不改 providerEnabled:false、不测试真实 Siri 域名。
- 用户跳过独立出站抓包；因此本实验即使成功，也只能表明浏览器/运行日志层面的行为，**绝不证明零泄漏，也不能进入真实 Siri 联调**。

## 文件

- `scripts/aies_transport_fault_probe.js`：限定 `https://aies-probe.invalid/__aies_fault?case=...`，固定状态/内容，不读取正文；`throw`/ `nodone` 仅合成故障。
- `shadowrocket/30-AIES-TRANSPORT-FAULT-DIRECT.sgmodule`：虚构域名→127.0.0.1 且 DIRECT，对照正常 Mock 和故障。
- `shadowrocket/31-AIES-TRANSPORT-FAULT-REJECT.sgmodule`：同一虚构域名→127.0.0.1 且 REJECT，研究同域脚本冲突。
- `tests/transport-fault-probe.test.js`：Node 内部执行模拟和配置约束；不发网络请求。

## 安全安装前提

先保存/备份现有配置；只保留 `00-SAIRS-LOCKDOWN`，停用 10/20/21。测试时 **30 和 31 严禁同时启用**。按已有 E1 方法将新 JS 存到本地 `Script/aies_transport_fault_probe.js`；本机 CA 仅为 `aies-probe.invalid` 解密。保留 00 的 `DOMAIN,prod-yabuli.qianwen.com,REJECT`。本轮使用无个人信息的固定测试 URL。

## 实验步骤（先 30，后 31）

1. 00+30（31/20/21/10 关闭），Safari 访问以下 4 个 URL，一次一个，保存界面结果及不含请求正文的 `[AIES_FAULT]` 日志：
   - `https://aies-probe.invalid/__aies_fault?case=ok` → 理想情况下 `AIES_FAULT_OK`，HTTP 200。
   - `https://aies-probe.invalid/__aies_fault?case=deny` → `AIES_FAULT_DENIED`，HTTP 503。
   - `https://aies-probe.invalid/__aies_fault?case=throw` → 预期错误/超时；判别是否脚本异常后尝试直连本机回环。**不能把错误页解释为零出站**。
   - `https://aies-probe.invalid/__aies_fault?case=nodone` → 预期超时或客户端错误；同上。
2. 停用 30，启用 31，仅重试 `case=ok`；比较是否仍能得到早期本地响应，及是否先由 REJECT 拒绝。不要将 31 的 REJECT 复制到真实域名做实验。
3. 关闭 31；恢复仅 00。保存测试矩阵和脱敏日志，不上传证书、请求正文或完整抓包。

## 判读 / 停止条件

| 情况 | 最多允许的结论 | 下一步 |
|---|---|---|
| 30 的 ok 返回正确标记 | 本地 request mock 可执行（先前 E1 已展示） | 与故障结果对照 |
| 30 的 throw/nodone 报错或超时 | 对该虚构回环目标的客户端失败行为 | 无独立出站证据前不推论“零泄漏” |
| 31 的 ok 被 REJECT、无 MOCK 日志 | 支持同域 REJECT / 脚本冲突假设，不能推出精确内部执行顺序 | 停止真实域名替换路线，评估替代网络接管组件 |
| 31 的 ok 仍返回标记 | 同域冲突有不同表现，仍不能证明真实域名安全 | 需要独立出口验证与真实策略评审 |
| 出现任何真实千问请求非 REJECT、敏感日志或证书异常 | 安全异常 | 立即停用 30/31，恢复 00 |

## 后续产品决策

如果同域 REJECT 确认与 Mock 冲突，下一步不再继续用相同规则排列组合碰运气；应评估是否能在**有独立防透传能力的接管层**完成本地响应。未证明这一点前不打开模型调用，Siri SSE 真机也不进行。
