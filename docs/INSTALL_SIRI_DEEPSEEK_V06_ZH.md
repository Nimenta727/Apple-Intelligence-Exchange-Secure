# AIES v0.6 Shadowrocket Siri / 写作工具安装、模式切换与回滚

> **回滚提示（2026-11-20）：如果安装过 63 v0.7，请停止使用。** 该请求优先实验版在真实 Siri 上出现六次本地 SSE 已提交但完全无可见回答的问题，仓库已默认禁用它。恢复可用方案：关闭 63，启用 62 LOCAL，保持 iCloud 云盘 `Shadowrocket/Script/aies_siri_deepseek_v06.js` 的原版文件，重新应用当前配置；60 和 61 仍保持关闭。不需要重新设置 `SAIRS_DEEPSEEK_API_KEY` 或重装证书。详细证据：[11:25 回归记录](routine/2026-11-20-11-25-v07-synthetic-sse-real-device-failure.md)。

> **实验 Beta，未通过原生 Siri UI 验收。** 60 是 Siri + WritingTools Compose Beta 的 DeepSeek 改写模式；61 是只读 Qwen 诊断模式，**两者不能同时启用**。用户问题可能先到 Qwen，再由 60 转交给 DeepSeek，无法提供系统级“零 Qwen 流量”保证。

## 1. 当前两个模块

| 模式 | 模块 | Runtime 固定 SHA |
|---|---|---|
| **60 Siri / 写作工具 → DeepSeek 改写** | [60-AIES-SIRI-DEEPSEEK-V06.sgmodule](../shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule) | `c9e8ac6332c7726594006fd243839742dba5d88a` |
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

1. 关闭 61 和其它同域冲突模块，再导入并启用 60。确认三条脚本规则固定 SHA 为 `c9e8ac6332c7726594006fd243839742dba5d88a`。
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

为了比较复杂问题在原生 Qwen 和 AIES→DeepSeek 下的实际差异，使用[同题 A/B 实验指南](AB_SIRI_QWEN_DEEPSEEK_COMPARISON_ZH.md)。60 的三条规则均固定到 `c9e8ac6332c7726594006fd243839742dba5d88a`；61 的四条原样放行规则均固定到 `506e51ad1ad549722242611f174b527cc12c4d21`。先进行所有模块关闭的原生基线，再用 61 观察同题 SSE 与客户端可见答案，最后切换 60 观察 DeepSeek API 的 `finish_reason`、token 用量、合成 SSE、关联丢失和会话级 Guard。任何步骤都不要同时启用 60 和 61；专用脚本只能手动 Script Test，不要注册自动网络钩子。

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

新版 60 **共四条 Hook**：主请求、主响应、会话级请求、会话级响应，全部固定 SHA `c9e8ac6332c7726594006fd243839742dba5d88a`。后续请求必须有有效 Siri UA、明确纯文本、合法 `previous_choice_id`，且该 choice 必须关联到**同一 Qwen session 中上一轮成功生成并返回的 DeepSeek 答案**。AIES 仅在设备本地 `$persistentStore` 保留最多三轮经 DeepSeek 验证的问答历史，逻辑有效期 **5 分钟**；注意过期只代表拒绝继续读取，**不保证底层物理擦除**。回答前还需通过请求/响应同事务临时 token（45 秒）和 SSE 结构与会话身份双重校验。只有这些校验都成功，才把经过验证的历史 + 本轮纯文本发送给 DeepSeek。Qwen 答案、引用链接及原始上下文元数据都不会被转交或回显。

新固定日志：
- `SIRI_CONTEXT_STORED`：经 DeepSeek 验证的当轮回答在本地建立了续答关联；
- `ERROR_FOLLOWUP_CONTEXT_UNAVAILABLE`：没有同一会话、未过期的前轮 DeepSeek choice；
- `ERROR_FOLLOWUP_CORRELATION_UNAVAILABLE` / `ERROR_CORRELATION_MISMATCH`：响应阶段事务标签/会话关联不可用；
- `SSE_PREFLIGHT_PASSED`、`DEEPSEEK_STARTED`、`DEEPSEEK_RESPONSE_ATTEMPTED`：续答结构通过并尝试替换，**不代表 Siri UI 一定显示成功**。
- 原 `QWEN_SESSION_FOLLOWUP_SSE_BLOCKED` 仍可能出现，例如响应没有可信关联标记；不安全的真实后续会话仍返回 502，而不会伪称 DeepSeek 回答。

