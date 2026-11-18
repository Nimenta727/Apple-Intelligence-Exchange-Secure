# AIES v0.6 维护、升级与发布流程

> `main` 仅维护当前 v0.6 Beta 实验路线；未完成的 Siri 真机验收与来源保证不得因合并代码而标记通过。

## 日常开发

```bash
git clone https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure.git
cd Apple-Intelligence-Exchange-Secure
git switch main
npm run check
npm run docs:check
```

需要 Node.js 20 或更高版本；CI 当前使用 Node 22。**不需要旧式 build/bundle 生成步骤**。

维护文件：
- `scripts/aies_siri_deepseek_v06.js` — 唯一运行脚本。
- `shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule` — 唯一模块。
- `tests/siri-deepseek-v06.test.js` 与 `tests/fixtures/siri-sse.js` — 纯模拟回归，不代表真实 Siri。
- `tools/check-docs.js` — 文档链接、部署钩子、版本与冗余文件检查。
- 根目录 README、CHANGELOG、CONTRIBUTING 与 `docs/` — 现行文档。

## 改动与回归步骤

1. 从 `main` 创建开发分支；明确当前修改解决的错误码和验收前提。
2. 修改运行脚本时一并补充正向和失败测试，禁止将真实问题、Authorization 或 Key 写进测试 fixture。
3. `npm run check` 检查语法、自动测试与文档/安装文件一致性；对安全扫描出现的异常必须修复，不能关掉检查。
4. **固定脚本版本**：先提交已测试的 JS，获得真实 40 位提交 SHA；将模块的 Request 和 Response 两条 `script-path` 都修改为该提交，再跑 CI 并提交模块。
5. 同步更新中英文 README、CHANGELOG、安装、调试、安全与发布记录；版本说明只写真正得到证据的功能。
6. 真实设备用非隐私问题验收，记录 Shadowrocket / OS 版本和脱敏错误码。没有设备证据就保持 Beta。

## 代码审查重点

- 固定 URL/path、方法、Siri 文本类型，未知 SSE 不透传千问。
- DeepSeek API 仅访问固定 HTTPS 地址；Key 只在设备本地，不写日志或远端配置。
- 超时、HTTP 错误、异常与重复回调只能尝试安全失败；不要增加自动千问回退。
- 每次请求关联必须避免串话；注意目前 `$persistentStore` 中问题原文可能残留。
- 现有 `deepseek-flash` 模型标识需要用官方信息和真实 API 核验。
- 系统级绕过不受脚本控制，不得宣传无条件 DeepSeek-only。

## 发布与升级纪律

- 通过 [发布验收表](RELEASE_CHECKLIST_ZH.md) 才能考虑稳定版；合并 `main` 不是发布证明。
- 任何正式发布须锁定安装模块、脚本 commit、说明文档与测试结果；提供回滚方式。
- 避免直接覆盖运行中的远程脚本，以免用户安装配置在不知情情况下改变。
- 每次修复后保留当前模块原件的可回滚来源；不能泄露真实 Siri 问题及网络抓包。
- 如果脚本未运行就会直接返回千问，必须在文档中明确此系统级限制。

参考 [架构](ARCHITECTURE_CURRENT_ZH.md)、[调试](DEBUGGING_ZH.md)、[安全](SECURITY_CURRENT_ZH.md)。
