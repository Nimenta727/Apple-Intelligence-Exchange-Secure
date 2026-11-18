# iPhone / Shadowrocket 配置指南（简体中文）

> **重要更新（2026-11-18）**：本文保留 CA / Key 技术背景及历史排障内容，但其中部分实验安装顺序已过时。请以 [当前安装规划](../INSTALLATION_ROADMAP_ZH.md)、[实验矩阵](../EXPERIMENT_MATRIX_ZH.md) 和 [项目现状](../CURRENT_STATUS_ZH.md) 为准。当前**不要填写真实 DeepSeek API Key，不要尝试将 10 模块当作可用 Siri 方案**；先使用 00 阻断和 20/21 虚构域名探针。


> 历史参考文档；当前仓库为 v0.4.0-lab。**仅供测试；不是已验证的 Siri 可用版。** 本指南不要求越狱，不要求云服务器。最重要的是不要把 CA 私钥或真实 DeepSeek API Key 发给任何人，也不要提交到 GitHub。

## 0. 准备工作

- 可使用国行 Apple 智能的 iPhone（项目上游研究的是 iOS 27.3 beta 协议；实际兼容版本需要真机确认）。
- 从 App Store 正规渠道安装 Shadowrocket。
- 设备可访问 DeepSeek 官方 API；若使用代理节点，网络请求会经由你配置的节点转发。
- **先不需要 API Key，也不需要安装 CA**，先做网络阻断测试。
- 卸载或禁用原版 SAIR，避免多个模块的相同域名规则冲突。保留经过脱敏的原配置备份。

## 1. 安全基线：先阻断千问