**安装时必须重新导入 60**：旧模块固定 pin 不会因为 GitHub 的 `main` 更新而自动变成新版。确保 60 四条 Hook 都为上述 SHA、61 停用、旧 `00 REJECT` 和同域 Rewrite 停用。无需重复写入已有的 DeepSeek Key。先做普通纯文本同一 Siri 会话两问，并只查看固定 `[AIES_V06]` 错误码与每轮 UI 是否都显示 `【DeepSeek · AIES】`。如任一轮只显示无标记的 Qwen、错误、或中断，则停用 60，恢复原生模式并记录**非敏感状态码**；当前依然是 **Beta，未通过这条新路径的 iPad 真机 UI 验收**。

## 2026-11-20 00:47：脚本运行时从 raw.githubusercontent.com 下载失败（CFNetwork 310）与本地模块

用户截图显示 Shadowrocket 针对已核对的 `c9e8ac6332c7726594006fd243839742dba5d88a` Runtime 连续出现：
`script update script url ... => Error Domain=kCFErrorDomainCFNetwork Code=310`、`script exception => aies_siri_deepseek_v06.js`，在匹配目标 URL 时直接将请求/响应继续交给上游或客户端。**同一截图未出现 `[AIES_V06] REQUEST_CAPTURED`、`DEEPSEEK_STARTED`。** 因此主因先按**远程脚本下载/HTTPS 代理连接失败**排查，不要把本次“全是 Qwen”错误当作上一轮多轮解析失败、DeepSeek Key 失效。Apple 将代码 310 定义为 `kCFErrorHTTPSProxyConnectionFailure`（HTTPS proxy connection failure）。

### 优先步骤：排查 GitHub 脚本 URL 下载通路

1. 临时停止 60 后备份当前 Shadowrocket 配置。打开**正在使用的配置文件** → 编辑配置 → **脚本 URL**，查看四条 60 Hook 统一的 `raw.githubusercontent.com` 资源是否显示下载失败或红叉。可以手动重试下载，成功后重新“使用配置/编译配置”，而不是只看模块开关。
2. 若是 GitHub Raw 域名的代理连接失败，检查当前节点是否可用以及该域名的分流策略，不应将所有域名 HTTPS 解密范围扩大或随意关闭证书验证。可以通过受信任网络在浏览器打开下面的 **固定提交**文件链接核对 JavaScript 是否能完整获取。
3. 在日志还继续出现 `CFNetwork Code=310` 或 `script exception` 时**不要继续把 Siri 结果认作 DeepSeek**。停用 60 可恢复原生 Qwen；本项目不保证系统级阻止 Qwen。

### 避免运行时下载：可选 62 本地变体（仍需真机校验）

如果 Raw 下载在 Shadowrocket 中反复失败，可以把同一份 60 Runtime 从浏览器保存进 Shadowrocket **本机 `Script/aies_siri_deepseek_v06.js`**，再启用 [`62-AIES-SIRI-DEEPSEEK-V06-LOCAL.sgmodule`](../shadowrocket/62-AIES-SIRI-DEEPSEEK-V06-LOCAL.sgmodule)；该本地模块不是额外的改写器，**它替代 60，而非与 60 同时启用**。

