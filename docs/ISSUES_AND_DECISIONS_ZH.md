# AIES 当前技术决策与未关闭问题（2026-11-19）

> 以真实设备证据为准。旧的组名、请求 JSON 解析问题已有实证支持的代码修复；真实 Siri 最终显示及请求—响应可靠关联仍未验收。

## 当前决定

| 编号 | 决策 |
|---|---|
| D1 | 面向 Siri **原生文本问答 UI**，不通过快捷指令、网页或通知替代 |
| D2 | 用户允许原始请求先到 Qwen；只有在脚本成功改写时，回答来源才应该是 DeepSeek |
| D3 | **60 改写**和**61 原生被动诊断**独立互斥；停用 60 才能做原生 Qwen 对照 |
| D4 | 60 只能使用被严格验证的纯文本输入和当前已知 SSE；工具、媒体、审核异常保持 fail-closed |
| D5 | 回答可见前缀在 DeepSeek 合法返回和 SSE 生成成功后由代码添加，不能只依赖模型自称 |
| D6 | 请求关联必须可证明。Header 丢失且响应缺少请求正文时，继续失败关闭；绝不使用“最新请求” |
| D7 | 真实 SSE 结构采用真机采样的字段类型，对有界非模型元数据做限定复制，**所有可见答案字段必须重建** |
| D8 | Key、私密提问、认证 Header、原始日志、CA 私钥不写入仓库；辅助探针默认关闭、只能本机手动开启 |
| D9 | 真机 Siri UI 及系统级回退没过验收前，仍为 Beta，不发 Stable |

## 当前待解决问题

| 优先级 | 问题 | 可用证据与建议 |
|---|---|---|
| **P0** | Shadowrocket Response Hook 曾丢失 `X-AIES-Request-ID` 且没有 Request body | 12:40:20 `RESPONSE_TAG_MISSING`、`ERROR_PROMPT_UNAVAILABLE`。需确认宿主支持的跨钩子事务 ID；不能“猜”关联 |
| **P1** | 新合成 SSE 是否被 Siri 原生客户端接受 | 已用真实 Qwen 13 事件字段结构改写，但只有离线模拟，通过真机 UI 验证 |
| **P1** | DeepSeek API 当前完整调用体验和 11 秒超时 | 曾有一次 `DEEPSEEK_RESPONSE_ATTEMPTED`；现请求明确禁用 thinking，仍需验证服务延迟 |
| **P1** | 系统级代理缺席时可能显示 Qwen 原始回答 | 软件 Hook 不能保证系统通道始终被覆盖；应明确告知使用者 |
| **P2** | 不同 Siri/iOS/多媒体和 Tool Response 变体 | 只掌握 `iOS 27.3/zh_CN/noRTI` 的受控样例；继续保持白名单 |
| **P2** | Session store、Key、MITM、日志剩余风险 | 逻辑过期清理不是物理擦除；需要真实设备版本/回滚验证 |

当前证据和审计详情见 [根因与决策](ROOT_CAUSE_DECISIONS_2026-11-19_ZH.md)、[完整调试历史](DEBUG_HISTORY_2026-11-19_ZH.md)、[真机验收](VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md)。
