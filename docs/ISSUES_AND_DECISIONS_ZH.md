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
- 现有实验方法与约束详见 [网络边界](NETWORK_BOUNDARY_ZH.md) 和 [实验矩阵](EXPERIMENT_MATRIX_ZH.md)。
- 历史口述 A–B–A 记录不是可独立验证的原始抓包证据；不得转写为“零透传已通过”。
