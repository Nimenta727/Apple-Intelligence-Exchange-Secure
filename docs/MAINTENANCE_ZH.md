# AIES 维护与协作规范（v0.6 候选路线）

## 两套代码的明确分工

- **v0.6 候选部署**：`shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule` + `scripts/aies_siri_deepseek_v06.js`。双阶段脚本为自包含实现；`tests/siri-deepseek-v06.test.js` 是相关模拟测试。
- **v0.4 历史研究文件（main 内保留）**：`src/`、`tools/build.js`、`scripts/sairs_router.js`、`00/10/20/21` 与对应测试。它们仍属于仓库 CI 与研究记录，**不依赖于 60 的运行**。不能以修改 src/ 代替修改 v0.6 脚本。
- **旧 40/50、30/31**：存在于历史 PR/分支，不再是 v0.6 当前安装步骤。

## 代码修改与发布工作流

1. 从当前基准创建功能分支，确保 PR 指向正确目标分支；旧实验 PR 不随意合并到 v0.6。
2. 修改真实部署脚本及配套测试；检查现有文件的文档与模块是否引用了同一个固定版本。不要只改模块版本号。
3. 本地运行 `npm run check`；旧 src/ 若变更必须 `npm run build` 并将生成的 `scripts/sairs_router.js` 一并提交。
4. 运行自动化静态检查、敏感文件扫描和文档相对链接检查。每项 CI 失败都要修原因。
5. 更新中英文 README、CHANGELOG、安装/安全/状态/验收文档；标明真机与 API 真实联调的证据状态。
6. v0.6 的远程脚本链接固定到不可变 commit；改脚本后必须同步更换两个 hook 的 pin 并复测。
7. 真机验收仅使用不包含隐私的固定问题，收集脱敏结果；决定是否合并及是否发布，**不以 CI 绿灯替代真机**。

## 安全设计关注点

- 优先减少设备本地的用户正文存储；请求关联、并发和 TTL 的语义由真机结果决定。
- 检查 SSE 解析器遇多字段/未知事件时是否可能保留千问回答；出错时须明确当前脚本能否覆盖整个响应。
- 任何扩大 MITM 范围、远程脚本加载、密钥传参、自动 fallback 都需要单独安全审查。
- 不提交 DeepSeek API Key、证书私钥、Cookie、Authorization、用户提问和完整抓包。
- 修改 00 REJECT 的流程必须明确区分“旧阻断配置”与“用户已接受上游透传的 v0.6 新配置”。

## 文档版本纪律

- `README.md`、`README_EN.md`：定位与导航，不塞大量旧日志。
- `docs/README.md`：统一入口。
- `docs/CURRENT_STATUS_ZH.md`：唯一当前状态。
- `docs/SIRI_DEEPSEEK_RESPONSE_REWRITE_PLAN_ZH.md`：需求与 P0–P6 计划。
- `docs/ISSUES_AND_DECISIONS_ZH.md`：历史决策保留，最新目标覆盖旧要求。
- `docs/history/`：历史原文不删除、不当作当前安装说明。

## 下一步优先事项

真实 Siri 集中验收 → 明确脚本/协议可行性 → 深化来源失败验证 → 去除持久化用户正文与简化核心逻辑 → 发布前安全和许可证审查。

## 详细操作手册

本文记录维护规范。需要实际操作时请直接使用：[维护、升级、版本固定和发布流程](OPERATIONS_ZH.md)；调试阶段请使用 [错误码与日志定位](DEBUGGING_ZH.md)；代码职责和数据流见 [当前架构](ARCHITECTURE_CURRENT_ZH.md)；真机安装参阅 [使用指南](USER_GUIDE_ZH.md)。
