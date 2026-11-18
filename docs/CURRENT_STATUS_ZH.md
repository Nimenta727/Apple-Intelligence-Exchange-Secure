# AIES 当前项目状态（2026-11-18）

> **这是当前状态的权威入口。** 活跃候选为 [v0.6 Clean Beta](INSTALL_SIRI_DEEPSEEK_V06_ZH.md)，目前已合入 `main`；原 [PR #10](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/10) 和开发分支可供追溯。`main` 同时保留旧 v0.4.0-lab 阻断研究文件。**v0.6 离线自动检查通过，但尚未完成 Siri 原生界面和 DeepSeek 真实 API 验收。**

## 目标与验收

只保留 Siri 原生界面中的文本问答。原始请求允许发送千问；**最终 AI 答案必须是 DeepSeek 生成的内容，而非千问**。代码在确实介入的响应路径不会主动回退千问，但脚本缺席、VPN/MITM 失效时 Siri 仍可能使用千问，故系统级“任何时候必为 DeepSeek”尚无法保证。

## 当前进度

| 范围 | 事实 | 判定 |
|---|---|---|
| 需求和实施计划 | 新目标、P0–P6 和发布门槛已文档化 | 已完成规划 |
| 部署收敛 | 60 模块 + 1 个固定提交的 JS，40/50 已从 v0.6 分支删除 | 代码已提交 |
| 文本解析、请求关联、DeepSeek API、SSE 重建 | 代码存在并有离线模拟与错误路径测试 | 已编码，真机未验证 |
| GitHub CI | 最新已观察的 v0.6 代码提交 Actions #102 success | 离线通过 |
| Siri 原生 UI 真机显示 | 没有真实结果 | **未运行** |
| 使用用户自己的 DeepSeek Key 的实际联调 | 没有真实结果 | **未运行** |
| Shadowrocket 失效 / Siri 回退 | 无系统级阻断证明 | **未解决** |
| 隐私生命周期 / 安全审计 | 暂存用户问题于本机 store，逻辑 TTL 不能保证物理清除 | 待加强 |
| 正式发布 | 已合并 main，但未发布稳定 Tag | **未发布** |

## 仓库代码分层

- **当前 v0.6**：`shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule` → `scripts/aies_siri_deepseek_v06.js`；它们就是安装部署入口。
- **v0.4 历史文件（main 内保留）**：`src/`、`tools/build.js`、`scripts/sairs_router.js`、00/10/20/21，继续在 CI 中维护，但不能当作新版本部署脚本。
- 旧 30/31、40、50 原型位于历史分支和 PR，当前安装不需要。

## 接下来按顺序

1. 完成一次集中 Siri 真机验收，确认两阶段脚本被调用且 Siri UI 真正使用 DeepSeek 回答。
2. 完成模型失败、脚本缺席、断网/缓存及千问回退的来源安全验证。不能保证时明确支持条件，不宣称“必定”。
3. 整理状态管理、减少本地用户问题明文持久化，进一步重构和审查；锁定发布版本。
4. 通过 [发布核对表](RELEASE_CHECKLIST_ZH.md) 后，再决定合并与发布。

[文档中心](README.md) · [安装](INSTALL_SIRI_DEEPSEEK_V06_ZH.md) · [安全](SECURITY_CURRENT_ZH.md) · [维护](MAINTENANCE_ZH.md) · [历史实验](EXPERIMENT_MATRIX_ZH.md)。

## 后续操作资料（v0.6）

- [首次使用及集中验收](USER_GUIDE_ZH.md)
- [真机调试、错误码和脱敏反馈](DEBUGGING_ZH.md)
- [当前脚本结构和双阶段数据流](ARCHITECTURE_CURRENT_ZH.md)
- [升级、维护、版本 pin 和发布流程](OPERATIONS_ZH.md)
