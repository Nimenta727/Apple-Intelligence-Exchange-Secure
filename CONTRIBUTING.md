# Contributing / 贡献指南

当前活跃候选版本是 **v0.6 Clean Beta**；本仓库还保留 v0.4.0-lab 历史阻断研究。请先读 [文档中心](docs/README.md)、[维护手册](docs/MAINTENANCE_ZH.md)和[安全边界](docs/SECURITY_CURRENT_ZH.md)。

## 提交原则

1. 先确认目标分支。新 Siri→DeepSeek 响应替换功能请针对 v0.6 路线开发；历史 00/10/20/21/旧 src 仅在明确修复旧研究时修改。
2. **不要混淆构建路径**。v0.6 运行代码是 `scripts/aies_siri_deepseek_v06.js`；旧 `src/` 是 `scripts/sairs_router.js` 的构建来源。两者不是同一版本。
3. 每项功能提交包含自动测试与失败反例。使用 `npm run check`；修改历史 `src/` 时先 `npm run build`，生成文件一并提交。
4. 任何脚本修改都需更新模块两个钩子的不可变 commit pin 并重新检查，防止引用了旧脚本。
5. 更新 README（中英）、CHANGELOG、状态、安装、安全、验收和必要的历史备注；相对链接应通过自动检查。
6. 明确证据等级：仅代码、离线模拟、Safari/Shadowrocket、真实 Siri UI、真实 DeepSeek API、系统级回退。只给获得证据的环节打通过标记。
7. 不提交/复制真实 DeepSeek Key、CA 私钥、Authorization/Cookie、个人 Siri 问题、原始响应或完整抓包。日志仅用固定阶段标记；不开放任意 Endpoint、Web Dashboard 或密钥 URL 参数。
8. 新路线的原问题可能送千问是用户明确接受的取舍；**脚本级无千问回退不是系统级来源保证**。如果跳过 Script/MITM 能得到千问答案，必须保留发布阻断状态。
9. 保留 [boitar/sair](https://github.com/boitar/sair) 的 MIT 归属及本仓库 [LICENSE](LICENSE)，不得删除历史安全研究的原始证据。

## 发布规则

在 P4 真机来源失败矩阵和 P5 重构审查完成前，PR 保持 Draft / Experimental。不能为了 CI 绿灯删除测试、扩大 MITM 或宣称已完成真实 Siri 验收。参见[发布核对表](docs/RELEASE_CHECKLIST_ZH.md)。

## 后续操作资料（v0.6）

- [首次使用及集中验收](docs/USER_GUIDE_ZH.md)
- [真机调试、错误码和脱敏反馈](docs/DEBUGGING_ZH.md)
- [当前脚本结构和双阶段数据流](docs/ARCHITECTURE_CURRENT_ZH.md)
- [升级、维护、版本 pin 和发布流程](docs/OPERATIONS_ZH.md)
