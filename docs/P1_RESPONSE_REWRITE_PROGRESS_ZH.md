# P1 响应重写：首个开发提交与技术边界

状态：**P1-A 离线实现已提交，真实 Shadowrocket http-response 与 Siri 尚未测试。**

## 本次交付
- 分支：siri-deepseek-response-rewrite，不修改 main 的既有部署配置。
- src/response-rewrite.js：严格只接受实验性 12-event 合成 SSE，重建每个包含 AI 回答的节点，避免保留模拟千问文本；离线测试使用 src/sse.js 的自有生成数据。
- scripts/aies_response_rewrite_probe.js：仅匹配 aies-probe.invalid/__aies_rewrite_fixture 的 http-response smoke-test 入口；把来自该域名的模拟 SSE 响应主体替换为固定 ASCII 标记。**这个脚本目前不是 Siri SSE 重写器，也不能用于真实域名**。
- shadowrocket/40-AIES-RESPONSE-REWRITE-P1.sgmodule：仅供人工检查的虚构域名规则，不启用真实千问 MITM/拦截。
- tests/response-rewrite-p1.test.js：重写语法、字段残留、故障输入及宿主入口的离线测试。

## 不能误判的事实
- 当前没有为 .invalid 测试域名提供可用的 HTTPS 上游 fixture 服务。Safari 直接访问它不能自动产生 http-response 响应事件。因此 **40 先不导入、先不启用**，更不能因此关闭当前用户的 00 基线。
- Offline VM 通过仅说明纯 JS 逻辑成立，不能证明 Shadowrocket 在真实 SSE 流式响应下可捕获完整 body，也不能证明 Siri UI 可以显示。
- 不要将 40 的测试 URL 替换成 prod-yabuli.qianwen.com；真实 Siri 测试需要另行设计并在用户明确授权下进行。
- 响应重写失败的 $done 行为、流式处理、原响应透传等都是 P1 真机门槛。未解决前不宣称“答案一定来自 DeepSeek”。
- 为简化最初实验，本次只建立最小通路和严格 synthetic fixture。真正的 Siri SSE 格式必须用安全脱敏结构资料确认，不可将本项目自行合成的事件当作官方完整规范。

## 下一步
1. 建立受控的非真实域名 HTTP-response fixture 机制（本地模拟服务或等效可控源），验证 Shadowrocket P1 response hook 是否实际接收到并修改响应。
2. 证实响应替换能力、流式/压缩限制后，再经独立授权规划真实 Siri 固定假回答的实验。
3. 固定回答真机验收成功后才进入 DeepSeek API Adapter 集成；随后按正式计划完成安全来源验证、P5 必做简化重构。
