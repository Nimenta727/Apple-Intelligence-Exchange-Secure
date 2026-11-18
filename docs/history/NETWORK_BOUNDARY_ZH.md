# v0.2.2-lab 网络安全边界和真实设备证据

## 目前已知
Shadowrocket 2.2.93 (3488) 用户实测：在 example.com 上完成 A（HTTPS mock 成功）—B（加入同域 REJECT 后连接被拒绝）—A（关闭测试 REJECT 后 mock 恢复）。缺少脚本入口的可靠观测和底层出站抓包，因此不能声称已经确定执行先后顺序，也不能证明 Siri 的请求一定被脚本捕获。

## 本阶段实现
- `src/config.js` 的 `providerEnabled=false` 在真实网关隔离机制验证前强制关闭 DeepSeek 请求。
- `src/core.js` 在解析文本后立即阻断，返回稳定错误 `AIES_NETWORK_ISOLATION_UNVERIFIED`。
- `tools/check-boundary.js` 静态核查 00/10 的 REJECT、实验脚本类型及 provider 安全闸。
- 使用完全虚构的数据进行离线单元测试，验证未配置网络隔离时零 DeepSeek 调用、零 Key 读取。
- 该逻辑不是网络防火墙。Shadowrocket REJECT 仍须保持开启；如果脚本未被执行，则上述本地错误响应也不会出现。

## 禁止采取的捷径
1. 不得移除 `prod-yabuli.qianwen.com` 的 REJECT 以便使脚本被调度。
2. 不得直接移植上游 boitar/sair 的 response-rewrite 方案，因为它通过官方千问获取 SSE 会话骨架。
3. 不得将本地代码返回 503 描述为“已实现零透传”；需要 VPN/设备外部抓包与网络策略独立核对。

## 网络引擎进入下一阶段的验收门槛
- 在完全虚构的 HTTPS 测试域名上，网络路由层可证明无上游 TCP/TLS/QUIC 会话，同时本地客户端获得预期 mock 响应。
- 断开 VPN、切换网络及脚本加载失败时，记录可观察的阻断行为；无法保障时必须明示。
- 真机验收记录仅保存日期、客户端版本、脚本 commit SHA、是否本地响应和是否观察到上游出站；不能提交密钥、用户输入、真实报文或 CA 私钥。
- 未完成这些证据前，安全闸不能解除，项目继续标记为 LAB / 不可用于 Siri→DeepSeek。
