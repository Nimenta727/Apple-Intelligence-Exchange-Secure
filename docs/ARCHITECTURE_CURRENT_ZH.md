# AIES v0.6 当前结构与数据流

> 本文以 `scripts/aies_siri_deepseek_v06.js` 和 `60-AIES-SIRI-DEEPSEEK-V06.sgmodule` 当前代码为依据。这里描述**脚本打算做什么**，不把模拟测试解释为已验证的 Siri 行为。

## 1. 主要运行文件

```text
Apple-Intelligence-Exchange-Secure/
├── shadowrocket/
│   ├── 60-AIES-SIRI-DEEPSEEK-V06.sgmodule    ← v0.6 唯一部署模块
│   ├── 00-SAIRS-LOCKDOWN.sgmodule            ← 旧阻断模式，仅作回滚/研究
│   └── 10/20/21 ...                         ← 历史实验
├── scripts/
│   ├── aies_siri_deepseek_v06.js             ← v0.6 唯一运行逻辑
│   ├── provision_key_ONCE.js                 ← 设备本地临时配置 Key 模板
│   ├── clear_key_ONCE.js                     ← 设备本地清空 Key 模板
│   └── sairs_router.js                       ← 旧 v0.4 生成脚本
├── src/                                     ← 旧 v0.4 模块化实验源码
├── tests/
│   └── siri-deepseek-v06.test.js             ← v0.6 宿主模拟和故障测试
├── tools/
│   ├── build.js                              ← 仅为旧 v0.4 打包
│   ├── check-boundary.js                     ← 旧基线边界静态检查
│   └── check-docs.js                         ← Markdown 链接及 v0.6 部署引用
└── docs/                                    ← 当前说明和 history 研究档案
```

**重要**：`src/` 并不构建 v0.6 的 `aies_siri_deepseek_v06.js`。请修改实际部署脚本，并同步 tests 与模块 pin。

## 2. v0.6 数据流

```text
                   Siri 原生文本问题
                           |
                  Shadowrocket MITM
                           |
             HTTP Request / Capture hook
                 - 匹配固定 HTTPS URL
                 - 检查 POST 与 Siri 文本 JSON
                 - 生成 per-request token
                 - store: AIES_R1_<token>
                 - 附加 X-AIES-Request-ID
                           |
                     千问原始请求
                     (允许接收问题)
                           |
                   千问候选 SSE 响应
                           |
            HTTP Response / Rewrite hook
                 - HTTP 200 + body 检查
                 - 匹配 token 或当前 request body
                 - 合成预检 SSE 结构
                 - 读取本地 DeepSeek Key
                           |
            HTTPS DeepSeek Chat Completions
             model = deepseek-flash (尚未真机核实)
             stream = false; max_tokens = 500
                           |
                 modelReply 验证完整性
                           |
                rewriteSse(answer)
              - 仅已知事件类型/顺序
              - 保留经校验的会话 ID
              - 重新构造 delta/done/final
                           |
                  Shadowrocket $done(...)
                           |
               Siri 是否接受？（真机待验收）
```

## 3. 运行脚本逻辑分区

| 组件或函数 | 责任 | 注意事项 |
|---|---|---|
| `C` | 固定 URL、Key 名、模型、超时/大小限制 | 模型 ID 更新需官方核对 |
| `parseRequest` / `rawRequest` | 提取只支持文本的 Siri 问题 | 不支持图像/写作/其他 schema |
| `randomToken` / `storeRead/Write` | 请求关联、TTL 和消费后清空 | 使用 `Math.random`，**不具备密码学安全随机性证明**；存储不保证物理删除 |
| `statusCode` / `modelReply` | 检查 API HTTP 200、JSON、完整回答 | `finish_reason` 必须为 `stop` |
| `E` / `rewriteSse` | 对已知事件序列生成包含 DeepSeek 文本的新 SSE | 这并非 Apple 官方 Siri SSE 完整规范 |
| `done` / `error` | 单次回调、清除超时、尝试输出 502 错误 | 不提供脚本缺席时的系统级隔离 |
| `log` | 固定阶段标记，不输出正文 | 可能仍需审查 Shadowrocket 自身网络日志 |

## 4. 关键状态及数据

- `$request`：请求阶段尝试获得 URL、method、headers、body；响应阶段能否看到同样的 `$request.body` 尚未得到真机证实。
- `$response`：脚本以其存在判定响应阶段；尝试读取完整 `body`。流式响应是否可一次获得、压缩后是否能读，尚未验证。
- `$persistentStore`：Key 名 `SAIRS_DEEPSEEK_API_KEY`；上下文名 `AIES_R1_<token>`，包含 `p`(问题文本) 与 `exp`(逻辑过期时间)。
- `$httpClient.post`：独立访问固定 DeepSeek HTTPS API；未证明所有设备的返回格式与超时行为一致。
- `$done`：请求阶段尝试提交新增 header，响应阶段尝试替换 SSE。脚本错误时可能尝试返回 502；只对成功调用到该钩子的请求有效。

## 5. 信任与失效边界

1. 用户明确接受问题可能同时由千问与 DeepSeek 接收；不能宣传“千问不会看到问题”。
2. 为了响应替换必须能够获取千问候选 SSE，旧 00 REJECT 因此与 60 冲突，不能同时开启。
3. 自定义关联 header 可被上游观察；依赖它跨 request/response 保留是一项**待真机确认的实现假设**。
4. `Math.random` 的 token 不应被当作强安全凭据；不能依赖它防止恶意参与方伪造。模型输出来源保证依赖脚本与宿主行为，而不是这个 token。
5. 真实 Siri 响应变化、SSE 多段与系统回退可能导致普通错误或绕过；不能据离线 fixture 通过就断言正式兼容。

## 6. 修改与扩展规则

优先解决真实 Siri 兼容和错误安全；然后减少用户正文存储、增加清理机制、拆分纯函数测试，再考虑打包后的单文件部署。任何改动必须让模块两条 `script-path` 指向同一新的不可变 Git commit、更新对应测试/CHANGELOG/文档，并经过 [维护手册](MAINTENANCE_ZH.md) 与 [发布核对表](RELEASE_CHECKLIST_ZH.md)。
