# 2026-11-20 00:47 — Shadowrocket 60 新版代码未能下载，CFNetwork 310；本地运行时备用方案

## 用户设备现象与有效证据
用户提供四张 iPad Shadowrocket 的截图（PacketTunnel-20261120004329）。可见：
- 在 00:43:51、00:44:22、00:44:40、00:44:47，Shadowrocket 尝试更新固定脚本 `raw.githubusercontent.com/.../7a698fbaadeb37431d9bd1d43df359292ee78ba0/scripts/aies_siri_deepseek_v06.js`；
- 每次报 `Error Domain=kCFErrorDomainCFNetwork Code=310`（Apple 定义为 HTTPS proxy connection failure），并出现 `script exception => aies_siri_deepseek_v06.js`、`script cleanup`，原请求及响应继续向上游或客户端发送；
- 截图范围内没有 `[AIES_V06] REQUEST_CAPTURED`、`DEEPSEEK_STARTED`、`DEEPSEEK_LABEL_APPLIED`，Siri 最终由用户观察为原生 Qwen。
- 个别 URL 是 `/v1/sessions/{id}/responses`；这次**不属于可信脚本执行后的 `ERROR_FOLLOWUP_*`**，优先解决脚本下载。不能声称 DeepSeek API 被调用或新版 60 多轮已验证。

以上仅以屏幕中可见行推断；没有由截图证明其他所有时段、网络通路或 Shadowrocket 脚本缓存状态。**不在仓库提交任何截图里的设备 IP、session UUID、PacketTunnel 原文、授权信息或 API Key。**

## 代码和文档变更
1. 不更改已通过 106 测试的 60 JavaScript 解析/关联逻辑，不增加全域 Qwen 拦截以掩盖下载失败。
2. 新增 `shadowrocket/62-AIES-SIRI-DEEPSEEK-V06-LOCAL.sgmodule` 作为**与 60 互斥的备用安装模块**，四条主/续答 Hook 与远程 60 在 type/pattern/requires-body/max-size/timeout 上逐字相同；仅把 `script-path` 统一改成 `aies_siri_deepseek_v06.js`，本机 Script 目录的 JS 文件须人工从固定 SHA `7a698fbaadeb37431d9bd1d43df359292ee78ba0` 安装。Shadowrocket 本地 Hook 文件路径的真机兼容仍待用户设备验证。
3. `tools/check-docs.js` 允许且约束第三个本地模块，比较本地 Hook 与 60 远程模块的规则，禁止本地变体继续引用 GitHub/CDN 远程 Runtime。
4. `tests/siri-deepseek-v06.test.js` 新增静态模拟用例，保证四条 Hook 形状、固定版本说明、本机引用与 MITM 保持一致。
5. `docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md` 增加优先修复 Raw HTTPS 代理下载错误的具体界面路径、本地 JS / 62 LOCAL 的互斥安装方法、真机日志判断与安全回滚。

## 当前边界
- 62 是代码和配置级修复路径，**没有验证用户的 Shadowrocket iPad 版本一定支持 `script-path=xxx.js` 的本机模块解析**；必须看到真实 `[AIES_V06] REQUEST_CAPTURED` 后才能进入业务层测试。
- 即使本地脚本可用也无法系统级防止 Siri iOS 绕过 MITM、非当前 Qwen 网关的流量或用户主动关闭 Shadowrocket。
- Qwen 源请求可能仍先到 Qwen，DeepSeek 的 API Key 也必须在同一个本地 Shadowrocket 存储环境中存在，严禁放入模块文件。

## 下一步规划
1. 开 PR 并跑 CI（语法、106+ 现有测试、模块和文档链接）；失败应修复而非降低限制。
2. 优先让用户在 Shadowrocket 当前配置「脚本 URL」页确认 Raw 的手动下载是否成功；如果成功，沿用四 Hook 60，关闭 61/62。
3. 如果 GitHub Raw 的代理连通性长期失败，用户从受信任渠道在 iPad Shadowrocket 本地 Script 目录保存固定版本源码，并仅启用 62 LOCAL；真实日志确认无 GitHub Raw runtime 下载且有 `[AIES_V06] REQUEST_CAPTURED`。
4. 只有请求与响应双方脚本真实执行后再验收 Siri 第一问/第二问/第三问。每轮正文必须带 `【DeepSeek · AIES】`；无前缀即视为未证实 DeepSeek。
5. 若本地路径无效，依据脚本 URL 页面、版本、错误分类决定适配 Shadowrocket 本机 file URL 或明确受支持的本地配置；**不直接推断本地模式已部署成功**。

## PR #34 合并及 CI 补记

- [PR #34](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/34) 已合并到 `main`，merge commit `909f2169ed404b1bd9e74156af8959e85f798fe9`。
- [GitHub Actions](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/actions/runs/44571160641) 结果 **107 tests / 107 pass / 0 failed**。已在仓库验证 60 Remote 与 62 Local 的四条 Hook 规则参数相同，区别只有 runtime 的下载 URL / 本地文件名。
- 下一步保持：优先修复 GitHub Raw 的 HTTPS 代理下载链路；若不可修复，用户亲自保存固定提交 JS 至 Shadowrocket Script 文件夹、且仅启动 62 LOCAL。真正的验收依据是脚本 HTTP Hook 日志出现 `[AIES_V06] REQUEST_CAPTURED` 及 Siri UI 实际 DeepSeek 来源前缀，而非仅成功运行本地 Script Test。
- **仍未验证用户 iPad 的本地 module `script-path` 解析行为**；不声称此 PR 已在用户设备解决全部 Qwen 穿透。
