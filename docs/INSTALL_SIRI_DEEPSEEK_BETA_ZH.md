# AIES Siri → DeepSeek 可安装完整测试版（50）

> 2026-11-18。状态：**功能集成 Beta，尚未通过真实 Siri 原生界面验收。** 用户要求一次性开发，后续集中安装测试；不再逐项开展 40 等无关探针。

## 一、核心目标
保留 Siri 原生界面；指定 Siri 文本问答的最终 AI 答案必须来自 DeepSeek，不允许在脚本中失败后回退为千问答案。**原始请求可以发送到千问**，因此本版本不声称零数据出站。脚本未执行、VPN 断开等宿主级情况仍可能出现原生千问答复，不能承诺系统层面绝对保证。

## 二、代码结构
- scripts/aies_siri_deepseek_beta.js：单一脚本包含两阶段运行逻辑。HTTP Request 阶段验证 URL/POST/文本场景，存储短期问题及随机关联标识，向上游原请求加入随机 X-AIES-Request-ID 头。
- HTTP Response 阶段先依据关联标识取得对应文本（也支持当前 $request.body 直接解析），从本机持久存储读取 DeepSeek Key，固定 HTTPS 向 DeepSeek 发起模型请求。
- DeepSeek 成功时，识别已知 Siri SSE 事件序列，重建所有 AI 内容字段，并通过 $done 尝试替换响应。模型失败、无 Key、未知 SSE、上下文丢失时尝试返回 502 错误响应；脚本代码没有将千问回包作为成功路径。
- shadowrocket/50-AIES-SIRI-DEEPSEEK-BETA.sgmodule：单次导入配置，两条 request/response 脚本钩子，使用固定 GitHub 分支的 Raw 文件路径。该路径会随分支代码更新，应在生产环境锁定经审计的 commit/tag。
- tests/siri-deepseek-beta.test.js：离线环境模拟双阶段、并发会话、DeepSeek 成功/失败、SSE 异常、Key 与 URL 等场景。

## 三、最终安装使用（集中一次测试）

**模块导入地址：**

https://raw.githubusercontent.com/Nimenta727/Apple-Intelligence-Exchange-Secure/siri-deepseek-response-rewrite/shadowrocket/50-AIES-SIRI-DEEPSEEK-BETA.sgmodule

**脚本地址（模块中自动引用）：**

https://raw.githubusercontent.com/Nimenta727/Apple-Intelligence-Exchange-Secure/siri-deepseek-response-rewrite/scripts/aies_siri_deepseek_beta.js

1. 在 Shadowrocket 备份当前配置，确认本机 CA 已安装且 HTTPS MITM 功能正常。50 仅 MITM 目标千问域名；MITM 本身会扩大本机信任边界。
2. **关闭旧 00 REJECT 阻断模块**，因为用户现已同意原始问题经过千问且旧 REJECT 会阻止新响应改写；保留 00 文件用于回滚。关闭 10/20/21/30/31/40 等旧实验模块，不要两个版本同时接管。
3. 将你的 DeepSeek API Key 仅在本机写入 Shadowrocket $persistentStore，键名为 SAIRS_DEEPSEEK_API_KEY。仓库现有 scripts/provision_key_ONCE.js 是一次性本地脚本模板，必须只在设备上临时填写真实 Key，验证支持手工运行后执行；绝不将填写后的脚本、Key、CA 私钥传到聊天或 GitHub。可使用 scripts/clear_key_ONCE.js 清除 Key。
4. 导入并启用 50 模块，保持 Shadowrocket VPN 已连接，确认两条脚本规则和 MITM 已生效。
5. 用不含隐私的文本向 Siri 提问，观察其**原生界面**最终出现的内容；出现完整 DeepSeek 答复才算功能候选通过。仅看到 DEEPSEEK_RESPONSE_ATTEMPTED 日志不等于 Siri 接受。
6. 一旦发现 Siri 展示千问内容、长时间无响应、未命中脚本、SSE 报错或重复串话，将其记为失败，关闭 50；恢复旧 00 模块，不需要反复做以前的 Safari/30/31/40 测试。

## 四、安全与可靠性边界
- 只匹配固定千问 HTTPS host/path，且仅处理 Siri 文本 POST；不处理图片、写作和任意其它网址。
- API 端点固定为 https://api.deepseek.com/chat/completions，模型为 deepseek-flash；要根据官方更新验证模型是否仍可用。
- 所有诊断日志仅包含阶段标记，不输出请求文本、回答、Authorization 或 Key。
- 每次请求使用随机短期关联标识，避免上游 SAIR 的“最近一条提问”全局缓存造成串话。临时问题会写入 Shadowrocket 本地持久存储，设 45 秒逻辑过期，并在读取后尝试清空。**存储是否加密未证实；脚本异常或请求无响应可能留下未及时清理的本地记录。** 此行为仍须在 P5 优化。
- 未识别的 SSE 事件、响应体不完整、压缩/分块不支持会导致错误，而非自动展示千问答案；但如果 Shadowrocket 的钩子压根没运行或 Siri 采用其他网络通道，则此脚本无法阻断系统级千问回退。
- 目前只依据上游 SAIR 公开的部分事件结构和项目自有合成 fixture 开发，**没有真实 Siri SSE 结构的完整可验证规范**，因此无法预先保证真机成功。
- 如发现无法保证所有最终 AI 输出均由 DeepSeek 提供，该版本只能是实验 Beta，不能标为正式完成。

## 五、开发与后续优化
- 开发者完成 GitHub Actions 自动测试，用户只需要最后一次真实 Siri 集中安装验收。
- 若真机成功，继续做 P4 脚本故障时的模型来源审计，再做 P5 必须完成的结构简化、敏感数据最小化、配置唯一化和性能优化，然后 P6 发布审查。
- 若真机失败，直接依据可脱敏的错误阶段和可见症状修复，不重新要求 30/31/40 的重复探针。
- 新版全部隔离在 siri-deepseek-response-rewrite 分支的 Draft PR，main 的旧 00 安全配置保持未改动。
