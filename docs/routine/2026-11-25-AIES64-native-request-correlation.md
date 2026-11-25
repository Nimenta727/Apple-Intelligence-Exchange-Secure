# 2026-11-25 — AIES 64 请求/响应关联修复

## 依据

设备日志 10:16:45 捕获 Siri 首轮请求，10:16:48 进入响应钩子；观察到 RESPONSE_TAG_MISSING、RESPONSE_PROMPT_BODY_UNAVAILABLE、CORRELATION_NO_TAG_NO_VALID_BODY、ERROR_PROMPT_UNAVAILABLE。未调用 DeepSeek，故本次优先修复事务关联，不改 SSE 状态机、模型参数或已验证的 62。

## 修改

- 64 运行时增加原始请求头 x-request-id、x-client-request-id、traceparent 的严格格式校验和本地事务索引。仅当两钩子可读取相同原始标识且事务未过期、URL/场景/会话一致时允许恢复；不依赖全局最近一次请求。
- 同一原生标识被重复使用时阻止索引回退；冲突、失效、已消费的事务、索引写失败和错误会话均拒绝。显式无效自定义 tag 不使用其他来源掩盖错误。
- 无 tag 但响应钩子提供完整原始正文时，续答须有明确的已验证上一轮 choice 指针；缺失指针仅在捕获时已可信绑定的事务路径处理，避免选中后来更新的会话上下文。
- 新增 12 个回归测试：原生 ID、traceparent、反序并发、重复/冲突、过期、重放、正文/会话不一致、同钩子正文续答、索引写失败等。
- 60/61/62/63 模块与旧 JS 保持不变；64 模块的本地 JS 路径和四条默认禁用规则保持不变。只需替换独立 v08 JS 进行用户主动选择的实验。

## 边界和后续

现有设备日志没有显示上述原始请求标识是否可用，故此修复不是设备端成功的证明。若仍出现 NATIVE_ID_UNAVAILABLE / NATIVE_ID_NO_MATCH，说明没有足够关联依据；不得放宽为最近一次提问匹配。原生标识的唯一性仍依赖实际客户端语义，PersistentStore 没有原子 CAS，逻辑 TTL 不等于物理擦除。当前不提供系统级接管保证。诊断只输出固定状态码，不输出原始标识、正文或凭据。

下一步：通过 CI 后检查同一设备首轮是否出现 CORRELATION_NATIVE_ID_MATCH、SSE_AUDIT_PASSED 和 DEEPSEEK_RESPONSE_ATTEMPTED；必须以 Siri 实际显示为准。若原生标识路径不可用，需获得不含敏感内容的真实运行时关联能力证据再研究，不继续猜测。保持 62 可独立回滚。


## 2026-11-25 10:25–10:27 真机回归

PR #43 已合并（041082818a542dabeb904676ed0dd35b1ec70e78），CI 160/160 通过。用户报告：普通问题仍可能无法开始；以“请向千问发送”开头可以正常获得回答并连续追问。

对本次 PacketTunnel 本地日志的固定码统计：4 次 REQUEST_CAPTURED，3 次 RESPONSE_TAG_PRESENT / SSE_AUDIT_PASSED / DEEPSEEK_STARTED / SIRI_CONTEXT_STORED / DEEPSEEK_RESPONSE_ATTEMPTED；其中 10:26:09 为首轮，10:26:34 与 10:27:05 为同一 URL session 的追问，缺失 previous_choice_id 时恢复了已验证的同会话历史。用户确认能够连续回答。三次整体耗时档位分别为 2–4、4–6、6–8 秒。

10:25:45 的首轮经历 save data to pending data / send script pending data；随后 RESPONSE_TAG_MISSING、RESPONSE_PROMPT_BODY_UNAVAILABLE，未调用 DeepSeek。NATIVE_ID_UNAVAILABLE 共 5 次，没有 CORRELATION_NATIVE_ID_MATCH，故 PR #43 的原生标识候选没有在这份真机样本命中。10:26:19 同会话一次追问被 FOLLOWUP_GROUP_OTHER_SIRI 拒绝。日志不含逐字问题及 Siri 意图路由决策，不能将每次失败或成功与特定前缀一一绑定，也不能断言所有普通提问均未触发扩展。

结论：64 已获得真实多轮可用证据，但仍有连接关联和未知配置组的独立失败；显式千问前缀是用户验证过的可用操作方式，而非保证所有问题都走同一路由的协议开关。HTTP Hook 无法控制 iOS 在请求发出之前的意图选择。

本次只补充维护记录，不改任何运行时或模块。下一步保持当前可用配置；研究 Shadowrocket 新连接时跨 Hook 的可靠关联能力及未知场景的安全结构诊断，避免再次以未证实的原生 ID、最新问题或伪造会话进行盲目修复。无目标 HTTP 请求时，应区分系统路由与代理脚本故障。原始日志和真实 ID 不提交。
