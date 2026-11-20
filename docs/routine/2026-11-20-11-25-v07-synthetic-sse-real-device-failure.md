# 2026-11-20 11:25 — v0.7 63 请求优先合成 SSE 在真实 Siri 完全失败，隔离禁用并回退 62

## 故障复盘（本地日志，不上传敏感原文）

用户上传 `PacketTunnel-20261120112522(1).log`（11:25:22 附近开始，共 1,365 行），报告新 v0.7 63 完全无法从 DeepSeek 获得 Siri 可见回答。

仅分析本地代理日志固定状态、HTTP 路径和 Hook 生命周期（**未提交原始日志、session ID、用户问题、API Key、请求/响应包**）：

- `[AIES_V07] REQUEST_VALIDATED`：**6** 次；
- `[AIES_V07] SYNTHETIC_SSE_PREFLIGHT_PASSED`：**6** 次；
- `[AIES_V07] DEEPSEEK_STARTED`：**6** 次；
- `[AIES_V07] SIRI_CONTEXT_STORED`、`DEEPSEEK_LABEL_APPLIED`、`LOCAL_SSE_RESPONSE_READY`：**各 6** 次；
- Shadowrocket `script http request send early response to client`：**6** 次；
- 本轮六次 Siri 目标 HTTP 路径都为 `/v1/sessions/responses`，**未见任何** `/v1/sessions/{id}/responses` followup Hook；未见 `[AIES_V07] ERROR_*` 和脚本找不到。
- 用户确认 Siri UI **没有**真正显示可用的 DeepSeek 回答。

因此调用 DeepSeek、合成脚本内部 SSE、调用 `$done({response:{status:200, ...}})` 及 Shadowrocket 提前返回都已发生，**不能再把故障归因于 Key、网络、脚本未启用、模型本身失败或模型启动阶段**。但日志也不足以证明客户端是因合成 session/choice ID、响应时序、HTTP 包头细节还是其他 Siri 会话语义拒绝结果。**SSE 模拟测试成功 != iPad Siri UI 成功**；此前将该架构作为可试用替代版的发布判断过于乐观。

## 这次 GitHub 实施的止损修改

1. `shadowrocket/63-AIES-SIRI-DEEPSEEK-V07-REQUEST-FIRST-LOCAL.sgmodule`：名称改为 **63 DISABLED**；描述与顶层注释加入 11:25 真机失败事实，**两条请求 Hook 的 `enable=true` 改成 `enable=false`**。不删项目源码，作为技术实验留档；不再将 63 作为普通可用方案。
2. `tools/check-docs.js`：静态检查要求 63 两条 Hook 均显式默认禁用，同时必须出现故障隔离警告。
3. `tests/siri-deepseek-v07-request-first.test.js`：更新模块安全断言；可保留其引擎模拟测试用于研究，但**不以测试通过作为设备兼容性已修复的宣称**。
4. `README.md`、`README_EN.md`、`docs/CURRENT_STATUS_ZH.md`、`docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md` 及 `docs/INSTALL_SIRI_DEEPSEEK_V07_REQUEST_FIRST_ZH.md`：在醒目位置标识 63 已验证不兼容，推荐立即回退 **62 LOCAL**，说明保留密钥、证书和旧版 JS，不需重新部署。
5. 当前稳定使用的 `scripts/aies_siri_deepseek_v06.js`、62 LOCAL 的四条 Hook、DeepSeek Key 名称 **完全不改动**；不要把失败的 63 补丁影响已验证多轮可用的 62。

**已经安装在设备上的 63 模块不会因远端仓库默认禁用而自动改变状态**：用户必须手动关闭本机 63，重新开启 62 并应用配置。切勿 62/63 同时启用。

## 工程结论与后续规划

**立即回滚**：iPad Shadowrocket → 模块 → 关闭 63 → 开启 62 LOCAL → 确保旧 60 / 61 / 00 REJECT 关闭 → 重新使用配置；本地 iCloud `Shadowrocket/Script/aies_siri_deepseek_v06.js` 应仍是先前可用版本。可用的固定 v0.6 源码参考 `637484295c10627f06e610bfe040dd58e67d309a` 的 `scripts/aies_siri_deepseek_v06.js`，但若设备已有可用文件则无需替换。无需重设 `SAIRS_DEEPSEEK_API_KEY` 或证书。

**技术研究（在真实协议证据出现之前，不再推给用户冒险试）**：
1. 将 63 请求优先引擎降级为只读研究分支；从合成 SSE 的真实 Siri 会话契约入手，确认是否必须是服务端签发的 session/response/choice 标识及客户端状态转换。**不能从“没有 followup”直接断言唯一根因**。
2. 在 62 的稳定两钩子基础上，单独研究请求／响应关联：首条新连接 `RESPONSE_TAG_MISSING` 的载体可能与 Shadowrocket 的 pending-data 处理有关，尚需有证据的事务匹配机制；禁止采用「最近一次 Siri 问题」等会导致跨会话串答的关联猜测。
3. 对 `FOLLOWUP_GROUP_OTHER_SIRI` 仅用非敏感结构、类型和固定分类做协议确认；不从 group 前缀擅自推定请求一定是安全纯文本，也不让其他 Siri 工具/音视频或私人字段透传。
4. 设计**设备端真实验收门槛**：脚本完成、Shadowrocket 返回、Siri 界面实际显示来源标记、接续 session 请求出现且能完成第二轮，四个步骤必须全部满足，不能仅以 mock CI 通过或 `LOCAL_SSE_RESPONSE_READY` 为合格。
5. 如果继续研发 v0.7，应先在独立开发分支明确协议假设、建立可失败的协议契约测试和零隐私诊断，经过用户明确自愿一次性设备试验后再考虑重新发布。生产推荐持续为 62 LOCAL，明示它仍存在间歇失败。

## 隐私与风险

本日志确实包含系统和网络环境信息，原始全文留在用户会话，**不提交 GitHub**。只引用阶段码和汇总计数。现有本地 DeepSeek 对话历史 5 分钟逻辑过期不代表物理删除。原 62 将请求发送给 Qwen 后再改写回应的架构不能保证「千问完全没有接收到问题」。本次 63 的失败不应成为放松会话隔离、工具权限检查、敏感字段保护的理由。
