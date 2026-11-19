# AIES v0.6 当前架构

> 以下描述当前代码设计，不代表其已在真实 Siri 设备上通过验证。

## 文件结构

```text
.github/workflows/ci.yml                  GitHub Actions
README.md / README_EN.md                   项目介绍
shadowrocket/
  60-AIES-SIRI-DEEPSEEK-V06.sgmodule      当前唯一安装模块
scripts/
  aies_siri_deepseek_v06.js                当前唯一请求/响应重写脚本
  provision_key_ONCE.js                    本机一次性 Key 设置模板
  clear_key_ONCE.js                        本机 Key 清空模板
  siri_group_probe_ONCE.js                手动 600 秒 Siri 组名状态诊断
  siri_group_probe_STOP_ONCE.js           手动明确停止/清空组名诊断状态
  siri_schema_probe_ONCE.js               手动开启/读取 noRTI 字段名+类型摘要
  siri_schema_probe_STOP_ONCE.js          手动明确停止结构诊断
  siri_qwen_body_probe_ONCE.js            手动启动/读取单次脱敏请求正文
  siri_qwen_body_probe_STOP_ONCE.js       手动明确停止请求正文采样
tests/
  siri-deepseek-v06.test.js                当前脚本模拟回归
  fixtures/siri-sse.js                     测试专用合成 SSE
tools/check-docs.js                        文档、版本引用与部署规则检查
docs/                                      当前使用/架构/调试/安全/发布文档
```

当前部署**不依赖旧的模块化构建器，也不需要运行生成命令**。模块的两个钩子指向同一固定 Git 提交的 `aies_siri_deepseek_v06.js`。

## 请求/响应流

```text
Siri 文本输入
  ↓
Shadowrocket HTTP Request Hook
  ├ 固定 host/path、POST、JSON，以及 legacy siri.tqa / 新增 Siri-only noRTI 严格文本范围校验
  ├ 读取问题正文、生成请求 token、写入短期存储
  └ 原请求继续按系统配置发送（可能由千问处理）
  ↓
千问候选 HTTP 200 SSE
  ↓
Shadowrocket HTTP Response Hook
  ├ 按 token 或当次 request body 找到问题
  ├ 预检 SSE 事件序列、长度、结构与会话 ID
  ├ 从本地 store 取 DeepSeek API Key
  ├ POST https://api.deepseek.com/chat/completions
  ├ 校验完整模型回答
  └ 仅用 DeepSeek 文本重建已识别回答字段
  ↓
尝试 $done({status,headers,body})
  ↓
Siri 原生 UI 是否接受：尚待真机验证
```

## 核心函数

| 部分 | 当前职责 |
|---|---|
| `C` | 固定 URL、模型、Key 名称、长度与超时 |
| `rawRequest`、`parseRequest`、`textAtom` | 严格提取支持的 Siri 文本输入，只输出固定 `REQUEST_DIAG_*` 失败原因码 |
| `randomToken`、`storeRead`、`storeWrite` | 每次请求关联与逻辑过期 |
| `rewriteSse` | 已知事件检查和 DeepSeek 回答字段重建 |
| `modelReply` | HTTP 200、完整结束原因、非空文本等校验 |
| `done`、`error` | 一次性响应、超时与尝试 502 错误 |
| `log` | 固定阶段日志，不主动输出问题和 Key |

2026-11-19 真机通过本地只读探针确认了 `siri.multimodal.noRTI`。本次仅对这个精确标识且 User-Agent 符合 Siri 的请求增加受限纯文本适配；`observedSiriTextEnvelopeReasons` 只接受顶层 `configuration` + `input`，每项仅接受纯文本 `content` 或受限 `message` 包装，拒绝媒体附件、意外字段与非用户角色；随后继续复用 `textAtom` 和 SSE 的严格检查。**真实 noRTI 请求的完整 JSON 结构尚未验证，拒绝不代表系统有问题**。日志仍只输出固定码。

## 真机组名诊断（2026-11-19）

用户日志确认 Siri 与 WritingTools 共用目标路径；请求钩子对两类请求都曾返回 `GROUP_UNSUPPORTED`。现在新增 `isWritingTools`，明确识别为 WritingTools 时无论 Request/Response 阶段均调用 `$done({})` 旁路，避免错误接管不支持的写作工具。

