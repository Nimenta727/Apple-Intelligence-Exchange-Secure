# AIES v0.6 调试与错误码

> 仅用于受控 Beta 真机测试。不要上传真实问题、API Key、Authorization、完整 SSE、CA 私钥或抓包。日志不是 Siri 客户端成功显示的证据。

## 定位顺序

```text
Siri 文本请求
  → [AIES_V06] REQUEST_CAPTURED
  → 上游响应 SSE 结构检查
  → [AIES_V06] DEEPSEEK_STARTED
  → DeepSeek 官方 API
  → [AIES_V06] DEEPSEEK_RESPONSE_ATTEMPTED
  → Siri 原生界面实际显示
```

1. 记录操作系统、Shadowrocket 和 AIES 版本；确认 VPN、MITM、60 模块均开启，设备上无其他同域冲突规则。
2. 用非隐私文本问 Siri 一次，记录固定日志阶段和最终显示类别：DeepSeek / 千问 / 空 / 错误 / 不明。
3. 如果显示千问或混合内容，视为产品来源验收失败，停止测试、关闭模块并恢复备份配置。
4. 只向开发者反馈错误码与版本，不分享敏感请求或完整响应。

## 错误定位表

| 阶段/错误码 | 含义 | 优先措施 |
|---|---|---|
| 完全无 `[AIES_V06]` | Script/VPN/MITM 未运行或客户端走其他通路 | 检查模块和实际命中；不能宣称来源保证 |
| `REQUEST_CAPTURED` 后停止 | Response hook 未运行或响应不可用 | 核对目标网络通路 |
| `ERROR_UNSUPPORTED_SIRI_REQUEST` | JSON 或 Siri 文本场景不受支持 | 查看紧邻的 `REQUEST_DIAG_*` 常量码，勿传请求正文 |
| `ERROR_SESSION_STORE_UNAVAILABLE` | 缺少本地 store | 不用全局最近问题作为替代 |
| `ERROR_ORIGINAL_RESPONSE_STATUS` | 上游 HTTP 状态不是 200 | 不调用 DeepSeek |
| `ERROR_SSE_UNAVAILABLE` | body 不可读、分块、压缩或超限 | 停止，不能直接透传原文 |
| `ERROR_PROMPT_UNAVAILABLE` / `ERROR_CORRELATION_MISMATCH` | 请求响应无法对应或串话风险 | 核对跨钩子 token 和请求体可见性 |
| `ERROR_SSE_REWRITE_UNSUPPORTED` | 事件顺序/结构不符合已知模型 | 使用合成 fixture 定位，不传真实 SSE |
| `ERROR_KEY_NOT_PROVISIONED` | 本地 Key 未写入 | 仅在设备本地配置，不粘贴到 URL |
| `ERROR_HTTP_CLIENT_UNAVAILABLE` | 运行环境不支持 HTTP 请求 API | 记录环境版本 |
| `ERROR_MODEL_NETWORK` / `ERROR_MODEL_TIMEOUT` | DeepSeek 网络或超时 | 检查网络和账户额度 |
| `ERROR_MODEL_RESPONSE_INVALID` | 状态码/JSON/结束原因不符 | `deepseek-flash` 模型名官方已支持；检查实际账户、HTTP 状态和回复完整性 |
| `ERROR_MODEL_EXCEPTION` / `DONE_EXCEPTION` | 运行时或回调异常 | 停止并核对固定脚本版本 |
| `DEEPSEEK_RESPONSE_ATTEMPTED` 但原生 Siri 显示千问 | 客户端未接受替换、缓存或网络旁路 | 验收失败，不能标成功 |

## 2026-11-19 真机请求解析专项

已观察到 Siri 的 `POST /v1/sessions/responses` 进入 Shadowrocket 的 Request hook，但脚本返回 `ERROR_UNSUPPORTED_SIRI_REQUEST`。这**不代表** DeepSeek API 已调用，也没有证据说明请求 JSON 的具体结构；不能凭猜测放宽 Siri 场景白名单。

