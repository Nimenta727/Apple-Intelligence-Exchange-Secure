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

真实日志发现 Siri 和 WritingTools 共享目标接口；随后本机探针确认 Siri 的场景组名为 `siri.multimodal.noRTI`。本次改动：

- WritingTools 的请求/响应识别为非 Siri 作用域时直接跳过，不调用 DeepSeek，主脚本只输出固定 `WRITINGTOOLS_SKIPPED`。
- **默认不采集**未知组名。必须在本机通过手动运行最新版 `siri_group_probe_ONCE.js` 主动开启 600 秒窗口，且请求阶段确实为 Siri User-Agent 的 POST，才可能暂存一个被长度和字符集限制的组名。
- 主脚本不记录组名；新版采用单个本地状态键保存固定解析原因、最多 9 次的小型计数及至多一个格式受限组名；重复手动查看状态不会取消采样。捕获后只在设备本机手动 Script Test 中显示一次 `GROUP_ID`，随后逻辑清空；独立 [`siri_group_probe_STOP_ONCE.js`](../scripts/siri_group_probe_STOP_ONCE.js) 可以明确停止。**本机存储的逻辑 TTL 和清空不保证物理删除**，不证明执行环境共享状态或协议可信性。
- 如果标识像随机令牌/凭据或不符合保守格式，直接拒绝采样；不要分享该值。**不得提交**原始 PacketTunnel 日志，它可能包含 Authorization、私有访问令牌和其他数据。
- 新增组名仅精确允许 `siri.multimodal.noRTI`，同时要求 Siri User-Agent、POST 和严格文本容器。多模态附件、未知嵌套字段、非用户角色、未知根级属性将失败并只输出固定 `REQUEST_DIAG_*`；不能仅凭 User-Agent 放行。实际真机结构与端到端安全仍未验证。

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

## noRTI 真机输入结构诊断补充

已观察到 noRTI 首次兼容后仍出现 `REQUEST_DIAG_INPUT_UNSUPPORTED`。新增 `NORTI_SHAPE_*` 仅输出固定的字段层级/类型异常分类，最多两项；**不会因为发现结构差异而自动放开原本拒绝的媒体和未知字段**。获取具体完整 JSON 仍须另行安全评估，禁止上传带认证信息的原始日志。

## 2026-11-19：请求字段结构最小采样

为避免直接放宽 noRTI 未知字段，增加一个与原本组名探针完全独立的**本机 opt-in 结构摘要**：默认关闭，必须通过手动 Script Test 开启 600 秒。仅在精确 noRTI、Siri UA、POST、请求阶段和严格解析失败时，暂存一次经过长度和疑似敏感内容过滤的有限字段**名称/类型**。普通主脚本日志只显示固定成功或失败码；字段名只会在用户再次手动 Script Test 时本地展示一次并清除。**字段值从不被保存为探针结果**，包括真实问题、Authorization、Cookie、令牌、Key 或请求正文。字段名仍可能敏感，分享前必须人工检查；逻辑清空不能保证物理擦除。STOP 只清理诊断状态，不影响 API Key。详见[本地结构探针](SIRI_SCHEMA_PROBE_ZH.md)。

## 真实 noRTI 字段结构精确兼容（2026-11-19 11:54）

来自 iPad 本地探针的字段**名称和 JSON 类型**经人工提供，包含工具列表和响应格式配置；这些非提问元数据只做严格类型检查并忽略，**不会转发到 DeepSeek**。仅允许精确 Siri noRTI 组名和现有 Siri User-Agent，且保留 POST、纯文本、角色、媒体/工具调用、上游 SSE 失败关闭校验。外层 `type` 的值未知，不会因类型是 string 就放行任何值；只允许已知文本消息判别符 `message`。新的 `NORTI_CONTENT_*` 日志只报告固定的无值结构分类。真机完整输入仍未验证。
