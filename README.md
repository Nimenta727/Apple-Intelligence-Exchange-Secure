# Apple Intelligence Exchange Secure

> 基于 [boitar/sair](https://github.com/boitar/sair) 协议研究的 **Shadowrocket / iPhone 本地安全实验项目**。
>
> **状态：v0.2.0-lab · Experimental / 未经过真实 iPhone 验收。**
> 目前**不能保证**阻止全部 Apple 智能云端流量，也**不能保证** Siri 接受独立合成的 SSE；严禁将实验版宣传为已验证生产可用。

[简体中文安装与证书指南](docs/CONFIGURATION_ZH.md) · [安全设计](docs/SECURITY_ZH.md) · [真机验收](docs/TEST_PLAN.md) · [架构与维护](docs/ARCHITECTURE_ZH.md) · [English](README_EN.md) · [上游 MIT 许可证](LICENSE)

## 项目简介

**Apple Intelligence Exchange Secure (AIES)** 旨在研究：在 iPhone 本地使用 Shadowrocket 脚本，拦截指定 Apple 智能扩展请求，调用**由使用者自行授权**的 DeepSeek API，并尝试把回答封装成 Siri 可接受的 SSE 响应。研究目标是**不让匹配请求发往千问**，而不是把千问的返回内容事后替换。

该版本以**安全先行、失败关闭 (fail-closed)** 为原则。先通过独立阻断模块验证域名级阻断，再启用未经验证的本地响应实验模块。默认不提供 Web 控制台、不接受 URL 传参修改 Endpoint 或 API Key；不包含账号密码、证书私钥、真实 DeepSeek 密钥；不依赖上游作者在线服务。

### 核心边界

- **实验阶段**：JS 离线测试可验证代码分支，但不能证明 Shadowrocket 的脚本与规则执行顺序、模拟响应能力、SSE 兼容性和 VPN 断开情况下的安全性。
- **云端调用**：DeepSeek 推理发生在 DeepSeek 云端；此项目不是本地离线推理，用户内容可能被 DeepSeek 处理。
- **非零 Apple 流量**：苹果系统其他域名/服务仍可能联网；本仓库只针对已知域名的规则，不能声称全机隔离。
- **无 ChatGPT 订阅接口**：ChatGPT Plus/Pro 不能作为本项目的通用 API Key；当前只适配 DeepSeek 独立 API Key。
- **仓库公开**：公开代码不等于公开密钥。建议 Fork 或自行保管私有配置，**绝不向仓库提交真实密钥/CA 私钥**。

## 仓库结构（v0.2.0-lab）

维护性源码已拆分为清晰的独立模块；实际导入 Shadowrocket 的脚本仍然只有一个自动构建文件。

    src/config.js             # 固定安全配置、模型和资源上限
    src/request.js            # URL / 场景 / 文本协议校验
    src/deepseek.js           # DeepSeek API 调用与响应校验
    src/sse.js                # 实验性 SSE 格式生成
    src/core.js               # 状态管理、超时与安全拒绝
    src/entry.js              # Shadowrocket 运行时适配
    tools/build.js            # 无依赖确定性构建
    scripts/sairs_router.js   # 自动生成的单文件插件脚本
    scripts/provision_key_ONCE.js / clear_key_ONCE.js
    shadowrocket/             # 阻断模式与实验模式
    tests/*.test.js           # Node 离线安全回归测试
    docs/                     # 证书、架构、安全、验收指南

请修改 src/ 后执行 npm run build；切勿只修改生成的 scripts/sairs_router.js。

## 最短部署路线

1. **先做阻断基线**：在 Shadowrocket 导入 `00-SAIRS-LOCKDOWN.sgmodule`，保持本地 VPN 启用。检查 `prod-yabuli.qianwen.com` 被拒绝。
2. **谨慎启用实验模式**：只有确认 Shadowrocket 当前版本支持本地 `script-path` 与请求阶段 mock response，才测试 `10-SAIRS-DEEPSEEK-LAB.sgmodule`。
3. **本机自行生成 CA**：只为必要的目标主机启用 HTTPS 解密。**证书私钥不需要也不应填写到插件。**
4. **DeepSeek API Key 本机初始化**：官方创建低额度专用 Key，按 [配置指南](docs/CONFIGURATION_ZH.md) 在本地执行一次初始化脚本，不把 Key 写入 GitHub、URL 或模块配置。
5. **先运行检查再上真机**：`npm run check` 及 `npm run check`；按照 [测试计划](docs/TEST_PLAN.md) 观察网络连接和 Siri 行为。

**不可跳过的重要门槛**：LAB 模块中的 REJECT 规则可能在脚本之前生效，导致 DeepSeek 不会运行；移除 REJECT 则可能导致异常时原始请求透传。任何情况下，都不要为了“让 Siri 能回答”而牺牲千问隔离验证。

## 运行测试

需要 Node.js（只用于开发电脑上的离线测试；不需要在 iPhone 安装 Node）：

```bash
npm run check
npm run check
```

## 当前能力 / 未完成

| 能力 | 状态 |
|---|---|
| 公开可审计的本地核心脚本 | 已实现 |
| 固定 DeepSeek 官方 Endpoint / `deepseek-flash` | 已实现 |
| 无 Web Dashboard / 无公开配置接口 | 已实现 |
| API Key 从本地持久存储读取 | 已实现（存储加密性质取决于客户端） |
| 未识别请求保守拒绝、失败不回退千问 | 已实现（代码层面） |
| 请求阶段阻断及本地 mock response | **待 Shadowrocket 真机验证** |
| Siri 接受自己合成的 SSE | **待真机验证** |
| VPN 关闭时依旧阻断千问 | **不支持** |
| 图像/视觉智能 | 暂不支持，遇到图片输入拒绝 |
| GPT/Claude/Gemini 手动切换 | 暂不支持，后续在安全架构稳定后考虑 |

## 安全与开源声明

本项目不是 Apple、Shadowrocket、DeepSeek、OpenAI 或原 SAIR 作者的官方产品。系统 HTTPS 解密会引入 CA 信任风险，请阅读 [安全文档](docs/SECURITY_ZH.md)。上游项目版权属于原作者 boitar，MIT License 要求保留原版权及许可文本。未经真实设备验证的能力不得标注为已完成。


## 维护与持续优化

第二轮重构将配置、解析、模型调用、SSE 与运行时状态机独立维护，并在 GitHub Actions 中检查生成脚本与源码完全一致。详细模块职责见 [架构与开发指南](docs/ARCHITECTURE_ZH.md)。这并不能取代真实 iPhone 的隔离与协议验收。
