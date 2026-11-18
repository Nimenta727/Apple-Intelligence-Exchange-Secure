# main 历史基线状态 / 最新项目进度（2026-11-18）

> `main` 目前仍是 **v0.4.0-lab 旧阻断研究基线**；最新功能集成在 [v0.6 Clean Beta 开发分支](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/tree/siri-deepseek-v0.6-clean)，[Draft PR #10](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/10)。新版尚未完成真实 Siri UI、真实 DeepSeek Key 调用和失败来源验收。**当前状态权威文档请读 [v0.6 CURRENT_STATUS_ZH.md](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/CURRENT_STATUS_ZH.md)**。

## 需求与版本区别

- 用户现在允许原问题经过千问，要求 Siri 原生界面的最终 AI 回答来自 DeepSeek。
- 旧版 main 的 00、10、20、21、`src/` 和 `sairs_router.js` 是“不得发送千问”的历史实验，不是新版直接安装入口。
- v0.6 使用 60 单模块与固定提交的单文件脚本，通过离线 CI；但**不能保证脚本缺席、VPN 断开或 Siri 回退时不会显示千问**。
- 新版安装、回滚与风险请遵循 [v0.6 安装指南](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md)，不得混用 00 与 60。

## 当前验收状况

| 项目 | 状态 |
|---|---|
| v0.6 候选双阶段代码与测试 | 已提交，离线 CI 通过 |
| Siri 原生显示 DeepSeek 内容 | **未运行** |
| DeepSeek API Key 的真机实际联网调用 | **未运行** |
| Siri / Shadowrocket 异常回退来源保证 | **未证明** |
| v0.6 正式发布及合并 main | **未进行** |

[文档入口](README.md) · [安全说明](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/SECURITY_CURRENT_ZH.md) · [发布核对表](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/RELEASE_CHECKLIST_ZH.md)。

---

下面的历史实验事实见 [问题台账](ISSUES_AND_DECISIONS_ZH.md)、[旧实验矩阵](EXPERIMENT_MATRIX_ZH.md) 与 [history 归档](history/README.md)。