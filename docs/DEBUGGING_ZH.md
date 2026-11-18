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
| `ERROR_UNSUPPORTED_SIRI_REQUEST` | JSON 或 Siri 文本场景不受支持 | 记录不支持，勿传请求正文 |
| `ERROR_SESSION_STORE_UNAVAILABLE` | 缺少本地 store | 不用全局最近问题作为替代 |
| `ERROR_ORIGINAL_RESPONSE_STATUS` | 上游 HTTP 状态不是 200 | 不调用 DeepSeek |
| `ERROR_SSE_UNAVAILABLE` | body 不可读、分块、压缩或超限 | 停止，不能直接透传原文 |
| `ERROR_PROMPT_UNAVAILABLE` / `ERROR_CORRELATION_MISMATCH` | 请求响应无法对应或串话风险 | 核对跨钩子 token 和请求体可见性 |
| `ERROR_SSE_REWRITE_UNSUPPORTED` | 事件顺序/结构不符合已知模型 | 使用合成 fixture 定位，不传真实 SSE |
| `ERROR_KEY_NOT_PROVISIONED` | 本地 Key 未写入 | 仅在设备本地配置，不粘贴到 URL |
| `ERROR_HTTP_CLIENT_UNAVAILABLE` | 运行环境不支持 HTTP 请求 API | 记录环境版本 |
| `ERROR_MODEL_NETWORK` / `ERROR_MODEL_TIMEOUT` | DeepSeek 网络或超时 | 检查网络和账户额度 |
| `ERROR_MODEL_RESPONSE_INVALID` | 状态码/JSON/结束原因不符 | 重点检查 `deepseek-flash` 模型是否可用 |
| `ERROR_MODEL_EXCEPTION` / `DONE_EXCEPTION` | 运行时或回调异常 | 停止并核对固定脚本版本 |
| `DEEPSEEK_RESPONSE_ATTEMPTED` 但原生 Siri 显示千问 | 客户端未接受替换、缓存或网络旁路 | 验收失败，不能标成功 |

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
