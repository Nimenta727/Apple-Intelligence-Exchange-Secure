# AIES 版本维护、升级与发布操作流程

> 本文面向维护者。**v0.6 Clean Beta 仍是待真机验收的 Draft 候选**，不是已发布的生产版本；`main` 已包含 v0.6 Beta 候选和旧 v0.4 实验代码。

## 1. 日常开发循环

```bash
git clone https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure.git
cd Apple-Intelligence-Exchange-Secure
git fetch origin
git switch main
npm run check
npm run docs:check
```

必须使用适合项目 `package.json` 的 Node 版本（声明 Node >=20；CI 当前使用 Node 22）。不通过用删除测试解决 CI 失败。

代码与文档职责：
- 运行逻辑：`scripts/aies_siri_deepseek_v06.js`。
- 模块：`shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule`。
- 自动测试：`tests/siri-deepseek-v06.test.js`。
- 文档：`docs/` 与根目录 README / README_EN / CHANGELOG / CONTRIBUTING。
- 旧研究：`src/`、`tools/build.js` 和 `scripts/sairs_router.js`，仅改旧研究时运行 `npm run build` 重新生成。

## 2. 修改脚本后的正确顺序

1. 从候选基准创建新功能分支。限制变更范围，新增或更新至少一个正常测试与一个相关失败/安全测试。
2. 先在 JS 与模拟测试中修改行为；检查是否把用户问题、模型回复、Key、Authorization 或原始 SSE 记录到控制台。
3. `npm run check` 和 `npm run docs:check` 必须通过；包含旧 REJECT 静态规则和文档引用检查。
4. **固定提交再更新模块**：先提交已审查的 JS，并取得真实 40 位 commit SHA；将 60 模块中 Request 和 Response 两条 `script-path` 都更新为该 SHA；再提交更新后的模块并重新跑 CI。绝不能用随分支漂移的脚本链接替换固定 pin。
5. 如果模块跟随新提交而变化，检查本地 Shadowrocket 导入版本与实际远端脚本匹配。不要只更新 README 版本号。
6. 同步 README、README_EN、CHANGELOG、安装/架构/安全/调试/维护/发布核对表。
7. 真机仅用非隐私问题做最终集中验收，记录操作系统和 Shadowrocket 版本、是否命中钩子、客户端显示、失败来源和回滚结果。

## 3. 可执行的审查清单

- URL 白名单未放宽、仅支持 Siri 文本 POST；MITM Host 没有扩大。
- Key 不在 URL、源码常量、日志或公共配置；本地清理脚本不打印 Key。
- 原始千问正文在解析失败时不会被脚本成功返回；未知 SSE 必须安全报错。
- 异步回调至多一次；超时、网络错误、非法 model reply、并发错配被覆盖。
- 持久化问题是否可以减少，是否有过期清除和崩溃后残留。
- 新模型名来自官方信息且当前账户权限已在本机验证。
- 不以单次正常 Siri 输出推断 VPN 失效后的来源保证。

## 4. 版本和发布策略

- 用户已授权将 v0.6 整合进 `main`，但合入代码不是发布稳定版，不得据此宣称 Siri 真机验收通过。
- v0.6 已进入 `main`；旧 #7/#8/#9 已关闭并保留历史；#10 是合并审计记录。
- 功能/故障矩阵在 [发布验收表](RELEASE_CHECKLIST_ZH.md) 中记录真实观察；若 Siri 直接显示千问或模型无法调通，标记未通过、暂缓发布。
- 只有按当前安全标准完成真机与来源回退验收，才决定发布 Tag / Release，并更新唯一现行安装入口。
- 正式发行时锁定模块、运行脚本与文档到同一不可变版本；升级需保留可回滚的旧安装文件。

## 5. 发生故障时维护者怎么处理

1. 立即区分宿主钩子没执行、SSE 格式不符、DeepSeek 认证/网络、Siri 不接受输出。
2. 只收集固定阶段码、版本、请求是否命中、原生界面结果；**不请求用户上传真实问题或完整响应**。
3. 优先编写合成 fixture 重现，再修订解析/错误处理，禁止直接把千问原文透传当作“兼容性修复”。
4. 修复版本走独立提交和 pinned script 更新，保留旧配置回滚路径。
5. 更新 [当前状态](CURRENT_STATUS_ZH.md)、[问题台账](ISSUES_AND_DECISIONS_ZH.md)、CHANGELOG 与 [调试手册](DEBUGGING_ZH.md)，防止相同故障被反复测试。

## 6. 定期维护建议

每次修改前检查最新 PR、CI 结果、文档链接、API 模型 ID 可用性与脚本 SHA。每次发布候选后检查测试覆盖、日志敏感性、模块冲突和是否存在用户上下文留存。维护记录只写可核实事实，不把计划写成已经完成的功能。

[代码结构](ARCHITECTURE_CURRENT_ZH.md) · [安装使用](USER_GUIDE_ZH.md) · [调试](DEBUGGING_ZH.md) · [安全](SECURITY_CURRENT_ZH.md)。
