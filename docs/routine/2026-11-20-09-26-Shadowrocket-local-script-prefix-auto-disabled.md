# 2026-11-20 09:26 — 修复 62 LOCAL 开启后脚本开关自动关闭 / 本地 JS not found

## 来自用户设备的观察
用户确认 iPad 的 `aies_siri_deepseek_v06.js` 已保存在 `iCloud 云盘/Shadowrocket/Script`，手动执行 `Script/aies_siri_deepseek_v06.js` 的 Script Test 运行结束；但启用 `AIES 60 LOCAL - Siri DeepSeek v0.6 Beta` 模块后，脚本 UI 开关自动关闭。此前 PacketTunnel 日志多次显示 `script try to read js file in cloud driver` 和 `script js file is not found => aies_siri_deepseek_v06.js`。用户已经排除“未操作 Siri”及“iCloud 文件不在指定文件夹”的常见原因。

**新证据**：Shadowrocket 发布的本地脚本实例（[Shadowrocket News](https://t.me/s/shadowrocketnews/973)）让用户将 `header.js` 保存到 `iCloud 云盘/Shadowrocket/Script`，并在 HTTP Hook 中写 `script-path=Script/header.js`、`enable=true`。旧版 AIES 62 四条 Hook 却写成 `script-path=aies_siri_deepseek_v06.js`，缺少 `Script/` 前缀和显式启用属性，确实不同于已公开的工作示例。

## 本次改动
1. 修改 `shadowrocket/62-AIES-SIRI-DEEPSEEK-V06-LOCAL.sgmodule`，将四条 Request/Response Hook 的 `script-path` 由不带目录的脚本名改成 **`Script/aies_siri_deepseek_v06.js,enable=true`**。请求 URL、MITM、超时、max-size、内容拦截规则、60/61 功能逻辑均未修改。
2. 更新 `tools/check-docs.js`，要求本地 62 四条 Hook 都使用确切的 `Script/` 路径并显式启用，同时仍保持除 runtime/enable 外的匹配参数与 60 四条一致。
3. 更新 `tests/siri-deepseek-v06.test.js` 的本地模块断言，覆盖四条 Hook 的目标 Script 路径与 enable 标志。
4. 更新 `docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md`，明确前一版 bare filename 写法已过时、刷新模块方式、如何判定修复以及仍需真机验证的边界。

## 风险与边界
- `Script/` 与 `enable=true` 的具体语法有公开示例支持，但**用户设备中“开关自动关闭”的唯一根因尚未由新的真机日志证实**。Shadowrocket 模块优先级、iCloud 同步或当前配置的 UI 规则也可能影响开关。不能把此次改动说成在用户设备已验证修好。
- 本次未修改 DeepSeek Key 或已通过 CI 的 SSE 续答逻辑；脚本能够运行之后仍须验证 Siri UI 的每一轮实际显示 `【DeepSeek · AIES】`，而不是只看模块已启用。
- 不上传 PacketTunnel 原始日志、访问凭据或问答内容至仓库。

## 下一步规划
1. 在 PR 跑全量 CI；检查四条 Hook 与 60 语义一致、Script/ 路径和 enable 标记齐全、所有文档链接有效。只有通过才合并。
2. 用户重新导入/刷新 **62 LOCAL 模块**（现有已安装模块不会自动变更），确保 60、61、旧同域 Hook 关闭，JS 继续放在 iCloud Script 文件夹且文件下载完整。
3. 先只测试配置加载：重新应用配置，检查脚本开关不再自动关闭并且没有 `js file is not found`。随后单轮无隐私 Siri 请求，日志必须出现 `[AIES_V06] REQUEST_CAPTURED` 或明确的固定错误码，才能继续检查回答。
4. 如果自动关闭依然复现，关闭 62；在备份过的活跃 `.conf` 文件原生 `[Script]` 段添加相同四条本地规则，严格避免重复 Hook；收集脚本列表截图或固定错误码来确认是模块优先级/编译的冲突还是 iCloud 文件加载问题。
5. 真机完成单轮、两轮、三轮 Siri UI 标记验收前，仍维持 Beta，不宣传完整多轮或防止所有 Qwen 穿透。

## PR #36 合并结果与下一步（2026-11-20）

- [PR #36](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/pull/36) 已合并到 `main`，merge commit `03273a2d4848a098f90039a80c3129331db91013`。
- [GitHub Actions 全量测试](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/actions/runs/44653967264)：**107 tests / 107 pass / 0 fail**。本轮只更新了 62 LOCAL 的脚本路径/启用标记、静态测试与文档，没有修改 DeepSeek 模型逻辑。
- **用户需要主动更新已安装的 62 模块文本**，目前 iPad 上旧模块可能仍缓存 `script-path=aies_siri_deepseek_v06.js`；必须看四条规则实际变成 `script-path=Script/aies_siri_deepseek_v06.js,enable=true` 才算采用本次修复。
- 下一步先验证**启用模块后脚本列表开关是否保持开启**、`js file is not found` 是否消失。只在加载层恢复后再单问无隐私 Siri 问题，读取 `[AIES_V06]` 阶段码。若依然自动关闭，停用 62 改为直接写活跃配置的 `[Script]`，不再同时叠加 AIES 模块；仍需真机验证。
