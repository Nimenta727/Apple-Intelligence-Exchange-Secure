# AIES v0.6 后续调试与故障排查手册

> 目标：**一次集中、可回滚的真机验收**，不再要求重复旧 30/31/40 Safari 探针。所有记录必须脱敏；不要上传真实 Siri 问题、DeepSeek Key、原始 SSE 或完整 HTTP 报文。离线 CI 通过不代表真实 Siri 可以响应。

## 1. 诊断分层：先定位在哪一环节失败

```text
Siri 发起请求
   ↓
Shadowrocket HTTP Request hook [AIES_V06] REQUEST_CAPTURED
   ↓ 原请求可发千问（这是用户接受的新目标）
千问返回候选 SSE → HTTP Response hook
   ↓ 校验状态、会话上下文与 SSE
[AIES_V06] DEEPSEEK_STARTED
   ↓ 固定 DeepSeek API、设备本地 Key
[AIES_V06] DEEPSEEK_RESPONSE_ATTEMPTED
   ↓ 尝试替换 $response.body
Siri 原生 UI 实际展示 → 只有这一层才能最终验证
```

每个日志标签只是**脚本行为证据**，不等于上一层或下一层已成功。查看日志只关注固定 `[AIES_V06]` 阶段码和有无对应请求命中，避免展示请求头、正文和响应内容。

## 2. 第一次完整测试的推荐流程

1. 记录软件版本、模块版本、固定运行脚本 SHA、VPN 和 MITM 是否启用。备份旧配置。
2. 在本机配置已授权的低风险 DeepSeek API Key，明确原问题可能被千问与 DeepSeek 同时处理。
3. 启用 60 并停用旧 00/10/20/21/30/31/40/50，确认无重复接管规则。
4. 发出一个**非隐私** Siri 文本问答。记下是否有 `REQUEST_CAPTURED`、`DEEPSEEK_STARTED`、`DEEPSEEK_RESPONSE_ATTEMPTED` 或 `ERROR_*`，再记录 Siri 原生界面最终展示“DeepSeek/千问/无内容/系统错误/未知”。
5. 如果成功，只能记“正常路径一次通过”；继续做来源与回退故障验收之前，不能宣布产品已满足“答案一定来自 DeepSeek”。
6. 如果失败，**不重复无目的切换规则**，先对照下面的分支定位；若多次出现回退千问或私人信息风险，停止并恢复旧配置。

## 3. 错误码与处理矩阵

| 固定日志或症状 | 可能阶段 | 优先检查 | 预期处理 |
|---|---|---|---|
| 完全没有 `[AIES_V06]` | 宿主钩子未运行 | 模块导入、VPN、MITM Host、脚本下载、目标路径和版本 | 记为宿主未验证；不得声称不回退千问 |
| `REQUEST_CAPTURED`，无模型阶段 | 请求已捕获，响应钩子或预检未完成 | 是否存在对应响应阶段、原 SSE 状态与压缩/流式可见性 | 记录错误码；不得主动修改为千问透传 |
| `ERROR_UNSUPPORTED_SIRI_REQUEST` | 请求解析 | 仅支持固定 Siri 文本 POST、`siri.tqa` 或 `siri_tqa` 配置 | 记不支持，勿提交原始 body |
| `ERROR_SESSION_STORE_UNAVAILABLE` | 会话存储 | Shadowrocket 是否暴露 `$persistentStore.write` | 禁止绕过存储直接全局复用最近问题 |
| `ERROR_ORIGINAL_RESPONSE_STATUS` | 千问响应状态 | 本次原响应是否为 HTTP 200 | 不调用 DeepSeek，保留错误结果 |
| `ERROR_SSE_UNAVAILABLE` | 响应体 | `$response.body` 是否可读、上限/流式/压缩限制 | 不通过强行放行原 SSE 来绕过 |
| `ERROR_PROMPT_UNAVAILABLE` / `ERROR_CORRELATION_MISMATCH` | 关联 | `X-AIES-Request-ID` 是否跨两钩子可见；`$request.body` 是否仍可读 | 不以全局最近提问补救 |
| `ERROR_SSE_REWRITE_UNSUPPORTED` | 协议 | SSE 事件数量/顺序/字段和已支持版本是否一致 | 需要脱敏结构分析，不上传响应正文 |
| `ERROR_KEY_NOT_PROVISIONED` | 认证准备 | 本地 Key 键名、脚本执行成功与否 | 不把 Key 粘贴进 module 或 URL |
| `ERROR_HTTP_CLIENT_UNAVAILABLE` | 宿主 API | 当前运行环境是否支持 `$httpClient.post` | 记录环境差异，不假定跨版本兼容 |
| `ERROR_MODEL_NETWORK` / `ERROR_MODEL_TIMEOUT` | DeepSeek 网络 | HTTPS、网络连接、端点与超时 | 失败而非回退千问；必要时停止测试 |
| `ERROR_MODEL_RESPONSE_INVALID` | DeepSeek 返回 | HTTP 非 200、模型 ID、`finish_reason`、回答为空或超长 | 核对官方模型名称与账户权限，**勿上传原始响应** |
| `ERROR_MODEL_EXCEPTION` / `DONE_EXCEPTION` | 脚本内部或宿主调用 | 固定版本、运行时语法和异常路径 | 停止测试；可能存在未被改写的原生回退 |
| `DEEPSEEK_RESPONSE_ATTEMPTED` 但 Siri 仍显示千问 | 客户端/钩子边界 | Response rewrite 是否被 Siri 接受、是否存在别的连接/缓存 | **产品验收失败**，不是成功 |

`ERROR_*` 的 502 是**尝试替换响应**，不保证系统不显示千问。当前脚本没有设置“绝对禁止系统回退”的能力。

## 4. 最小故障注入与来源验证

只有正常链路成功之后才考虑（不要为了制造错误把私人问题发送千问）：
- 删除/清除本地测试 Key 或使用专用测试 Key 的可撤销配置，观察是否出现千问回答。
- 有限次数的 DeepSeek 网络错误/超时路径；预期脚本错误，而不是混合或千问 AI 文本。
- 两个非隐私问题连续/快速提出，核对没有交叉答案。
- VPN 断开、MITM 关闭或脚本缺席属于**宿主无法保证**的路径，不建议为了验证而持续在无保护状态下提敏感问题；如果 Siri 展示千问，即说明“任何时候只显示 DeepSeek”不成立。
- 结构变化、分块与压缩问题应优先用离线合成数据，在得到脱敏字段结构之前不得增加盲目透传容错。

## 5. 提交 Bug 前的信息格式

```text
AIES version: v0.6 Clean Beta
Script commit: b143280fe95e85fec197366afd735f1d46359e39
OS / Shadowrocket version: （只填版本）
Enabled modules: 60 on; 00/10/20/21/30/31/40/50 off
Hook result: REQUEST_CAPTURED / DEEPSEEK_STARTED / ERROR_CODE / no log
Native Siri output: DeepSeek / Qwen / none / error / unknown
Repro frequency: 1/1 or N/M (仅计数)
Rollback: yes/no
Secrets / raw prompts / headers / SSE: NOT INCLUDED
```

参阅：[用户使用](USER_GUIDE_ZH.md) · [源码架构](ARCHITECTURE_CURRENT_ZH.md) · [发布核对表](RELEASE_CHECKLIST_ZH.md)。
