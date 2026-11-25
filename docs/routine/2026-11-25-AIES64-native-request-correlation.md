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
