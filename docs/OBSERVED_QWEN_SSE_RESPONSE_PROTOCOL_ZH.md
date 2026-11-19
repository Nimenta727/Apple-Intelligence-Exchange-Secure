# 已观测 Qwen → Siri SSE 响应协议（2026-11-19）

> **不是 Qwen 官方文档**。本文件完全基于 13:50、14:49 两次真实 iPad Siri/Qwen 的 61 被动结构诊断、用户手动提交的 `RESPONSE_SSE_PART_*`，以及仓库现有的 `strict60Preflight` 校验。仅包含协议键名、字段类型、事件序列、检查结论；没有真实 Qwen 模型文本、会话 ID、隐私元数据或完整 SSE。

## 已验证的响应外壳

- URI 对应原有 `POST /v1/sessions/responses`。
- HTTP 状态：**200**。
- 主体：`text/event-stream` 风格 SSE；本次记录共 **13 个 JSON 数据事件**。
- 13 个事件分割为 14 个 `\n\n` 块（包含最后空块）：`framesScanned=14`。
- `jsonDataFrames=13`，`unparsedFrames=0`，`truncated=false`。
- 没有观察到多行 `data`、`id:`、`retry:`、SSE 注释或无 `event:` 的帧。
- 完成事件是 `session.response.done`；不要求独立的 `data: [DONE]`（两次都是 `doneMarker=false`）。
- **2026-11-19 14:49**：真实请求的 `strict60Preflight="MATCHES_60_PREFLIGHT"`，确认该次 SSE 通过当前 60 版的帧布局、已知事件序列、JSON 外壳、Session/Response ID 字符规则、关联相等性与整数过期时间检查。**这不证明改写后的 Siri UI 会正常显示**。

## 事件序列（实际捕获的顺序）

| 序号 | SSE `event:` | 次数 | 事件 `data` 的主要类型结构 |
|---:|---|---:|---|
| 1 | `session.created` | 1 | `id:string`、`object:string`、`expires_at:number`、`expires_after:object`、`last_active_at:number`、`created_at:number` |
| 2 | `session.response.created` | 1 | `notices:array(0)`、`created_at:number`、`model:string`、`id:string`、`choices:array(0)`、`object:string`、会话关联字段（诊断时键名被遮挡，源码检查表明为 `session_id`） |
| 3 | `session.response.choices[].added` | 1 | `index:number`、`choice:{output:array(0),id:string,continue_url:string,status:string}` |
| 4 | `session.response.choices[].items[].added` | 1 | `choice_index:number`、`index:number`、`item:{type:string,message:{role:string,content:array(0)}}` |
| 5 | `session.response.choices[].items[].message.content[].added` | 1 | `item_index:number`、`choice_index:number`、`index:number`、`content:{text:{annotations:array(0),value:string},type:string}` |
| 6–7 | `session.response.choices[].items[].message.content[].text.value.delta` | 2 | `item_index:number`、`choice_index:number`、`content_index:number`、`delta:string` |
| 8 | `session.response.choices[].items[].message.content[].text.value.done` | 1 | `item_index:number`、`choice_index:number`、`content_index:number`、`value:string` |
| 9 | `session.response.choices[].items[].message.content[].done` | 1 | `item_index:number`、`choice_index:number`、`index:number`、`content:{text:{annotations:array(0),value:string},type:string}` |
| 10 | `session.response.choices[].items[].done` | 1 | `choice_index:number`、`index:number`、`item:{type:string,message:{role:string,content:array(1)}}` |
| 11 | `session.response.choices[].completed` | 1 | `index:number`、`choice:{output:array(1),moderation:array(0),id:string,continue_url:string,status:string}` |
| 12 | `session.response.choices[].done` | 1 | 同上 `index`、`choice` 结构 |
| 13 | `session.response.done` | 1 | `notices:array(0)`、`created_at:number`、`model:string`、`id:string`、`choices:array(1)`、`object:string` 及会话关联字段 |

每个 `data:` JSON 的外层均满足：

```json
{
  "type": "<event_name>",
  "<event_name>": {
    "<上表所列结构>": "<只示意类型，不是原始字段值>"
  }
}
```

