# AIES v0.6 安装与回滚指南

> 版本：**v0.6.0-beta**。仅供受控真机验证，尚未证明 Siri 原生回答和 DeepSeek API 的完整兼容性。**原始问题可能发送千问与 DeepSeek**；不保证脚本未运行时的答案来源。

## 当前唯一模块

- [Shadowrocket 60 模块](../shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule)
- [实际运行的脚本](../scripts/aies_siri_deepseek_v06.js)
- 模块 Raw URL：

```text
https://raw.githubusercontent.com/Nimenta727/Apple-Intelligence-Exchange-Secure/main/shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule
```

模块的 HTTP Request 和 Response 两条规则均使用同一个经过固定 Git SHA 引用的脚本。**不要把 GitHub 页面链接当作模块导入 URL**。

**2026-11-19 诊断版升级：** 旧版在真实 Siri 请求捕获阶段返回 `ERROR_UNSUPPORTED_SIRI_REQUEST`。新模块已 pin 到修订脚本。已安装旧 60 的用户请**更新/重新导入模块并让 Shadowrocket 下载新的脚本**；无需重设本地 API Key 或 MITM CA。之后只记录 `REQUEST_DIAG_*` 和 `ERROR_*` 固定码；诊断版未证明 Siri 已修复。

## 安装前的安全准备

1. 备份当前 Shadowrocket 配置。设备上如存在**之前导入的同域 REJECT、旧接管脚本或其他冲突模块**，测试新模式时必须先停用。这些文件虽然已从仓库移除，但不会从设备上自动消失。
2. Shadowrocket VPN 连接正常。本机生成并按当前 iOS 正规流程信任 Shadowrocket CA，MITM 只对 `prod-yabuli.qianwen.com` 生效。信任根 CA 有安全风险，测试结束后视需要撤销。
3. 使用自己的 DeepSeek API Key。仅在设备本地支持执行脚本的情况下，复制 [provision_key_ONCE.js](../scripts/provision_key_ONCE.js) 到设备临时位置，将占位符替换为真实 Key，并在本地运行；Key 写入 `$persistentStore` 的 `SAIRS_DEEPSEEK_API_KEY`。执行后删除临时脚本。**绝不在 GitHub、聊天、URL、截图或日志中提交 Key**。
4. **已知潜在阻塞**：当前运行脚本固定 `model: "deepseek-flash"`，其在 DeepSeek 官方 API 的可用性尚未被真机确认。此问题可能导致模型响应失败，需通过后续受审查的代码更新修复，不能简单归咎于安装错误。
5. 若 Shadowrocket 不提供经确认的本地脚本执行入口，**暂停配置 Key**，不要把它放入远程模块或其他不安全渠道。

## 第一次集中安装

1. 导入上方 Raw URL 的 60 模块并启用。
2. 确认存在一个 `http-request` 和一个 `http-response` 规则，两者匹配相同 HTTPS 目标路径；不要叠加其它同域脚本。
3. 确认 Shadowrocket VPN、CA 信任、目标域名 MITM 都已生效。
4. 用不包含私人信息的一条 Siri 文本问题测试。**必须看 Siri 原生界面是否真正显示 DeepSeek 对应回答**，不能只看脚本记录“尝试替换”。
5. 对照 [调试手册](DEBUGGING_ZH.md) 查看 `[AIES_V06]` 固定日志标记；如果响应失败、展示千问内容或超时，记录失败并停止测试。

## 如何安全回滚

1. 在设备上停用 60 模块和它的双阶段钩子。
2. 恢复安装前备份的 Shadowrocket 配置；如原配置包含阻断规则，恢复后应按自己的网络要求复核其生效情况。
3. 如不再使用 Key，可在本地执行 [clear_key_ONCE.js](../scripts/clear_key_ONCE.js)，它将对应 store 键清空。**清空操作不构成物理安全删除证明**。
4. 测试结束后关闭不需要的 MITM 主机规则，按需移除 CA 信任，保留脱敏错误码和设备/软件版本即可。

## 结果判定

- “模块导入成功”不是“DeepSeek API 成功”。
- “脚本调用了 `$done`”不是“Siri 接受响应”。
- “单次 DeepSeek 显示成功”不是“脚本没运行时不会展示千问”。
- 只有 [发布验收清单](RELEASE_CHECKLIST_ZH.md) 所列条件才决定是否可以标为稳定版本。

其他材料：[使用手册](USER_GUIDE_ZH.md) · [当前架构](ARCHITECTURE_CURRENT_ZH.md) · [安全说明](SECURITY_CURRENT_ZH.md)。
