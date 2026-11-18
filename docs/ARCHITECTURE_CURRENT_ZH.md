# AIES v0.6 当前架构

> 以下描述当前代码设计，不代表其已在真实 Siri 设备上通过验证。

## 文件结构

```text
.github/workflows/ci.yml                  GitHub Actions
README.md / README_EN.md                   项目介绍
shadowrocket/
  60-AIES-SIRI-DEEPSEEK-V06.sgmodule      当前唯一安装模块
scripts/
  aies_siri_deepseek_v06.js                当前唯一请求/响应重写脚本
  provision_key_ONCE.js                    本机一次性 Key 设置模板
  clear_key_ONCE.js                        本机 Key 清空模板
tests/
  siri-deepseek-v06.test.js                当前脚本模拟回归
  fixtures/siri-sse.js                     测试专用合成 SSE
tools/check-docs.js                        文档、版本引用与部署规则检查
docs/                                      当前使用/架构/调试/安全/发布文档
```

当前部署**不依赖旧的模块化构建器，也不需要运行生成命令**。模块的两个钩子指向同一固定 Git 提交的 `aies_siri_deepseek_v06.js`。

## 请求/响应流

```text
Siri 文本输入
  ↓
Shadowrocket HTTP Request Hook
  ├ 固定 host/path、POST、JSON 和 siri.tqa 文本范围校验
  ├ 读取问题正文、生成请求 token、写入短期存储
  └ 原请求继续按系统配置发送（可能由千问处理）
  ↓
千问候选 HTTP 200 SSE
  ↓
Shadowrocket HTTP Response Hook
  ├ 按 token 或当次 request body 找到问题
  ├ 预检 SSE 事件序列、长度、结构与会话 ID
  ├ 从本地 store 取 DeepSeek API Key
  ├ POST https://api.deepseek.com/chat/completions
  ├ 校验完整模型回答
  └ 仅用 DeepSeek 文本重建已识别回答字段
  ↓
尝试 $done({status,headers,body})
  ↓
Siri 原生 UI 是否接受：尚待真机验证
```

## 核心函数

| 部分 | 当前职责 |
|---|---|
| `C` | 固定 URL、模型、Key 名称、长度与超时 |
| `parseRequest` | 严格提取支持的 Siri 文本输入 |
| `randomToken`、`storeRead`、`storeWrite` | 每次请求关联与逻辑过期 |
| `rewriteSse` | 已知事件检查和 DeepSeek 回答字段重建 |
| `modelReply` | HTTP 200、完整结束原因、非空文本等校验 |
| `done`、`error` | 一次性响应、超时与尝试 502 错误 |
| `log` | 固定阶段日志，不主动输出问题和 Key |

## 风险边界

- 原始问题可能到千问；模型调用也会将问题发送 DeepSeek。
- 自定义 `X-AIES-Request-ID` 会发给上游，且跨钩子可见性尚待真机验证。
- 请求正文在本地 `$persistentStore` 中逻辑缓存约 45 秒；不代表安全擦除。`Math.random` token 也不应被视为密码学强随机凭据。
- SSE 是基于现有合成事件结构编写，不保证真实流式/压缩的 Siri 接收。
- 脚本处理失败尝试返回 502，但脚本完全缺席时无法阻止 Siri 的系统级回退。
- `deepseek-flash` 需要官方 API 可用性核对，不应误称已验证。

## 修改原则

统一修改 `scripts/aies_siri_deepseek_v06.js`、当前测试，并对模块中两个相同的不可变 Git SHA 引用同步更新。保持未知 SSE 不透传千问答案、Key 不上传仓库、失败路径不自动回退。详见 [维护手册](OPERATIONS_ZH.md)。
