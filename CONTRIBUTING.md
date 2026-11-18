# Contributing / 贡献指南

该项目是安全优先的 Shadowrocket 实验，不是生产级 Siri 插件。

1. 仅编辑 src/ 源码，不直接编辑 scripts/sairs_router.js（自动生成）。
2. 在本地运行 npm run build 和 npm run check，源代码和生成脚本必须同时提交。
3. 新功能必须加单元测试、负例测试和隐私风险说明。
4. 不得用删除 REJECT、开启无鉴权面板或不受限 Endpoint 的方式换取可用性。
5. 不得提交证书私钥、DeepSeek API Key、真实请求抓包及含个人信息日志。
6. 保留 boitar/sair 原项目的 MIT 版权声明。
7. 真机验证必须提供 iOS/Shadowrocket 版本、去敏证据和失败场景。
