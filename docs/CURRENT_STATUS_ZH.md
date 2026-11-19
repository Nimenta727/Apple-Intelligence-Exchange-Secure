# AIES v0.6 当前状态（2026-11-19，真机证据归档后）

> **真实功能状态：实验性 Beta、尚未通过 Siri 原生端到端验收。** 60 模块的 Siri 请求解析在真机曾成功，DeepSeek API 曾至少一次进入有效响应的脚本处理路径，61 模块已两次观测真实 Qwen SSE，其中一次满足 60 严格预检。**最新 60 的完整字段 SSE 改写尚未在 Siri 原生 UI 验证**。不要将离线 CI 或“Qwen 卡片出现”误写成完整成功。

## 一张表看清进展

| 层级 | 最新证据与结果 | 当前结论 |
|---|---|---|
| 模块分工 | 60 DeepSeek 改写、61 Qwen 原生只读诊断；设备必须互斥启用 | 两套模式已存在，不能同时启用 |
| Siri 组名 | `siri.multimodal.noRTI`，本机组名探针已验证 | 已知主要支持场景；其他 Siri 组未知 |
| Siri 请求格式 | 11:54、12:07 字段摘要和 12:26 一次性脱敏请求体 | 文本包络及主要元数据类型已掌握 |
| 请求解析 | 12:25 `REQUEST_CAPTURED ×4`、12:40 `REQUEST_CAPTURED ×2` | **至少六次成功解析**，不代表随后回答成功 |
| 请求—响应关联 | 12:40 一次 `RESPONSE_TAG_MISSING`、一次成功从 store 恢复 | **间歇性不可靠；未证实修复**，缺少可验证事务标识时仍失败关闭 |
| DeepSeek API | 12:25 一次 `DEEPSEEK_STARTED` + `DEEPSEEK_RESPONSE_ATTEMPTED` | 有一次脚本层有效模型输出处理证据；UI 未验证 |
| Qwen 原生响应 | 13:50 与 14:49 两次 HTTP 200、13 个 SSE JSON 事件、两次文本 delta | 真实主要 SSE 事件序列及字段类型已掌握 |
| 60 的 SSE 前置校验 | 14:49 `strict60Preflight=MATCHES_60_PREFLIGHT` | 对**该次**原生 Qwen 响应通过全部当前已知前置条件 |
| 合成 DeepSeek SSE | 本轮按真实字段类型补齐 Session/Response/Choice/Item/Content/Done，离线测试 | 代码和 mock 通过；真实 Siri 是否接受 **待测** |
| Siri UI 标识 | 用户曾报告一次 Qwen 标签、数次“无法获得回答” | 不能推断哪些回答由哪个模型生成 |
| 安全限制 | 非纯文本、工具、审核分支拒绝；61 一律 `$done({})` | 保持失败关闭；系统级旁路仍可能显示 Qwen |
| 稳定版 | 无充分真机成功率和回滚验证 | **未发布** |

## 最新代码实际做了什么

1. 60 **不再只生成字段极简的 12/13 SSE 事件**，而是按已经从真机观察到的对象键名和数组结构构造所有回答承载事件；只复用上游有界 ID/时间及经限制的 Qwen 同域 continuation 元数据，所有回答文本由经过校验的 DeepSeek 输出生成。
2. 对 `notices`、`moderation`、工具调用、媒体内容的多处后期 SSE 位置增加了拒绝条件，防止错误的强制回答或 Qwen 数据泄漏。
3. 原有的不可混淆请求关联保护未被弱化：必须有有效 Header+本地 store，或同一响应 Hook 内完整且受支持的 Request body；同时有两者时必须一致。缺失两者则 **502，不猜“最后一条问题”**。
4. 61 被动诊断代码仍然不改写请求/响应，不调用 DeepSeek，不将问答正文写入仓库或额外服务器；它仍是独立的、手动授权才采样的实验工具。

## 建议查阅顺序

- [一日全部调试时间线与 PR #17–25](DEBUG_HISTORY_2026-11-19_ZH.md)
- [真实 Siri → Qwen 请求 JSON 结构](OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md)
- [真实 Qwen 13 事件 SSE 响应结构](OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md)
- [根因、信任边界与遗留 P0](ROOT_CAUSE_DECISIONS_2026-11-19_ZH.md)
- [真机验收矩阵和回滚](VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md)
- [安装 60](INSTALL_SIRI_DEEPSEEK_V06_ZH.md) / [被动 61 指南](QWEN_PASSIVE_DIAG_ZH.md)

**补充边界**：无法证明 Shadowrocket 在所有连接阶段都把临时请求 Header 原样带入 Response Hook；这依赖真实设备而非 Node mock。若要继续验证来源和显示效果，使用少量不涉及个人信息的 Siri 测试即可；不需要重复向仓库提交 PacketTunnel、代理数据库或私密请求值。
