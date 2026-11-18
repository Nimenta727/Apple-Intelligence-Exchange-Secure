# Apple Intelligence Exchange Secure

> 基于 [boitar/sair](https://github.com/boitar/sair) 协议研究的 **Shadowrocket / iPhone 本地安全实验项目**。
>
> **状态：v0.4.0-lab · Experimental / 未经过真实 iPhone 验收。**
> 目前**不能保证**阻止全部 Apple 智能云端流量，也**不能保证** Siri 接受独立合成的 SSE；严禁将实验版宣传为已验证生产可用。

[交接总览](docs/PROJECT_HANDOFF_ZH.md) · [遇到的问题](docs/ISSUES_AND_DECISIONS_ZH.md) · [项目现状](docs/CURRENT_STATUS_ZH.md) · [安装规划](docs/INSTALLATION_ROADMAP_ZH.md) · [实验矩阵](docs/EXPERIMENT_MATRIX_ZH.md) · [证书及历史配置](docs/CONFIGURATION_ZH.md) · [安全设计](docs/SECURITY_ZH.md) · [真机验收](docs/TEST_PLAN.md) · [架构与维护](docs/ARCHITECTURE_ZH.md) · [English](README_EN.md) · [上游 MIT 许可证](LICENSE)

## 当前阶段从这里开始（2026-11-18）

**核心目标未变：安全本地接管 Siri 文本请求 → 用户授权的 DeepSeek → Siri 原生 SSE；原始请求不得传至千问。** `main` 是最新集成版本，但仍为 **v0.4.0-lab**，不能承诺现已可用。

请按顺序阅读：

1. [项目交接总览](docs/PROJECT_HANDOFF_ZH.md)：当前架构、决策、贡献规范和真正的完成条件。
2. [本次对话问题台账](docs/ISSUES_AND_DECISIONS_ZH.md)：已遇到的问题、证据、是否解决。
3. [当前实现和阻塞条件](docs/CURRENT_STATUS_ZH.md)：哪些功能是代码层完成，哪些未经真机证明。
4. [Shadowrocket 安装与安全回滚规划](docs/INSTALLATION_ROADMAP_ZH.md)：00 基线、20/21 两个互斥的虚构域名实验。
5. [实验矩阵与证据模板](docs/EXPERIMENT_MATRIX_ZH.md)：E0–E6 测试的通过、失败及停机条件。

**现在只应进行无 API Key 的安全基线与虚构域名对照实验。** 真实 Siri 安全接管与 SSE 客户端兼容尚未通过，主脚本故意保持 `providerEnabled:false` 和目标域名 REJECT。实验模块 20/21 不得同时开启，更不得把其虚构域名直接替换成真实千问域名。


## 项目简介

**Apple Intelligence Exchange Secure (AIES)** 旨在研究：在 iPhone 本地使用 Shadowrocket 脚本，拦截指定 Apple 智能扩展请求，调用**由使用者自行授权**的 DeepSeek API，并尝试把回答封装成 Siri 可接受的 SSE 响应。研究目标是**不让匹配请求发往千问**，而不是把千问的返回内容事后替换。

该版本以**安全先行、失败关闭 (fail-closed)** 为原则。先通过独立阻断模块验证域名级阻断，再启用未经验证的本地响应实验模块。默认不提供 Web 控制台、不接受 URL 传参修改 Endpoint 或 API Key；不包含账号密码、证书私钥、真实 DeepSeek 密钥；不依赖上游作者在线服务。

### 核心边界

- **实验阶段**：JS 离线测试可验证代码分支，但不能证明 Shadowrocket 的脚本与规则执行顺序、模拟响应能力、SSE 兼容性和 VPN 断开情况下的安全性。
- **云端调用**：DeepSeek 推理发生在 DeepSeek 云端；此项目不是本地离线推理，用户内容可能被 DeepSeek 处理。
- **非零 Apple 流量**：苹果系统其他域名/服务仍可能联网；本仓库只针对已知域名的规则，不能声称全机隔离。
- **无 ChatGPT 订阅接口**：ChatGPT Plus/Pro 不能作为本项目的通用 API Key；当前只适配 DeepSeek 独立 API Key。
- **仓库公开**：公开代码不等于公开密钥。建议 Fork 或自行保管私有配置，**绝不向仓库提交真实密钥/CA 私钥**。

## 仓库结构（v0.4.0-lab）

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

## 历史部署概要（请以最新安装规划为准）

1. **先做阻断基线**：在 Shadowrocket 导入 `00-SAIRS-LOCKDOWN.sgmodule`，保持本地 VPN 启用。检查 `prod-yabuli.qianwen.com` 被拒绝。
2. **先做无密钥实验**：只在虚构域名上分别测试 `20-AIES-LOCAL-BOUNDARY-PROBE.sgmodule` 和 `21-AIES-HTTP-ENGINE-PROBE.sgmodule`（不得同时启用），**不要直接启用 10 进行真实 Siri→DeepSeek 联调**。
3. **本机自行生成 CA**：只为必要的目标主机启用 HTTPS 解密。**证书私钥不需要也不应填写到插件。**
4. **DeepSeek API Key 暂不配置**：当前真实域名安全隔离和 SSE 尚未证明可行；只有通过 [实验矩阵](docs/EXPERIMENT_MATRIX_ZH.md) 中相应安全门槛后，才进行后续授权联调。
5. **先运行检查再上真机**：`npm run build` 及 `npm run check`；按照 [测试计划](docs/TEST_PLAN.md) 观察网络连接和 Siri 行为。

**不可跳过的重要门槛**：LAB 模块中的 REJECT 规则可能在脚本之前生效，导致 DeepSeek 不会运行；移除 REJECT 则可能导致异常时原始请求透传。任何情况下，都不要为了“让 Siri 能回答”而牺牲千问隔离验证。

## 运行测试

需要 Node.js（只用于开发电脑上的离线测试；不需要在 iPhone 安装 Node）：

```bash
npm run build
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


## 0.2.1-lab 脚本诊断（仅阶段标记）

本版在 Shadowrocket 支持 `console.log` 时记录 `[AIES_DIAG] ENTER`、`REQUEST_VALIDATED`、`REQUEST_REJECTED`、`KEY_MISSING`、`UPSTREAM_STARTED`、`UPSTREAM_OK`、`UPSTREAM_FAILED`、`LOCAL_RESPONSE_ATTEMPTED`、`LOCAL_ERROR_ATTEMPTED` 等固定标记。**不记录原始 URL、提问、回答、Authorization 或 API Key。** 日志出现 `LOCAL_RESPONSE_ATTEMPTED` 只说明已尝试调用 `$done({response})`，并不保证 Siri 已接受响应。

**若连接日志只有 REJECT 且没有 `ENTER`**，支持请求未进入 JS 的诊断假设，但 `console.log` 不可用、客户端未显示脚本日志也会造成相同现象；不能单凭缺失日志证明严格执行顺序。

与上游 [boitar/sair](https://github.com/boitar/sair) 的关键区别：原版通过放行请求获得千问 SSE 骨架，再在 `http-response` 阶段替换内容；本安全版不允许原始请求透传千问，因此无法直接移植其双阶段方案。即使独立 mock 在 HTTP/HTTPS 中成功，同域 `REJECT` 仍可能阻止真实请求脚本触发。不要删除保护规则。

诊断标记 `LOCAL_RESPONSE_ATTEMPTED` / `LOCAL_ERROR_ATTEMPTED` 发生在调用 `$done` 之前；`DONE_THROW` 表示 `$done` 同步抛错。**不存在可据此证明 Siri 收到回答的 `SUCCESS` 标记。**


## 0.2.2-lab：真实流量安全门槛（阶段二）

针对 Shadowrocket 2.2.93 的 A–B–A 真机观测：独立 HTTPS mock 能工作，同域 REJECT 命中后页面请求被拒绝，移除 REJECT 后 mock 恢复。**这只是冲突现象的证据，不能证明精确内部执行时序，也不能推断全设备或其他版本行为。**

`src/config.js` 的 `providerEnabled: false` 是**发布安全闸**：即使请求匹配、Key 已配置，主脚本也只尝试返回 `AIES_NETWORK_ISOLATION_UNVERIFIED`，绝不调用 DeepSeek。它不具备网络层阻断能力，必须继续保留 `DOMAIN,prod-yabuli.qianwen.com,REJECT`。不要将它改为 `true` 来追求运行效果。

`npm run check` 新增静态边界审查，拒绝删除阻断规则、误开模型调用或使用原始千问上游回包。这一阶段提供安全停止与证据记录机制，**不意味着已经实现无透传的 Siri 接管**。下一阶段必须寻找能独立证明“本地响应、零原始上游连接”同时成立的网络引擎；未通过验收，不发布 Siri→DeepSeek 可用版。详情见 [安全边界验证](docs/NETWORK_BOUNDARY_ZH.md)。


## 阶段三（开发）：只针对保留域名的本地接管探针

本阶段新增 `shadowrocket/20-AIES-LOCAL-BOUNDARY-PROBE.sgmodule`、`scripts/aies_boundary_probe.js`、脱敏证据判定工具和离线测试。探针只匹配 RFC 2606 预留的 `aies-probe.invalid`，尝试将其 Host 映射到 `127.0.0.1`，在 HTTPS 请求阶段返回固定 `AIES_BOUNDARY_PROBE_OK`。**这只是独立测试模块；不修改真实 Siri 模块或现有千问 REJECT，也不需要 DeepSeek API Key。**

详情及限制：[阶段三本地边界探针](docs/LOCAL_BOUNDARY_PROBE_ZH.md)。测试成功也仅说明模拟域名的机制有效，不能证明真实 Siri 请求已经被安全接管。默认 `providerEnabled: false` 仍保持。


## v0.4.0-lab：独立 Siri SSE 协议构建与虚构端到端测试

独立生成器 `src/sse.js` 现在对 Siri 的 `content/suggestions/summary`、写作工具的 `body/refinements` 执行受限结构化输出处理；较长文本被切分为多个 delta，所有 `done` 节点复用相同最终数据。`validateCandidateSse` 逐事件校验完整性、顺序、会话 ID、delta 汇总和场景 Schema，核心代码在尝试返回前进行自检。`tests/protocol-synthetic.test.js` 仅用虚构请求和模拟 DeepSeek HTTP 响应验证全链路，不发送任何真实请求。

这仍是**协议候选实现**：原作者 SAIR 依赖真正的千问 SSE 骨架，公开协议说明不等于完整、经过验证的 Apple 协议规范。测试通过不意味着 iOS 接受 SSE。**保持 `providerEnabled: false` 与目标域名 REJECT，直到独立网络接管被证实安全。** 导入脚本路径在实验模块中写为 `Script/sairs_router.js`；路径仍须依真机环境核实。


## v0.5 实验：本地 HTTP 引擎 / Fake-IP 对照

新增独立的 21 实验模块，仅对 RFC2606 虚构域名 aies-probe.invalid 进行 198.18.41.221 的映射，并尝试 force-http-engine-hosts。与 20 loopback 方案相互独立、**不得同时开启**；不影响正式 Siri/千问路由和 REJECT。本方案还没有获得真机安全证据，不能作为真实 Siri 替换模块部署。详细见 docs/HTTP_ENGINE_PROBE_ZH.md。