- 固定源码：[GitHub 提交 `7a698fba` 中的 `aies_siri_deepseek_v06.js`](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/c9e8ac6332c7726594006fd243839742dba5d88a/scripts/aies_siri_deepseek_v06.js)。文件名必须保持 `aies_siri_deepseek_v06.js`；不允许将已经填入真实 Key 的本地一次性脚本当作运行时源文件。
- 将它放在 iPad “文件”App 的 Shadowrocket / Script 文件夹下；若应用版本使用不同本机目录，应在 Shadowrocket 里核对当前 Script 文件的实际路径，**不要仅凭 Script Test 能运行就认定 HTTP Hook 已找到本地文件**。
- 先关闭 60、61、旧的 `00 REJECT` 与重复同域 Hook，再安装/开启 **62 LOCAL**，保持必要的目标主机 MITM。62 的四条 Hook 同样为 `AIES60 Capture`、`AIES60 Rewrite`、`AIES60 Followup Capture`、`AIES60 Followup Rewrite`，但 `script-path` 一律改为 `aies_siri_deepseek_v06.js`，不再尝试通过 GitHub Raw 下载脚本。
- **验收本地文件加载**：先对一条无隐私的普通 Siri 问题观察 HTTP Hook 是否开始出现 `[AIES_V06] REQUEST_CAPTURED`；如果仍仅有 `script exception`、`script not found` 或错误，**该设备版本尚不能确认能解析本地模块路径，立即关闭 62**，返回 GitHub 下载网络诊断，不能宣称本地方案已生效。
- 如果请求捕获成功、但接着出现 `ERROR_FOLLOWUP_CONTEXT_UNAVAILABLE` 或 `ERROR_SSE_REWRITE_UNSUPPORTED`，这才进入之前的协议/会话级问题；分别处理，不把网络下载和模型失败混为一谈。
- 本地化减少对**GitHub 脚本更新链路**的依赖，**不会**防止系统或网络绕过 MITM，也**不能**保证“每个问题系统级零 Qwen”。本地也不会自动升级：未来更新必须人工替换整个 JS + 模块规则并重新核验 SHA。

建议先修好 Raw 通路并使用原版 60；62 是备用加载方案，其本地路径在用户设备上仍需实测。

## 2026-11-20 01:01：62 LOCAL 实际提示 `script js file is not found`

用户先尝试 60 Remote 时出现 `NSURLErrorDomain -1001 请求超时`（远程脚本获取失败），再启用 62 LOCAL，日志四次显示：

```text
script try to read js file in cloud driver => aies_siri_deepseek_v06.js
script js file is not found => aies_siri_deepseek_v06.js
```

用户在 `Script/aies_siri_deepseek_v06.js` 上执行 **Script Test** 没有异常与日志。这**不等于**模块的 HTTP 请求/响应 Hook 成功读取了该文件：主脚本在没有 `$request`/`$done` 的手动测试上下文中可以静默退出。随后的上传日志 `PacketTunnel-20261120010000.log` 显示四条脚本规则和 MITM 证书均正常加载，Siri 的主请求及会话级请求确实经过代理，但**没有任何 `[AIES_V06]` 执行阶段码**。不能称为 DeepSeek 生效。

### 应先排查 iCloud 目录与文件真实位置

