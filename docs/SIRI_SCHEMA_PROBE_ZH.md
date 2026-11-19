# iPad Siri noRTI 请求结构本地诊断（严格隐私版）

> 仅限受控 Beta 测试。**此工具不会让 Siri/DeepSeek 立即正常工作**，只帮助确定真实 Siri JSON 的**字段名和数据类型**，以安全审查必要的兼容代码。真机已确证 `siri.multimodal.noRTI`，最新日志出现 `NORTI_SHAPE_ROOT_FIELDS` + `NORTI_SHAPE_ITEM_WRAPPER_FIELDS`。不需要再提取组名。

## 设计与风险边界

- 用户只有**手动测试** `siri_schema_probe_ONCE.js` 才会开启 **600 秒/10 分钟**采集，默认完全关闭；再次手动运行仅查询状态，不会意外取消。
- 主 HTTP Request hook 只有匹配目标 URL、Siri User-Agent、POST、精确 noRTI 组名，并且**原有严格解析已拒绝请求**时，才会在本机暂存**最多一份**结构摘要。
- 摘要只包含有限的根级额外字段、`input` 外层包装字段、内层 `message` 字段的**键名及固定数据类型**，还有 `input` 容器的数据类型；**不包含任何字段值**，也不保存提问内容、请求正文、Authorization、Cookie、DeepSeek Key、SSE 或 Token。
- 字段名必须匹配短 ASCII 名称且不含疑似密钥、身份、邮箱、地址、会话、账号等敏感模式；否则以 **`REDACTED`** 替代。最多记录 8 个字段/层级；溢出只记录 `TRUNCATED`。
- 即使键名经过筛选，**也要先在本机人工检查**，如果有个人信息、疑似凭据或私人字段名，**不要发送**。该诊断不构成设备隔离或物理擦除证明。

## 操作步骤

1. 首先备份配置，确保 Shadowrocket VPN、目标域名的 HTTPS MITM 和唯一 60 模块工作，其他同域冲突模块已停用。**刷新/重新导入 [唯一的 60 模块](../shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule)**，检查双钩子脚本路径都锁定到 `bf11ab5bdb6d039d0f68d528676eaf2f3986f891`。

   模块 URL：

   https://raw.githubusercontent.com/Nimenta727/Apple-Intelligence-Exchange-Secure/main/shadowrocket/60-AIES-SIRI-DEEPSEEK-V06.sgmodule

2. 下载 [`siri_schema_probe_ONCE.js`](../scripts/siri_schema_probe_ONCE.js) 到 iPad 的 Shadowrocket 本地 `Script` 文件夹。它是**新的辅助脚本**，不是此前的 `siri_group_probe_ONCE.js`，不能混用。打开 Script Test 手动测试；如果保存表单强制要求类型，可设为**禁用**的 `event`，但不要让它自动运行。
3. 首次手动执行，必须看到：

   ```text
   [AIES_SIRI_SCHEMA_LOCAL] ARMED_600_SECONDS
   [AIES_SIRI_SCHEMA_LOCAL] PERSISTENCE_ROUNDTRIP_OK
   ```

4. **立即真实询问 Siri 一次非隐私问题**，例如“为什么天空是蓝色的？”。不用等满 600 秒。此时原有严格解析仍可能令 Siri 显示“无法从 Qwen 获得回答”，这是当前 Beta 的已知状态，**不等于已调用 DeepSeek**。
5. 再次手动执行**同一个新辅助脚本**。成功时得到类似以下**虚构示例**：

   ```text
   [AIES_SIRI_SCHEMA_LOCAL] SCHEMA_CAPTURED
   [AIES_SIRI_SCHEMA_LOCAL] INPUT_TYPE=array
   [AIES_SIRI_SCHEMA_LOCAL] ROOT_EXTRA_FIELDS=metadata:object,stream:boolean
   [AIES_SIRI_SCHEMA_LOCAL] ITEM_WRAPPER_EXTRA_FIELDS=type:string,index:number
   [AIES_SIRI_SCHEMA_LOCAL] MESSAGE_FIELD_TYPES=content:string,role:string
   [AIES_SIRI_SCHEMA_LOCAL] SCHEMA_CLEARED
   ```

   示例中的字段是合成测试数据，**不是实际 Siri 格式**。实际结果只有设备运行后才知道。读取前会先逻辑清除结果。
6. 如果显示 `STILL_ARMED` 和 `ACTIVE_REMAINING_SECONDS`，说明还没有观测到符合条件的请求且采样没有被取消。可以在剩余时间内真实问 Siri，再次执行查询；若 `EXPIRED_CLEARED`，需要再手动执行一次才重新开启 600 秒。

## 主脚本固定码

- `[AIES_V06] NORTI_SCHEMA_CAPTURED_LOCAL` — 结构摘要已保存到**本机**，主脚本不输出任何字段名或字段值。
- `[AIES_V06] NORTI_SCHEMA_STORE_FAILED` — 本机状态写入失败，需要检查脚本环境。
- `[AIES_V06] NORTI_SHAPE_ROOT_FIELDS` / `NORTI_SHAPE_ITEM_WRAPPER_FIELDS` — 当前真实 Siri 格式超出受支持范围；无论是否采样，仍按原安全策略拒绝。

如需取消，可单独手动执行 [`siri_schema_probe_STOP_ONCE.js`](../scripts/siri_schema_probe_STOP_ONCE.js)，看到 `SCHEMA_PROBE_STOPPED_AND_CLEARED`。该脚本**不会动 DeepSeek API Key**。

## 可以反馈什么

只需将**手动辅助脚本结果中** `[AIES_SIRI_SCHEMA_LOCAL]` 前缀的几行，在本机检查无敏感内容后发给开发者。不要发送完整 PacketTunnel、proxy.db、JSON 请求、截图里的认证头、API Key 或 CA 私钥。若显示 `REDACTED`，保留这个字样，不尝试恢复隐藏的键名。

只有字段结构确证且经过内容安全审查后，才调整纯文本解析白名单。仍必须单独验证响应 SSE、真实 DeepSeek API 和 Siri 原生 UI；不能因为一个解析错误消失就宣称成功。

## 已获取结构后的使用说明

2026-11-19 11:54 已在 iPad 真机取得一次有效的结构摘要：根级为 `client_tools:array`、`response_format:object`、`server_tools:array`、`stream:boolean`；消息包装为 `type:string`；内部为 `content:array` 和 `role:string`。**无需再次运行本探针**，现在请刷新最新 60 模块，并只用非隐私问题观察下一阶段的固定错误码；本探针仍保留供其他版本的受控诊断。工具无法从字段类型推导字段值，因此最新代码没有无条件放行工具和媒体。
