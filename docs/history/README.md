# AIES 历史技术资料（只读参考）

> **本目录全部为旧版研究档案，不能作为 v0.6 安装或当前安全承诺。** 旧要求是“千问零出站”，已被用户更新为“允许请求到千问，但最终 Siri AI 回答必须来自 DeepSeek”。仓库保留原始研究证据与失败案例，用于避免重复实验。

## 资料目录

- [CONFIGURATION_ZH.md](CONFIGURATION_ZH.md)：旧 Shadowrocket、证书和 Key 操作说明。
- [TEST_PLAN.md](TEST_PLAN.md)：旧版 T01–T14 真机计划。
- [ARCHITECTURE_ZH.md](ARCHITECTURE_ZH.md)：旧 src/ 和独立候选 SSE 架构。
- [SECURITY_ZH.md](SECURITY_ZH.md)：旧零透传威胁模型。
- [NETWORK_BOUNDARY_ZH.md](NETWORK_BOUNDARY_ZH.md)：同域 REJECT 风险。
- [LOCAL_BOUNDARY_PROBE_ZH.md](LOCAL_BOUNDARY_PROBE_ZH.md)：20 Loopback 原型。
- [HTTP_ENGINE_PROBE_ZH.md](HTTP_ENGINE_PROBE_ZH.md)：21 Fake-IP / HTTP Engine。
- [PROTOCOL_LAB_ZH.md](PROTOCOL_LAB_ZH.md)：旧合成 SSE 候选研究。

30/31 故障注入与 40/50 改写原型保留在原 PR/提交历史中，不是 v0.6 安装前置测试。

## 当前项目请从这些文档开始

[文档中心](../README.md) · [v0.6 安装](../INSTALL_SIRI_DEEPSEEK_V06_ZH.md) · [安全边界](../SECURITY_CURRENT_ZH.md) · [当前状态](../CURRENT_STATUS_ZH.md) · [发布门槛](../RELEASE_CHECKLIST_ZH.md)。

请勿按历史配置直接修改真实目标域名路由、安装未经审核的远程脚本或上传自己的 DeepSeek API Key。
