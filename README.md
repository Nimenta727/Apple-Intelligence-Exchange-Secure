# Apple Intelligence Exchange Secure (AIES)

**Siri 原生界面 × DeepSeek 回答替换**。适用于 Shadowrocket 的独立研究项目，参考 [boitar/sair](https://github.com/boitar/sair) 的公开协议研究（MIT）。

> **当前状态：v0.6 Clean Beta，代码及离线 CI 已完成，尚未通过真实 Siri UI 验收。不是稳定版。** 新目标允许 Siri 的原始问题经过千问；项目尝试让最终展示的 AI 回答来自 DeepSeek。**如果 VPN/脚本/MITM 未工作，Siri 仍可能显示千问回答，无法承诺任何时候只显示 DeepSeek。**

[English](README_EN.md) · [文档总览](docs/README.md) · [安装说明](docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md) · [当前状态](docs/CURRENT_STATUS_ZH.md) · [安全说明](docs/SECURITY_CURRENT_ZH.md) · [更新日志](CHANGELOG.md)

## 产品范围

只支持指定的 **Siri 文本问答**。不是 Apple、Shadowrocket 或 DeepSeek 官方插件；不支持视觉智能、写作工具、多模型切换、独立聊天 UI 或系统级流量保证。

### 运行方式

1. Shadowrocket 在请求阶段尝试获取 Siri 文本，并关联此次请求。
2. 原始请求按新模式可以到达千问；千问的响应被视为 SSE 结构参考。
3. Shadowrocket 在响应阶段调用用户自备的 DeepSeek API，从模型返回中提取文本。
4. 脚本按识别到的 SSE 事件结构重新生成回答字段，尝试让 Siri 原生界面显示 DeepSeek 答案。
5. 在脚本实际介入的失败路径中，尝试返回明确错误，不静默恢复千问的 AI 文本。

上述是**候选实现路径**，不是已完成的真机效果证明；若 Shadowrocket 未拦截或 Siri 原生回退，脚本不能禁止千问原生响应。

## 当前版本与仓库分支

| 分支 / 版本 | 用途 | 状态 |
|---|---|---|
| [`siri-deepseek-v0.6-clean`](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/tree/siri-deepseek-v0.6-clean) | 当前新路线候选部署 | Draft PR #10，待真机 |
| `main` / v0.4.0-lab | 旧“阻断千问出站”研究与 CI 基线 | 历史实验，不是 v0.6 安装入口 |
| `siri-deepseek-response-rewrite` / 50 | 早期响应改写 Beta | 已被 v0.6 取代 |
| 30/31/40 | 旧网络故障和模拟响应探针 | 非当前安装步骤 |

**不要混用 00 与 60**：00 对目标千问域名 REJECT，60 要求接收原始千问 SSE。仅在了解新目标的网络与隐私风险并备份后，按安装指南切换。版本测试结束可恢复 00。

## v0.6 的唯一部署入口

- [Shadowrocket 60 模块](shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule)
- [v0.6 运行脚本](scripts/aies_siri_deepseek_v06.js)（request/response 两个钩子使用**同一固定 Git commit**）
- [集中安装与回滚指南](docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md)
- [相关模拟测试](tests/siri-deepseek-v06.test.js)

安装模块：  
`https://raw.githubusercontent.com/Nimenta727/Apple-Intelligence-Exchange-Secure/siri-deepseek-v0.6-clean/shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule`

**请先完整阅读安装/安全文档**。API Key 只能在设备本机配置，不能放到模块 URL、GitHub、聊天或日志中。真机测试需要 Shadowrocket CA 的目标域名 MITM，存在证书信任风险。不要在测试前提交敏感请求。

## 已实现和仍待验证

| 项目 | 状态 |
|---|---|
| 请求校验、两阶段脚本、独立会话关联 | 已编码，并有模拟测试 |
| 固定 DeepSeek API、SSE 候选重建、无脚本级千问回退 | 已编码，并有模拟测试 |
| 自动化检查、生成包/历史规则审计 | CI 通过 |
| Siri 原生界面实际显示 DeepSeek 回答 | **未验证** |
| DeepSeek 真正联网 Key 调用与模型可用性 | **未验证** |
| SSE 流式/压缩/大小/多会话兼容 | **未验证** |
| 任何故障下都不显示千问 | **未证明，可能受系统绕过限制** |
| 真机通过后的代码审查、持久化隐私优化和正式发布 | 待完成 |

## 开发与维护

仓库保留两条不同架构的代码：
- **新 v0.6**：`scripts/aies_siri_deepseek_v06.js` 是真正被 60 模块调用的单文件逻辑；开发时修改此文件和 `tests/siri-deepseek-v06.test.js`。
- **旧 v0.4 lab**：`src/` → `tools/build.js` → `scripts/sairs_router.js` 是历史阻断实验的确定性构建；不能误认为它生成 v0.6。

开发端执行 `npm run check`。旧 `src/` 改动还必须运行 `npm run build` 并提交生成文件。查看[维护指南](docs/MAINTENANCE_ZH.md)、[发布门槛](docs/RELEASE_CHECKLIST_ZH.md)、[需求计划](docs/SIRI_DEEPSEEK_RESPONSE_REWRITE_PLAN_ZH.md)与[贡献指南](CONTRIBUTING.md)。

## 安全、隐私与法律声明

问题可能同时被千问和 DeepSeek 处理；当前脚本会短期将用户问题写入 Shadowrocket 的本地持久存储，存储加密与中断后的擦除尚未证明。脚本并不提供系统级零千问回答或网络出口保证。不要把生产和个人隐私请求用于未验证版本。任何 CA 私钥、真实 Key、Authorization、原始请求/完整抓包均不得提交。保留上游 MIT 归属；详见 [LICENSE](LICENSE) 与 [安全文档](docs/SECURITY_CURRENT_ZH.md)。

## 使用、调试与维护指南

- [使用与首次启用](docs/USER_GUIDE_ZH.md)
- [集中调试、错误码与反馈模板](docs/DEBUGGING_ZH.md)
- [当前 v0.6 架构与目录职责](docs/ARCHITECTURE_CURRENT_ZH.md)
- [开发、升级和维护流程](docs/OPERATIONS_ZH.md)

这些指南描述的是可安装候选版，**不是已证明 Siri 原生功能成功或系统级不回退千问的承诺**。
