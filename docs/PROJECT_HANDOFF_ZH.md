# AIES 当前项目交接（2026-11-18）

**先读此页，再阅读 [文档中心](README.md)。** 项目目前没有真实 Siri 验收完成的正式版。当前候选为 `siri-deepseek-v0.6-clean` 中的 v0.6 Clean Beta；`main` 保留旧 v0.4 REJECT 安全研究基线。

## 产品定义

- 在原生 Siri 界面处理文本问题，尝试由 **DeepSeek** 提供最终 AI 回答。
- 用户明确接受原问题也可能送到**千问**；取消“千问零出站”的旧产品要求。
- 即使 DeepSeek 失败，脚本也不应把千问 AI 文本作为模型答案回退。
- **不能保证脚本没有执行、MITM 被绕过、VPN 断开时的系统级 Siri 行为**；尚不能承诺“最终一定是 DeepSeek”。

## 已有交付与分支

| 分支 / PR | 内容 | 当前地位 |
|---|---|---|
| `main` | v0.4.0-lab 原安全研究、生成脚本和 CI | 保留独立历史基线 |
| `siri-deepseek-v0.6-clean` / PR #10 | 当前 60 模块、唯一 v0.6 JS、离线回归与文档 | Draft，等待真机 |
| `siri-deepseek-response-rewrite` / PR #9 | 40/50 早期响应改写候选 | 被 v0.6 取代 |
| `mvp-transport-failure-probe` / PR #8 | 30/31 同域故障实验 | 历史证据 |
| `e4-sse-hardening` / PR #7 | 旧合成 SSE 边界补丁 | 研究内容，非新发布前提 |

本次设备曾确认 30 的固定响应成功、31 的 REJECT 命中而本地 Mock 失败；这**不能证明** v0.6 的真实 Response Rewrite 已可用。用户不再需要按旧 30/31/40 实验循环验证。

## v0.6 技术事实

- 部署文件：`shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule`。
- 运行脚本：`scripts/aies_siri_deepseek_v06.js`（模块中的两个脚本 hook 引用同一固定 commit）。
- 离线测试：`tests/siri-deepseek-v06.test.js`；GitHub Actions #102 已成功运行，不能代表真机 Siri 验收。
- 请求阶段提取支持的 Siri 文本并生成 per-request token；响应阶段先检查 SSE，再调用官方 DeepSeek Endpoint，并尝试以 DeepSeek 文本重建回答字段。
- 主要未确认风险：Shadowrocket 是否真正取得 Siri SSE、是否可跨两个 hook 正确关联、Siri UI 接受性、Key 本地配置、脚本失效时 Qwen 回退。
- 数据风险：问题正文暂存于设备 Shadowrocket 持久存储，逻辑过期不等于自动擦除；密钥/CA 不得进入仓库或聊天。

## 维护规则

- 需要修改 v0.6 **直接编辑部署脚本和对应测试**，不要误改旧 `src/` 当作 v0.6。
- 旧 `src/` 改动则使用 `npm run build` 更新旧生成包；所有变更至少执行 `npm run check`。
- 更新两个 hook 的不可变 commit pin 以及文档、CHANGELOG、安装/回滚说明。
- **未通过 P4 来源安全验证前不把 PR #10 标记 Stable/合并为正式发布。** 不因用户改变隐私取舍就省略来源审查。

## 工作入口

[当前状态](CURRENT_STATUS_ZH.md) · [v0.6 安装](INSTALL_SIRI_DEEPSEEK_V06_ZH.md) · [安全](SECURITY_CURRENT_ZH.md) · [项目计划](SIRI_DEEPSEEK_RESPONSE_REWRITE_PLAN_ZH.md) · [维护](MAINTENANCE_ZH.md) · [发布核对表](RELEASE_CHECKLIST_ZH.md) · [决策台账](ISSUES_AND_DECISIONS_ZH.md)。
