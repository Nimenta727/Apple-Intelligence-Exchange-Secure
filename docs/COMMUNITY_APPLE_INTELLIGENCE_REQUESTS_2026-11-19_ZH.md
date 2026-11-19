# Apple Intelligence / Qwen 请求结构：浏览器社区、技术文章及原项目交叉研究（2026-11-19）

> 研究对象是**网页可访问的程序员社区、Apple 开发者资料、逆向/安全研究及 SAIR 原项目**。与 Apple 官方公开的 Writing Tools UI/API 区分：`prod-yabuli.qianwen.com`、`response_configuration_group_id` 以及以下 SSE 字段来自第三方逆向和我们 iPad 真机观测，**不是 Apple 官方承诺稳定的公开协议**。本文件不含私人请求正文、Cookie、Authorization、模型密钥、个人设备/会话标识值。

## 1. 来源与证据质量分级

| 类别 | 公开来源 | 能真正证实什么 | 不能据此认定什么 |
|---|---|---|---|
| **逆向一手技术资料** | [boitar/sair: protocol_analysis.md](https://github.com/boitar/sair/blob/main/docs/protocol_analysis.md)、[运行代码 sair_adapter.js](https://github.com/boitar/sair/blob/main/scripts/sair_adapter.js) | 逆向作者报告的千问网关、`compose_selectedAndAllText`、Siri/写作不同 JSON、SSE 重写路径 | 不能保证其他设备/版本字段一样；项目功能声明不等于 Apple 官方支持或第三方复测 |
| **我们自己的设备实测** | [Siri 请求归档](OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md)、[13/24/26 SSE 事件归档](OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md)、[调试时间线](DEBUG_HISTORY_2026-11-19_ZH.md) | `siri.multimodal.noRTI`、UA=Siri、纯文本 input、Qwen 主/会话级接口、原生 SSE 注释增量、偶发 Header 丢失 | **尚未拿到 WritingTools 原始请求 JSON**；`WritingTools` UA 已从之前两份 PacketTunnel 验证，但不能由 UA 推断完整 group/schema |
| **Apple 官方 UI/功能** | [Apple Support：Writing Tools](https://support.apple.com/guide/iphone/writing-tools-write-improve-summarize-iph6f08da1d2/27/ios/27)、[WWDC25：Dive deeper into Writing Tools](https://developer.apple.com/videos/play/wwdc2025/265/) | 校对、重写、选中文本、Compose 与后续写作调整、富文本和编辑器集成是不同系统功能 | 并未公开中国区千问私有 HTTP JSON/SSE 字段、认证方法或响应具体 event 名称 |
| **Apple 官方模型框架技术** | [WWDC26：Bring an LLM provider to Foundation Models](https://developer.apple.com/videos/play/wwdc2026/339/) | 模型请求含 transcript/context/generation options；响应通过 text delta、工具/元数据事件组成流 | 这是**开发者使用的 Foundation Models provider 扩展机制**，不是本项目千问网关的同一套私有协议 |
| **开发者独立实测** | [Eclectic Light：Read an Apple Intelligence Report](https://eclecticlight.co/2026/09/22/read-an-apple-intelligence-report/)、[Check Writing Tools using AIR](https://eclecticlight.co/2024/10/29/check-writing-tools-using-air/) | Apple Intelligence Report（AIR）可展示模型请求、内部模板/处理位置；写作功能可能有本地与云端不同执行路径 | AIR 是**Apple 自身 AI/Private Cloud Compute**诊断，不自动等于第三方 Qwen 完整 HTTP 抓包；报告中可能包含私人写作正文 |
| **独立安全研究** | [Lumia Security：AppleStorm](https://www.lumia.security/blog/applestorm)、[Black Hat / DEF CON AppleStorm](https://infocondb.org/con/def-con/def-con-33/applestorm-unmasking-the-privacy-risks-of-apple-intelligence) | Siri、系统扩展、第三方服务的网络路径和隐私边界复杂；不同入口和模型服务可能有不同数据处理方式 | 不能证明“通过一个域名的 MITM 就能 100% 禁用其他系统模型或系统卡片品牌” |
| **程序员社区实际体验** | [V2EX 国行 AI 初体验](https://www.v2ex.com/t/1254313)、[V2EX 国行 Qwen 扩展说明](https://v2ex.com/t/1232913)、[LINUX DO 27.3 体验](https://linux.do/t/topic/3128615) | 用户能看到 Siri 千问标识、写作工具的千问创作入口，系统实际功能范围有限 | 普通 UI 体验贴没有原始 JSON/SSE、group ID 或 token 对照；不可当作协议来源 |
| **公开独立解析工具** | [ruangraung/apple-intelligence-report-parser](https://github.com/ruangraung/apple-intelligence-report-parser) | 能解析用户自己导出的 Apple Intelligence Report，观察请求执行环境与内部模板 | 不是中国 Qwen 响应 SSE 解析器；报告/文件本身可能含私密内容 |

**检索结论**：截至研究日，未发现**独立于 SAIR 的、公开可核实且给出国行 Qwen `compose_selectedAndAllText` 完整 request+response 字节结构**的程序员博客/论坛文章。多个站点的新闻或用户体验帖反复确认 UI 功能，却不能代替协议样本。因此不能将 SAIR 推断伪称为“多项目交叉验证”。

## 2. 真实 Qwen 请求层：目前已知的场景

公共网关（SAIR 逆向 + 我们真机 Siri/WritingTools 网络层观测）：

```text
POST https://prod-yabuli.qianwen.com/v1/sessions/responses
Content-Type: application/json
Response: text/event-stream
```

| 分组 ID | 源与状态 | AIES 策略 |
|---|---|---|
| `siri.multimodal.noRTI` | **我们真机证实**：Siri 纯文本子集，`input[].message.content[]` | 保留原有严格 Siri 路线和工具/媒体拒绝 |
| `siri.tqa` / `siri_tqa` | 原 SAIR、历史 AIES 文档/兼容路径 | 继续保留被验证的纯文本子集 |
| `compose_selectedAndAllText` | **SAIR 逆向报告，尚未由本机 WritingTools 请求正文复核** | 新增精确分组白名单的 **WritingTools Compose Beta**，只接受用户角色和纯文本输入，不盲目接受其他写作模式 |
| `siri.visualIntelligenceCamera` | SAIR 逆向报告的图像输入；本项目未验证完整端到端 | 不纳入本次纯文本适配，不发送未知媒体/图片 |
| 其他 `compose*`、校对/摘要、工具事件 | **缺少足够可核实的 Qwen 私有 payload 资料** | 不推断它们与 Compose 同构；需要用户受控无隐私样本和独立验收 |

SAIR 推断一个常见包络（**示意键名，不是用户真机 WritingTools 原始完整包**）：

```json
{
  "configuration": {
    "response_configuration_group_id": "compose_selectedAndAllText"
  },
  "input": [
    {
      "type": "message",
      "message": {
        "role": "user",
        "content": [{"type": "text", "text": "<用户自行选择的非隐私测试文本>"}]
      }
    }
  ],
  "stream": true
}
```

安全边界：现有 AIES 仍保留本机独立的 API Key，不复制原 SAIR 的潜在 URL 参数凭据管理、对所有字段进行宽松递归提取，或全局 `LATEST_PROMPT` 回退。若真实写作工具发送不同包装，本次 Beta 会返回明确的 `WRITING_*` 诊断码，不会猜测“最新一条写作内容”。

## 3. SSE：事件骨架类似，但**事件中的答案 JSON 不同**

原 SAIR 逆向认为 `session.created` → `session.response.created` → `choices/items/content` → 多次 `text.value.delta` → `text.value.done` → `content.done` → `items.done` → `choices.completed/done` → `session.response.done` 的层次结构可适用于多个场景。**我们真机已验证 Siri 的对应结构和额外 `text.annotations[].added` 事件；WritingTools 的实际 SSE 结构尚未得到该设备证实**。

两个场景应该生成不同的结构化答案文本：

```json
{"content":"【DeepSeek · AIES】\nSiri 的回答","suggestions":[],"summary":"【DeepSeek · AIES】"}
```

```json
{"body":"【DeepSeek · AIES】\n写作工具生成的正文","refinements":["精炼表达","调整语气","优化结构"]}
```

上面是**本项目约定**，不是完整原生 SSE；它们会被 JSON 序列化到相应的 `text.value.delta`、`text.value.done`、`content.done`、`item/choice/response.done` 结构中。原 SAIR 的具体字段名 `body`、`refinements` 是本次 WritingTools 新增支持的主要依据。

## 4. 已据此实现的 AIES Beta 代码

- `scripts/aies_siri_deepseek_v06.js`：优先按请求 UA 确定 Siri / WritingTools；WritingTools 只支持**精确匹配** `compose_selectedAndAllText` 且仅明确用户角色、纯文本、有限长度/个数。与 Siri 分别用 `body/refinements` 和 `content/suggestions/summary` 生成不同的文本 JSON，均由通过模型 API 验证的 DeepSeek 答案提供。
- 对 WritingTools 仍要求请求阶段与响应阶段使用相同事务的 token + 本机存储，或严格解析的同一事务 Request body；**明确记录场景类型**，不能拿 Siri 缓存误配写作工具答案。
- 对输出成功时的模型来源正文保留 `【DeepSeek · AIES】`；写作工具实际正文因此会含该前缀，**可能污染用户直接插入编辑器的文本**，这是用户要求强制可见身份标识的可预期代价。
- 不取消 Siri 工具/媒体/审核注释等既有安全限制，不全域拦截 Qwen，不声称系统级控制“千问”品牌。未匹配或未证实的 WritingTools 请求会失败关闭，可能显示“不可用”，而不是偷偷把未验证数据送 DeepSeek。
- 版本限于实验性场景适配，**需要真实写作工具进行纯文本 A/B 验收**；离线 mock 通过仅证明此假定请求形状下的代码行为。

## 5. 下一步真机验证清单

1. 用 WritingTools → 千问创作 → 一段完全非隐私文字，先在**原生 Qwen 61 被动**模式确认它的真实组名、`input` 键类型及 SSE 事件（不上传全文、认证 Header）。
2. 仅启用 60 测试同题 WritingTools Compose，固定日志需依次出现 `WRITINGTOOLS_COMPOSE_SCOPED`、`REQUEST_CAPTURED`、`SSE_PREFLIGHT_PASSED`、`DEEPSEEK_STARTED`、`WRITINGTOOLS_DEEPSEEK_PAYLOAD_READY`、`DEEPSEEK_RESPONSE_ATTEMPTED`，且编辑器实际出现写作正文。若不匹配，以 `REQUEST_DIAG_WRITING_*` 和 `ERROR_*` 判断。
3. 回归 Siri 一问一答和复杂 SSE 注释，确保原 Siri 路线未被 WritingTools 扩展干扰。
4. **P0**：Shadowrocket request→response Header 丢失时没有可靠同事务身份，仍失败关闭。不允许复制原 SAIR 的“60 秒内最新请求”方案；两种场景并发时尤须防串答。
5. 如确需扩展到其他 WritingTools 功能，先取得一条无隐私真机字段/类型结构，再给每个操作建立独立的 schema 和正反回归测试。

更多根因见 [调试史](DEBUG_HISTORY_2026-11-19_ZH.md) 与 [维护记录](routine/2026-11-19-AppleIntelligence-web-community-and-WritingTools-Compose.md)。

## 6. 本轮补充的本地验证手段

依据来源分级结果，当前尚缺乏可独立复验的真实 iPad `WritingTools` 请求正文。因此 61 的四条原生 Qwen Hook 继续**全部 `$done({})` 放行**，新增独立手动开启的 `writing_schema_probe_ONCE.js`：只有 600 秒窗口内，`WritingTools` User-Agent 的目标主/会话级 Qwen POST 才保存 JSON 字段名/类型、**软件场景 group ID（经过安全字符约束）**、SSE 事件/类型/状态；绝不记录写作选中文字、生成答案、原始 SSE、Token 或 Header。读取时逻辑清空。使用说明见[只读诊断指南](QWEN_PASSIVE_DIAG_ZH.md)及[本次维护 routine](routine/2026-11-19-21-30-WritingTools-Compose-SAİR-analysis-and-adapter.md)。

这个探针的任务是检验 SAIR 对 `compose_selectedAndAllText` 与 `body/refinements` 的私人协议逆向是否在当前国行 iPadOS 27.3 上成立；它不会让无 Qwen 远程请求的系统内部写作操作自动切换 DeepSeek。
