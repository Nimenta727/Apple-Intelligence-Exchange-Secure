# 已观测 Siri → Qwen 请求协议（2026-11-19 真机基线）

> **证据性质**：来源于用户 iPad 的本地 `siri_qwen_body_probe_ONCE.js` 脱敏 JSON 摘要（12:26:57），及 11:54、12:07、13:50、14:49 四次本地结构探针。仅有**本次实际观测的字段和值/类型**才标为“已证实”；未公布的服务端工具定义、格式模式及设备私人元数据不猜测、不伪造。请求主体不是经过官方发布的 API 规范，不能推导其他 iOS 版本必然相同。

## 接口与请求外形

- **接口（已证实）**：`POST https://prod-yabuli.qianwen.com/v1/sessions/responses`。
- **客户端识别（已证实）**：Siri User-Agent，配置组名 `siri.multimodal.noRTI`；该组虽然名为 multimodal，本次可处理的用户请求元素是单纯的 `type:"text"`。
- **系统字段（已证实）**：`configuration.query.platform="iOS"`、`locale="zh_CN"`、`os_major_version=27`、`os_minor_version=3`、`os_patch_version=0`。这是**请求中明示的元数据**，并非从系统读取隐藏提示词。
- **正文位置（已证实）**：`input[0].message.content[0].text`，内容类型 `"text"`，`message.role="user"`，`input[0].type="message"`。
- **请求控制（已证实）**：`stream=true`，存在 `client_tools[]`、`server_tools[]`、`response_format{}`；部分真实请求带 `input_hint:string`。
- 当前项目**只提取消息纯文本用于 DeepSeek**；其余工具、格式指令和 `input_hint` 都不发送给 DeepSeek。

## 经过脱敏的结构示例（说明性的占位值，绝非完整原包）

```json
{
  "configuration": {
    "query": {
      "platform": "iOS",
      "locale": "zh_CN",
      "os_major_version": 27,
      "os_minor_version": 3,
      "os_patch_version": 0
    },
    "response_configuration_group_id": "siri.multimodal.noRTI",
    "template_variable_definition_overrides": [],
    "template_variables": []
  },
  "input": [
    {
      "type": "message",
      "message": {
        "role": "user",
        "content": [
          {"type": "text", "text": "<用户自行输入的无隐私测试问题>"}
        ]
      }
    }
  ],
  "client_tools": [
    {
      "type": "<工具类型字符串；值未公开>",
      "function": {
        "name": "<不记录>",
        "description": "<不记录>",
        "parameters": {},
        "strict": true
      }
    }
  ],
  "server_tools": [
    {"type": "<工具类型字符串；值未公开>"}
  ],
  "response_format": {
    "type": "<响应格式类型；值未公开>",
    "json_schema": {
      "name": "<不记录>",
      "content_property": "<不记录>",
      "strict": true,
      "schema": {
        "type": "<类型；值未公开>",
        "properties": {},
        "required": [],
        "additionalProperties": false,
        "x-order": []
      }
    }
  },
  "stream": true,
  "input_hint": "<可选；值不会采集或转发>"
}
```

**注意**：上面的 `client_tools`、`server_tools`、`response_format` **只展示已观测到的字段名和部分数据类型**，其中示意数组长度和布尔值均不是原始请求实值保证。不要据此实现 Qwen 官方 API 或转发未核查的工具定义。

## 字段表与证据粒度

| JSON 路径 | 观测类型 | 已知 / 未知 |
|---|---|---|
| `configuration.response_configuration_group_id` | string | 已证实具体值 `siri.multimodal.noRTI` |
| `configuration.query.*` | string / number | 平台、语言和 OS 三段版本已证实 |
| `configuration.template_variables` | array | 观测请求为空数组 |
| `configuration.template_variable_definition_overrides` | array | 在一次脱敏正文中为空数组 |
| `input` | array | 被动探针观测长度 1；不能视为固定长度 |
| `input[].type` | string | 一次正文确认值 `message` |
| `input[].message.role` | string | 一次正文确认值 `user` |
| `input[].message.content` | array | 一次正文确认长度 1 |
| `input[].message.content[].type` | string | 一次正文确认值 `text` |
| `input[].message.content[].text` | string | 真正的 Siri 用户问题；**不存档原句** |
| `input_hint` | string | 有时出现；语义和真实值未知、丢弃 |
| `client_tools` | array | 类型和内部 `function.name/description/parameters/strict` 已观测，具体功能未知 |
| `server_tools` | array | 类型及元素 `type:string` 已观测，具体工具类型未知 |
| `response_format.json_schema` | object | 子字段名及 JSON 类型已观测，实际具体 schema 值未知 |
| `stream` | boolean | 原始测试值为 `true` |

## 处理与安全约束

1. **严格来源**：只接受目标 HTTPS 域名 + Siri 请求上下文；`WritingTools` 必须保持旁路。
2. **严格内容**：只接收明确文本、用户角色和允许的消息包装，未知附件、音视频、tool call、非用户角色应拒绝（fail-closed）。
3. **不挪用工具定义**：`client_tools`、`server_tools`、`response_format`、`input_hint` 仅可进行类型检查，不属于用户问题、绝不拼接到 DeepSeek 的 `messages`。
4. **不可假定请求—响应必然绑定**：Shadowrocket 60 曾出现 `RESPONSE_TAG_MISSING`，只有真实关联标记或**同一响应 Hook 自带的完整可解析请求正文**能证明问题来源；禁止用“最近一次请求”猜测。
5. **原文不进入 Git 仓库**：不存认证头、Cookie、PacketTunnel 原文、API Key、用户问题、音视频/附件或系统私人上下文。

## 来源索引（在用户的本机原始日志，不上传 GitHub）

- `PacketTunnel-20261119115335.log`：11:53/11:54 的 `NORTI_SHAPE_*` 拦截（只证实不兼容分类）。
- 11:54 本机 `siri_schema_probe_ONCE.js`：顶层额外字段四项、包装 `type:string`、`content:array`。
- 12:07 本机同一辅助脚本：新增 `input_hint:string`。
- 12:26:57 本机 `siri_qwen_body_probe_ONCE.js`：**实际 `message.content[0]` 文本元素与包装值**（只保留已公开的结构信息）。
- `PacketTunnel-20261119134948.log`、`PacketTunnel-20261119144915.log`：61 被动请求/响应钩子本机成功记录结构。
- 13:50 和 14:49 的 61 `REQUEST_SCHEMA_PART_*`：工具定义、响应格式、OS 版本等的**字段名和类型**。

**不能从本材料推断** Qwen 的完整系统提示词、Tool 的内部内容、远端会话隐私字段、函数调用参数的原始值，或 DeepSeek 对 Siri 提问的真实端到端显示成功。参见 [响应协议](OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md)、[调试历史](DEBUG_HISTORY_2026-11-19_ZH.md)。
