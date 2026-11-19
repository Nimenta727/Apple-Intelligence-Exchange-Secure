# 2026-11-19 — 浏览器技术社区 Apple Intelligence 报文分析与 WritingTools Compose 支持

## 需求与进展

用户明确要求**先从浏览器可访问的程序员社区文章、技术博客、独立研究与论坛寻找 Apple 请求分析**，不局限 GitHub，并把经审查的请求结构改进到 AIES。当前设备 WritingTools HTTP 日志中此前已经确认 User-Agent `WritingTools (iPad - Version 27.3.0)` 和同一个千问主接口；旧版 60 因 `WRITINGTOOLS_SKIPPED` 完全没有调用 DeepSeek。用户希望 Siri 与系统写作工具都由 DeepSeek 产生回答。

本轮沿用独立功能分支 `feat/dual-siri-writingtools-deepseek-20261119`；`main` 在最终 PR/CI 审查前不变。

## 网络研究：来源、判断与不确定性

- **唯一能直接给出国内千问私有请求/SSE 结构的公开详细资料**：`boitar/sair` 的 `docs/protocol_analysis.md` 和 `scripts/sair_adapter.js`；明确列出 `compose_selectedAndAllText`、`siri.tqa`、`siri.visualIntelligenceCamera`，以及 WritingTools 的 `{body,refinements}` 与 Siri 的 `{content,suggestions,summary}`。属于逆向分析、不是 Apple 官方。
- **Apple 官方**：Writing Tools 支持选中文字、Compose、语气调整、校对、摘要等不同功能；Apple WWDC25 介绍编辑器和富文本集成；WWDC26 “Bring an LLM provider” 说明框架有结构化请求、transcript、options 和流式 delta，但**该 API 不是中国区 Qwen 私有协议**。
- **技术博客/独立测量**：Eclectic Light Company 的 Apple Intelligence Report (AIR) 分析记录模型 prompt/template 与执行环境；不是 Qwen API 全量抓包；报告可能含用户私人文字。
- **安全研究**：Lumia Security / AppleStorm 指出 Siri 和第三方扩展有不同的数据流与隐私边界；不能假定一个拦截域名覆盖所有系统处理路径。
- **程序员社区**：V2EX 的 Apple 智能/千问扩展实际使用讨论、LINUX DO 的 iOS 27.3 实验，可证实 UI/功能反馈，**但未提供独立可复核的 `compose_selectedAndAllText` JSON 和 Qwen SSE 原文**。
- 浏览器跨站搜索没有找到可验证的第二份完整 Qwen 私有 WritingTools 抓包，因此不能宣称 SAIR 的 schema 被多源证实。所有链接和证据边界见 [社区与协议专文](../COMMUNITY_APPLE_INTELLIGENCE_REQUESTS_2026-11-19_ZH.md)。

## 本轮代码具体修改

1. `scripts/aies_siri_deepseek_v06.js`：移除 WritingTools 主接口的**无条件旁路**，改为 `parseWritingToolsRequest()` 严格解析，**只允许精确组名 `compose_selectedAndAllText`**、`WritingTools` UA、`stream:true`、已知根键、用户角色及纯文本 input；未验证写作组、工具输出、未知根字段或媒体依然拒绝，不复制它们给 DeepSeek。
2. 分开 Siri 与 WritingTools 的合成答案 JSON：Siri 保留 `content/suggestions/summary`；WritingTools 输出 `body/refinements`，所有可见答案位置都由通过校验的 DeepSeek 文本重新生成，正文前保留 `【DeepSeek · AIES】`。
3. 深度模型系统说明根据场景区分问答/文本创作，不要求模型自行构造 Apple 结构化 JSON；由 AIES 在代码中完成响应序列化。
4. `AIES_R1_*` 临时关联记录增加 `scene` 字段：必须与响应阶段的客户场景一致，不允许把一条 Siri 请求对应到另一条 WritingTools 写作正文；仍不采用 SAIR `SAIR_LATEST_PROMPT` 或跨会话最近请求猜测。
5. 已新增 WritingTools 正向/拒绝/跨场景隔离 mock 测试，并更新先前错误的 WritingTools 旁路测试假定。原有 Siri 解析和复杂注释 SSE 的安全逻辑不变。
6. 已创建 [跨站协议研究归档](../COMMUNITY_APPLE_INTELLIGENCE_REQUESTS_2026-11-19_ZH.md)，含来源可靠性表、请求/响应模型、已证实 vs 未证实边界和真机矩阵。

## 当前限制与安全说明

- 这是 **WritingTools Compose Beta**，不是所有 Apple 写作工具功能完全替换。系统级校对/摘要可能使用 Apple 自有模型、PCC 或不同 Qwen 响应组。
- 用户 WritingTools 的真正 `input` JSON、组名和 SSE 还未由其设备受控探针完成完整字段类型证实；SAIR 的样例只作为可测试假设，真实客户端可能继续报不兼容。
- 生成正文的来源前缀会进入粘贴或替换的写作内容；这是用户要求强制身份标识的副作用，后续可另设专门提示方案。
- 关联丢失时仍返回失败而非使用任何“最近一条写作内容”兜底；可用性有限，但跨 Siri / WritingTools 串答的隐私风险不能接受。
- 不能保证代理关闭/系统绕行后全部 Qwen 消失，也不能修改 Apple 系统 UI 的固定服务品牌。

## 后续规划

1. 审查测试和状态监控，确保旧版 Siri 的 schema、复杂注释兼容和 WritingTools 仅白名单成功不会相互干扰；运行仓库 GitHub CI，修复发现的真实回归。
2. 把 60 的三条脚本规则 pin 到**同一最终生产 JS commit**，同步测试/安装指南、README、架构、安全与发布约束。
3. 真机使用无隐私测试文字进行写作工具的千问创作，先确认真机 `response_configuration_group_id`/input 结构，再看 `WRITINGTOOLS_DEEPSEEK_PAYLOAD_READY` 和实际编辑器插入正文；Siri 继续用已经验证的测试问题回归。
4. 若真实 WritingTools 不用 `compose_selectedAndAllText` 或 SSE 骨架不同，新增**默认关闭且只记录字段/事件名的**结构探针；严禁用户上传完整私密选中文字、授权头或模型密钥。
5. 查清 Shadowrocket 主请求→响应临时身份丢失的具体宿主路径，确认可证明关联前保持失败关闭；遇到 Qwen 会话级 SSE Guard 中断复杂流程，单独通过真机观察再讨论修改，不在本 PR 扩大阻断范围。

## 验收口径

离线 CI 通过仅表示在 SAIR 逆向请求形状/合成 fixture 下代码执行安全；Apple 写作工具的真实显示、系统自有写作功能、各种高复杂上下文和不同 iOS 版本**必须明确标记为未完成真机验收**。
