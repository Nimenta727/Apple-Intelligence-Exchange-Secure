# AIES 项目交接（main 历史基线）

> **最新交接在 [v0.6 PROJECT_HANDOFF_ZH.md](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/PROJECT_HANDOFF_ZH.md)**。本页只描述 main 分支状态。用户已经改变目标：允许原始 Siri 问题经过千问，但最终 AI 回答必须来自 DeepSeek。

## 项目目前的分支

- **main**：v0.4.0-lab，旧“千问不得接收原始请求”研究实验，包含 REJECT 基线、候选 SSE、自建打包工具和离线测试。不能直接提供新版效果。
- **siri-deepseek-v0.6-clean**：当前 Beta 候选版本 60，Request/Response 双钩子，DeepSeek 应答 SSE 重建。离线 CI 通过，真机 Siri UI 和系统故障回退未验证。
- 旧 30/31/40/50 等留在历史 PR，不需要用户重复测试。

## 新版开始入口

[新版安装和回滚](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md) · [安全边界](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/SECURITY_CURRENT_ZH.md) · [发布门槛](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/RELEASE_CHECKLIST_ZH.md) · [维护指南](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/MAINTENANCE_ZH.md)。

**不要合并“离线测试已通过”与“Siri 已可用”这两个结论。** 脚本级 502 错误不能阻止 VPN 失效或 Shadowrocket 未执行时的千问原生答复。绝不上传 Key、CA 私钥、Siri 原文和完整抓包。

历史实验详情保留在 [docs/history](history/README.md) 和 [问题与决策](ISSUES_AND_DECISIONS_ZH.md)。