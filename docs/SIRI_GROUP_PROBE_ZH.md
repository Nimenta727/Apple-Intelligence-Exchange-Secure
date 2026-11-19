# Siri 场景组名：本地诊断 v2（10 分钟）

> 2026-11-19 诊断改进版。真机已观察 Siri 的 REQUEST_DIAG_GROUP_UNSUPPORTED，现已在 iPad 真机捕获 `response_configuration_group_id=siri.multimodal.noRTI`，这份指南保留作后续同类诊断。本工具仅用于定位，不自动放宽白名单，不证明 DeepSeek/SSE/Siri UI 已经兼容。

## 与旧版相比

- 旧版 180 秒，重复运行会取消采样；v2 **600 秒（10 分钟）**，重复运行只**检查状态**，绝不意外取消，不用等满 10 分钟。
- 本机显示**剩余秒数**、**Siri 命中次数**、**WritingTools 命中次数**、**其他客户端命中次数**、**最近解析阶段码**，可判断“没有实际问 Siri”“被 WritingTools 命中”“真正解析失败”“过期”。
- 成功捕获时只在本机暂存一个经格式/长度限制的场景组名；只在再次手动测试时显示一次 GROUP_ID 并清理。主 HTTP 脚本绝不输出组名或请求正文。
- 取消有**独立 STOP 辅助脚本**，不会因查看状态而停用。
- 两个辅助 JS 都只是本地 Script Test 工具，不是 HTTP、event 或 cron 自动钩子。

## 一次性准备

1. 备份 Shadowrocket 配置；确保 VPN、MITM 只针对 prod-yabuli.qianwen.com，并停用冲突规则。
2. 更新 [唯一 60 模块](../shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule)，确认双钩子固定脚本 SHA 为 **e79d05c3b8ef788abc92d3f1626426914c9dc7ce**。模块原始 URL：

   https://raw.githubusercontent.com/Nimenta727/Apple-Intelligence-Exchange-Secure/main/shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule

3. **特别重要：还要更新 iPad 本地脚本文件。** 新版 [siri_group_probe_ONCE.js](../scripts/siri_group_probe_ONCE.js) 必须替换之前存在 Script 文件夹的旧版同名文件。**刷新 60 模块不会更新你手动保存的本地 JS 文件。**
4. 可选保存新 [siri_group_probe_STOP_ONCE.js](../scripts/siri_group_probe_STOP_ONCE.js)，用于明确取消。
5. 与此前验证 Key 的流程相同，通过 Shadowrocket 的「脚本测试」运行本地辅助文件。若新增脚本表强制要求类型，可保存成**禁用**的 event，绝不启用自动执行。**不需要重新填写或修改 DeepSeek API Key。**

## 正常使用：两次检查，中间向 Siri 提问

### 第一次手动脚本测试：开始

运行本地 siri_group_probe_ONCE.js，应看到：

- [AIES_SIRI_GROUP_LOCAL] ARMED_600_SECONDS
- [AIES_SIRI_GROUP_LOCAL] PERSISTENCE_ROUNDTRIP_OK

这只能证明**手动测试的执行环境中**持久存储读写成功；Request Hook 与手动测试环境是否共享状态仍要通过真机验证。

### 10 分钟内发起 Siri 文本问答

立即向 Siri 真正提一个**不包含私人信息**的问题，例如“什么是光合作用？”。不需要等 600 秒，也不要把 WritingTools 当作 Siri。提问成功或失败都可以检查诊断。

### 第二次手动测试：读取/检查

再次运行**同一个** siri_group_probe_ONCE.js：

**成功采样时：** 在本机看到 [AIES_SIRI_GROUP_LOCAL] GROUP_ID=...，另有命中计数和 LAST_STAGE=GROUP_CAPTURED。读取前脚本先清空该组名的逻辑存储。请先检查此标识是否像凭据或个人身份标识；只在确认无敏感信息时才考虑分享。

**没有捕获但窗口仍有效：** 显示例如：

