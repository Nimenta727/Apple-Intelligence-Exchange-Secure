# AIES v0.6 安全与隐私边界（2026-11-19）

> 这是**实验性 Beta**。已对代码和 Node mock 做安全检查，但**未完成独立第三方安全审计、Shadowrocket 所有流转分支的验证或 Siri 原生端到端验收**。本页描述代码能控制的路径，并不承诺系统级的“只显示 DeepSeek”。

## 数据边界

1. **用户问题可能同时经过 Qwen 和 DeepSeek**：60 不会阻止已交给 Qwen 的原始 Siri 请求；在响应钩子验证成功后，只有提取出的明确纯文本部分会作为 `messages[].content` 发送到用户授权的 DeepSeek API。
2. **DeepSeek API Key**：只存放在设备 `$persistentStore` 的 `SAIRS_DEEPSEEK_API_KEY`；传给官方 DeepSeek HTTPS 端点的 Authorization Header。运行时的 AIES 固定日志不打印这个值；不要把它写到模块、URL、GitHub、截图或聊天里。
3. **原生 Qwen 回答**：60 对已识别 SSE 只使用通过格式约束的会话元数据（有界 ID、时间戳、部分被限制为同域的 continuation URL）。所有可显示答案的 `delta`、`done`、`output` 和最终响应文本由 DeepSeek 成功完成的回答重新构建；原生 Qwen 的答案文本不得混进改写结果。
4. **Shadowrocket PacketTunnel**：系统原始日志可能包含 Header、私有访问令牌、代理路由、设备信息或正文。**禁止将整份 PacketTunnel、proxy 数据库、CA 私钥公开提交或分享**，即使本项目自己的 `[AIES_V06]` 只打印固定阶段码。
5. **用户主动测试**：本地一次性组名、键/类型、脱敏正文探针均需用户手动开启 600 秒窗口；一般诊断只保留结构类型，不会主动上传 Qwen 或 DeepSeek 的文本值。带测试文本的专用探针仅适用于用户自己选择的**非隐私**问句，脱敏不是绝对保障。
6. **逻辑清除不能保证物理擦除**：本机 Session 关联存储有 TTL 并在成功消费后写空；网络丢失或没有匹配 Response 时，状态仍可能残留直到宿主机制清理。时间到期检查并不自动把所有持久化文件从闪存物理擦掉。

## 支持范围与失败关闭

- 60 主要兼容设备已证实的 `siri.multimodal.noRTI` 和历史的 `siri.tqa` / `siri_tqa` 文本包络。**当前支持范围仅是已证实的文本变体，不是通用多模态 Siri 转发器**。WritingTools 按 User-Agent 旁路，无法保证未识别客户端在一切环境中都可分类。
- 用户角色不是 `user`、未知外层类型、明显媒体内容、工具调用与非空审核输出应被拒绝，不发送给模型；新代码已对多个 SSE 结束事件中的工具和审核位置做检查。
- 如果 Qwen 上游不返回 HTTP 200、SSE 帧或事件类型未知、ID 不一致、DeepSeek 网络失败、模型并未正常结束，60 应返回固定错误，避免主动把 Qwen 原文当成 DeepSeek。
- 只有模型 API HTTP 200、`finish_reason=stop`、非空回答、重建 SSE 成功后才添加 `【DeepSeek · AIES】`，同时带 `X-AIES-Answer-Source: deepseek` 响应头。**不能凭卡片的 Qwen 品牌或 AIES 提交日志推断 Siri 真实显示。**

## P0：请求/响应关联的安全边界

- 请求 Hook 为每条有效 Siri 请求生成独立的随机 `X-AIES-Request-ID` 并将问题暂存到单独的短期本机键。响应 Hook 只在相同标记匹配，或其**自身已持有并能严格解析同一事务请求体**时恢复问题；两种来源冲突时立即拒绝。
- 真机已经出现 `RESPONSE_TAG_MISSING` + `RESPONSE_PROMPT_BODY_UNAVAILABLE`。如果这两个关联渠道都没有，**不能正确知道是哪一个问题产生当前响应**，因此返回 502。
- **绝不能**将“最近一次 Siri 请求”“唯一一个 Pending 请求”“最接近的时间戳”作为安全关联策略；多请求、重试和异步转发会造成把 A 的答案发给 B 的风险。
- 当前代码未证明 Shadowrocket 存在稳定的公开事务 ID API；后续只能在受控设备上验证宿主提供的同事务机制，不能臆测私有 `$request.id`。

