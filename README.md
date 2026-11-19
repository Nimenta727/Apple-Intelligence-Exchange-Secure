# Apple Intelligence Exchange Secure (AIES)

**让 Siri 原生界面尝试显示 DeepSeek 生成的文本回答。**

> **v0.6.0-beta · 真机已观察请求钩子命中，端到端仍待验收**  
> Shadowrocket 脚本及离线模拟测试已完成。真实 Siri SSE、原生界面接受情况、DeepSeek API 实际调用及系统级回退保护**尚未验证**。本项目不是 Apple、Shadowrocket 或 DeepSeek 的官方产品，也不是稳定版。

[English](README_EN.md) · [安装](docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md) · [使用](docs/USER_GUIDE_ZH.md) · [调试](docs/DEBUGGING_ZH.md) · [文档中心](docs/README.md)

> **2026-11-19 真机进展**：已观察 Siri POST 被 Request hook 拦截，但脚本返回 `ERROR_UNSUPPORTED_SIRI_REQUEST`，未到 DeepSeek 阶段。本次添加不记录敏感数据的 `REQUEST_DIAG_*` 分类、少量严格纯文本包装兼容和离线回归测试。**现已确认组名，但真实输入 JSON 和响应 SSE 结构仍需复测，不能认定问题已解决。** 重新导入/刷新 60 模块才能使用新固定脚本，详见[调试文档](docs/DEBUGGING_ZH.md)。

## 2026-11-19：Siri 组名已确认，真实文本结构仍待适配

**11:14 真机进展：** 新日志确认 `NORTI_SHAPE_ROOT_FIELDS` 与 `NORTI_SHAPE_ITEM_WRAPPER_FIELDS`。原始 PacketTunnel 不包含安全可用的字段名称；因此新增**完全本地、手动开启、只采集字段名及数据类型**的 [noRTI 结构探针](docs/SIRI_SCHEMA_PROBE_ZH.md)。此工具不采集字段值、问题正文或认证信息；实际解析仍失败，DeepSeek/Siri 端到端尚未修复。需要先刷新 60 模块，再下载 [本地新脚本](scripts/siri_schema_probe_ONCE.js) 手动运行。

最新日志确认 Siri 与 WritingTools 共享同一个接口，并且二者均可能触发 `REQUEST_DIAG_GROUP_UNSUPPORTED`。已在 iPad 实际捕获 Siri `response_configuration_group_id=siri.multimodal.noRTI`。现仅为**匹配 Siri User-Agent、受限纯文本输入形状**的这一精确组名加入离线验证过的支持；媒体和未知字段仍被拒绝。WritingTools 继续跳过，**端到端 Siri/DeepSeek 功能尚未验证**。

**如需再次诊断（v2）**：先[刷新 60 模块](shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule)，同时**用新版覆盖 iPad 本地同名 JS**。手动测试 [`siri_group_probe_ONCE.js`](scripts/siri_group_probe_ONCE.js) 一次开启 **600 秒（10 分钟）**，然后实际问 Siri 一次，再手动测试同一个脚本读取结果或查看剩余时间。反复检查不会取消采样；需要取消时专门运行 [`siri_group_probe_STOP_ONCE.js`](scripts/siri_group_probe_STOP_ONCE.js)。不使用 event/cron/HTTP 自动规则，不提交完整 PacketTunnel 日志，已有 API Key 不需重设。详细步骤见[本地诊断指南](docs/SIRI_GROUP_PROBE_ZH.md)。

## 项目目标

- **界面**：保留 Siri 原生界面，只面向特定 Siri 文本问答场景。
- **答案**：脚本正常介入时，尝试用 DeepSeek 的回答重建 Siri SSE，而不是显示千问生成的内容。
- **数据取舍**：原始问题**可能同时发送到千问和 DeepSeek**；不提供“千问零出站”保护。
- **故障**：脚本能处理的失败尝试返回错误，不主动以千问答案代替 DeepSeek。**若 VPN、MITM、脚本未运行或 Siri 自身回退，仍可能出现千问答案；因此无法保证任何时候都只显示 DeepSeek。**

## 安装入口

**目前只有一个 Shadowrocket 模块：**

