# AIES v0.6 Shadowrocket Siri / 写作工具安装、模式切换与回滚

> **实验 Beta，未通过原生 Siri UI 验收。** 60 是 Siri + WritingTools Compose Beta 的 DeepSeek 改写模式；61 是只读 Qwen 诊断模式，**两者不能同时启用**。用户问题可能先到 Qwen，再由 60 转交给 DeepSeek，无法提供系统级“零 Qwen 流量”保证。

## 1. 当前两个模块

| 模式 | 模块 | Runtime 固定 SHA |
|---|---|---|
| **60 Siri / 写作工具 → DeepSeek 改写** | [60-AIES-SIRI-DEEPSEEK-V06.sgmodule](../shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule) | `8175f473e1d812707418e2c2729c3db80e69e19b` |
| **61 原生 Qwen 被动诊断** | [61-AIES-QWEN-PASSIVE-DIAG.sgmodule](../shadowrocket/61-AIES-QWEN-PASSIVE-DIAG.sgmodule) | `506e51ad1ad549722242611f174b527cc12c4d21` |

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

1. 关闭 61 和其它同域冲突模块，再导入并启用 60。确认三条脚本规则固定 SHA 为 `8175f473e1d812707418e2c2729c3db80e69e19b`。
2. 在 Siri 问一个非私密且答案容易核对的**纯文本问题**；音频、图像、工具调用、未经验证的 WritingTools 操作、未知 SSE 事件都不应被当作受支持的纯文本转给 DeepSeek。
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

为了比较复杂问题在原生 Qwen 和 AIES→DeepSeek 下的实际差异，使用[同题 A/B 实验指南](AB_SIRI_QWEN_DEEPSEEK_COMPARISON_ZH.md)。60 的三条规则均固定到 `8175f473e1d812707418e2c2729c3db80e69e19b`；61 的四条原样放行规则均固定到 `506e51ad1ad549722242611f174b527cc12c4d21`。先进行所有模块关闭的原生基线，再用 61 观察同题 SSE 与客户端可见答案，最后切换 60 观察 DeepSeek API 的 `finish_reason`、token 用量、合成 SSE、关联丢失和会话级 Guard。任何步骤都不要同时启用 60 和 61；专用脚本只能手动 Script Test，不要注册自动网络钩子。

## 写作工具 Compose Beta（2026-11-19 浏览器协议研究后新增）

从系统的写作工具中选择**千问创作/Compose**，仅在其 Qwen 请求使用 SAIR 已逆向的 `configuration.response_configuration_group_id = compose_selectedAndAllText`，输入为明确的 user/text 包络、响应为目前支持的纯文本 SSE 时，60 才尝试调用 DeepSeek；成功正文输出 `body/refinements` JSON，并强制带 `【DeepSeek · AIES】`。这会把来源标记写进正文，插入文稿前请检查。*系统原有校对/摘要/本地处理不一定经过千问，不能保证已经全量替换。*

请先用一段**无个人信息的普通测试文字**测试；`WRITINGTOOLS_COMPOSE_SCOPED` 表示经过对应分支，`REQUEST_DIAG_WRITING_*` 表示未知或不安全的结构被拒绝，只有 `WRITINGTOOLS_DEEPSEEK_PAYLOAD_READY` 与实际写作工具正确展示共同成立，才算这一条写作工具实验成功。禁止上传选中文本原文、完整 PacketTunnel 或 API Key。所有来源及边界：[跨站请求分析](COMMUNITY_APPLE_INTELLIGENCE_REQUESTS_2026-11-19_ZH.md)。

## WritingTools Compose Beta：真实请求不匹配时

本版 60 在 `WritingTools` User-Agent 且 `configuration.response_configuration_group_id=compose_selectedAndAllText`、纯文本 `input` 已识别时，才向 DeepSeek 转发输入，并在 SSE 中返回 `body/refinements`；Siri 仍返回 `content/suggestions/summary`。真实 WritingTools 的完整 Qwen 请求 JSON 尚未在你的设备上逐字段核实，因此目前是 **Compose Beta**，不是校对/摘要/所有写作模式的完整替换。

