# AIES 文档中心（2026-11-19 调试重构归档）

**新增 WritingTools 纯结构探针：** [只读 Qwen 诊断指南中的 WritingTools 操作](QWEN_PASSIVE_DIAG_ZH.md)；可独立手动授权，检查 Compose 分组及 SSE 字段，不保存选中文本或回答。

**新增浏览器技术社区研究与 WritingTools Compose Beta：** [国行 Apple Intelligence/Qwen 请求结构交叉调查](COMMUNITY_APPLE_INTELLIGENCE_REQUESTS_2026-11-19_ZH.md)；来源包括 SAIR 逆向、Apple 开发者文档、Eclectic Light Company、AppleStorm、V2EX 与 LINUX DO。**只有 SAIR 提供写作工具的详细私有 JSON/SSE 逆向结构，本机 WritingTools 全量 schema 尚未复测。** [本次 routine 记录与下一步](routine/2026-11-19-AppleIntelligence-web-community-and-WritingTools-Compose.md)。

> **当前可用的是实验性 60 DeepSeek SSE 改写和互斥的 61 Qwen 原生被动诊断**。本轮离线模拟测试用于验证代码安全，不代表 Siri 原生 UI 已通过验收。真实设备请求与 Qwen SSE 的主要字段结构已有证据，历史日志只留脱敏摘要，不把抓包或 Token 提交到仓库。

## 2026-11-19 17:12 维护记录

- [复杂 Siri 注释 SSE 根因、三份 A/B 日志错位、代码修改和下一步计划](routine/2026-11-19-17-12-Siri-complex-annotations-ab-diagnosis.md)：今后在 `docs/routine/` 以“时间—内容简介”持续保存维护记录。

## 优先阅读：调试事实与协议归档

**新增：** [Siri 同题 A/B 实验——完全关闭基线 / 原生 Qwen 只读采集 / DeepSeek 改写采集](AB_SIRI_QWEN_DEEPSEEK_COMPARISON_ZH.md)，包含手动诊断脚本、原生 Qwen/DeepSeek 客户端可见文本、SSE 结构、模型 `finish_reason`/token 用量、会话级 Guard 事件的比较方法。


| 文档 | 为什么重要 |
|---|---|
| [当天完整调试时间线与 PR #17–25](DEBUG_HISTORY_2026-11-19_ZH.md) | 按时间解释全部阶段错误、版本和已修复/仍未修复事项，索引 15 份本机日志 |
| [真实 Siri → Qwen 请求 JSON](OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md) | `siri.multimodal.noRTI`、`input[].message.content[]`、工具/格式字段类型和 OS 元数据 |
| [真实 Qwen SSE 响应协议](OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md) | 13 个事件顺序、完成事件、每层字段类型、真实与旧合成 SSE 差异 |
| [根因、决策与安全限制](ROOT_CAUSE_DECISIONS_2026-11-19_ZH.md) | 关联 Header 失效仍是 P0；防并发串答、防 Qwen 原文透传 |
| [真机验收与回滚矩阵](VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md) | 怎样客观确认 DeepSeek 真正在 Siri 显示；如何恢复原生 Qwen |

## 使用者

| 文档 | 用途 |
|---|---|
| [60 安装、密钥和回滚](INSTALL_SIRI_DEEPSEEK_V06_ZH.md) | DeepSeek 改写实验模式、停用 61/旧 REJECT |
| [61 Qwen 原生通行与被动诊断](QWEN_PASSIVE_DIAG_ZH.md) | 原生 Qwen SSE 结构观测；两钩子一律不改写 |
| [首次使用与日常操作](USER_GUIDE_ZH.md) | 安装边界、异常处理和恢复 |
| [故障码总览](DEBUGGING_ZH.md) | 具体请求／响应／模型／UI 阶段 |
| [本地 Siri 组名探针](SIRI_GROUP_PROBE_ZH.md) | 仅用于未知组名场景；当前主要组名已确认 |
| [本地 JSON 字段类型探针](SIRI_SCHEMA_PROBE_ZH.md) | 默认关闭；当前根级、消息包装字段已确证 |
| [一次性脱敏请求正文采集](SIRI_QWEN_BODY_CAPTURE_ZH.md) | 需要用户主动授权，避免上传原始抓包 |
| [安全与隐私](SECURITY_CURRENT_ZH.md) | 跨 Qwen/DeepSeek 数据流、MITM、日志和 Key 风险 |

## 维护者

| 文档 | 用途 |
|---|---|
| [当前状态](CURRENT_STATUS_ZH.md) | 每层真实证据与未验证项 |
| [当前架构](ARCHITECTURE_CURRENT_ZH.md) | 60/61 双模块、请求关联、原生 SSE 重构 |
| [运行与维护](OPERATIONS_ZH.md) | GitHub CI、固定提交、诊断流程 |
| [问题与历史决策](ISSUES_AND_DECISIONS_ZH.md) | 维护决策索引；详见根因专题 |
| [发布验收清单](RELEASE_CHECKLIST_ZH.md) | 对真实 Siri 和安全边界的验收门槛 |

## 重要使用规则

- **60 和 61 不能同时启用**；原生 Qwen 基线请两个都关闭。
- **不要把错误码消失当作 Siri UI 成功**。必须以真实 Siri 看到 `【DeepSeek · AIES】` 的回答正文，并与模型 API 诊断链对应才算完成一条真实闭环。
- **不向 GitHub 提交原始 PacketTunnel、代理数据库、设备个人信息、凭据、真实私人问答**。Git 历史上的旧代码仍可查找，但不建议安装旧实验配置。
