# AIES 当前问题与决策记录（v0.6）

> 当前项目以 [文档中心](README.md)、[当前状态](CURRENT_STATUS_ZH.md)和[发布验收清单](RELEASE_CHECKLIST_ZH.md)为准。旧实验时期完整的问题台账已归档至 [history/ISSUES_AND_DECISIONS_ZH.md](history/ISSUES_AND_DECISIONS_ZH.md)，不再与当前工作混用。

## 当前产品决策

| ID | 决策 | 说明 |
|---|---|---|
| D-C01 | Siri 原生界面 | 面向指定 Siri 文本问答；不得以通知、网页或快捷指令代替原生显示 |
| D-C02 | DeepSeek 答案来源 | 用户允许原始问题发送千问，但最终 AI 答案应由 DeepSeek 生成 |
| D-C03 | 不回退千问 | 脚本能控制的失败路径不主动展示千问 AI 正文；脚本未运行或系统绕过时尚无法保证 |
| D-C04 | 单一当前部署 | `main` 中的 60 模块及 `aies_siri_deepseek_v06.js` 是 v0.6 当前候选入口 |
| D-C05 | 旧版研究归档 | 旧 00/10/20/21、30/31、40/50 和 E0–E6 实验保留供审计，不作为 v0.6 必需步骤 |
| D-C06 | 安全优先 | API Key 不入 Git/聊天/日志，遵守 MITM 最小域名范围、脱敏记录和可回滚配置 |
| D-C07 | 候选版而非稳定版 | 已整合 main 且离线 CI 通过；真正的 Siri、DeepSeek API、异常回退仍待设备验证 |

## 当前未解决问题

| 问题 | 现状 | 后续验证 |
|---|---|---|
| Q-01 Shadowrocket 请求/响应钩子是否实际可关联 | 仅模拟验证 | 真实目标请求命中、Header 和响应阶段上下文 |
| Q-02 真实 Siri SSE 是否兼容 | 只针对合成结构验证 | 原生 UI 接受、分块与压缩、事件序列 |
| Q-03 DeepSeek API 模型与认证 | `deepseek-flash` 未做真实 Key 验证 | 官方 API 支持性与小额非敏感联调 |
| Q-04 脚本失效时是否出现千问 | 现有脚本无法系统级禁止 | 断 VPN、MITM 未命中、脚本异常与系统回退 |
| Q-05 临时用户问题留存 | 本地 persistentStore 的逻辑 TTL 无法保证物理删除 | 减少持久化、清理机制与隐私复审 |
| Q-06 可发布性 | Beta 候选，未满足全部 P4–P6 门槛 | [发布核对表](RELEASE_CHECKLIST_ZH.md) |

## 发生新问题时的维护方式

先按 [调试手册](DEBUGGING_ZH.md) 定位固定错误码，只使用脱敏结果；再补对应测试、修复代码、同步 [使用指南](USER_GUIDE_ZH.md)和 [维护流程](OPERATIONS_ZH.md)。不得用原始千问回答透传来修补失败路径。

## 历史资料

- [完整旧问题台账（I-01 等、D-01 等）](history/ISSUES_AND_DECISIONS_ZH.md)
- [旧阻断安装路线](history/INSTALLATION_ROADMAP_ZH.md)
- [旧实验矩阵 E0–E6](history/EXPERIMENT_MATRIX_ZH.md)
- [全部历史研究](history/README.md)

以上是**项目决策和未验证事项**，不是 Siri 真实功能已成功的证明。
