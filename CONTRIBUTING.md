# Contributing / 贡献指南

AIES 目前只维护 `main` 的 **v0.6.0-beta**。

1. 真正运行的源码是 `scripts/aies_siri_deepseek_v06.js`；模块是 `shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule`。不要重新引入无关实验部署入口。
2. 为修改添加成功/失败测试，使用 `npm run check` 和 `npm run docs:check`；不要为了使 CI 通过而删除失败测试。
3. 修改运行脚本后，先提交已审查版本，获得不可变 commit SHA，再同时更新模块中 Request / Response 两处脚本引用。
4. 同步中英文 README、CHANGELOG、文档中心、安装/调试/架构/安全/发布手册；相对链接必须可用。
5. 绝不提交用户真实问题、DeepSeek API Key、CA 私钥、Authorization、Cookie、HTTP 原始响应或含隐私的网络抓包。
6. 脚本级不主动回退千问**不等于**系统级禁止 Siri 展示千问；不得宣称没有实测依据的稳定性。
7. 保留 MIT 许可与 [boitar/sair](https://github.com/boitar/sair) 的研究归属。

提交前请阅读 [维护指南](docs/OPERATIONS_ZH.md) 和 [发布验收表](docs/RELEASE_CHECKLIST_ZH.md)。