本次更新在失败前只输出固定 `REQUEST_DIAG_*` 分类，不打印请求头、问题正文、原始 JSON 或令牌。

| `REQUEST_DIAG_*` 后缀 | 解释 |
|---|---|
| `BODY_NOT_TEXT` / `BODY_EMPTY` / `BODY_OVERSIZE` | 请求正文不是可读字符串、为空或超限 |
| `JSON_INVALID` / `ROOT_UNSUPPORTED` | JSON 无效或顶层不是对象 |
| `GROUP_MISSING` / `GROUP_UNSUPPORTED` | 不存在或不属于 `siri.tqa` / `siri_tqa`、或严格受限的 `siri.multimodal.noRTI`（Siri UA）组 |
| `INPUT_UNSUPPORTED` | `input` 数组结构或数量不符合限制 |
| `CONTENT_UNSUPPORTED` / `MEDIA_UNSUPPORTED` | 文本内容包装不支持或包含媒体 |
| `PROMPT_EMPTY` / `PROMPT_OVERSIZE` | 提取后为空或超长 |
| `STRUCTURE_UNSUPPORTED` | 其他复杂结构被拒绝 |

**复测流程：** 备份配置，刷新或重新导入 60 模块使双钩子引用新固定 SHA，使用一个非隐私问题测试；只反馈 `REQUEST_DIAG_*`、`ERROR_*` 和 Siri 最终显示类型。没有新诊断码就先检查是否仍在运行旧版脚本。不要再发送完整 PacketTunnel 日志——真实日志可能含 Authorization 和私有访问令牌。若看到千问输出，视为来源验收失败并回滚。

## 2026-11-19 新增：Siri 与 WritingTools 的组名区分

真实日志出现三个 `REQUEST_DIAG_GROUP_UNSUPPORTED`：一次 WritingTools、两次 Siri。因为二者共享同一个 URL，**仅匹配域名并不能区分**；当前脚本会对识别为 WritingTools 的请求和响应执行 `WRITINGTOOLS_SKIPPED`，不会向 DeepSeek 转发其内容。主程序仍严格拒绝未知 Siri 组名；**已确认的 `siri.multimodal.noRTI` 仅在 Siri UA 和严格纯文本 JSON 结构满足条件时允许通过第一道解析门槛**。

为避免旧版 180 秒采样过期和重复测试误取消，现用 **v2 600 秒状态检查工具**：先同步更新远程 60 模块和 iPad **本地同名 JS 文件**，使用 [`siri_group_probe_ONCE.js`](../scripts/siri_group_probe_ONCE.js) 手动开启、询问 Siri、反复查询剩余时间与分类计数，查询**不会取消**；捕获时仅在本机测试日志显示一次 `GROUP_ID=...`，其他日志仍只有固定码。确需取消，手动运行独立的 [`siri_group_probe_STOP_ONCE.js`](../scripts/siri_group_probe_STOP_ONCE.js)。完整方法及 `ACTIVE_REMAINING_SECONDS` / `SIRI_REQUESTS_SEEN` / `LAST_STAGE` 解释见[本地探针指南](SIRI_GROUP_PROBE_ZH.md)。若窗口过期、网络通路未命中或格式不安全，不放宽白名单。

**2026-11-19 新阶段：** 真机探针已读出 `siri.multimodal.noRTI`。更新模块后，无需再次开启采样，直接问一个非隐私文本问题。若继续收到 `REQUEST_DIAG_GROUP_UNSUPPORTED`，先确认模块更新和请求确实使用这个组名；若出现 `REQUEST_DIAG_INPUT_UNSUPPORTED` 或 `CONTENT_UNSUPPORTED`，意味着真正的 JSON 输入结构超出已知安全文本范围，**不要通过放宽多模态字段绕过**；若出现 `REQUEST_CAPTURED`，才进入 SSE/DeepSeek 下一步。上述均不代表 Siri 最终输出成功。

**提示：** `SIRI_GROUP_CAPTURED_LOCAL` 不代表请求已捕获并可送 DeepSeek，只代表曾临时保存一个组名；在真实组名审查后仍须验证解析、SSE 和 Siri UI。禁止发完整 PacketTunnel 日志。

