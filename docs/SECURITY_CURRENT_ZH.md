# AIES v0.6 安全与隐私边界

> 当前是**实验性 Beta**，未通过独立安全审计与 Siri 真机验收。以下描述代码设计，不能保证操作系统或代理失效时的行为。

## 数据可能发往哪里

用户明确允许 Siri 原始文本请求到千问。响应脚本同时会把提取的问题发到用户授权的 DeepSeek API。因此**千问和 DeepSeek 都可能处理同一问题**。该工具不提供“千问零出站”或完全离线运行。

## 代码层设计

- 只匹配固定 HTTPS Host/Path 和受支持的 Siri 文本输入。
- 只将 Key 加到对 DeepSeek 官方 API 的 Authorization 头，Key 不通过模块 URL、源代码或日志发送。
- 对已识别 SSE 结构重建答案，不在脚本能控制的成功路径中保留千问 AI 文本；未知 SSE 拒绝重写。
- 对无 Key、网络/模型超时、SSE 错误等情况尝试用 502 代替上游回复。
- 两个脚本钩子固定到同一不可变 Git commit，避免追踪开发分支更新。
- 2026-11-19 新增请求解析固定原因码：代码只打印静态分类，不打印请求 body、header、Authorization、Private-Access-Token、Key 或真实问题。**Shadowrocket 自带的 PacketTunnel 日志可能显示敏感请求头，不能将整个日志发送给他人。**

## 2026-11-19 本地一次性组名诊断

真实日志发现 Siri 和 WritingTools 共享目标接口，且真实 Siri 的场景组名与当前白名单不符。本次改动：

- WritingTools 的请求/响应识别为非 Siri 作用域时直接跳过，不调用 DeepSeek，主脚本只输出固定 `WRITINGTOOLS_SKIPPED`。
- **默认不采集**未知组名。必须在本机通过手动运行最新版 `siri_group_probe_ONCE.js` 主动开启 600 秒窗口，且请求阶段确实为 Siri User-Agent 的 POST，才可能暂存一个被长度和字符集限制的组名。
- 主脚本不记录组名；新版采用单个本地状态键保存固定解析原因、最多 9 次的小型计数及至多一个格式受限组名；重复手动查看状态不会取消采样。捕获后只在设备本机手动 Script Test 中显示一次 `GROUP_ID`，随后逻辑清空；独立 [`siri_group_probe_STOP_ONCE.js`](../scripts/siri_group_probe_STOP_ONCE.js) 可以明确停止。**本机存储的逻辑 TTL 和清空不保证物理删除**，不证明执行环境共享状态或协议可信性。
- 如果标识像随机令牌/凭据或不符合保守格式，直接拒绝采样；不要分享该值。**不得提交**原始 PacketTunnel 日志，它可能包含 Authorization、私有访问令牌和其他数据。
- Siri 组名仅用于待审查的白名单更新，不得仅凭 User-Agent 就让未知请求进入 DeepSeek；实际端到端安全仍未验证。

详见 [Siri 组名安全诊断](SIRI_GROUP_PROBE_ZH.md)。

## 尚未解决的重要风险

1. **系统绕过**：VPN 关闭、MITM 不生效、脚本加载失败、Siri 缓存或备用通路可能使用户看到千问回复，脚本无法无条件阻止。
2. **本机留存**：问题正文写入 `$persistentStore`，45 秒仅是逻辑 TTL，不能保证物理删除或存储加密；Token 使用 `Math.random`，不应视为密码学强凭据。
3. **MITM 根证书**：本机受信任 CA 扩大证书信任边界；仅对目标域名启用解密，测试后关闭并按需撤销信任。不分享 CA 私钥。
4. **协议兼容**：真实 SSE 的分块、压缩、未知事件与跨阶段可见性未经真机验证。
5. **API 模型与费用**：官方文档列出 `deepseek-flash`，但脚本尚未用真实账户 API 联调；调用会使用用户自己的 DeepSeek 额度。
6. **上游元数据**：新增关联请求头可能被千问观察，虽然它不直接包含问题明文，但会增加可关联信息。

## 停止条件与敏感数据规范

任何显示千问答案、混合答案、串话、密钥泄露、流式错误或不明绕过都应记录为失败，停止测试并按[安装指南](INSTALL_SIRI_DEEPSEEK_V06_ZH.md)回滚。只记录阶段码和版本，**不提交**真实问题、API Key、Authorization、Cookie、完整 HTTP/SSE 或网络抓包。

只有 [发布验收清单](RELEASE_CHECKLIST_ZH.md) 所列设备与安全门槛达成，才考虑 Stable。
