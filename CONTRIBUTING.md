# Contributing / 贡献指南

> 重要：**main 是旧 v0.4.0-lab 安全研究基线**，v0.6 当前响应改写路线位于 [`siri-deepseek-v0.6-clean`](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/tree/siri-deepseek-v0.6-clean)（Draft PR #10）。新功能、文档、安装测试应先参考该分支的 [维护说明](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/MAINTENANCE_ZH.md) 和 [发布清单](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/RELEASE_CHECKLIST_ZH.md)。

- 修改 main 的历史 `src/` 时，运行 `npm run build` 和 `npm run check`，提交自动生成的 `scripts/sairs_router.js`。
- v0.6 部署逻辑不由历史 `src/` 构建。修改它必须更新 `scripts/aies_siri_deepseek_v06.js`、对应测试和 60 模块的两个固定 commit URL。
- 无论何种分支，提交安全负例测试、敏感数据审查和版本文档；不要删除失败测试只为通过 CI。
- 严禁提交 DeepSeek API Key、CA 私钥、用户原文、Authorization、Cookie 或完整原始抓包。
- 分清 **脚本级不回退千问** 和 **系统级绝不出现千问**，后一项当前没有经过真机验证。
- 保留 boitar/sair 的 MIT 许可说明，旧实验记录和真机观察结论不可当成新版已通过的证据。
