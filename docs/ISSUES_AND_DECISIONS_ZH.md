# 本次会话的问题台账与技术决策

> 时间范围：截至 2026-11-18。严格区分“用户报告/复现实验”“代码已实现”“未证实的推断”。本文件不包含真实用户请求正文、凭据或抓包。

| 编号 | 问题 / 症状 | 已掌握证据 | 当前结论 / 处理 | 状态 |
|---|---|---|---|---|
| I-01 | 原作者称 SAIR 已可用于 Shadowrocket，为什么我们的不能照装？ | 上游 README 和 sair_adapter.js 说明原请求先经过千问、响应阶段再改写 SSE | 原版可借鉴事件名称，但**不满足不向千问传原始请求**的硬约束 | 架构决定已作出 |
| I-02 | 同域 REJECT 和本地 request mock 冲突 | 用户在 Shadowrocket 2.2.93 (3488) 的非 Siri 测试域名做 A–B–A：mock → REJECT 拒绝 → 恢复 mock | 不删除真实域名 REJECT；优先试仅虚构域名的 loopback / Fake-IP 接管 | 关键阻塞，未解决 |
| I-03 | Shadowrocket 本地脚本路径无效 | 历史本机 Script/ 前缀路径测试有效；裸相对脚本路径发生过失败，远程 raw URL 曾能运行 | 模块使用 Script/sairs_router.js；仍需在当前配置再次验证 | 配置已改，待真机复测 |
| I-04 | 本地脚本日志能否证明 Siri 收到回复？ | LOCAL_RESPONSE_ATTEMPTED 只发生在调用 $done 前；DONE_THROW 表示同步失败 | 不能用脚本日志代替客户端最终接受与网络零透传证据 | 诊断已修正 |
| I-05 | DeepSeek API Key 配好后为何没有真正调用？ | src/config.js 明确 providerEnabled:false | 隔离未验证前先强制返回 AIES_NETWORK_ISOLATION_UNVERIFIED，不读取 Key，不调模型 | 有意保持关闭 |
| I-06 | Siri 对独立 SSE 接不接受？ | 上游列出部分 27 状态协议及两类 JSON Schema；本仓库候选生成器有 12 个基础事件 + delta 分块 | 通过离线 SSE 一致性测试不等于苹果系统接受；需在安全环境另行验证 | 待验证 |
| I-07 | 视觉智能、图片是否已完成？ | src/request.js 拒绝多模态输入 | 当前仅文本 Siri / Writing 候选，图片/音视频未支持 | 未开发 |
| I-08 | Shadowrocket CA 和 DeepSeek Key 是不是同一回事？ | 证书用于 TLS MITM，Key 用于调用模型 | 两者必须分开，绝不上传 CA 私钥或 API Key；00 阻断不需要 CA | 文档化 |
| I-09 | GitHub Actions 曾失败 | 阶段二旧测试假设可直接调用模型；阶段四旧路径测试仍匹配裸脚本名 | 重构测试后 Actions #17/#23 通过，不以取消安全闸让测试转绿 | 已修复 |
| I-10 | 开发阶段散落多个 GitHub branch / PR | 早期采用堆叠 PR #1/#2/#4/#5，用户要求统一到 main | PR #6 已将最新累计版合并 main；后续以 main 作为交付位置 | 已处理 |
| I-11 | “代码写完”是否等于“只用安装就一定能成功”？ | 当前无安全接管与 Siri 实际验收 | 不能承诺仅靠安装即成功；若实际客户端不支持所需组合，仍需改架构 | 未解决 |
| I-12 | VPN 断开、HTTP/3、DNS/其他域名会不会绕过？ | 单域名 Shadowrocket 规则不是全机隔离 | 只能在实际接管的流量范围内讨论阻断；每种网络状态须单独测试 | 待覆盖 |

## 决策记录

- D-01：本项目的目标是零原始 Siri 请求透传千问；不会因为上游 SAIR 声称可用而更改目标。
- D-02：保留 DOMAIN,prod-yabuli.qianwen.com,REJECT 与 providerEnabled:false，直到获得设备级、独立出站观测证明。
- D-03：先在 aies-probe.invalid 上分别测方案 A（20 → 127.0.0.1）和方案 B（21 → 198.18.41.221 + force-http-engine-hosts）；绝不把实验模块的域名简单替换成千问。
- D-04：不在聊天、GitHub、日志、Issue、PR 提交真实 Key、CA 私钥、原始语音文本、抓包或敏感设备信息。
- D-05：每项测试必须记录版本、配置、成功条件及反例，失败就标失败；代码 CI、网络隔离和 Siri 接受是三个独立门槛。

