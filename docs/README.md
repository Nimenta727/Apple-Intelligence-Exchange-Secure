# AIES 当前文档中心

> **2026-11-19 更新**：真机已证实请求钩子命中，但 JSON 解析不受支持；新增安全 `REQUEST_DIAG_*` 阶段分类。详情见[调试文档](DEBUGGING_ZH.md)。尚未验证 DeepSeek 原生 Siri 输出。

> **仅包含当前 v0.6 Beta 的有效文档。** 项目已经整合进 `main`，但仍未通过真实 Siri 原生界面验收。离线 CI 不能证明端到端成功或系统级“只显示 DeepSeek”。

## 使用者

| 文档 | 内容 |
|---|---|
| [安装与回滚](INSTALL_SIRI_DEEPSEEK_V06_ZH.md) | 模块导入、证书、设备本地 Key、停用 |
| [首次使用及日常操作](USER_GUIDE_ZH.md) | 安装后测试、使用边界、故障恢复 |
| [调试与错误码](DEBUGGING_ZH.md) | 请求/响应/模型/UI 诊断和脱敏反馈 |
| [Siri 组名本地诊断](SIRI_GROUP_PROBE_ZH.md) | 600 秒采样；重复查看状态不取消；提供独立停止脚本，不采集正文 |
| [安全与隐私](SECURITY_CURRENT_ZH.md) | Qwen 上游、DeepSeek、MITM、存储及回退 |

## 开发者与维护者

| 文档 | 内容 |
|---|---|
| [当前架构](ARCHITECTURE_CURRENT_ZH.md) | 唯一运行脚本、SSE 重建、状态管理 |
| [维护与升级](OPERATIONS_ZH.md) | CI、版本 pin、修复、发布 |
| [当前状态](CURRENT_STATUS_ZH.md) | 完成和未验证事项 |
| [当前决策及问题](ISSUES_AND_DECISIONS_ZH.md) | 仅当前版本的风险与决定 |
| [发布验收](RELEASE_CHECKLIST_ZH.md) | 真实 Siri、API、回退与安全门槛 |

## 唯一产品目标

保持 Siri 原生文本问答界面；允许原始问题到千问，但脚本应尝试使最终 AI 回答来自 DeepSeek。正常脚本故障不主动回退千问；**无法控制脚本缺席时的系统级回退**。需要通过真机验证后才能确认支持范围。

旧版实验文件已从当前仓库树移除；历史仍可通过 Git 提交记录查看。当前页面不再包含旧实验安装入口。