如果只得到 `REQUEST_DIAG_WRITING_GROUP_UNVERIFIED` 或 `WRITING_INPUT_UNSUPPORTED`，**不要上传包含选中文本/凭据的 PacketTunnel 全文**；可先停用 60，启用只读 61，在本地使用 [WritingTools 字段类型一次性探针](QWEN_PASSIVE_DIAG_ZH.md#四可选只采集-writingtools-compose-的字段类型不保存选中文本) 采集非隐私示例的结构。AIES 不使用原 SAIR 的最近一次全局请求缓存修补丢失关联，以避免跨 Siri/写作工具串答。

## 响应阶段 User-Agent 丢失的受限场景恢复（2026-11-19）

新版 60 若响应阶段缺少 `User-Agent`，只允许凭**该事务请求阶段生成、仍在 45 秒有效期内、并在本地 store 验证成功的 `X-AIES-Request-ID`**恢复 WritingTools/Siri 场景；若响应阶段有明确但冲突的 UA，仍返回 `CORRELATION_MISMATCH`。缺少可靠 token 时，不能按最近一次请求猜测 WritingTools 场景。`WRITINGTOOLS_COMPOSE_SCOPED` 现在只在写作请求完成支持组名及纯文本校验后输出；`WRITINGTOOLS_SCENE_RECOVERED_FROM_TAG` 是受限恢复路径的诊断码，**仅表明代码命中，不等于 iPad 真机已经正常展示**。

## Siri 只能第一问显示 DeepSeek：先做 61 followup 诊断（2026-11-19）

2026-11-19 两份真机日志显示，多次 `DEEPSEEK_RESPONSE_ATTEMPTED` 已发生，而 60 的第三条规则累计 7 次 `QWEN_SESSION_FOLLOWUP_SSE_BLOCKED`（给会话级路径返回 502），并且每份日志各出现一次请求关联缺失。**这不能证明 DeepSeek API 只支持第一问**，也不能仅凭日志断定第二问 UI 失败完全由 Guard 引起。

在改动 60 的会话逻辑之前，先按 [61 被动诊断指南](QWEN_PASSIVE_DIAG_ZH.md)第五节运行一次 Siri followup *仅结构*探针：保持 60 关闭、61 独占，手动开启 `siri_followup_schema_probe_ONCE.js`，连续问两条非隐私文本问题，然后手动读取结构并清除。**不要把禁用 Guard 后偶然出现的原生 Qwen 回答误判为 DeepSeek。**

## 2026-11-20：真正的 Siri 会话级 DeepSeek 续答实验（替代旧第三条阻断 Guard）

**这节描述当前新版，覆盖上面旧版本关于“60 只有三条 Hook、第三条永远返回 502”的历史说明。** 本次 iPad 61 无正文探针证实：后续会话 POST 的路径是 `/v1/sessions/{id}/responses`，具有严格 `siri.multimodal.noRTI` 纯文本输入及 `previous_choice_id:string`；原生 HTTP 200 的 SSE **从 `session.response.created` 开始，不包含 `session.created`**，18 个可解析事件里包括 4 个文本增量和 4 个在 `text.value.done` 后的引用注释。之前的 `EVENT_ORDER_UNSUPPORTED` 因此是**主接口预检不可直接用于续答响应**，不代表原生 SSE 无效。

新版 60 **共四条 Hook**：主请求、主响应、会话级请求、会话级响应，全部固定 SHA `8175f473e1d812707418e2c2729c3db80e69e19b`。后续请求必须有有效 Siri UA、明确纯文本、合法 `previous_choice_id`，且该 choice 必须关联到**同一 Qwen session 中上一轮成功生成并返回的 DeepSeek 答案**。AIES 仅在设备本地 `$persistentStore` 保留最多三轮经 DeepSeek 验证的问答历史，逻辑有效期 **5 分钟**；注意过期只代表拒绝继续读取，**不保证底层物理擦除**。回答前还需通过请求/响应同事务临时 token（45 秒）和 SSE 结构与会话身份双重校验。只有这些校验都成功，才把经过验证的历史 + 本轮纯文本发送给 DeepSeek。Qwen 答案、引用链接及原始上下文元数据都不会被转交或回显。

新固定日志：
- `SIRI_CONTEXT_STORED`：经 DeepSeek 验证的当轮回答在本地建立了续答关联；
- `ERROR_FOLLOWUP_CONTEXT_UNAVAILABLE`：没有同一会话、未过期的前轮 DeepSeek choice；
- `ERROR_FOLLOWUP_CORRELATION_UNAVAILABLE` / `ERROR_CORRELATION_MISMATCH`：响应阶段事务标签/会话关联不可用；
- `SSE_PREFLIGHT_PASSED`、`DEEPSEEK_STARTED`、`DEEPSEEK_RESPONSE_ATTEMPTED`：续答结构通过并尝试替换，**不代表 Siri UI 一定显示成功**。
- 原 `QWEN_SESSION_FOLLOWUP_SSE_BLOCKED` 仍可能出现，例如响应没有可信关联标记；不安全的真实后续会话仍返回 502，而不会伪称 DeepSeek 回答。

**安装时必须重新导入 60**：旧模块固定 pin 不会因为 GitHub 的 `main` 更新而自动变成新版。确保 60 四条 Hook 都为上述 SHA、61 停用、旧 `00 REJECT` 和同域 Rewrite 停用。无需重复写入已有的 DeepSeek Key。先做普通纯文本同一 Siri 会话两问，并只查看固定 `[AIES_V06]` 错误码与每轮 UI 是否都显示 `【DeepSeek · AIES】`。如任一轮只显示无标记的 Qwen、错误、或中断，则停用 60，恢复原生模式并记录**非敏感状态码**；当前依然是 **Beta，未通过这条新路径的 iPad 真机 UI 验收**。
