# AIES 项目交接总览（2026-11-18）

> 此文档是后续开发者、AI Agent 与真机测试者的统一入口。请优先读本页，再读问题台账、实验计划和安装步骤。仓库 main 当前为 v0.4.0-lab；**不是已经可以投入使用的 Siri → DeepSeek 产品**。

## 1. 唯一的核心目标与不能妥协的边界

目标：国行 Apple Intelligence / Siri 的指定文本请求，在设备本地由 Shadowrocket 安全接管，不把**原始 Siri 请求正文**发送给千问；通过用户自行授权的 DeepSeek API 获取回答，将本地构建的 SSE 返回给 Siri 原生界面。写作工具属于已编码的协议候选场景；视觉智能不在现阶段支持范围内。

硬约束：不得通过放行 prod-yabuli.qianwen.com 换取真实 SSE 骨架；不得删除目标 REJECT 作为临时成功捷径；不得提供未经独立出站观测证实的“零透传”保证；不在 GitHub 保存真实 API Key、CA 私钥、用户提问、Authorization 或完整抓包。

原作者 [boitar/sair](https://github.com/boitar/sair) 采用 request 阶段记录上下文 + **允许原请求到千问**获取有效 SSE + response 阶段修改回答的架构。它的“可用”不等于符合本项目的“不送千问”安全目标。可以借鉴协议结构，**不能照搬上游的数据路径**。

## 2. 当前版本和代码事实

- 默认分支：main；包版本：0.4.0-lab。分散实验分支内容已通过合并 PR #6 整理到 main。合并不是生产发布。
- 核心目录：src/request.js（严格请求校验）、src/deepseek.js（固定 DeepSeek HTTPS 适配）、src/sse.js（独立候选 SSE 生成和完整性校验）、src/core.js（执行与失败关闭）、src/entry.js（Shadowrocket 宿主桥接）、src/config.js（开关及上限）。
- scripts/sairs_router.js 由 tools/build.js 确定性生成；修改 src/ 后运行 npm run build、npm run check，不能只改生成文件。
- shadowrocket/00-SAIRS-LOCKDOWN.sgmodule：目标千问域名 REJECT 基线，无 Key/CA。
- shadowrocket/10-SAIRS-DEEPSEEK-LAB.sgmodule：真实 Siri 域名实验脚本，带 REJECT；尚未安全接通。
- shadowrocket/20-AIES-LOCAL-BOUNDARY-PROBE.sgmodule：仅保留域名 aies-probe.invalid → 127.0.0.1 的实验。
- shadowrocket/21-AIES-HTTP-ENGINE-PROBE.sgmodule：仅保留域名 aies-probe.invalid → 198.18.41.221 的 HTTP Engine / Fake-IP 实验。20 与 21 不得同时开启。
- scripts/aies_boundary_probe.js：只输出固定字符串，不调用模型。tools/evaluate-boundary.js：判定脱敏测试证据，PROBE_PASS 仅对虚构域名有效。
- src/config.js 中 providerEnabled: false：即使配置了真实 Key，主脚本也拒绝调用 DeepSeek，响应码 503 / AIES_NETWORK_ISOLATION_UNVERIFIED；这是故意设计的发布闸。

## 3. 已经成立的证据与不能外推的部分

已完成：模块化代码、生成产物、Siri/写作候选 SSE、自检、模拟 DeepSeek 数据链路、回归测试、静态 REJECT 审计。历史 GitHub Actions #17（阶段 2）、#19（阶段 3）、#23（阶段 4）、#24（阶段 5）通过。**离线 CI 不验证真实 Siri、流量隔离、证书或 Shadowrocket 内部执行顺序。**

已观测（用户历史真机报告）：Shadowrocket 2.2.93 (3488) 上，使用非真实 Siri 的 HTTPS 测试域名，A–B–A 测试表现为无 REJECT 时 request mock 可工作，同域 REJECT 后请求被拒绝，移除后 mock 恢复。这不证明内部精确优先级，也不能推论所有 iOS 版本或全部网络流量。

当前障碍：**没有经验证的网络层接管策略可以在阻断千问原始出站的同时，让 Siri 获得本地模拟响应**；Siri 对本地独立 SSE 的接受性也未得到真机证实。因此完整 Siri → DeepSeek → Siri 功能未完成。

## 4. 下一步及明确完成条件

按 [真机实验计划](EXPERIMENT_MATRIX_ZH.md) 运行 E0 安全基线、E1/E2 仅虚构域名 A/B、E3 真实域名风险评估（**不得先移除 REJECT**）、E4 独立 SSE 兼容、E5 最后才做真实 DeepSeek 联调。执行入口参见 [安装与测试规划](INSTALLATION_ROADMAP_ZH.md)。

任何发现仅限于设备、Shadowrocket 版本、VPN 配置与测试日期；每项记录“未运行 / 通过 / 失败 / 证据不足”。独立网络出站证据不足时不得宣称零透传。全部门槛满足后再进行安全审查，才可考虑提供非 lab 的可安装版本。

## 5. GitHub 工作规则

main 为最新集成事实来源。开发可用短期分支+PR 做隔离和 CI，但阶段通过后应合并到 main；不要让项目长期散落在多个分支。提交文档、代码与测试时保留真实状态；CI 红色时先修复，不得把 draft/实验写成正式可用。

相关文档：[问题与决定记录](ISSUES_AND_DECISIONS_ZH.md) · [当前状态](CURRENT_STATUS_ZH.md) · [实验矩阵](EXPERIMENT_MATRIX_ZH.md) · [安装规划](INSTALLATION_ROADMAP_ZH.md) · [现有安全边界](NETWORK_BOUNDARY_ZH.md) · [候选协议](PROTOCOL_LAB_ZH.md)。