1. 打开仓库 [00-SAIRS-LOCKDOWN.sgmodule](../../shadowrocket/00-SAIRS-LOCKDOWN.sgmodule)，保存为本地文件，或通过受信任方式导入 Shadowrocket。
2. 在 Shadowrocket → **配置** → **模块** 中添加并启用 \`00-SAIRS-LOCKDOWN\`。不同版本菜单可能有差异，按客户端现有界面操作。
3. 确认这份模块内存在 \`DOMAIN,prod-yabuli.qianwen.com,REJECT\`，并在当前有效配置下启动 Shadowrocket VPN。
4. 打开连接日志；测试触发与千问有关的 Apple 智能请求。**预期：请求被拒绝，功能可能失败。这是安全基线，不是产品故障。**
5. 如发现千问依然正常工作，**暂停全部下一步**：核实当前使用的配置是否包含模块、规则是否优先命中、是否走其他域名/协议、VPN 是否工作。

⚠️ Shadowrocket VPN 断开或系统流量绕过 VPN 时，模块规则就不能保证生效。独立阻断模块只能对其实际接管的流量提供保护。

## 2. CA 证书是什么？需要填写 CA 私钥吗？

**不需要向 AIES 填任何 CA 私钥。** 两类凭据不能混淆：

| 凭据 | 作用 | 放在哪里 | 是否要输入到脚本 |
|---|---|---|---|
| Shadowrocket CA 证书 | 让 iOS 信任 Shadowrocket 为目标 HTTPS 会话生成的证书 | iOS 受信任证书配置 | 不要 |
| CA 私钥 / .p12 / .pem | Shadowrocket 在设备本地进行 TLS 代理所用的敏感私钥材料 | 仅在设备本地由 Shadowrocket 管理 | **绝对不要** |
| CA 导出密码（若客户端要求） | 保护导出的证书文件 | 由你自己设置，不复用 API Key | 不要 |
| DeepSeek API Key | 调用 DeepSeek 服务的 Bearer Token | 仅存于本地脚本存储（后述） | 在本地初始化步骤临时输入 |

**证书不是拿 DeepSeek API Key 申请的。** 不要使用网上的共享 CA 文件或他人导出的 .p12。

### 2.1 何时才需要 CA？

- **00 阻断模块**：只用域名 REJECT，**不需要 CA**。
- **10 DeepSeek 实验模块**：要读取 HTTPS 请求体，才需要 HTTPS 解密 CA。只有经过隔离测试决定继续实验时才安装。

### 2.2 在 iPhone 上生成并安装 CA

以下是 Shadowrocket 常见的菜单路径，版本不同可能略有差异：

1. Shadowrocket → **配置** → 当前启用配置右侧的 **ⓘ** → **HTTPS 解密** → **证书** → **生成新的 CA 证书**。
2. 选择 **安装证书**。按 iOS 提示下载描述文件。
3. iPhone **设置 → 通用 → VPN 与设备管理 → 已下载的描述文件**，选择 Shadowrocket 证书，按提示安装。
4. iPhone **设置 → 通用 → 关于本机 → 证书信任设置**，找到刚安装的 Shadowrocket CA，**启用完全信任**。
5. 回到 Shadowrocket，开启当前配置的 **HTTPS 解密 / MITM**。
6. 检查实际生效的 MITM 主机名：仅包含我们需要的 \`prod-yabuli.qianwen.com\`；要同时审查其它配置或模块是否扩大了主机范围。
7. 若证书信任按钮不存在，回到「VPN 与设备管理」核实描述文件确实安装完成。每次切换 Shadowrocket 配置时也要确认对应的 HTTPS 解密配置仍生效。

⚠️ 即便 MITM 规则仅列出一个域名，iOS 对根 CA 的系统级信任仍可能被利用在其他域名上。不要启用“解密所有 HTTPS”，不要对银行、工作邮箱、密码管理器等无关域名启用 MITM。

## 3. 获取 DeepSeek API Key

1. 通过 [DeepSeek 开放平台](https://platform.deepseek.com/) 登录你的开发者账户，创建**单独供 AIES 使用**的 API Key。
2. 在平台侧核查账单、余额和费用限制；为实验设置低额度，避免意外高费用。
3. 复制 Key，**仅留在自己设备**。不要粘贴到聊天窗口、仓库、Issue、截图、URL、快捷指令参数或共享文档中。
4. 首选在网络阻断和本地脚本兼容性已通过测试以后再创建或写入真实 Key。

### 3.1 DeepSeek Key 填在哪里？

仓库中 \`scripts/provision_key_ONCE.js\` 有一个占位符：

\`\`\`javascript
var key = 'REPLACE_WITH_YOUR_DEEPSEEK_API_KEY';
\`\`\`

**在 iPhone 本机的本地脚本副本中**临时把引号里的占位符替换成 DeepSeek 官方 API Key；**不要修改 GitHub 仓库原文件**。必须确认 Shadowrocket 版本支持本地手动运行独立脚本且 $persistentStore 在该运行环境可用，才能执行此一次性脚本。

脚本会写入本地键名 \`SAIRS_DEEPSEEK_API_KEY\`；我们的主脚本只读取该键。初始化成功后立即删除包含明文 Key 的本地临时脚本，清理相关同步、缓存及备份副本。**脚本持久化存储并不等同于 iOS Keychain；是否加密需以 Shadowrocket 的具体实现为准。**

⚠️ 如果你的 Shadowrocket **没有可确认的手动执行脚本功能**，目前这版不具备已验证的安全 Key 初始化流程：**停在这里**，不要将真实 Key 填进 URL、模块远程参数、GitHub 公开文件或别人提供的控制台。

### 3.2 DeepSeek 的技术参数（已写死在安全实验脚本）

- API：\`POST https://api.deepseek.com/chat/completions\`
- 模型：\`deepseek-flash\`
- 鉴权：\`Authorization: Bearer <你自己的 DeepSeek API Key>\`
- 当前先用 \`stream: false\` 获取完整结果，再尝试组装 Apple SSE。
- **API Key 与 CA 私钥完全无关**，不互相替代。

## 4. 实验模块接入（并非已验收的“安装成功”）

1. 确认第一阶段 00 阻断生效，记录 Shadowrocket 日志。
2. 将 \`scripts/sairs_router.js\` 放入 Shadowrocket 能识别的**本地脚本位置**。当前实验模块中为 \`script-path=Script/sairs_router.js\`，**文件名必须能被你的客户端解析**。没有确认本地路径之前，不要把它替换成随时可能变化的第三方远程脚本 URL。
3. **不要同时启用 00 和 10 两个模块**。单独启用 \`10-SAIRS-DEEPSEEK-LAB.sgmodule\` 并核实其内的 REJECT 后备规则仍在。
4. 仅针对需要的主机名启用 MITM，并按第 2 节生成/信任自己的 CA。
5. **当前版本禁止本步骤**：因 `providerEnabled:false` 且真实域名隔离未通过，暂时不要录入真实 Key。只有安全评审允许以后才能进行。
6. **当前不进行真实 Siri/DeepSeek 联调**。先完成 [E0–E2](../EXPERIMENT_MATRIX_ZH.md) 的无密钥测试；真实链路的出站监测、SSE 接受和故障演练都属于后续安全评审后的环节。
7. **若只能看到 REJECT，或 Siri 无法显示回答：视为实验未通过。不要为了让功能可用而直接删除 REJECT 后备保护。** 不同 Shadowrocket 版本可能存在请求脚本与 REJECT 规则执行顺序差异。

## 5. 如何确认没有泄露？如何卸载？

- 检查 Shadowrocket 连接日志：与目标 Apple 智能请求对应的 \`prod-yabuli.qianwen.com\` 流量必须被明确阻断/短路；需要同时排查其他潜在域名。日志只保留必要的时间、域名、动作，不记录用户对话和授权头。
- 失败/超时/断网时：不应该把请求放行到千问；如果不能确定，立即停止 10 模块并恢复 00 阻断模块。
- 不继续测试时：关掉 10 实验模块；如果要恢复普通 iOS 行为，必须清楚相应流量不再被本项目阻断。
- 不再需要 MITM 时，在 **设置 → 通用 → 关于本机 → 证书信任设置** 中关闭该 CA 的信任，并在 **VPN 与设备管理** 删除其描述文件。
- 撤销 API Key：去 DeepSeek 官方控制台撤销旧 Key；若可本地手动执行脚本，运行 \`scripts/clear_key_ONCE.js\` 清空对应键值，并删除本地临时密钥文件。
- 设备丢失/越狱/疑似泄密：第一时间撤销 API Key，停止相关代理配置，检查其它持久化副本。

## 6. 常见问题

**Q：需要把 CA 私钥放进 .sgmodule 吗？** 不需要，绝对不要。只在 Shadowrocket 生成并由其本地管理。

**Q：有没有证书密码？** 正常“生成并信任根 CA”流程不要求你把私钥密码交给 SAIR；若因导出私钥被要求设置密码，请自行设置且**不要导出到 GitHub**。

**Q：API Key 是我的 ChatGPT Plus 密码吗？** 不是。这里使用 **DeepSeek 独立 API Key**。

**Q：Shadowrocket 开着但 VPN 断开会怎么样？** 规则可能不生效；不能保证任何千问流量会被阻断。

**Q：能否直接装到日常主力机？** 不建议。建议非敏感环境完成真机验证后再评估。

**Q：为什么 10 模块装好却不能用？** 可能是 REJECT 先执行、脚本路径无效、MITM 未生效、当前 Shadowrocket 不支持 request-phase mock response，或 Apple 智能不接受候选 SSE。参见 [测试计划](TEST_PLAN.md)。

## 7. 参考

- [上游 boitar/sair](https://github.com/boitar/sair)
- [DeepSeek 官方 Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/)
- [Apple：关于在 iOS 信任手动安装的证书](https://support.apple.com/en-us/102390)
- [Shadowrocket 社区使用说明（非官方）](https://github.com/shunichio/ShadowrocketUserManual)


## 8. 维护新版源码与生成安装脚本

v0.2.0-lab 起（当前 v0.4.0-lab），开发源码在 src/；Shadowrocket 实际执行的 scripts/sairs_router.js 由 tools/build.js 自动生成。维护时在电脑执行 npm run build 与 npm run check，并将源码与生成产物一并提交到 GitHub。无需在 iPhone 安装 Node.js。

参考 [架构与开发指南](../ARCHITECTURE_ZH.md)。请不要因为 CI 通过就假定 iPhone 网络隔离、HTTPS 解密或 Siri SSE 已经通过实际验收。
