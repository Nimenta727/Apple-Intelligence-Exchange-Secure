# AIES v0.6 用户使用与操作手册

> 适用版本：`siri-deepseek-v0.6-clean` 开发分支的 60 模块。**这是集中真机验收手册，不是已验证可用的用户成品说明。** 先阅读 [安全说明](SECURITY_CURRENT_ZH.md) 和 [安装/回滚指南](INSTALL_SIRI_DEEPSEEK_V06_ZH.md)。

## 1. 你实际在使用什么

AIES v0.6 尝试在原生 Siri 文本问答接口上截取服务响应，调用用户自己的 DeepSeek API，重建 Siri 可识别的候选 SSE 回答。原始问题可能同时交给千问、DeepSeek；不承诺零千问出站，也不能阻止 **VPN 没运行、MITM 没命中或脚本没执行** 时 Siri 的原生行为。

仅支持已识别的 Siri 文本请求，**不支持**写作工具、视觉智能、图像/语音文件输入、泛用 Safari 网页重写或任何保证永久稳定的系统级集成。

## 2. 设备和准备材料

- iOS/iPadOS 与 Shadowrocket 版本应先记录；历史研究环境是 iOS/iPadOS 27.3 beta 2、Shadowrocket 2.2.93 (3488)，不代表其他版本已支持。
- 可正常运行的 Shadowrocket VPN、仅对目标 `prod-yabuli.qianwen.com` 配置的本机 MITM CA 信任链。
- 你自己合法获取的 DeepSeek API Key；仅在设备本机提供给 `SAIRS_DEEPSEEK_API_KEY`，绝不可发送给聊天、仓库、模块 URL 或截图。
- 测试问题必须是可公开的非隐私文本；预先保存 Shadowrocket 当前配置方便回滚。
- 60 模块中的两条规则必须都指向同一个固定 Git commit 的 `aies_siri_deepseek_v06.js`。不要直接更换不明来源脚本。

## 3. 第一次启用（一次集中执行）

1. **备份现行配置**，确保记得原来开启的模块以及 00 阻断状态；如需保留旧 00 安全模式，先不要继续启用 60。
2. 用户同意千问可能收到原问题后，**只在 v0.6 测试模式**关闭 `00-SAIRS-LOCKDOWN`，否则 REJECT 会和响应替换冲突；关闭 10/20/21/30/31/40/50 及其他针对相同目标的实验脚本。
3. 确认当前 Shadowrocket 版本确实提供本地脚本手动执行能力后，在**设备本地临时副本**中运行 `scripts/provision_key_ONCE.js`，存储键名 `SAIRS_DEEPSEEK_API_KEY`。执行后删除含 Key 的临时副本。若无法确认支持手动执行，**暂停，不通过 URL 传 Key**。
4. 通过 [60 模块源文件](../shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule) 导入并启用；确认两个钩子和 MITM Host 精确匹配。请依据你的 Shadowrocket 当前界面确认加载情况，不假定所有版本菜单布局相同。
5. 保持 VPN 已连接，使用一个非私密的普通 Siri 文本问题做第一次验收。**必须以 Siri 原生界面可见的答案为准**，脚本日志 `DEEPSEEK_RESPONSE_ATTEMPTED` 只能证明发起响应改写尝试。
6. 若 Siri 显示千问答案、超时、报错或模型不一致，记录“失败”而非重复改配置碰运气；按下面方式停止，并参阅[调试手册](DEBUGGING_ZH.md)。

**当前版本有一个关键前置不确定性**：`deepseek-flash` 是脚本里固定的模型 ID；必须先确认你的官方 DeepSeek API 账户支持这一 ID。实际未验证之前，不应把“已能调用 DeepSeek”当作事实。模型 ID 应只通过受审查的代码变更来调整，不在浏览器 URL 传入。

## 4. 如何判断是否成功

成功必须**同时**满足：
- Siri 原生界面显示答案（不是 Safari、日志面板、通知或独立 App）。
- Shadowrocket 的目标 Request/Response 处理步骤实际触发，DeepSeek 返回有效回答。
- 展示文本确实对应本次 DeepSeek 返回内容，无千问片段、没有上一次回答串话。
- 对 DeepSeek 失败 / 脚本没执行等异常路径有诚实记录；**不能从单次正常回答推出系统级绝对保证**。

未知、超时或看见千问内容都记为尚未通过；禁止仅凭 `[AIES_V06] DEEPSEEK_RESPONSE_ATTEMPTED` 宣称成功。

## 5. 结束测试、暂停和回滚

1. 在 Shadowrocket **关闭 60 模块**，不要同时保留其两条钩子或 MITM 目标。
2. 如希望恢复此前的阻断基线，重新开启你备份的 `00-SAIRS-LOCKDOWN`，确认对应 REJECT 规则；不意味着其它域名完全隔离。
3. 清除设备本地 Key 时，可在支持的本地脚本执行环境运行 `scripts/clear_key_ONCE.js`；该脚本向 store 写入空字符串，不等同于已证明物理删除。
4. 若不再需要 MITM，依照设备正常配置撤销相关主机的 MITM 和不必要的证书信任；不要分享或导出 CA 私钥。
5. 不要把真实对话或完整日志发给维护者。反馈时仅报告版本、固定阶段错误码、Siri 是否显示 DeepSeek/千问、是否已回滚。

## 6. 日常使用约束

当前仅用于受控实验，不建议对含身份证、财务、健康、账户或其他私密信息的问题启用。模型调用可能有时间开销和账户费用；脚本目前不提供额度控制 UI。任何版本升级需检查两个脚本钩子的 commit pin、阅读 CHANGELOG 后手动替换，不能假定旧配置自动安全迁移。

参考：[调试与问题定位](DEBUGGING_ZH.md) · [架构](ARCHITECTURE_CURRENT_ZH.md) · [维护](MAINTENANCE_ZH.md)。
