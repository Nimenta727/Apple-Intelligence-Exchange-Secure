# 项目架构与开发维护

> **历史资料（只读研究记录；不适用于 v0.6 安装）**：本文记录旧版网络阻断、候选协议、证书或测试假设。用户最新目标允许问题经过千问，要求尝试由 DeepSeek 提供 Siri 原生界面的最终 AI 回答。部分旧操作建议与新模式矛盾，**不得依本文启用旧模块、修改 REJECT 或配置密钥**。当前入口：[文档中心](../README.md) · [v0.6 安装](../INSTALL_SIRI_DEEPSEEK_V06_ZH.md) · [安全边界](../SECURITY_CURRENT_ZH.md)。

状态：0.2.0-lab。未经真实 iPhone / Shadowrocket 验证。

## 源码模块

- src/config.js：固定目标域名、DeepSeek API URL 和模型 ID、安全上限。
- src/request.js：目标路径、方法、场景、JSON 与文本白名单解析。
- src/deepseek.js：固定模型 API 请求、HTTP 错误和响应格式校验。
- src/sse.js：实验性 Siri SSE 响应生成器，不代表已通过协议验收。
- src/core.js：主状态机、统一一次性结束、超时和拒绝策略。
- src/entry.js：Shadowrocket 注入的运行时全局变量适配。
- tools/build.js：无第三方依赖、确定性打包。
- scripts/sairs_router.js：自动生成的唯一实际部署脚本，禁止直接手改。
- tests/*.test.js：Node 内置测试运行器的离线测试。
- shadowrocket/00...：无 CA、无 API Key 的网络阻断基线。
- shadowrocket/10...：包含 REJECT 后备的 DeepSeek 实验模块。

## 数据流

入口 → 请求校验 → 本地存储读取专用 API Key → DeepSeek HTTPS 请求 → 返回值校验 → SSE 候选生成 → 本地模拟响应。

无密钥、未识别输入、失败或超时均在 JS 层尝试本地拒绝，不主动将原始请求放行。仍需要真机确认 Shadowrocket 的 REJECT 执行顺序、Mock Response 支持以及 VPN 异常时的流量路径。

## 开发流程

在仓库根目录使用 Node.js 20+，不需要安装 npm 依赖。

    npm run build
    npm run check

每次变更必须提交 src/ 源码和脚本生成物。CI 会校验它们完全一致。新增模块时更新 tools/build.js 中的构建清单，添加回归测试。不要加入随时变化的远程代码 URL。

## 未来规划

第一优先级是真机证明隔离和 SSE 兼容，而不是增加模型数量。若 Shadowrocket 无法同时确保拦截和调用，则继续保留阻断模块，不通过删除 REJECT 实现假成功。后续多模型扩展需要分别管理端点白名单和密钥，不能开放无鉴权的动态 Endpoint。
