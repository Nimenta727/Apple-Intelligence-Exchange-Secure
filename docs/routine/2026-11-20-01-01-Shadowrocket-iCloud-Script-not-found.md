# 2026-11-20 01:01 — Shadowrocket 本地 Script Test 正常但 62 HTTP Hook 提示 cloud driver not found

## 证据核对

用户分享当次设备控制台日志：
- 远程 60 的固定 JS URL `raw.githubusercontent.com/.../7a698fba.../aies_siri_deepseek_v06.js` 于 00:43:15 报 `NSURLErrorDomain Code=-1001 请求超时`，因此不能依赖该 GitHub Raw 的当次获取。
- 本地 62 在 00:57:41 四次报告 `script try to read js file in cloud driver`，紧接 `script js file is not found => aies_siri_deepseek_v06.js`，对应四条 Hook 的本地运行时未被找到。
- 00:59 与 01:01 两次手动 Script Test 能触发 `Script/aies_siri_deepseek_v06.js` 的测试环境而无诊断输出，但主脚本缺少 `$done` / HTTP 请求上下文时会在入口静默退出，**不能当成实际 HTTP Hook 加载成功**。
- 上传的 `PacketTunnel-20261120010000.log` 已程序化筛查 1,973 行：启动时配置汇总 `script:4`，目标 Qwen MITM 证书 `trusted => 1`；01:00:30 出现 Siri `/v1/sessions/responses`，01:00:45 与 01:01:02 出现会话级 `/v1/sessions/{id}/responses`。此段没有 `[AIES_V06]`、`script exception` 或 `script js file is not found`。**能确定请求经过隧道，不可据此确定该段是否正确执行过业务 Hook。**
- 不上传任何 PacketTunnel 原文、私人问题、认证 Header、Key、会话 ID 或设备网络信息到 GitHub。

## 本次调整

1. 在 `shadowrocket/62-AIES-SIRI-DEEPSEEK-V06-LOCAL.sgmodule` 的说明里明确：Shadowrocket 本次实际通过 `cloud driver` 读取本地文件，所以应核对 iPad「文件 → iCloud 云盘 → Shadowrocket → Script → aies_siri_deepseek_v06.js」的真实文件存在及下载状态；不要只依靠“我的 iPad”目录或 Script Test 判断。
2. 在 `docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md` 增加完整的文件定位、检查 iCloud 同步、确保 .js 无 .txt 后缀、手动下载、仅开启 62、应用配置、日志验证路径。若所在版本不识别本地文件，不擅自推荐未经证实的路径参数。
3. 没有改变已通过 107 项测试的 60 JS 运行时或 62 四条 HTTP Hook；**本次只纠正安装说明与故障分类**。
4. 澄清来源风险：脚本因下载失败而未运行时，原生 Qwen 回复可能直接显示；不能承诺系统级 DeepSeek 独占。

## 下一步规划

1. GitHub PR 与 CI 核对 module / docs 改动，合并仅在检查通过后进行。
2. 用户在 iPad 打开文件 App 的 **iCloud 云盘 / Shadowrocket / Script**，确认完整的 `aies_siri_deepseek_v06.js` 文件是已下载状态，并且当前真正启用的是 62，而不是 60/61。
3. 只提一个不涉及隐私的 Siri 问题，观察是否首次出现 `[AIES_V06] REQUEST_CAPTURED` 或固定的 `ERROR_*`；缺失则继续只针对本机文件路径和模块 Hook 命中排查。
4. 只有本地 HTTP Hook 加载成功后，才重启两轮/三轮 DeepSeek SSE 验收；每轮需用户实际观察 `【DeepSeek · AIES】` 前缀。
5. 如果 iCloud 目录与下载状态正常仍然 `not found`，整理 Shadowrocket 具体版本与文件存储模式，形成经过真机确认的独立路径兼容变更；不能靠猜测添加路径前缀。

## PR #35 合并及 CI 核验

- [PR #35](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/35) 已成功合并至 `main`，merge commit `c1e87ef316ec70fa8dc4d7ef3840373ad223c04c`。
- [GitHub Actions](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/actions/runs/44573294518)：**107/107 tests passed, 0 failed**。本轮仅更新 62 模块内说明和安装/维护文档，没有修改任何实际请求/响应 Hook 或 DeepSeek 模型交互代码。
- 下一步由用户先确认 iCloud 云盘实际目录和已下载的 JS 存在，再仅启用 62 并检查 **HTTP Hook** 是否出现 `[AIES_V06]` 固定码。如果文件确实存在仍报告 cloud driver `not found`，再针对 Shadowrocket 当前版本做具体路径适配，不重新采集 Siri 协议或推断模型出错。