## 已有测试/提交线索

- GitHub CI：Actions #17、#19、#23、#24（历史通过）；PR #6 合并累计代码到 main。
- 现有实验方法与约束详见 [网络边界](history/NETWORK_BOUNDARY_ZH.md) 和 [实验矩阵](EXPERIMENT_MATRIX_ZH.md)。
- 历史口述 A–B–A 记录不是可独立验证的原始抓包证据；不得转写为“零透传已通过”。

## 2026-11-18 本轮新证据与已解决问题

| 编号 | 实际证据 | 本轮判定 | 状态 |
|---|---|---|---|
| I-13 | 00 模块启用后，目标千问域名连接日志显示 REJECT | 规则级阻断命中；非全机隔离证据 | E0 已观测 |
| I-14 | 00+20、Safari case=1/2 返回 `AIES_BOUNDARY_PROBE_OK`；日志包含 `MOCK_ATTEMPTED`、`send early response to client` | 20 在该真机环境可以执行 JS 并提前返回虚构 HTTPS 响应 | **本地 Mock 已解决**；零出站未证实 |
| I-15 | 00+21、Safari case=3 同样成功；21 源文件含 Fake-IP/HTTP Engine 设置 | 21 环境本地 Mock 成功，但没有证据能区分其底层路径或确认 `198.18.41.221` 实际连通 | **本地 Mock 已解决**；HTTP Engine 未确认 |
| I-16 | Shadowrocket 普通连接详情只显示 HTTP-REQUEST / DOMAIN,DIRECT 等规则，运行日志不等于路由器出口抓包 | DIRECT/loopback 字样不能证明零公网出站 | E2-N 用户主动暂缓 |
| I-17 | e4-sse-hardening 先触发 Bundle drift；后提交 `6b44eb9` 重新同步自动生成脚本；Actions #74 quality 成功 | 修复构建产物与源码不一致，choice_index 错误注入检查通过 | **分支已修复，尚未并入 main** |
| I-18 | 用户选定唯一 MVP：Siri 原生文本 → DeepSeek → Siri 原生界面 | 停止泛化 SSE/写作/多模型工作，先解决真实网络接管证明，再评估客户端 SSE | 决策已明确，产品未完成 |

### 更新后的决策

- D-06：E1/E2 的“Safari 本地 Mock 成功”不再重复测试，但 E2-N 被跳过而不是通过；文档不允许把它误写成“独立零出站证明”。
- D-07：最小可行路线只解决两个阻塞点：请求不会透传的独立接管、Siri 原生 SSE 的真实接受；DeepSeek 适配已有代码可复用。
- D-08：下一轮独立开发分支仅做 `aies-probe.invalid` 的故障注入对照（正常、脚本不返回、脚本故意抛错等），**绝不放行真实千问域名**。故障行为仍需独立网络观察才可宣称安全。
- D-09：当用户暂不进行独立出站核验时，可以继续编码和虚构域名测试，但不得将 10 真实接管模块作为“可用产品”启用，不得打开 `providerEnabled`。

## I-19 / D-10：30/31 最小实验结果及架构转向（2026-11-18）

- **I-19（已复现的兼容冲突）**：00+30/DIRECT 下 `ok` 返回 `AIES_FAULT_OK`，`deny` 返回 `AIES_FAULT_DENIED`；`throw`、`nodone` 产生客户端连接错误。00+31/REJECT 下相同 `ok` 请求在连接详情中显示 `DOMAIN,aies-probe.invalid,REJECT`，PacketTunnel 明确出现 `tcp rule => REJECT`、`proxy stream ... reject`，Safari 无法获得本地模拟响应。
- **证据边界**：日志截图证明匹配并执行 REJECT；未提供完整脚本日志和独立出口观测，不能断言精确引擎执行优先级，更不能推出全局无上游透传。
- **D-10**：不再为同域 REJECT + HTTP Request Mock 方案继续进行重复排列组合；下一步研究能否由具备独立 fail-closed 出站保护的接管层合成响应。评估前不启动真实域名、不配置 Key、不打开 provider 开关。
- **MVP 范围不变**：只处理 Siri 原生文本 → DeepSeek → Siri 原生输出，写作/视觉/泛化 SSE 测试暂停。PR #8 为留档的研究性 Draft，不是可部署 Siri 模块。