[60-AIES-SIRI-DEEPSEEK-V06.sgmodule](shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule)

复制到 Shadowrocket 的模块导入功能：

```text
https://raw.githubusercontent.com/Nimenta727/Apple-Intelligence-Exchange-Secure/main/shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule
```

安装前请阅读[完整安装与回滚指南](docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md)：

1. 备份 Shadowrocket 配置，**停用已经安装在设备上的任何同域 REJECT 或其他冲突模块**。
2. 本机准备并信任 Shadowrocket 所需的 CA，只为目标主机启用 HTTPS MITM。不要导入别人提供的 CA 私钥。
3. 使用设备本地的一次性脚本将自己的 DeepSeek API Key 写入 `SAIRS_DEEPSEEK_API_KEY`。**不要在聊天、GitHub、URL 或日志里提供密钥**；如果 Shadowrocket 不支持已确认的本地脚本执行方式，应暂停而非用不安全方式传 Key。
4. 启用模块后只用非隐私的测试问题检查 **Siri 原生界面**，而不是根据脚本日志判定成功。
5. 失败时立即停用模块，恢复备份配置。完整错误码和处理顺序见[调试手册](docs/DEBUGGING_ZH.md)。

**重要兼容性提示**：当前运行脚本使用的 `deepseek-flash` 已列在 [DeepSeek 官方 Chat Completions API](https://api-docs.deepseek.com/api/create-chat-completion/) 支持列表中，但用户账户的实际 API 调用、费用/额度和 Siri 端到端效果仍未验证。

## 工作原理

```text
Siri 文本请求
  → Shadowrocket HTTP Request hook（解析并关联问题）
  → 原始上游（可能由千问处理）
  → Shadowrocket HTTP Response hook（预检 SSE）
  → DeepSeek Chat Completions（使用设备本地 Key）
  → 重建回答字段并尝试替换响应
  → Siri 原生界面（是否接受尚待真机验证）
```

模块使用同一个固定 Git 提交中的脚本处理请求和响应；它没有后台服务、开放面板或任意模型路由配置。仅支持已识别的文本 JSON 与 SSE 事件，遇到未知结构时拒绝改写。详情见[架构说明](docs/ARCHITECTURE_CURRENT_ZH.md)。

## 项目目录

```text
shadowrocket/  唯一当前 sgmodule
scripts/       运行脚本、设备本地 Key 初始化与清除脚本
tests/         当前版本模拟测试和合成 fixture
tools/         文档、模块及安全静态检查
docs/          当前安装、调试、安全、维护、发布文档
```

源码修改与版本 pin 更新请阅读[维护流程](docs/OPERATIONS_ZH.md)。开发环境 Node.js >= 20：

```bash
npm run check
```

## 文档和当前状态

- [完整文档中心](docs/README.md)
- [使用与回滚](docs/USER_GUIDE_ZH.md)
- [故障排查与错误码](docs/DEBUGGING_ZH.md)
- [代码架构](docs/ARCHITECTURE_CURRENT_ZH.md)
- [安全与隐私](docs/SECURITY_CURRENT_ZH.md)
- [维护、升级及发布](docs/OPERATIONS_ZH.md)
- [当前验证状态](docs/CURRENT_STATUS_ZH.md)
- [发布验收门槛](docs/RELEASE_CHECKLIST_ZH.md)

**当前结论**：代码和模拟验证不等于可用性验证；真实 Siri、DeepSeek 模型、协议兼容性、异常回退及本地存储生命周期仍须测试。本项目遵循 [MIT License](LICENSE)，参考 [boitar/sair](https://github.com/boitar/sair) 的公开协议研究并保留出处。

> **最新真机诊断（11:06）**：`siri.multimodal.noRTI` 已经通过组名检查，但后续两次均出现 `REQUEST_DIAG_INPUT_UNSUPPORTED`，尚未调用 DeepSeek。为了避免盲目放宽多模态请求，本次进一步增加 `NORTI_SHAPE_*` 固定分类码。刷新 60 模块后问 Siri 一次，仅反馈固定错误码；详见[调试指南](docs/DEBUGGING_ZH.md)。