- ACTIVE_REMAINING_SECONDS=532
- SIRI_REQUESTS_SEEN=0
- WRITINGTOOLS_SEEN=0
- OTHER_CLIENTS_SEEN=0
- LAST_STAGE=NONE
- STILL_ARMED

此时**采样仍在运行，不需要重新开启**。若 SIRI_REQUESTS_SEEN 大于零但没抓到组名，LAST_STAGE 会提供 JSON_INVALID、GROUP_MISSING、GROUP_ID_UNSAFE 等固定诊断分类。若只看到 WRITINGTOOLS_SEEN 或 OTHER_CLIENTS_SEEN 增加，不代表 Siri 已命中。

**过期时：** 显示 EXPIRED_CLEARED 或状态无效时 INVALID_OR_EXPIRED_STATE_CLEARED；不会在这次检查中自动重新开启。再运行一次才会重新开始 10 分钟。捕获成功后的结果只会在本机逻辑保留最多 10 分钟，等你手动读取。

## 明确取消（可选）

如需中止诊断，**只**手动执行 [siri_group_probe_STOP_ONCE.js](../scripts/siri_group_probe_STOP_ONCE.js)。

正常输出 [AIES_SIRI_GROUP_LOCAL] PROBE_STOPPED_AND_CLEARED。它清除诊断存储和旧版缓存键，不会删除 DeepSeek API Key。逻辑清空不构成底层物理擦除证明。

## 主脚本日志中可能出现的安全诊断码

| 代码 | 含义 |
|---|---|
| SIRI_PROBE_SIRI_REQUEST_SEEN | 已开启的探针观察到一个 Siri User-Agent 目标请求，但不一定拿到了组名 |
| SIRI_GROUP_CAPTURED_LOCAL | 一个符合限制的场景组名已经写入本机状态；具体值**不在 HTTP 日志中** |
| SIRI_GROUP_PROBE_UNSAFE_ID | 场景组名不满足保守格式限制，因此不保存其值 |
| SIRI_PROBE_WRITINGTOOLS_SEEN / WRITINGTOOLS_SKIPPED | WritingTools 被识别并跳过 DeepSeek 路径 |
| SIRI_PROBE_OTHER_CLIENT_SEEN | 命中目标 URL 的客户端未匹配 Siri User-Agent |
| SIRI_PROBE_STORE_WRITE_FAILED | 目标 HTTP Hook 无法写入诊断状态，不可将手动脚本的读写自检作为跨运行环境保证 |

## 数据保护与真实性边界

- 不采集、打印或上传用户问题正文、HTTP 原始请求、Headers、Authorization、Cookie、Private-Access-Token、DeepSeek Key 或 SSE。
- 仅暂存固定状态码、有限计数和**最多一个受限格式的组名**。组名仍可能带敏感含义，人工检查之前不能认为绝对安全。
- **不要上传完整 PacketTunnel 日志、数据库或包含 Bearer 的截图。** 只需要分享本地脚本测试里 [AIES_SIRI_GROUP_LOCAL] 前缀的几行；如果 GROUP_ID 看起来像令牌或个人信息，请遮挡。
- 当前 iPad 已在真实问答中观察到一次 `SIRI_REQUESTS_SEEN=1`、`LAST_STAGE=GROUP_CAPTURED` 和本地读取后的清空，证明本设备该轮状态共享确实工作；其他设备仍需验证。若始终 SIRI_REQUESTS_SEEN=0，应检查模块版本、时间与主日志，不要反复导出敏感流量。
- 精确的 `siri.multimodal.noRTI` 现在仅在 Siri UA、POST 和严格纯文本输入结构符合时通过第一关；未知 Siri 场景组仍被拒绝，**不必为这个已确认的组名再次运行探针**。真实 API、SSE 重建、Siri 原生 UI、系统级千问回退都尚未通过验收。

其他：[调试手册](DEBUGGING_ZH.md) · [当前状态](CURRENT_STATUS_ZH.md) · [安装与回滚](INSTALL_SIRI_DEEPSEEK_V06_ZH.md) · [安全边界](SECURITY_CURRENT_ZH.md)。
