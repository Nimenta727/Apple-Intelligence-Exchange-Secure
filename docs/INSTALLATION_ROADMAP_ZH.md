# Shadowrocket 安装规划与执行步骤（适用 main v0.4.0-lab）

> **这不是可直接启用 Siri→DeepSeek 的成品安装指南。** 当前计划仅供在保留安全规则的情况下，执行无密钥本地接管实验。最先完成的是 00 阻断、20/21 对照；真实 10 模块与 DeepSeek Key 均不能作为第一轮步骤。

## A. 事前准备（不需要 Key、不需要共享证书）

1. 在 GitHub 打开 https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/tree/main ，确认看到 v0.4.0-lab 与 docs/PROJECT_HANDOFF_ZH.md；使用 main 中的文件，不用老分支。
2. 在 Shadowrocket 保存当前配置的**脱敏本地备份**；关闭原作者 SAIR 模块、旧 AIES 测试模块及可能针对同一测试域名的其他规则。先选择当前有效的「配置」规则模式并启动 VPN。
3. 核对当前客户端版本；之前的实验环境为 Shadowrocket 2.2.93 (3488)、iOS/iPadOS 27.3 beta 2，升级后需要重测。
4. 将实验文件放入可找到的本地目录：scripts/aies_boundary_probe.js → Shadowrocket 的 Script/aies_boundary_probe.js；路径大小写和导入后的实际位置要自行核对。
5. 不要把 API Key、CA 私钥、证书导出文件、系统日志、真实 Siri 提问提交到 GitHub；不要临时粘贴 Key 到聊天。

## B. 第一步：00 安全阻断基线

1. Shadowrocket → 配置 → 模块（版本不同菜单可能不同）：导入 shadowrocket/00-SAIRS-LOCKDOWN.sgmodule 并单独启用。
2. 确认模块中目标域名规则为 DOMAIN,prod-yabuli.qianwen.com,REJECT。
3. 检查实际生效配置，触发已知相关服务并查看连接日志。预期目标连接被拒绝，Siri 扩展可能无法回答；这仅证明当前规则命中。**没有必要为 E0 安装 HTTPS CA，也不需要 DeepSeek Key。**
4. 如果规则没有命中，先核查 VPN / 模块加载 / 匹配路径 / 其他代理或域名；不要继续后面的实验。

## C. 第二步：仅虚构域名的本地 HTTPS 测试

预备：测试虚构域名的 HTTPS 请求可能要求在设备本地生成并信任 Shadowrocket 自己的 CA。若尚未安装 CA，按当前客户端正规流程生成、安装并启用信任；**绝不导入第三方共享 CA**。MITM 主机仅添加 aies-probe.invalid，不开全域解密。证书位置可参照 [原配置指南](CONFIGURATION_ZH.md)。

### C1：20 Loopback 模块

1. 保持对真实目标域名的 00 阻断；关闭 10 和 21，仅启用 20-AIES-LOCAL-BOUNDARY-PROBE.sgmodule（检查模块规则冲突）。
2. 确认 Script/aies_boundary_probe.js 可解析，避免“File not found”；历史测试说明 Script/ 前缀在此用户的配置中曾有效，但仍需当前版本核对。
3. Safari 打开 https://aies-probe.invalid/__aies_probe?case=1 。记录是否展示 AIES_BOUNDARY_PROBE_OK、是否出现 HTTPS 证书错误以及 127.0.0.1 映射状态。
4. 按实验矩阵 E1/E2-N 记录独立网络连接观察。**网页显示成功不是零出站证明。**

### C2：21 Fake-IP / HTTP 引擎对照

1. **先彻底停用 20**；只启用 21-AIES-HTTP-ENGINE-PROBE.sgmodule，且不得修改其中的 aies-probe.invalid 测试域名。
2. 使用同一个测试 URL；记录返回标记、是否读取到 198.18.41.221 映射，以及 force-http-engine-hosts 是否在此版本生效。
3. 记录独立的出站证据；失败/证书问题就记失败，不通过把规则改成真实千问域名来继续。
4. 完成后关闭 20/21，检查 00 阻断仍然有效。

## D. 第三步：结果评审（重要停机点）

- 若 E0 未通过：停止；不得启用 10。
- 若 E1/E2 均无法给出本地 mock：应继续分析 Shadowrocket 规则与引擎，不能移除千问 REJECT。
- 若虚构域名成功但缺少独立出站证据：只可记录“浏览器探针成功/零出站未证明”，不得切换真实 Siri 域名。
- 即使虚构域名探针通过，也需要设计真实域名的无泄漏安全验证方案，并经安全审查后，才能进入 SSE 真机兼容测试。

## E. 以后才做的完整 Siri → DeepSeek 联调（当前不可执行）

当且仅当真实 Siri 接管与 SSE 验证通过，再考虑单独启用 10（其内必须保留 REJECT）、通过设备本地安全方式准备低额度 DeepSeek API Key、对固定 api.deepseek.com 调用进行授权联调。当前 src/config.js 的 providerEnabled:false **必须维持**；任何更改都需要新的风险评估、代码审查、CI 与设备出站测试。

## F. 失败排查与撤销

| 情况 | 操作 |
|---|---|
| Script file not found | 核对本地 Script/ 文件位置、名称及模块 script-path；不以远程不明脚本取代 |
| 只有 REJECT，没有 MOCK_ATTEMPTED | 记录规则/脚本日志与网络事实；属于已知冲突候选，不删除千问阻断 |
| 证书错误 | 核对是否是本机生成、受信任的 CA 以及 MITM 目标主机配置；不改为全域解密 |
| 探针返回失败或外部连接被观察到 | 停止实验，保留 00 阻断，记录脱敏结果 |
| 不再测试 | 关闭 20/21/10；恢复符合需求的 00 基线。若不再需要 MITM，关闭证书信任并移除测试 CA |

## 当前安装验收停止条件

完成 A–D 并获得脱敏证据即可向开发者反馈。**现在不要创建或填写真实 DeepSeek Key，也不要将 10 当作可工作成品启用。**更完整的日志规则及测试用例见 [实验矩阵](EXPERIMENT_MATRIX_ZH.md)。
