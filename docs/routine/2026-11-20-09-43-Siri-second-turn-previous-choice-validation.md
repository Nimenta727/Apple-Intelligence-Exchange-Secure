# 2026-11-20 09:43 — Siri 后续追问在 previous_choice_id 校验处被拒绝

## 新的真机证据（仅非敏感状态）

用户开启 62 LOCAL 且四条 Hook 真正工作后，上传 `PacketTunnel-20261120094303.log`。本地核查 26 条 `[AIES_V06]` 记录：
- 09:43:28 首轮请求捕获后，09:43:31 响应缺少关联 tag，`ERROR_PROMPT_UNAVAILABLE`；这是独立的部分主请求相关性问题。
- 09:43:43–09:43:48 另一条主请求经历 `REQUEST_CAPTURED`、`RESPONSE_TAG_PRESENT`、`SSE_PREFLIGHT_PASSED`、`DEEPSEEK_STARTED`、`SIRI_CONTEXT_STORED`、`DEEPSEEK_LABEL_APPLIED`、`DEEPSEEK_RESPONSE_ATTEMPTED`，说明本地 JS 与 DeepSeek 通路已执行，**仍不等于 Siri UI 确认验收**。
- 09:44:03 同一客户端会话级追问遭到 `NORTI_SHAPE_PREVIOUS_CHOICE_INVALID`、`REQUEST_DIAG_INPUT_UNSUPPORTED`、`ERROR_UNSUPPORTED_SIRI_REQUEST`；不执行 DeepSeek 请求。
- 09:44:24–09:44:30 第二次主请求成功改写；09:44:39 第二个会话级追问重现完全同样的预检失败。
- 早前 61 schema 探针仅证明 `previous_choice_id` 的**类型为 string**，绝无原始值。不能断言失败是字符串空值还是非规范字符、超长等原因，更不能把真实的 session ID 或 choice ID 发到仓库。

## 原因与改动

旧 60 仅允许非空且完全符合 `/^[A-Za-z0-9_-]{1,160}$/` 的 `previous_choice_id`，直接在请求体结构校验拒绝其他字符串。为避免在不知晓实际值时引入不安全的全局 fallback，本次采用**仅空字符串**的窄化同会话备用机制。

1. `scripts/aies_siri_deepseek_v06.js`：后续请求 `previous_choice_id === ""` 时允许进入前置解析，并仅在 URL 中 exact session ID 与本地已成功改写的 DeepSeek choice/session 一致、5 分钟逻辑 TTL 有效时，从 `AIES_CTX_SESSION_<session>` 索引恢复已验证的上一轮 choice。此索引**仅包含 session/choice/过期值**；原问题和 DeepSeek-only 历史仍在原 choice-specific 本地上下文中。没有保存 Qwen 回答、没有向 DeepSeek 发送原始 Qwen 会话元数据、没有跨会话查找全局最新提问。
2. 非空但不规范、超长、非 string 或缺失的 `previous_choice_id` 仍拒绝；对解析结果只打印固定分类码（`FOLLOWUP_PREVIOUS_CHOICE_EMPTY`、`..._NONCANONICAL`、`..._OVERSIZE`、`..._NOT_STRING`），不输出 ID 内容；空值且成功绑定同一已验证 session 时打印 `FOLLOWUP_SESSION_CONTEXT_RECOVERED`。
3. 请求和响应仍要求原始 `previous_choice_id` **完全一致**，即使通过空值后会话索引解析到有效本地 choice，也不能在响应 Hook 阶段偷换续答指针。保留请求/响应临时 tag、SSE 预检、拒绝工具媒体、不会复制 Qwen 原文。
4. `tests/siri-deepseek-v06.test.js` 新增同会话空指针的第二问与第三问正例、跨会话/无历史失败、响应体指针篡改拒绝、非空不规范/非字符串/缺失/超长拒绝，以及不在日志中披露原值的验证。
5. 60 Remote 四条 Hook 的 Runtime pin 与 62 LOCAL 的注释更新为新源码提交 `c9e8ac6332c7726594006fd243839742dba5d88a`，62 保留 `script-path=Script/aies_siri_deepseek_v06.js,enable=true`；更新安装说明，明确本地脚本必须人工替换。

## 安全边界与不确定性

- 真实用户 `previous_choice_id` **是否为空未知**；因此本次不是已经确认的根因修复，只有空字符串场景才能自动恢复。若真实值是非规范但非空，仍保持 fail-closed 并从固定分类码定位，而非允许任意不可信指针。
- 实际输出由 Siri UI 决定；即使 `DEEPSEEK_RESPONSE_ATTEMPTED` 也不证明客户端显示。
- 本机 `$persistentStore` 保留 DeepSeek-only 用户提问及回答的短期历史，5分钟为逻辑失效，**不是安全物理擦除**。
- 无法保证系统级 Qwen 零穿透；Shadowrocket 被绕行、脚本失效或配置未正确应用时用户仍可能看到原生回应。

## 下一步规划

1. PR + GitHub Actions 全量回归测试；失败需要修复而非取消强校验。
2. 用户备份 iCloud 本地 JS，然后将更新后的固定 SHA 内容保存到 `Shadowrocket/Script/aies_siri_deepseek_v06.js`，确保 62 LOCAL 路径及启用标志无变动、60/61 关闭。
3. 只在同一个 Siri 会话中问两句非私人纯文本，核对 `[AIES_V06]` 日志：若 `FOLLOWUP_PREVIOUS_CHOICE_EMPTY` 和 `FOLLOWUP_SESSION_CONTEXT_RECOVERED`，再确认 `SSE_PREFLIGHT_PASSED`、`DEEPSEEK_RESPONSE_ATTEMPTED` 和 UI 标记。
4. 若报告 `FOLLOWUP_PREVIOUS_CHOICE_NONCANONICAL` 或 `OVERSIZE`，根据类型/长度等级设计更严格的隐私安全协议探针，**绝不收集或上传原 ID**，且不放松跨会话和来源标记。
5. 修复多轮后还需单独研究日志中偶发的主请求 `RESPONSE_TAG_MISSING`、并发和超时等回归问题。

## PR #37 合并与 CI 补记

- [PR #37](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/37) 已成功合并至 main，merge commit `f59df4e5e86a27b17170e678fe5eb5c1e1ff9dbf`。
- [GitHub Actions](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/actions/runs/44656987654)：**111 项测试全部通过，0 失败**。最初一次 CI 功能测试也是 111/111，通过后发现的是静态检查 `tools/check-docs.js` 未同步更新 62 注释所需的 Runtime pin；现已修正并通过最终 CI。
- 当前 **60 Remote** 四 Hook 已 pin `c9e8ac6332c7726594006fd243839742dba5d88a`。**62 LOCAL** 的四 Hook 继续指向 `Script/aies_siri_deepseek_v06.js,enable=true`；用户要**手动替换 iCloud 云盘 `Shadowrocket/Script` 里的 JS 内容**才能使用本次运行时修复，单独刷新模块不足以更新本地文件。
- 下一步真机判断应先看是否出现 `FOLLOWUP_PREVIOUS_CHOICE_EMPTY` 或 `FOLLOWUP_PREVIOUS_CHOICE_NONCANONICAL`，这只披露形式类别，不泄漏实际值；只有空指针才可通过同 session 已验证 DeepSeek 历史尝试续答。不把 CI 测试成功当作用户 Siri UI 已通过多轮验收。