## 61 被动诊断风险与互斥

- 61 两个 HTTP Hook 始终 `$done({})`，不改 Header、请求或响应 body/status，也不调用 DeepSeek 或其它第三方端点。
- 61 的本地摘要只在手动启动 600 秒后保存有限 JSON 键名/类型、白名单系统版本、SSE 事件序列/数量/结构；不保存原始 SSE、User-Agent 完整内容、认证 Header、Qwen 问答正文或 session ID 实值。固定 `strict60Preflight` 是**内存**里的值级判断，只有一个枚举结果持久化。
- 由于没有注入关联标记，61 单次 Request 摘要与 Response 摘要**不一定属于同一事务**，尤其存在并发时。测试期间一次只提一个问题。
- `$done({})` 不能消除 HTTPS MITM 和响应缓冲自身的时序影响。**60 和 61 必须互斥**；用户需要纯原生 Qwen 时应同时停用两个模块和所有旧同域 REJECT/Rewrite。

## 新增：只对已观测会话级 Siri SSE 的轻量阻断

本机代理数据库中发现 2 条旧版 60 没有覆盖的 Siri 会话级请求。新模块新增响应 Hook：仅对 `/v1/sessions/{id}/responses`、Siri 客户端和识别出的 HTTP 200 SSE 回包返回 502；不采集实际会话 ID 或原始回答，不封锁整个 Qwen 服务。它可减少一部分 Qwen 原答案直出，但不能阻止 MITM 未命中、非 SSE 或操作系统绕行。可能造成更多 Siri“无法获得回答”。

主路径关联缺失仍失败关闭，不扫描“最近一次请求”。成功 DeepSeek 回答的正文和 summary 由代码写入来源标记；Siri 底部的 Qwen 品牌不可由模型提示词可靠修改。用户本轮未要求、也未执行额外人工/真机测试。

## 错误报告与回滚

只分享经过本人检查的 `[AIES_V06]` 或 `[AIES_QWEN_PASSIVE]` 固定日志类别、模块固定 SHA 和 Siri 显示结果。停止实验时依次停用 60、61 和旧 REJECT，并按原备份决定是否关闭不再需要的目标域 MITM。所需的本地辅助采样可通过对应 `*_STOP_ONCE.js` 手动清理，不会误清 DeepSeek API Key。若需主动删除 Key，请使用单独的 [clear_key_ONCE.js](../scripts/clear_key_ONCE.js)。

详细源证据：[调试记录](DEBUG_HISTORY_2026-11-19_ZH.md)、[请求 JSON](OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md)、[原生 SSE](OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md)、[根因与决策](ROOT_CAUSE_DECISIONS_2026-11-19_ZH.md)。

## 自愿同题 A/B 诊断（2026-11-19）

新增两个独立、默认关闭的本地单次测试采样键：`AIES_AB_NATIVE_V1_STATE`（61 原生 Qwen）与 `AIES_AB_DEEPSEEK_V1_STATE`（60 DeepSeek）。在用户通过**手动 Script Test**开启后，采集安全的字段/事件类型、模型 HTTP 状态、`finish_reason`、用量、长度和**客户端可见的非隐私测试答案文本**（每个答案最长 7000 字符，常见 token/email/URL 字段遮挡）；不会记录认证 Header、API Key、会话 ID 值、隐藏系统提示词、原始 SSE 或模型推理细节。答案正文脱敏并不绝对，因此不得拿私人题目进行测试，读取结果应先本地检查再选择性分享。用户完全关闭两模块的 A 组不可能同时进行脚本层抓包；实验分为 A 原生基线、A' 61 插桩原生和 B 60 改写三组，避免混淆。参见[实验指南](AB_SIRI_QWEN_DEEPSEEK_COMPARISON_ZH.md)。