## 后续验证

只有正常显示可确认时，才使用非隐私文本检查失败路径、重复请求、网络切换和脚本缺席时是否发生千问回退。脚本错误处理不等于系统级控制能力。

## 脱敏报告模板

```text
AIES: v0.6.0-beta
OS / Shadowrocket: 仅版本号
模块和 VPN/MITM: on / off / unknown
日志阶段: REQUEST_CAPTURED / DEEPSEEK_STARTED / ERROR_XXX / none
Siri 结果: DeepSeek / Qwen / empty / error / unknown
复现次数: N/M
已恢复原配置: yes/no
附带凭据、headers、真实问题或 SSE: NO
```

参阅 [安装](INSTALL_SIRI_DEEPSEEK_V06_ZH.md) · [架构](ARCHITECTURE_CURRENT_ZH.md) · [安全](SECURITY_CURRENT_ZH.md)。

## 2026-11-19 真机 INPUT_UNSUPPORTED 的精细分类

真机在更新 noRTI 兼容脚本后，连续两次出现 `REQUEST_DIAG_INPUT_UNSUPPORTED` / `ERROR_UNSUPPORTED_SIRI_REQUEST`，没有证据说明已进入 DeepSeek 调用。PacketTunnel 日志没有提供可安全复原的完整输入 JSON 结构，因此**不得猜测并放行所有额外字段**。

新模块在 `siri.multimodal.noRTI` 严格文本检查失败时，在原错误码前额外打印最多两个常量 `NORTI_SHAPE_*`，不打印请求正文、字段名或字段值。代码含义：

| 诊断码后缀 | 安全含义 |
|---|---|
| `ROOT_FIELDS` | 顶层键不恰好为 `configuration` + `input` |
| `INPUT_MISSING` / `INPUT_NOT_ARRAY` / `INPUT_COUNT` | 缺少 input、不是数组，或数量超限 |
| `ITEM_NOT_OBJECT` | 某条 input 不是对象 |
| `ITEM_WRAPPER_FIELDS` / `MESSAGE_NOT_OBJECT` | message 包装存在额外结构，或 message 不是对象 |
| `ITEM_FIELDS` / `CONTENT_MISSING` | 消息含不允许的字段，或缺少 content |
| `ROLE_UNSUPPORTED` / `ITEM_TYPE_UNSUPPORTED` | 角色或消息类型不是严格允许的文本值 |

复测：只刷新 60 模块（两个 Hook SHA 应以 `bc726e60` 开头），直接问 Siri 一次，不需要重跑组名探针；只反馈 `[AIES_V06] NORTI_SHAPE_*`、`REQUEST_DIAG_*` 和 `ERROR_*` 行。**即使新的 INPUT_UNSUPPORTED 消失，也必须继续验证原始 SSE 与 DeepSeek，不能宣称成功。**

## 2026-11-19 11:14：进一步确定 noRTI 的两处结构差异

真实 PacketTunnel 只包含固定诊断码，观察到 `NORTI_SHAPE_ROOT_FIELDS`、`NORTI_SHAPE_ITEM_WRAPPER_FIELDS`、`REQUEST_DIAG_INPUT_UNSUPPORTED`、`ERROR_UNSUPPORTED_SIRI_REQUEST`。这些分类**不能告诉我们需要支持的具体键名，也不能证明所有额外字段都安全**。

已添加严格本地、需要用户主动手动启用的 [JSON 结构键名/类型探针](SIRI_SCHEMA_PROBE_ZH.md)：**先刷新 60 模块，下载新的** `siri_schema_probe_ONCE.js` 到本机，运行一次开启 600 秒、问 Siri 一次、再运行一次本机查看结果。普通主日志只会打印固定的 `NORTI_SCHEMA_CAPTURED_LOCAL`，不会打印字段名、字段值或正文；字段名也会进行疑似敏感内容筛查。不得上传完整抓包，不要盲目放宽或跳过媒体校验。
