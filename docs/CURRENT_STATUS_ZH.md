# AIES v0.6 当前状态

> **当前版本：v0.6.0-beta（`main`）。2026-11-19 真机确认了 Siri 请求钩子命中，但解析失败；原生 UI、DeepSeek API 与响应替换尚未验证。**

本次修订保留 `REQUEST_DIAG_*` 固定诊断码和受限纯文本包装兼容，并将一次性本地组名探针升级为 **v2（600 秒、状态检查不取消、单键存储、独立 STOP）**，保留 WritingTools 旁路。已在真实 iPad 日志观察到两次 Siri 和一次 WritingTools 的 `GROUP_UNSUPPORTED`，且通过新版探针取得真实 Siri 组名 `siri.multimodal.noRTI`；已添加精确的 Siri-only 纯文本兼容分支，但**真机请求解析及原生回答仍需验收，不能宣称已经修好 Siri**。不收集任何原始报文、私有令牌或真实问题；复测见[调试手册](DEBUGGING_ZH.md)。

| 环节 | 现状 |
|---|---|
| 唯一 Shadowrocket 60 模块与双钩子 JS | 已编码 |
| 文本识别、会话关联、SSE 重建 | 离线模拟通过；真实请求解析遇到 `ERROR_UNSUPPORTED_SIRI_REQUEST` |
| DeepSeek API 对接 | 代码已存在；`deepseek-flash` 官方模型名已核对，但真实 Key / 账户调用尚未实测 |
| 请求/响应钩子在真实 Siri 上是否触发 | 2026-11-19 已观察 Request hook 命中；Response hook 尚未确认 |
| Siri 原生界面是否接受重建 SSE | 未验证 |
| 分块、压缩、超时、并发和快速连续提问 | 需真机验证 |
| DeepSeek 失败时是否完全没有千问回退 | 脚本内部尝试阻止，系统级未证明 |
| 本地短期问题正文存储与彻底清理 | 待安全改善 |
| 稳定版 Release | **未发布** |

产品支持范围：特定 Siri 文本问答，不支持写作工具、视觉智能、音频文件、多模型或本地离线模型。用户接受原始请求可能由千问处理，DeepSeek 也会收到问题。

**2026-11-19 12:07 新证据：** 真实 Siri 的顶层还可能有 `input_hint:string`，已将该字段按类型严格允许，但不发送其值。另新增[主动开启的单次请求正文（脱敏）采样](SIRI_QWEN_BODY_CAPTURE_ZH.md)，目的是直接定位 `input` 中的文本元素，而不是继续猜 JSON 字段；用户需主动用 Siri 发一次非隐私问题。**尚无请求捕获/模型成功的真机验证。**

**真机新证据（2026-11-19 11:54）**：在明确手动授权的本机字段探针中，确认 `input:array`；顶层额外字段为 `client_tools:array`、`response_format:object`、`server_tools:array`、`stream:boolean`；`input` 包装层有 `type:string`；`message` 内部有 `content:array`、`role:string`。同期 PacketTunnel 的固定码证明两处原严格校验确实拦截了请求。现在仅精确允许这些**已证实的字段和类型**，要求消息 wrapper 的 `type` 若存在则必须为 `message`，未知实际值、媒体和工具调用仍拒绝。**真机完整解析、DeepSeek API、SSE 与 Siri UI 都未验证。**

**真机前次定位（2026-11-19 11:14）**：新版结构诊断明确报告 `NORTI_SHAPE_ROOT_FIELDS` + `NORTI_SHAPE_ITEM_WRAPPER_FIELDS`。本次增加单独的 [本机字段名/类型探针](SIRI_SCHEMA_PROBE_ZH.md)，只在明确手动授权时保存筛选过的字段键名/类型，不保存值。**不能仅据此认为输入已兼容**。

**真机前次阻塞（2026-11-19 11:06）**：noRTI 组名已被接受，但真实 Siri 在 11:06:40 和 11:06:46 两次出现 `REQUEST_DIAG_INPUT_UNSUPPORTED`；未到 DeepSeek。本次新增 `NORTI_SHAPE_*` 固定码细分顶层字段、input 类型和消息包装，不存储或输出实际 JSON。**修复尚未完成，需一次非隐私真机复测确认形状差异。**

当前下一步：刷新 60 模块，下载**新的** `siri_schema_probe_ONCE.js` 并遵循 [本地结构诊断流程](SIRI_SCHEMA_PROBE_ZH.md)。此脚本与此前组名探针不同，需要第一次手动开启、问 Siri、第二次手动读出经过筛选的键名与类型。使用非隐私 Siri 问题检查是否出现 `REQUEST_CAPTURED`，若看到 `REQUEST_DIAG_INPUT_UNSUPPORTED`、`CONTENT_UNSUPPORTED` 或 `MEDIA_UNSUPPORTED` 则说明真实结构仍超出安全白名单，停止该分支的测试并仅反馈固定错误码。之后再分别验证上游 SSE、DeepSeek 和 Siri 原生 UI；详见[调试说明](DEBUGGING_ZH.md)。达到 [发布清单](RELEASE_CHECKLIST_ZH.md) 的门槛后再决定是否发布稳定版。

仓库只保留当前 v0.6 的运行文件、测试与文档，不再维护不相关的旧实验代码。删除仓库中的旧文件**不等于清除设备上此前导入的模块**，实际设备仍需停用冲突配置。