1. **先保持 60/61/62 全部关闭**；不要把未打来源标记的原生 Qwen 回复当成已改写。
2. 打开 iPad 自带的 **文件 App → 浏览 → iCloud 云盘 → Shadowrocket → Script**。检查这里是否存在名称**完全一致**的 `aies_siri_deepseek_v06.js`，而非仅出现在“我的 iPad”目录或 Shadowrocket 的手动 Script Test 列表。Shadowrocket 本次日志明确写的是 `cloud driver`，所以应优先核实它所使用的 iCloud 云盘位置。参考 [Shadowrocket 社区使用手册](https://github.com/LOWERTOP/Shadowrocket/blob/main/README.md) 中的 iCloud Shadowrocket / Script 文件夹说明。
3. 如果文件仅在“我的 iPad”，从受信任的本地副本**复制/移动到以上 iCloud Script 文件夹**；确认文件扩展名是 `.js`、无额外 `.txt` 后缀、大小不为 0、不是空文件或普通快捷方式。若 iCloud 文件旁出现云朵下载标记，先点下载并等待其完全存于本机。避免上传任何带真实 DeepSeek Key 的版本。
4. 如果未显示 `Shadowrocket` 文件夹，检查 **iPad 设置 → Apple 账户 → iCloud → iCloud 云盘**，以及允许 Shadowrocket 使用 iCloud 的选项。若设备所在网络阻断 iCloud 同步或 iCloud 没有正确初始化，则不要假设它已经保存成功。
5. 在 Shadowrocket 中确认仅启用 **62 LOCAL**，四条规则仍以 `script-path=aies_siri_deepseek_v06.js` 结尾；刷新/重新应用当前配置，必要时重新启动 VPN，以避免上一份编译缓存继续运行。
6. 先只用一个无隐私的 Siri 文本问题，看日志中还会不会出现 `script js file is not found`；**真正证明脚本已由 HTTP Hook 执行**的信号是 `[AIES_V06] REQUEST_CAPTURED`，或者明确的 `[AIES_V06] REQUEST_DIAG_*` / `ERROR_*`。即使脚本已运行，仍需依据来源标记与 Siri UI 单独验证答案。
7. 若 iCloud Script 文件已完全下载、文件名准确、模块只有 62 且仍找不到，优先核对 Shadowrocket 版本的本地路径解析方式；**不要随意尝试 `Script/`、`file://` 等未经该版本验证的路径前缀**。返回 60 Remote 的下载通路修复或根据设备文档做单点兼容实验，保留原脚本不改动。

以上为**结合实际日志和公开说明的设备修复步骤**，非远程设备验证。没有必要再次开启 `siri_followup_schema_probe_ONCE.js`；前次 61 协议探针已经成功，当前故障是脚本载入层。

## 2026-11-20 09:26：修复 62 LOCAL 的本地脚本引用前缀和默认启用状态

**此节取代上文所有 62 LOCAL 示例中未带 `Script/` 的旧写法。** 用户再次确认：一旦开启 62 LOCAL，Shadowrocket UI 的脚本开关会自动关闭；之前已有 `script js file is not found`，但 `Script Test` 运行本地文件无异常。排查发现旧 62 四条 Hook 均写成：

```ini
script-path=aies_siri_deepseek_v06.js
```

参考 [Shadowrocket 官方新闻频道中本地文件使用示例](https://t.me/s/shadowrocketnews/973)：将 JavaScript 保存在 `iCloud 云盘/Shadowrocket/Script`，并使用 **`script-path=Script/header.js`**、`enable=true`。所以已修改项目的 62 模块四条 Hook，统一为：

```ini
script-path=Script/aies_siri_deepseek_v06.js,enable=true
```

**操作**：保持 60 / 61 关闭；在 Shadowrocket 的 62 模块中**重新下载/导入 main 的最新 62 LOCAL 模块或覆盖本地模块文本**，因为已保存的模块不会自动采用仓库新内容。确认四条 Hook 都显示 `Script/aies_siri_deepseek_v06.js,enable=true`。JS 仍是固定 SHA `c9e8ac6332c7726594006fd243839742dba5d88a`，无需更换 DeepSeek Key、重复下载 JS 或新建证书。重新应用当前配置，先检查脚本开关是否维持开启、`script js file is not found` 是否消失；**没有真实 `[AIES_V06] REQUEST_CAPTURED` 前不继续做多轮 Siri 模型验收**。

注意：日志只证明旧路径无法读取；`Script/` 前缀和 `enable=true` 是根据 Shadowrocket 发布的可用格式提出的具体修正，**尚未验证用户本机的自动关闭问题已被消除**。如果刷新模块后依旧自动关闭，应保持 62 停用，采用备份配置后直接在现有 `[Script]` 节添加四条与 62 相同的规则，不再同时使用任一 AIES 模块，并检查当前 Shadowrocket 版本的模块/脚本 UI 生效方式。

## 2026-11-20 09:43：真机仅第一问成功——previous_choice_id 严格校验与空值备用关联

用户使用已正常启动的 62 LOCAL，提交 `PacketTunnel-20261120094303.log`。在真机日志中，两次主 Siri 请求都进入了 `REQUEST_CAPTURED → RESPONSE_TAG_PRESENT → SSE_PREFLIGHT_PASSED → DEEPSEEK_STARTED → SIRI_CONTEXT_STORED → DEEPSEEK_LABEL_APPLIED → DEEPSEEK_RESPONSE_ATTEMPTED`；但两个后续会话请求分别在 09:44:03 和 09:44:39 报 `NORTI_SHAPE_PREVIOUS_CHOICE_INVALID → ERROR_UNSUPPORTED_SIRI_REQUEST`，**甚至还没调用 DeepSeek**。另有一次主请求响应丢失 tag，导致 `ERROR_PROMPT_UNAVAILABLE`；此错误与两次追问失败是独立问题。

初代 60 以 `/^[A-Za-z0-9_-]{1,160}$/` 强制校验 `previous_choice_id`。而 61 原始无正文探针只证明字段**类型是字符串**，未披露值，因此当前日志**不能推断该字符串究竟为空、含特殊字符还是超长**。

**已修复但仍需真机验收的限定场景**：

- 当 `previous_choice_id === ""` 时，新版允许在同一 Siri `/v1/sessions/{id}/responses` URL session 中读取此前**已通过 DeepSeek + SSE 校验**的最新本地 choice，绑定在原 5 分钟 TTL 内继续；请求/响应 tag、纯文本白名单、模型来源标记、SSE 审核仍必须通过。
- `previous_choice_id` **是非空、规范 ID** 时继续严格按原 choice ID 精确查找，不做宽松兜底。
- `previous_choice_id` 是**非空、含不支持字符、超长、缺失、非字符串**时仍拒绝，不允许错误串用其他会话的回答。
- 固定诊断日志新增 `FOLLOWUP_PREVIOUS_CHOICE_EMPTY`、`FOLLOWUP_PREVIOUS_CHOICE_NOT_STRING`、`FOLLOWUP_PREVIOUS_CHOICE_NONCANONICAL`、`FOLLOWUP_PREVIOUS_CHOICE_OVERSIZE`，**只输出分类，不记录 ID 值、提问文本或敏感元数据**。空指针且从同一会话找回上下文时记录 `FOLLOWUP_SESSION_CONTEXT_RECOVERED`。新源码固定到 `c9e8ac6332c7726594006fd243839742dba5d88a`。
- 62 LOCAL 的四条 Hook 仍为 `script-path=Script/aies_siri_deepseek_v06.js,enable=true`，**仅本地文件内容需要从上述新 SHA 覆盖**；60 Remote 四条 Hook 则已重新 pin 新 SHA。不能把“模块已更新”等同于本地 JS 已经替换。
- 若再出现 `FOLLOWUP_PREVIOUS_CHOICE_NONCANONICAL` 或 `OVERSIZE`，不要上传真实 previous choice 值，保留 fail-closed。依据固定分类再决定是否需要更精准的安全格式解析。

**验收顺序**：先保存备份，使用新版 62 LOCAL + 新版 JS；原 60/61 关闭。仅做普通无隐私的同一次 Siri 交互两问。看第二轮是否有 `FOLLOWUP_SESSION_CONTEXT_RECOVERED` / `REQUEST_CAPTURED` 和最终 `【DeepSeek · AIES】`；若未修复，仅分享 `[AIES_V06]` 固定代码，停止重复提问。已通过单轮还不足以宣称多轮 UI 成功。

## 2026-11-20 10:01：真实追问不是字符串 continuation；本地 62 JS 更新指南

用户上传的 `PacketTunnel-20261120100109.log` 证实：主请求多次进入 `DEEPSEEK_STARTED` 并将 `【DeepSeek · AIES】` 注入尝试返回；但五条追问都在 `FOLLOWUP_PREVIOUS_CHOICE_NOT_STRING`、`ERROR_UNSUPPORTED_SIRI_REQUEST` 处失败，根本没有进入第二轮模型调用。**这与 PR #37 所处理的 `previous_choice_id === ""` 不是同一条件**，不能凭日志断言真实字段一定为 null 或缺失。

最新版脚本对 `previous_choice_id` 为 **JSON null**、**字段不存在**、或**空字符串** 三种状态提供严格的 **同一会话**已验证 DeepSeek 历史恢复；不接受其他任意非字符串值、错误格式非空指针或跨会话复用。新增只有固定分类、不记录任何真实原值的日志：
- `FOLLOWUP_PREVIOUS_CHOICE_NULL` / `FOLLOWUP_PREVIOUS_CHOICE_MISSING` / `FOLLOWUP_PREVIOUS_CHOICE_EMPTY`：后续请求的无 pointer 形态；
- `FOLLOWUP_SESSION_CONTEXT_RECOVERED`：从 URL 指明的**精确同一 session**、5 分钟 TTL 内已验证 DeepSeek-only 上下文恢复；
- `FOLLOWUP_PREVIOUS_CHOICE_NONSTRING_UNSUPPORTED`：该字段为数字、布尔、数组、对象等**仍不支持的类型**，继续拒绝且不调用 DeepSeek；
- `FOLLOWUP_PREVIOUS_CHOICE_NONCANONICAL` / `..._OVERSIZE`：非空字符串格式不支持，继续拒绝。

**62 LOCAL 用户只替换本地 JS 内容**，从 <https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/c3a7014cdd8ec47841001748c615e704059d9370/scripts/aies_siri_deepseek_v06.js> 获取全部源码，保存到 `iCloud 云盘/Shadowrocket/Script/aies_siri_deepseek_v06.js`，确认文件已在本机下载并覆盖之前的版本。62 LOCAL 的四条脚本路径仍为 `script-path=Script/aies_siri_deepseek_v06.js,enable=true`，不需要重新安装模块、重新设置 DeepSeek Key 或修改 MITM 证书。60 Remote 的固定脚本 SHA 也同步升级，但远程下载在用户设备上曾报 310/超时，因此优先沿用本地 62。

更新后**只做一组**无隐私的两轮 Siri 问答，确认第二轮是否出现 `FOLLOWUP_SESSION_CONTEXT_RECOVERED`、`REQUEST_CAPTURED`、`DEEPSEEK_STARTED`，最终须在 Siri UI 看到 `【DeepSeek · AIES】` 才算通过。若出现 `..._NONSTRING_UNSUPPORTED` 或 `ERROR_SSE_REWRITE_UNSUPPORTED`，不要循环重试或发送原始请求数据，返回固定状态码即可。

## 2026-11-20 10:32：直接提问偶尔失败、首次/多轮显示“无法从千问获得回答”

在 `PacketTunnel-20261120101542.log`（10:15–10:29）中，**16 次**从缺失 `previous_choice_id` 恢复同会话上下文，**23 次**完成 DeepSeek SSE 改写尝试，但还有**9 次**后续请求 `FOLLOWUP_GROUP_UNVERIFIED`、**1 次**主请求 `GROUP_UNSUPPORTED`，以及**5 次**主请求 `RESPONSE_TAG_MISSING` / `ERROR_PROMPT_UNAVAILABLE`。

这份日志**不能**反推出“请问一下千问”对应的具体配置组，只能确认 Siri 在不同请求中采用不同协议组，且首个新连接请求的相关性有时丢失。AIES 不能仅凭出现 `DEEPSEEK_RESPONSE_ATTEMPTED` 宣告 Siri UI 显示成功。

本次新增**严格的已知纯文本 TQA 续答适配**：如果后续会话使用 `siri.tqa` 或 `siri_tqa`，在继续满足 Siri 客户端、纯文本结构、相同 URL session 内 DeepSeek-only 历史、request/response tag 与 SSE preflight 条件后才可进入 DeepSeek。**其他未知组仍拒绝**，避免工具媒体误路由。新日志固定分类：
- `FOLLOWUP_GROUP_TQA_TEXT`：已知 TQA 纯文本组（仍需后续所有校验）；
- `FOLLOWUP_GROUP_OTHER_SIRI`：其他 `siri.` 或 `siri_` 风格未验证组（未输出真实值，继续拒绝）；
- `FOLLOWUP_GROUP_OTHER_UNVERIFIED`：未知或不符合安全组名约束（继续拒绝）；
- `MAIN_GROUP_OTHER_SIRI` / `MAIN_GROUP_OTHER_UNVERIFIED`：主请求未知组（仍拒绝）；
- `RESPONSE_TAG_MISSING`：HTTP 响应未收到前一请求的事务标记；此问题**没有**在本次更新中解决，不能通过任意取“最近一个用户问题”修复。

**62 LOCAL：无需换模块，只更新脚本文件。** 从 <https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/637484295c10627f06e610bfe040dd58e67d309a/scripts/aies_siri_deepseek_v06.js> 获取整个固定 SHA 的源码，覆盖 `iCloud 云盘/Shadowrocket/Script/aies_siri_deepseek_v06.js`，保留 `script-path=Script/aies_siri_deepseek_v06.js,enable=true` 四条规则；保持 60、61 和历史同域 REJECT 关闭。无需重新配置 Key 或 MITM。只在 iPad 真机确认新脚本已载入后，再进行一组普通无隐私的两轮提问，观察 `[AIES_V06]` 固定状态和 Siri UI 的 `【DeepSeek · AIES】` 来源标记。

如果更新后主要仍是 `FOLLOWUP_GROUP_OTHER_SIRI` 或 `RESPONSE_TAG_MISSING`，停止重复问答，把固定诊断码作为下一轮具体兼容性证据；不建议把未知配置组一概允许，也不建议在缺失 tag 时直接回传原生 Qwen 作为 DeepSeek。
