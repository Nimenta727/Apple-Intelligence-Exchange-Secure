# AIES v0.6 发布与真机验收清单（2026-11-19 更新）

> **目前不是稳定版，不得宣称“已替换所有 Siri/Qwen 回答”。** 新版 60 的字段对齐 SSE 已通过离线 mock，简单问题至少一次显示来源标记，但复杂问题及稳定性尚未验收；Shadowrocket 响应阶段间歇性丢失关联标记仍是 P0。

| 发布条件 | 当前实证状态 | 下一步必须取得的证据 |
|---|---|---|
| 真实 Siri 组名与纯文本请求结构 | **已确认**：`siri.multimodal.noRTI`，`input[].message.content[]` | 其他组名/客户端不扩展为默认支持 |
| 真实 Qwen SSE 主要协议结构 | **已确认**：两次 61 采样，13 SSE 事件，两次 delta | 多问答、不同响应变体和工具路径仍需核查 |
| 当前 60 的 SSE 前置校验 | **某一次真机通过**：14:49 `MATCHES_60_PREFLIGHT` | 不能推断其他会话必然通过 |
| 新 60 合成 SSE 字段对齐 | **离线通过**：按真实结构构造全部答案承载事件 | 在真实设备确认原生 Siri 接受与显示 |
| 关联 Header/请求正文恢复 | **仍有故障**：12:40 `RESPONSE_TAG_MISSING` | 真机稳定连接、待发路径、请求复用、连续和并发测试 |
| DeepSeek API 真实服务 | 曾有一条 `DEEPSEEK_RESPONSE_ATTEMPTED` | 复测当前模型/Key、网络、超时、错误路径 |
| Siri UI 实际显示 DeepSeek 来源 | **未验收** | 非隐私问题真实看见 `【DeepSeek · AIES】` 的正文 |
| Qwen 原文不会误装为 DeepSeek 回答 | 离线构造器与 fail-closed 测试 | SSE 多分支与代理关闭/绕行的设备级验收 |
| WritingTools 与非文本附件隔离 | 离线回归 | 真机旁路、工具/媒体实验（不采私密数据） |
| 60/61 互斥、Key/日志隐私 | 已设计并测试 | 设备手工检查其他同域旧模块、Token 不进入日志 |
| 稳定版 Release | **未发布** | 全部关键项证实后再发布 |

## 当前 CI 可以证明什么

`npm run check` 用 Node mock 验证两钩子逻辑、结构事件输出、多 delta、Token 及日志隔离、工具/审核拒绝、故障关闭、并发独立存储、61 的只读行为、文档链接与双钩子固定 Git SHA。**不能证明 Shadowrocket 的真实 HTTP 请求关联、Siri UI 展示、服务端 API 长期有效或系统级回退保护**。

## 需要回滚时

先禁用 60，再禁用 61；确保旧的 `00 REJECT`、其它同域 Rewrite 一同关闭，确认 Siri 回到原生 Qwen 通路。诊断后的 HTTPS MITM 仅在必要时保留。不要上传原始 PacketTunnel、proxy.db、CA 私钥或个人问答。

完整真机用例和无隐私记录模板：[2026-11-19 验收与回滚矩阵](VALIDATION_AND_ROLLBACK_2026-11-19_ZH.md)。

## 可复现的证据索引

- [当天全量排障摘要与 PR 记录](DEBUG_HISTORY_2026-11-19_ZH.md)
- [真实请求 JSON](OBSERVED_SIRI_QWEN_REQUEST_PROTOCOL_ZH.md)
- [真实响应 SSE](OBSERVED_QWEN_SSE_RESPONSE_PROTOCOL_ZH.md)
- [根因与未完成问题](ROOT_CAUSE_DECISIONS_2026-11-19_ZH.md)

## 2026-11-19 15:51 新证据更新

已取得至少一次真正显示 `【DeepSeek · AIES】` 的 Siri 截图，故“完全没有 Siri UI 证据”已过时；但并没有完成**复杂问题、连续会话、会话级 Guard、跨 Hook 关联**的稳定性验收。日志主接口 2 次成功改写、2 次关联缺失、1 次 SSE 不兼容；额外会话级接口有 2 次未覆盖记录。60 新增第三条仅拦截 Siri SSE 的轻量 Guard，可能减少 Qwen 原文展示但增加失败提示。用户本轮要求不进行额外测试，因此最新改动均不得写成设备已验证。


## 16:15 A/B 真实故障分类基线

最新 4 次主请求中 2 次已提交 DeepSeek SSE、1 次关联丢失、1 次 Qwen SSE 预检失败；另有 4 次会话级 SSE 被 60 Guard 主动阻断。仅凭现有日志不能宣称模型有新的输出格式，也不能宣称 Guard 不影响复杂回答。增加 [A/B 同题实验](AB_SIRI_QWEN_DEEPSEEK_COMPARISON_ZH.md)来收集原生 Qwen 和 DeepSeek 的有限客户端可见答案、HTTP/SSE 结构及 `finish_reason` 等。必须看到真正的 Siri UI 结果才能修改“已验收”的状态。

## WritingTools Compose Beta 新增验收门槛

新增 `WritingTools` 适配的离线通过**不能**证明系统 Apple 写作工具端到端已经可用。发布前要求：(1) 本机实测 `response_configuration_group_id` 与 `input` 类型符合 SAIR 假设；(2) 原生 WritingTools Qwen SSE 符合受支持的 60 预检；(3) DeepSeek API 真实正常完成；(4) Apple 写作工具编辑界面实际显示 `body/refinements` 内容；(5) Siri 原有文字问答和复杂注释 SSE 正反回归无破坏；(6) WritingTools UA 与 Siri UA 不可跨请求串答。更多见 [跨站证据分级](COMMUNITY_APPLE_INTELLIGENCE_REQUESTS_2026-11-19_ZH.md)。
