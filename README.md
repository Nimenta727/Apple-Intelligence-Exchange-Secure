# Apple Intelligence Exchange Secure (AIES)

**研究项目：在 Siri 原生界面中尝试显示来自 DeepSeek 的 AI 回答。**

> **最新目标（2026-11-18）**：用户允许原始 Siri 文本请求经过千问，但要求最终展示的 AI 回答来自 DeepSeek，而不是千问。**v0.6 Clean Beta 已在独立开发分支完成候选代码及离线检查，真实 Siri 原生显示与系统回退仍未验证，不能宣称已可用或保证 DeepSeek-only。**

**当前代码位置请务必区分：**

| 分支 | 内容 | 状态 |
|---|---|---|
| [v0.6 Clean Beta](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/tree/siri-deepseek-v0.6-clean) | 最新候选模块 60、DeepSeek SSE 响应替换、完整文档 | [Draft PR #10](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/10)，待真机 |
| `main` / v0.4.0-lab | 旧网络阻断研究代码、00/10/20/21 模块、旧 CI 基线 | 历史安全实验；不是当前新路线安装入口 |

## 最新版请从这里开始

- **[v0.6 使用说明与回滚](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md)**
- [v0.6 文档中心](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/README.md)
- [当前项目状态](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/CURRENT_STATUS_ZH.md)
- [当前安全与隐私边界](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/SECURITY_CURRENT_ZH.md)
- [维护与贡献](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/MAINTENANCE_ZH.md)
- [发布验收清单](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/RELEASE_CHECKLIST_ZH.md)

## v0.6 的实际设计

1. Shadowrocket 请求钩子尝试识别 Siri 文本问题，并关联到对应响应。
2. 原始请求可以到千问；响应钩子读取其候选 SSE。
3. 使用用户授权的 DeepSeek API 获取新答案，脚本重建已识别的回答字段。
4. 在脚本确实介入的错误路径，尝试返回错误，不主动回退千问 AI 文本。

**重要限制**：VPN 未启动、MITM/脚本没有触发、Siri 使用缓存或其他网络通路时，仍可能看到千问答案。脚本级 fail-closed 不等于设备级来源保证。DeepSeek Key 与 Shadowrocket CA 私钥不得提交到仓库、URL 或聊天。

## 本分支为什么仍保留旧内容？

main 的 `src/`、`scripts/sairs_router.js`、`shadowrocket/00/10/20/21` 及其自动化测试，属于前一轮“千问原始请求不出站”研究。它与 v0.6 新需求是**两种不同的部署模式**。不要直接关闭旧 00 然后导入旧 10；不要混用 00 和新版 60。历史实验从 [docs/](docs/README.md) 进入。

此分支保留 `npm run build` 和 `npm run check` 以维护旧实验基线；v0.6 的独立运行脚本不会由旧 `tools/build.js` 自动生成。

[English](README_EN.md) · [变更日志](CHANGELOG.md) · [贡献指南](CONTRIBUTING.md) · [MIT License](LICENSE) · [历史文档](docs/history/README.md)。
