# Changelog / 更新日志

## 2026-11-19 — 真机 Siri noRTI 标识确认与纯文本分支

- 用户通过 v2 本地探针确认真机 Siri 的 `response_configuration_group_id=siri.multimodal.noRTI`；主脚本原本返回 `REQUEST_DIAG_GROUP_UNSUPPORTED`，这是已证实的第一道阻塞。
- 仅对精确 `siri.multimodal.noRTI` 且 Siri User-Agent 的 POST 增加文本解析路径；对未知客户端、WritingTools、附件、媒体、未知输入字段和其他组名保持严格失败或旁路。
- 增加离线模拟的双钩子成功路径及拒绝样例，更新模块 Request/Response 的同一不可变脚本提交。
- 真实 noRTI 输入 JSON、上游 SSE、DeepSeek 账户 API 与 Siri 原生界面尚未实测成功；测试中仍只能反馈固定码，不可分享含凭据的完整抓包。


## 2026-11-19 — v0.6 Beta 组名诊断 v2（10 分钟，手动状态检查）

- 旧 180 秒探针的第二次运行会误取消采样。新版改为 **600 秒**，重复检查仅报告状态和剩余时间，不自动停止。
- 将旧版 ARM/RESULT 两键改成单个本机 v2 状态键，区分已开启、已观察 Siri、其他客户端、WritingTools、已捕获、已过期、存储写入失败。
- 只保存固定解析阶段、小型计数和受限格式的一个组名；组名仅在明确手动测试时本地展示并清理，普通网络日志不得输出正文/凭据/组名。
- 新增独立的本地 STOP 辅助脚本，刷新模块之外还必须更新 iPad 本地同名检查脚本；旧缓存键可由辅助工具逻辑清空。
- 扩充离线测试并在 CI 中检查两个辅助脚本语法；保持 Siri 场景白名单严格，真实 Siri 组名、DeepSeek 和 SSE 尚待真机验证。


## 2026-11-19 — v0.6 Beta 组名探针与 WritingTools 隔离

- 真机发现 Siri 两次、WritingTools 一次出现 `GROUP_UNSUPPORTED`，均为同一路径，无法凭 URL 判断应用场景。
- 新增严格的 WritingTools 请求/响应跳过逻辑，仅针对 User-Agent 符合已观察格式的范围，未知流量仍不放宽。
- 引入 `scripts/siri_group_probe_ONCE.js`：**必须通过 Script Test 手动运行两次**，180 秒内一次性采集 Siri POST 中格式受限的组名，仅保存在本机；主脚本只输出固定事件码。读取后清空逻辑存储，不保证物理删除。
- 不从日志读取/输出问题正文、Header、Authorization、Key，也不自动把采样组名加入允许列表。
- 增加 WritingTools、手动探针、有效期、只读/单次清除、响应阶段隔离等离线回归测试，更新脚本固定提交和安装/安全/调试说明。
- **真实 Siri 组名、DeepSeek API、SSE 与 Siri 原生界面结果仍待验收。**

## 2026-11-19 — v0.6 Beta 请求解析诊断修订

- 真机证据：目标 Siri HTTPS POST 命中 Shadowrocket Request hook，随后返回 `ERROR_UNSUPPORTED_SIRI_REQUEST`；未进入 DeepSeek 阶段。
- 增加固定 `REQUEST_DIAG_*` 细分原因码；仅输出常量，绝不输出用户问题、请求正文、Headers 或 Key。
- 在文本白名单内谨慎兼容单对象内容和 `text.value` 包装，未知 JSON 结构/媒体仍失败，不盲目允许任意格式。
- 增加安全回归测试并将模块双钩子 pin 到新脚本 commit；更新当前调试与维护文档。
- **真实 Siri 请求 JSON 内容、响应 SSE 和 DeepSeek 账户 API 调用仍须真机验收。**

## v0.6.0-beta — 初始当前主线版本

- 保留 Siri 原生界面文本问答的 DeepSeek 响应替换候选：一个 Shadowrocket 60 模块、一个双阶段运行脚本。
- 请求关联、固定 API、SSE 重建、基础错误处理和模拟测试已编码。
- 整理单一安装入口、使用/调试/架构/维护/安全/验收文档。
- 清理仓库中全部不再参与当前版本的实验代码、旧模块、旧测试、旧文档以及历史目录。早期内容仅通过 Git 历史可追溯，不再出现在主分支文件树中。
- 精简 CI，仅针对当前 Beta 的运行脚本、自动化回归和部署/文档一致性检查。
- **真实 Siri、DeepSeek API 模型支持、异常回退以及设备安全边界仍未验收；本版本不是稳定版。**
