# AIES v0.6 Clean Beta：唯一安装与回滚指南

> 状态：**可安装的完整候选版；尚未通过真实 Siri 原生界面验收**。用户要求直接整合，随后集中安装测试；40/50 无需单独验证。

## 新版本部署文件

- 模块：shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule
- 唯一运行脚本：scripts/aies_siri_deepseek_v06.js
- 回归测试：tests/siri-deepseek-v06.test.js
- 历史 40/50/P1 重复部署入口已从当前分支清理；旧研究仍可通过 Git 历史与 PR #9 查找。main 现在包含 v0.6 候选与保留的旧实验架构；旧 00 仍是互斥的阻断模式。

## 目标与请求链路

用户接受原始问题可能发送到千问，但 **Siri 原生界面最终展示的 AI 回答必须是 DeepSeek 的内容**。本脚本在请求阶段检查固定 Siri 文本 POST，提取问题，创建随机短期会话标识并关联响应；在响应阶段先验证 SSE 是否属于可识别格式，再从本地读取 DeepSeek Key，调用固定 Chat Completions API（deepseek-flash）。仅使用 DeepSeek 产生的文本重建回答事件。模型失败、未知 SSE、无法关联时，脚本尝试改写为非模型 502 错误，不主动回退千问正文。

**重要限制**：只有 Shadowrocket 成功介入并执行脚本的响应才受这种行为约束。VPN 未启用、MITM 被绕过、脚本未触发、Siri 缓存或系统级回退时仍有可能看到千问答案。因此当前仍不能承诺系统级“始终只有 DeepSeek”。

## 一次性集中安装

1. 备份 Shadowrocket 当前配置、保留旧 00 阻断模块用于回滚。新模式开始前，需要关闭 00，因为 REJECT 会挡住真实请求；这意味着原始问题可能发送千问，符合用户新接受的约束。
2. 关闭旧 10/20/21/30/31/40/50 试验模块，避免多个脚本处理同一个请求。
3. 使用设备本地 Shadowrocket 手动执行环境，将 DeepSeek Key 保存到 $persistentStore 中的 SAIRS_DEEPSEEK_API_KEY；可参照仓库的 scripts/provision_key_ONCE.js 本地临时副本。绝不把真实 Key 发送到聊天、GitHub、URL 或日志；执行后删除含 Key 的临时文件。需要时可执行 scripts/clear_key_ONCE.js。
4. 在 Shadowrocket 导入并启用 60 模块。确保 VPN 已连接、目标 HTTPS MITM CA 为本机受信任证书；只添加目标域名，不扩大解密范围。
5. 用不包含隐私的文本问题测试 Siri。**以 Siri 原生 UI 的实际回答为准**，日志中的“尝试发送”不代表客户端已接受。
6. 如果 Siri 显示千问答复、脚本超时、无响应或其他异常，记录失败并关闭 60，恢复 00；不需要重新进行旧 30/31/40 的测试。

## 本次优化与安全门槛

- 新版只有一个模块、一个 Shadowrocket 运行脚本和一份最新测试，部署入口减少。历史基础源码仍为 CI 与研究保留，并非 v0.6 的运行依赖。
- 模型调用前先检查 SSE 状态与协议形态，防止给无法改写的响应白白调用 DeepSeek。
- 模型必须完成、回答非空且未超限制，不接受部分截断结果；错误状态不会调用脚本级的千问答案回退。
- 独立请求 token 降低并发串话风险，且在响应消费后尽量清理。
- 只接受已知事件，重建所有答案字段，未知事件不复制千问正文。
- 请求正文仍短期存入 Shadowrocket 本地持久存储，具备隐私残留风险；不保证该存储加密或系统崩溃时立即删除。
- 真实 Siri 的 SSE 事件变化、响应分块/压缩、脚本缺席时回退和请求关联仍待集中真机验证。**自动化 CI 通过不是最终可用证明**。

## 唯一安装入口

https://raw.githubusercontent.com/Nimenta727/Apple-Intelligence-Exchange-Secure/main/shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule

## 后续

集中安装成功后，依据 P4 来源失败测试完成审计；P5 结构简化本次已完成“部署层级减负”，但主仓库历史源码保留，正式发布前仍需根据真机行为完成安全重构审查与文档迁移。


脚本版本固定 SHA：b143280fe95e85fec197366afd735f1d46359e39；两条 hook 均指向此 commit 的原始脚本。

## 补充操作文档

首次使用和集中验收：[用户使用手册](USER_GUIDE_ZH.md)。发生错误请先参阅 [调试及错误码矩阵](DEBUGGING_ZH.md)，不要盲目反复启用旧探针；需要理解运行机制请看 [当前结构说明](ARCHITECTURE_CURRENT_ZH.md)。后续版本更新与安全维护参阅 [维护操作流程](OPERATIONS_ZH.md)。