v2 的 `probeObserveRequest`、`probeObserveWritingTools` **不会改变解析结果**；它们仅在本机手动开启后的 600 秒有效期、HTTP Request 阶段、指定目标路径执行。单个状态键保留固定阶段码与有上限的统计；只有 Siri User-Agent 的目标 POST、组名格式通过过滤时才暂存一个组名，供本机手动查看并清除。手动脚本重复执行仅查状态，独立 STOP 文件明确停止。主运行日志只打印固定码；真机已由 `SIRI_REQUESTS_SEEN=1`、`LAST_STAGE=GROUP_CAPTURED` 和一次本地 `GROUP_ID` 读取确认了当前设备上诊断状态的跨执行环境共享；不同设备版本仍需分别验证。

新版模块仍只有两个 HTTP Hook 且 pin 到同一个不可变提交，辅助脚本单独放在 `scripts/` 中供 Script Test。详情见 [诊断指南](SIRI_GROUP_PROBE_ZH.md)。

## 风险边界

- 原始问题可能到千问；模型调用也会将问题发送 DeepSeek。
- 自定义 `X-AIES-Request-ID` 会发给上游，且跨钩子可见性尚待真机验证。
- 请求正文在本地 `$persistentStore` 中逻辑缓存约 45 秒；不代表安全擦除。`Math.random` token 也不应被视为密码学强随机凭据。
- SSE 是基于现有合成事件结构编写，不保证真实流式/压缩的 Siri 接收。
- 脚本处理失败尝试返回 502，但脚本完全缺席时无法阻止 Siri 的系统级回退。
- DeepSeek 官方文档已列出 `deepseek-flash`，但真实账户调用及 Siri 端到端结果仍未验证。

## 修改原则

统一修改 `scripts/aies_siri_deepseek_v06.js`、当前测试，并对模块中两个相同的不可变 Git SHA 引用同步更新。保持未知 SSE 不透传千问答案、Key 不上传仓库、失败路径不自动回退。详见 [维护手册](OPERATIONS_ZH.md)。

## noRTI 结构细分诊断（2026-11-19）

设备真实请求已到达精确的 noRTI 分支，但出现 `INPUT_UNSUPPORTED`。函数 `observedSiriTextEnvelopeReasons` 在仍然拒绝原始请求的前提下，返回不超过两个固定结构分类（根级字段、input 容器和消息包装错误）；主脚本通过 `NORTI_SHAPE_*` 记录常量，**不打印未知键名、键值、正文或请求头**。一旦结构正确，则复用原纯文本解析、SSE 校验和 Key 安全路径。现阶段未证明真实请求结构被接受。

## noRTI 字段结构探针（手动授权）

`captureNortiSchemaLocally` 只在 noRTI 严格文本检查失败且本机用户明确打开 600 秒窗口时运行。它仅将最多 8 项/层级、已过滤敏感样式的字段名称和**数据类型标签**写入独立本地状态键；不将任何字段值、正文、HTTP Header、Cookie、Authorization 或 Key 写入诊断状态或 HTTP 日志。`siri_schema_probe_ONCE.js` 手动测试将读取并逻辑清除；独立 STOP 允许明确取消。原解析限制完全不变，真实字段名仍待设备确认；参考[结构探针指南](SIRI_SCHEMA_PROBE_ZH.md)。

## 11:54 真机 schema 探针反馈后的受限允许规则

仅在精确 noRTI + Siri UA 分支允许已证实的根级字段及类型：`client_tools:array`、`server_tools:array`、`response_format:object`、`stream:boolean`；它们只参与类型检查，**不发送到 DeepSeek**。输入外层只允许 `message` 和可选 `type`，后者若存在必须为文本消息类型 `message`；内部只允许 `content`、`role=user`、可选 `type=message`。实际 `type` **值**和内容数组元素的结构尚未知，不允许自动扩展媒体/工具调用。内容解析仍采用严格 `textAtom`。若拒绝未知元素，只记录固定 `NORTI_CONTENT_*` 分类。

## 12:07 输入提示字段与用户授权的单次请求体诊断

已观察到额外根级 `input_hint:string`，精确支持字符串型但不将其值用于模型。`captureQwenRequestBodyOnce` 在**目标 Siri POST Request Hook** 与主解析器运行之前，以单独的本机状态键保存一份**脱敏后的**请求 JSON（保留受限 `input` 纯文本，省略工具定义、格式配置及未知根级的值）。该功能必须通过本地 `siri_qwen_body_probe_ONCE.js` 手动开启，默认不采集，成功后仅保存一次，不在 HTTP 日志输出正文，不影响原请求的失败关闭路径。用户手动读取先清理存储再分段显示。**不等于原始网络抓包或 Qwen 已接收证明。**
