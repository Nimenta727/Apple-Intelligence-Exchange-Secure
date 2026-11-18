# AIES 文档中心

> 最新状态：**v0.6 Clean Beta 候选实现已提交，但 Siri 原生界面尚未通过真机验证**。v0.6 已整合到 `main`；旧 v0.4.0-lab 安全研究文件继续保留在同一仓库。请勿把 CI 通过理解为 Siri 已可用。

## 当前产品定义

保持 Siri 原生界面；用户允许原始请求经过千问，但**最终展示的 AI 回答必须来自 DeepSeek**。响应改写脚本仅能控制确实经过 Shadowrocket 钩子的流量，VPN 断开、MITM 失效或系统回退时可能直接显示千问，因此尚**无法保证无条件 DeepSeek-only**。

## 推荐阅读顺序

1. [当前项目状态](CURRENT_STATUS_ZH.md)：版本、已实现与未验证项、下一决策。
2. [v0.6 唯一安装及撤销指南](INSTALL_SIRI_DEEPSEEK_V06_ZH.md)：集中真机验收；不需要旧 30/31/40 探针。
3. [当前安全与隐私](SECURITY_CURRENT_ZH.md)：接受的上游出站、凭据/证书和失败风险。
4. [实施与验收计划](SIRI_DEEPSEEK_RESPONSE_REWRITE_PLAN_ZH.md)：P0–P6 阶段，P4 来源保证与 P5 结构优化门槛。
5. [发布核对表](RELEASE_CHECKLIST_ZH.md)：真机与安全审计未过之前不能标稳定。
6. [开发维护手册](MAINTENANCE_ZH.md)：代码、测试、分支与文档管理。
7. [项目交接](PROJECT_HANDOFF_ZH.md)：单页状态与下一步。
8. [问题与决策台账](ISSUES_AND_DECISIONS_ZH.md)：含旧路线实验结论与目标变更。

## 历史路线（只作记录，不按其操作）

- [旧版阻断安装路线](INSTALLATION_ROADMAP_ZH.md)：仅适用于 main 的 00/10/20/21 历史安全实验。
- [旧实验矩阵](EXPERIMENT_MATRIX_ZH.md)：E0–E5、30/31 同域 REJECT 对照；不是当前发布门槛。
- [history 归档](history/README.md)：旧架构、MITM、SSE 与网络边界研究。归档内容可能包含已废弃的操作建议，不能覆盖本目录的最新说明。

## 文档维护规则

- 一次只设置一个当前安装版本，旧文档保留但标清所属版本与废弃范围。
- 代码、模块路径、测试、安装文档、README_EN 与 CHANGELOG 同步更新。
- 所有“通过”须区分 **离线模拟、Shadowrocket 实测、真实 Siri UI、DeepSeek API 真实调用、系统回退安全** 五类证据。
- 不提交 API Key、CA 私钥、用户原话、完整 HTTP body、Authorization、Cookie 或可识别日志。

## 实际操作与开发参考

- [日常使用及首次启用](USER_GUIDE_ZH.md)：集中安装、Key 本机配置、使用边界与回滚。
- [后续调试与错误码排查](DEBUGGING_ZH.md)：诊断顺序、固定日志标记、错误矩阵和脱敏反馈模板。
- [v0.6 当前代码架构](ARCHITECTURE_CURRENT_ZH.md)：运行文件、双阶段流程、关联存储、SSE 和安全边界。
- [升级、维护与发布操作](OPERATIONS_ZH.md)：本地命令、功能修改、版本 pin、测试与发布流程。

上述四份是 v0.6 的实际操作手册，替代在旧历史文档里寻找安装/调试步骤。请先核实所安装的模块和脚本版本，任何 Siri 原生功能仍需要最终设备验收。
