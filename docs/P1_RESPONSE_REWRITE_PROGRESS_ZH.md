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

## P1-A 第二次实现：公开固定 HTTPS 响应源（2026-11-18）

**替代上文“40 先不导入”的旧条件：** 现在已经有可访问的公开 HTTPS 静态 fixture，40 可用于**仅该固定 URL**的短时测试，但仍然不能用于 Siri。

- 原始测试地址：`https://raw.githubusercontent.com/Nimenta727/Apple-Intelligence-Exchange-Secure/siri-deepseek-response-rewrite/tests/fixtures/p1-http-origin.txt`
- 不启用 40 时，预期 Safari 可看到 `AIES_P1_ORIGIN_UNMODIFIED`。
- 安装并启用 40，且本机 Shadowrocket CA 对 `raw.githubusercontent.com` 的 HTTPS MITM 生效时，预期 **同一 URL** 看到 `AIES_P1_RESPONSE_REWRITE_OK`。
- 日志预期出现 `[AIES_P1] REWRITE_ATTEMPTED`，但日志不能单独证明最终 Safari/Siri 显示。
- 如果返回 `AIES_P1_INVALID_FIXTURE`，说明脚本执行但收到的 response body 与预期不一致；若继续显示原文则响应阶段改写可能未生效；任何结果都只表示测试行为。

**安全边界：** 该主机是 GitHub 的共享内容域名，不是专用私有测试域名。开启对 `raw.githubusercontent.com` 的 MITM 代表对该主机的 TLS 处理范围扩大，虽然脚本 URL 已严格限定到单个文件，也不应长期保留。仅在测试时开启 40，完成后立即关闭并撤销该主机 MITM（确认其他模块没有保留此项）。不要在临时测试期间访问该主机的任何私有资源或敏感链接。

**真机操作采取单步确认，不能跳过：**
1. 先保持 00 开启、40 关闭，使用 Safari 访问原始测试 URL 并确认原文。
2. 仅确认原文后，才导入 `scripts/aies_response_rewrite_probe.js` 到本机 Shadowrocket 的 `Script/`，导入并启用 40，保持 10/20/21/30/31 关闭。
3. 同一 URL 复测，看 Safari 实际出现的文字，并在必要时提供固定标签日志。不能通过截图中的普通文本就推断 SSE 兼容。
4. 立即停用 40，继续保留 00，不将 40 用在真实 Siri。仍需 P1-B 真机 Siri SSE 与用户授权。

**当前未完成：** 这一步只验证一个普通 text/plain HTTPS response 的整体 body 改写。尚未验证真正 SSE body、streaming 的缓冲/分块、response 无法取得时的透传、跨阶段数据关联以及 Siri 原生 UI。实验成功后应继续设计受控合成 SSE fixture，再考虑真实 Siri。


## 2026-11-18：按用户要求跳过阶段性手工探针，交付集中安装的 50 Beta

用户明确要求不要逐项做 40/Safari 测试，要一次实现后再集中安装。研发侧据此新增：
- scripts/aies_siri_deepseek_beta.js：同一脚本的 HTTP Request 捕获 + HTTP Response 模型调用与 SSE 重建；不存在“模型失败→千问回答”的脚本级回退。
- shadowrocket/50-AIES-SIRI-DEEPSEEK-BETA.sgmodule：单模块安装，双钩子。
- tests/siri-deepseek-beta.test.js：可运行的双阶段 VM 和故障注入测试。
- docs/INSTALL_SIRI_DEEPSEEK_BETA_ZH.md：完整安装、密钥初始化和回滚说明。

原 P1-A 的 40 探针仍保留为研究文件，但**不是 Beta 安装前的必经步骤**。50 Beta 没有对真实 Siri 做过真机确认，且 Shadowrocket 脚本缺席/绕过时仍可能显示千问内容，因此只能作为安装后验收的实验候选，不能宣传为安全性已完全保证的成品。此前 P5 计划中的功能后重构仍是发布前必要工作；当前单文件脚本是为了提高 Shadowrocket 兼容性与部署简单性。
