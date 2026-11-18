# Changelog / 更新日志

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