上面只是**示意**，不可当成可直接发送的完整 SSE JSON。事件 `delta` 和 `done.value` 才是回答文本的关键位置；最终 `item.message.content[].text.value` 和 `choice.output[]` 也可能再次携带答案。因此只替换一个文本 delta、却原样转发其他 Qwen 事件，存在**Qwen 原答案混入 Siri 的风险**。

## 对照：2026-11-19 初版 60 合成 SSE 存在的差异

以下差异已由**历史源代码与真机字段类型**直接核实：

| 原 60 代码 | 与真机记录不一致之处 |
|---|---|
| Session 事件只含 `id/object/expires_at` | 缺少 `created_at/last_active_at/expires_after` 等 |
| Response Created 只含 `id/session_id/model/status` | 缺少 `notices/created_at/choices/object` 等 |
| Choice Added 使用 `choice_index`、`choice.index` | 真机使用 `index` 和带 `id/continue_url/output/status` 的 `choice` |
| Item Added 使用 `item_index` 和合成 `item.id` | 真机记录是 `index` 和消息对象 |
| Content Added 使用 `content_index`，空文本无 annotations | 真机使用 `index`、`text.annotations:[]` |
| 后续 completed/done 则只使用简化 `choice.output` | 真机有 `choice.id`、`continue_url`、`moderation:[]`、`status` |
| 最终 Response Done 缺少响应元数据 | 真机包含与 Response Created 对齐的 `notices/created_at/model/object/choices` |

这**是结构兼容性风险，不等于经过 Siri 返回的错误解释**。用户报告过一次 Qwen 品牌卡片，不能确定其正文来自何种模型；无法从 PacketTunnel 日志证明 Siri 原生 UI 对哪些字段实施了强校验。

## 本轮改写器的严格处理策略

- **保留**已检验且只返回原始 Siri 客户端的少量非模型元数据：受限 Session/Response ID、时间戳、过期信息，以及经白名单检查的同域 `continue_url`。
- **重新构造**回答携带结构：`delta`、`text.value.done`、`content.done`、`item.done`、`choice.completed/done`、`response.done` 的所有答案路径全部由 DeepSeek 已验证回答生成，绝不原样复用 Qwen 文本。
- **补齐**上述已经实测存在的字段名和数组结构。无法证明安全的通知、审核事件和工具调用，继续拒绝；不能以“仅更换一个字符串”代替严谨的协议变换。
- **保留事件序列**，不凭一条采样就接受额外事件或多模态 payload；不能自动推断未观测到的 iOS 版本和 SSE 分支。
- **发送条件**：仅当原 SSE 完成严格预检、请求关联可证明、DeepSeek HTTP 200 正常结束，且合成 SSE 输出通过离线结构测试，才由脚本提交替换结果。模型回答只有成功时附加 `【DeepSeek · AIES】`；Siri UI 自带的 Qwen 服务品牌由系统控制，脚本无法保证改变。

## 关联与安全限制

60 在 12:40 的两次真机请求分别出现 `RESPONSE_TAG_MISSING` / `RESPONSE_PROMPT_BODY_UNAVAILABLE` 和 `ERROR_SSE_REWRITE_UNSUPPORTED`。这两种故障独立；**本次原生 Qwen SSE 预检成功不能证明 60 的请求关联已可靠**。若自定义关联 Header 在 Shadowrocket 转发中丢失，且响应阶段也看不到同一请求的 body，安全的行为仍是拒绝替换；使用“最新提问”绑定会导致并发串答。

## 数据来源

- 真机本地 61 输出：13:50（旧版 `eded04f0`）和 14:49（新增预检版 `56755369`），用户提供的 `RESPONSE_SSE_PART_001..023`。
- `PacketTunnel-20261119134948.log` 和 `PacketTunnel-20261119144915.log` 中的 `REQUEST_SCHEMA_CAPTURED_LOCAL`、`RESPONSE_SSE_SCHEMA_CAPTURED_LOCAL`。
- `scripts/aies_qwen_passive_diag.js` 的类型限制与 `scripts/aies_siri_deepseek_v06.js` 的严格解析与重建代码。
- 未收集或保存真实原始 SSE、Qwen 文本/ID 值、认证 Headers。

相关：[请求协议](OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md)、[修复与风险决策](ROOT_CAUSE_DECISIONS_2026-11-19_ZH.md)。
