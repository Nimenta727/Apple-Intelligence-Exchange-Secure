# AIES v0.6 Shadowrocket Siri / 写作工具安装、模式切换与回滚

> **实验 Beta，未通过原生 Siri UI 验收。** 60 是 Siri + WritingTools Compose Beta 的 DeepSeek 改写模式；61 是只读 Qwen 诊断模式，**两者不能同时启用**。用户问题可能先到 Qwen，再由 60 转交给 DeepSeek，无法提供系统级“零 Qwen 流量”保证。

## 1. 当前两个模块

| 模式 | 模块 | Runtime 固定 SHA |
|---|---|---|
| **60 Siri / 写作工具 → DeepSeek 改写** | [60-AIES-SIRI-DEEPSEEK-V06.sgmodule](../shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule) | `be915df98261d3bf2e5eb65fd4827efae760643b` |
| **61 原生 Qwen 被动诊断** | [61-AIES-QWEN-PASSIVE-DIAG.sgmodule](../shadowrocket/61-AIES-QWEN-PASSIVE-DIAG.sgmodule) | `955fe4f7cec2471042469cdb7de740015db850bf` |

**60 的 Shadowrocket 模块 Raw URL：**

```text
https://raw.githubusercontent.com/Nimenta727/Apple-Intelligence-Exchange-Secure/main/shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule
```

**61 的 Shadowrocket 模块 Raw URL：**

```text
https://raw.githubusercontent.com/Nimenta727/Apple-Intelligence-Exchange-Secure/main/shadowrocket/61-AIES-QWEN-PASSIVE-DIAG.sgmodule
```

这些 Raw 地址是模块安装入口。**检查模块中的 Request 与 Response Hook 都固定到上表同一完整提交 SHA**；不要仅检查模块名字或脚本更新时间。GitHub 网页的 `blob/main` 链接不是 Shadowrocket 模块导入 URL。

## 2. 测试前准备

