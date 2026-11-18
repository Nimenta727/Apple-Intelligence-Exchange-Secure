# 当前项目状态与未完成工作（2026-11-18）

## 版本与判定

- 仓库：Nimenta727/Apple-Intelligence-Exchange-Secure。
- 集中交付：main（累计实验代码经 PR #6 合并）。
- 版本：v0.4.0-lab（package.json / src/config.js）。
- 安全状态：**实验、不可宣称可用、不可关闭 REJECT**。providerEnabled:false。

| 项目 | 代码状态 | 实测状态 |
|---|---|---|
| 请求 URL / POST / JSON / 文本输入白名单 | 已实现 | 通过离线自动测试，不等于真实设备兼容 |
| DeepSeek API 适配与错误处理 | 已编码 | 模拟响应已测试，真实 Key 联调未完成 |
| Siri SSE 生成器 | 已编码 | 内部一致性测试通过，Siri 接受性未知 |
| 写作工具响应生成器 | 已编码 | 内部测试通过，系统写作工具接受性未知 |
| 网络域名 REJECT | 配置存在 | 用户曾观察到 REJECT 触发；全网络状态验证不足 |
| Shadowrocket 同域安全接管 | 有 10 实验模块 | **未成功证明可用且零原始上游** |
| 20 Loopback / 21 Fake-IP 探针 | 已编码且 CI 通过 | 真实设备尚未按新模块完成 |
| Siri → DeepSeek → Siri 成功回答 | 非发布状态（安全闸关闭） | **未完成** |
| 图像 / 视觉智能 | 未实现，保守拒绝 | 不支持 |
| API Key 安全初始化 | 一次性脚本存在 | 需验证 Shadowrocket 当前版本手动脚本/存储操作；现阶段不需要 Key |
| 断开 VPN、蜂窝切换、HTTP/3、DNS 绕行 | 未形成可证明的全局保护 | 待实测，不得承诺设备级零泄露 |

## 当前最关键的阻塞条件

B1（必须先解决）：Shadowrocket 2.2.93 上，同域 REJECT 的安全阻断与 request 阶段合成响应存在冲突。需要先在隔离域名验证 HTTP 引擎、脚本入口与网络出站，并找到能安全覆盖真实请求的架构；不能通过取消 REJECT 来“修复”。

B2：无法确认 Siri 接受独立构造的 SSE 事件和 JSON。即使 B1 成功，仍需完成不泄露用户数据的协议验收。

B3：只有 B1/B2 经审计通过后，才能设计受控的真实 DeepSeek 调用测试，并且必须重新测试故障、超时、切换网络状态。

## 当前可直接执行的安全工作

1. 在 main 下载/核对 00 基线模块、20/21 虚构域名实验模块、scripts/aies_boundary_probe.js。
2. 不安装 10 作为“已可用 Siri”方案，不配置真实 DeepSeek Key。
3. 执行 [安装规划](INSTALLATION_ROADMAP_ZH.md) 的阶段 A–C 和 [实验矩阵](EXPERIMENT_MATRIX_ZH.md)，记录脱敏结果。
4. 回传结果后按证据修复代码；只把真实通过的阶段记为完成。

## 严格验收口径

代码检查通过 != 浏览器探针成功 != 真实域名无上游流量 != Siri 接受 SSE != 产品可用。发布前需要各门槛**分别**拿到可以复现的证据，并审查脚本失效时是否存在透传。

参考：[交接总览](PROJECT_HANDOFF_ZH.md) · [历史问题](ISSUES_AND_DECISIONS_ZH.md) · [历史验收清单](../history/TEST_PLAN.md)。
