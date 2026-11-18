# Changelog / 变更日志

> 此日志区分**已提交的代码**与**经过真机验证的功能**。目前没有正式生产稳定版。

## 0.6.0-clean-beta — 2026-11-18（开发分支，未正式发布）

- 新增 v0.6 单模块 `60-AIES-SIRI-DEEPSEEK-V06.sgmodule` 和独立的 request/response 双阶段脚本 `aies_siri_deepseek_v06.js`。
- 目标变更：允许 Siri 问题到千问作为协议来源，最终 AI 回答仅接受 DeepSeek 内容；脚本处理失败时不主动回退千问。
- 保留独立请求关联 token；SSE 预先验证、固定模型 API、完整回答校验、错误处理和长度上限。
- 清理当前开发分支中已过时的 P1/40 与 50 部署探针和重复测试；Git 历史保留。main 历史阻断安全实验仍独立存在。
- 两个脚本钩子固定到审核过的 Git commit，减少远程分支更新导致的意外代码变化。
- 更新中英文 README、安装和回滚、当前安全边界、发布门槛、维护与归档文档。
- **验证范围：离线自动检查通过；真实 Siri、DeepSeek Key 实际调用、网络切换与系统回退未验收。**

## 0.5.x response-rewrite research — 2026-11-18（历史分支）

- 添加请求/响应改写路线的 P1 实验脚本、40 固定 HTTPS 探针、50 Beta 双钩子和虚构 SSE 自动测试。
- 30/31 同域 REJECT 对照表明该真机配置中阻断路径和早期本地 Mock 无法同时正常返回。
- 研究性 PR #8/#9 保留，不是当前 v0.6 安装入口。

## 0.4.0-lab — 2026-11-18（main 历史研究基线）

- 构建固定 URL 请求解析、DeepSeek adapter、候选 Siri SSE 生成与校验、静态 REJECT 边界和虚构域名探针。
- 建立独立 CI、构建文件一致性与故障注入测试；不代表真实 Siri 安全接管通过。

## 0.2.0-lab — 2026-11-18

- Refactor legacy monolithic experimental script into config, request, DeepSeek, SSE, core and Shadowrocket entry modules.
- Add deterministic offline bundling, regression and legacy security checks.

## 0.1.0-lab — 2026-11-18

- Initial lockdown module and unverified DeepSeek request-phase experiment.

### Documentation maintenance — 2026-11-19

- Add detailed Chinese guides for end-user usage, debugging, error codes, actual v0.6 architecture, upgrades and repository maintenance.
- Link all guides from READMEs, docs index, installation, maintenance and release checklist.
- Keep native Siri acceptance, actual DeepSeek connectivity and fallback guarantee explicitly unverified.