1. 备份当前 Shadowrocket 配置。手动检查设备上**旧的 `00 REJECT`、历史脚本、同域 URL Rewrite 或另一个模式的模块**，先全部停用；GitHub 删除旧代码不会帮设备自动删除配置。
2. 确认 VPN 连接正常。对**目标主机** `prod-yabuli.qianwen.com` 启用必要的 HTTPS MITM，并通过设备支持的系统证书信任流程完成验证。信任 CA 有安全风险，诊断结束应按需要关闭；不要把 MITM 范围扩大到其他域名。
3. 若要启用 60，必须有本人授权使用的 DeepSeek API Key。使用仓库的 [provision_key_ONCE.js](../scripts/provision_key_ONCE.js) **仅在设备本地**填入并手动执行，使它写入 `$persistentStore` 的 `SAIRS_DEEPSEEK_API_KEY`。执行后删除含真实 Key 的本地临时脚本。绝不能在 GitHub、模块 URL、聊天、截图、PacketTunnel 日志里传播 Key。
4. DeepSeek Chat Completions 的当前官方接口为 `POST https://api.deepseek.com/chat/completions`；本项目默认 `deepseek-flash`，并使用官方支持的 `thinking: {"type":"disabled"}` 非思考模式缩短等待时间。具体参见[官方 API 文档](https://api-docs.deepseek.com/api/create-chat-completion/)。**只有成功 HTTP/脚本日志和真机显示才算实际验收，不能仅因模型名称存在而宣布功能成功。**

## 3. 先做原生 Qwen 基线

先把 60 和 61 都关掉，问 Siri 一次无隐私的纯文本问题。如果这时就不能正常使用 Qwen，优先排查网络、Siri 集成、VPN/代理配置，而不是误判 DeepSeek 重建代码。

需要研究原始 SSE 时，再启用 61（**60 保持关闭**）；按 [61 被动诊断指南](QWEN_PASSIVE_DIAG_ZH.md)使用本地 `qwen_passive_probe_ONCE.js`。61 默认不采集，手动开启 600 秒窗口才暂存有限字段类型，两个 Hook 都 `$done({})` 不修改请求或响应。即便如此，MITM 缓冲也可能影响流式时序。

## 4. 60 DeepSeek 实验模式

1. 关闭 61 和其它同域冲突模块，再导入并启用 60。确认三条脚本规则固定 SHA 为 `be915df98261d3bf2e5eb65fd4827efae760643b`。
2. 在 Siri 问一个非私密且答案容易核对的**纯文本问题**；音频、图像、工具调用、WritingTools、未知 SSE 事件都不应被当作正常文本转给 DeepSeek。
3. **只查看固定 `[AIES_V06]` 状态码**：`REQUEST_CAPTURED`、`RESPONSE_TAG_*`、`SSE_PREFLIGHT_PASSED`、`DEEPSEEK_STARTED`、`DEEPSEEK_LABEL_APPLIED`、`DEEPSEEK_RESPONSE_ATTEMPTED` 或 `ERROR_*`；不要上传原始请求日志。
4. 看 Siri **真正显示的内容**。只有用户肉眼看到 `【DeepSeek · AIES】` 的正文、且固定日志链与同一测试一致，才算至少一次 DeepSeek Siri 显示闭环。Qwen 服务卡片可能仍然显示原品牌。
5. 遇到 `RESPONSE_TAG_MISSING` + `RESPONSE_PROMPT_BODY_UNAVAILABLE` 时会失败关闭，避免把错误问题配给另一个答案。这是**仍待真机解决**的跨 Hook 关联问题；不要打开“全局最新请求”之类不安全修复。其他错误按[调试表](DEBUGGING_ZH.md)判断。

## 5. 2026-11-19 新 SSE 重建的意义与限制

- 真机 61 已验证 Qwen 原生有 13 个 SSE 事件、两个文本增量，14:49 的一次响应满足 `MATCHES_60_PREFLIGHT`。旧版 60 只构建极简的 Choice/Item/Session 事件字段。
- 最新 60 的脚本改为按[真实响应协议](OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md)重新生成包含完整可见字段结构的所有回答事件，仅从 Qwen 取有界的非模型会话元数据，所有答案文本都来自通过验证的 DeepSeek 回包；工具/媒体/审核路径拒绝。
- 这一改动仍只通过 Node 离线模拟和静态审查，**不能保证 Siri 真机接收**，也**没有解决 Header 丢失**。

## 5A. Qwen 会话级回答轻量保护（2026-11-19 15:51）

最新设备代理数据库出现 2 条以前没有被 60 拦截的 Siri `/v1/sessions/{会话标识}/responses` 请求。新版 60 因此共有 **3 条规则**：主请求、主响应、会话级 SSE 响应 Guard；统一固定到同一脚本提交。第三条只针对这个特定路径、Siri 客户端、上游 HTTP 200 且识别为 SSE 的响应返回 502，避免直接显示未经验证的 Qwen 原文。不封锁 Qwen 整个域名，也不影响正常主接口。

**权衡**：这个 Guard 并不会把该路径的 Qwen 回答改写成 DeepSeek，因此复杂 Siri 交互可能更频繁出现“无法获得回答”。若优先恢复原生 Qwen，关闭 60、61 与旧 REJECT。固定日志码是 `QWEN_SESSION_FOLLOWUP_SSE_BLOCKED` 和 `ERROR_QWEN_FOLLOWUP_UNVERIFIED_SOURCE`。

主请求偶发的 `RESPONSE_TAG_MISSING` 仍未解决。新代码提高普通 SSE 分帧兼容性、DeepSeek 最多生成 1000 token、15 秒代理等待上限，成功正文与 `summary` 都有强制 `【DeepSeek · AIES】`；底部“千问”系统服务品牌不能通过这类脚本可靠修改。

本轮根据你的要求**不进行人工或真机测试**，这些措施只代表代码改动，并非可靠性验收。

## 6. 停止和清理

- 不稳定时：**先停用 60，再停用 61**；确认旧的 REJECT 和其它同域脚本也停用，恢复原生 Qwen。
- 完成调试后：如不需要长期使用目标域 MITM，按原备份关闭或撤销相应配置。停止任何还在运行的本地采样，请手动执行对应的 `*_STOP_ONCE.js`；这不会清除 Key。
- 若想清除 DeepSeek Key，按需手动运行 [clear_key_ONCE.js](../scripts/clear_key_ONCE.js)，但这一步与普通更新模块无关。
- 只分享固定错误码、脚本 SHA 和 Siri 显示结果；**不要上传完整 PacketTunnel、代理 DB、CA 私钥、真实问题或认证信息**。

完整资料：[请求 JSON](OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md)、[调试历史](DEBUG_HISTORY_2026-11-19_ZH.md)、[根因与未修项](ROOT_CAUSE_DECISIONS_2026-11-19_ZH.md)、[验收矩阵](VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md)。

## 同题 A/B 实验（2026-11-19 16:15 后）

为了比较复杂问题在原生 Qwen 和 AIES→DeepSeek 下的实际差异，使用[同题 A/B 实验指南](AB_SIRI_QWEN_DEEPSEEK_COMPARISON_ZH.md)。60 的三条规则均固定到 `be915df98261d3bf2e5eb65fd4827efae760643b`；61 的四条原样放行规则均固定到 `955fe4f7cec2471042469cdb7de740015db850bf`。先进行所有模块关闭的原生基线，再用 61 观察同题 SSE 与客户端可见答案，最后切换 60 观察 DeepSeek API 的 `finish_reason`、token 用量、合成 SSE、关联丢失和会话级 Guard。任何步骤都不要同时启用 60 和 61；专用脚本只能手动 Script Test，不要注册自动网络钩子。

## 写作工具 Compose Beta（2026-11-19 浏览器协议研究后新增）

从系统的写作工具中选择**千问创作/Compose**，仅在其 Qwen 请求使用 SAIR 已逆向的 `configuration.response_configuration_group_id = compose_selectedAndAllText`，输入为明确的 user/text 包络、响应为目前支持的纯文本 SSE 时，60 才尝试调用 DeepSeek；成功正文输出 `body/refinements` JSON，并强制带 `【DeepSeek · AIES】`。这会把来源标记写进正文，插入文稿前请检查。*系统原有校对/摘要/本地处理不一定经过千问，不能保证已经全量替换。*

请先用一段**无个人信息的普通测试文字**测试；`WRITINGTOOLS_COMPOSE_SCOPED` 表示经过对应分支，`REQUEST_DIAG_WRITING_*` 表示未知或不安全的结构被拒绝，只有 `WRITINGTOOLS_DEEPSEEK_PAYLOAD_READY` 与实际写作工具正确展示共同成立，才算这一条写作工具实验成功。禁止上传选中文本原文、完整 PacketTunnel 或 API Key。所有来源及边界：[跨站请求分析](COMMUNITY_APPLE_INTELLIGENCE_REQUESTS_2026-11-19_ZH.md)。

## WritingTools Compose Beta：真实请求不匹配时

本版 60 在 `WritingTools` User-Agent 且 `configuration.response_configuration_group_id=compose_selectedAndAllText`、纯文本 `input` 已识别时，才向 DeepSeek 转发输入，并在 SSE 中返回 `body/refinements`；Siri 仍返回 `content/suggestions/summary`。真实 WritingTools 的完整 Qwen 请求 JSON 尚未在你的设备上逐字段核实，因此目前是 **Compose Beta**，不是校对/摘要/所有写作模式的完整替换。

如果只得到 `REQUEST_DIAG_WRITING_GROUP_UNVERIFIED` 或 `WRITING_INPUT_UNSUPPORTED`，**不要上传包含选中文本/凭据的 PacketTunnel 全文**；可先停用 60，启用只读 61，在本地使用 [WritingTools 字段类型一次性探针](QWEN_PASSIVE_DIAG_ZH.md#四可选只采集-writingtools-compose-的字段类型不保存选中文本) 采集非隐私示例的结构。AIES 不使用原 SAIR 的最近一次全局请求缓存修补丢失关联，以避免跨 Siri/写作工具串答。
