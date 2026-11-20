# 2026-11-20 10:01 — Siri 仅第一段可用：nullable/missing continuation 处理

## 真机日志结论（仅保留固定诊断码）

用户上传 `PacketTunnel-20261120100109.log`，全日志 1174 行。这次本地 62 已成功运行，多个主请求都完成了 `REQUEST_CAPTURED`、`RESPONSE_TAG_PRESENT`、`SSE_PREFLIGHT_PASSED`、`DEEPSEEK_STARTED`、`SIRI_CONTEXT_STORED`、`DEEPSEEK_LABEL_APPLIED`、`DEEPSEEK_RESPONSE_ATTEMPTED`；后续会话请求实际触发 5 次 `FOLLOWUP_PREVIOUS_CHOICE_NOT_STRING`、`NORTI_SHAPE_PREVIOUS_CHOICE_NOT_STRING`、`REQUEST_DIAG_INPUT_UNSUPPORTED`、`ERROR_UNSUPPORTED_SIRI_REQUEST`，均在 DeepSeek 之前失败。时间包含 10:01:50、10:01:59、10:02:33、10:02:42、10:03:11。另有最初一轮响应 `RESPONSE_TAG_MISSING / ERROR_PROMPT_UNAVAILABLE`，是独立关联问题。

**严格区分证据与推断**：`NOT_STRING` 仅证实 JavaScript 读取的值非字符串，无法从日志判断是 JSON `null`、字段完全缺失、数字/布尔、数组或对象。此前 PR #37 只兼容空字符串 `""`，未命中这次真机请求。没有从设备读取、记录、上传任何原始 choice/session ID、问题原文、DeepSeek Key 或 HTTP body。扫描日志仅针对 `[AIES_V06]` 固定阶段码。

## 代码修改

1. `scripts/aies_siri_deepseek_v06.js`：对会话级纯文本请求，精确接受 `previous_choice_id` 为**空字符串、JSON null 或字段缺失**三种可恢复的“无 continuation 指针”状态；只有确认 URL session ID 与本地 **已验证 DeepSeek-only 历史**一致、短期 5 分钟 TTL 未过期时，才查找同 session 上一轮 choice。**绝不**因任意非字符串、伪造非空指针或跨会话请求使用全局最近结果。
2. 对每种形态只输出静态分类日志 `FOLLOWUP_PREVIOUS_CHOICE_NULL`、`..._MISSING`、`..._EMPTY`，其他类型输出 `..._NONSTRING_UNSUPPORTED`；不输出实际字段值。请求/响应阶段绑定 `previousKind` 及原值，防止 HTTP body 从 null 偷换为空或缺失。
3. `tests/siri-deepseek-v06.test.js`：增加 null/缺失两类第二轮、第三轮正例，以及跨会话、历史过期、后续请求体变更、数字/对象/数组等负例；保留原有 canonical ID、空字符串路径和 WritingTools 隔离。
4. `shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule`：四条远程 Hook pin 更新为新 Runtime SHA `c3a7014cdd8ec47841001748c615e704059d9370`；`shadowrocket/62-AIES-SIRI-DEEPSEEK-V06-LOCAL.sgmodule` 四条本地路径 **仍然**保持 `Script/aies_siri_deepseek_v06.js,enable=true`，仅固定源码注释更新。同步更新静态检查源码 pin、单元测试 pin 和安装说明。

## 安全、兼容边界与未完成项

- `NOT_STRING` 的真实类型仍未知；本次代码**只放行 null 或缺失**。如果实际是 number/boolean/object/array，仍将 fail closed 并输出固定分类。不能把成功测试写成真实 iPad 端已验证。
- 续答只使用短期设备本地已验证的 DeepSeek 用户/助手文本；后续会发往 DeepSeek API。TTL 是逻辑失效，并非物理安全擦除。
- 真机主请求偶发 `RESPONSE_TAG_MISSING` 还需单独修复；客户端是否接受合成 SSE 还需依 UI 来源标记确认。
- Shadowrocket 脚本失效或系统绕过时仍可能出现原生 Qwen，不能保证系统级零透传。

## 下一步规划

1. 提交 PR；通过完整 CI（原有安全/回归 + 新增多轮 test）后合并。
2. 用户**只替换 iCloud 云盘/Shadowrocket/Script/aies_siri_deepseek_v06.js 的内容**为固定 SHA 新版；62 LOCAL 继续启用，60/61 关闭，勿重新配置 Key 或重装证书。
3. 在同一 Siri 会话里只进行一组普通无隐私的两轮提问；第二轮观察 `FOLLOWUP_PREVIOUS_CHOICE_NULL` 或 `..._MISSING` / `FOLLOWUP_SESSION_CONTEXT_RECOVERED`、`REQUEST_CAPTURED`、`DEEPSEEK_STARTED` 与 UI `【DeepSeek · AIES】`；不成功只汇报固定日志。
4. 如第二轮仍 `NONSTRING_UNSUPPORTED`，保留失败关闭，再用无正文类型探针区分具体 JSON 类型；不要采集真实 ID。若进入模型后 `SSE_REWRITE_UNSUPPORTED`，按 SSE 特定校验单独修。
5. 多轮真机完成后，再处理响应 tag 缺失、并发与超时安全性，不能把局部功能测试当作生产稳定版。
