# 独立 SSE 协议工程（v0.4.0-lab）

> **历史研究记录（不适用于最新 v0.6 安装）**：本文为旧 v0.4 阻断千问路线的研究材料，可能包含已废弃的配置步骤。新需求允许请求到千问，要求 Siri 最终 AI 回答来自 DeepSeek；真实 Siri 尚未验收。请优先查看 [当前文档](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/README.md)、[v0.6 安装](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/INSTALL_SIRI_DEEPSEEK_V06_ZH.md) 和 [安全限制](https://github.com/Nimenta727/Apple-Intelligence-Exchange-Secure/blob/siri-deepseek-v0.6-clean/docs/SECURITY_CURRENT_ZH.md)。

## 项目最终目的

安全地在设备本地接管 Siri 与写作工具请求，经过授权使用 DeepSeek 产生答复，并合成 iOS 可以接受的 SSE；**原始请求不得传给千问**。

## 这一轮已实现

- src/request.js：限定 Siri 请求的主机、路径、POST、JSON、文本场景。
- src/deepseek.js：使用固定的 DeepSeek chat/completions Endpoint；异常响应一律拒绝。已对照 2026-11 官方文档检查模型 deepseek-flash。
- src/sse.js：Siri 问答输出 content/suggestions/summary；写作工具输出 body/refinements；解析结构化模型回答并去掉非白名单字段。
- 长文本用 Unicode 安全的 delta 分块，所有 done、completed、session.response.done 节点重复同一最终 JSON。
- validateCandidateSse：校验事件顺序、SSE 基本格式、session ID 一致性、delta 聚合及写作/Siri 数据 Schema。
- tests/protocol-synthetic.test.js：用完全虚构的请求、模拟 API 返回，独立串联 Request → DeepSeek Adapter → SSE。测试不会产生互联网请求。

## 与原作者 boitar/sair 的关键差异

原作者公开的 docs/protocol_analysis.md 列出 session.created、session.response.* 事件名称及最终 JSON Schema，但 scripts/sair_adapter.js 采用请求阶段记录上下文、响应阶段修改实际千问 SSE 的方案。我们的安全版不能把该流程直接照搬，否则原始 Siri 内容已发往千问。

所谓「27 级 SSE」不足以提供完整官方规范；本项目候选序列短文本为 12 个 SSE event frame，长文本有更多 delta。通过离线自检不能证明苹果系统接受这些字段或顺序。

## 不得误报为已完成

1. Shadowrocket 2.2.93 的 REJECT 与脚本响应冲突尚未解决。
2. 真实 Siri 是否接受纯本地合成 SSE 仍未验证。
3. 断开 VPN、HTTP/3、系统 DNS 等环境条件下的零透传证明尚未取得。
4. 主脚本仍必须保持 providerEnabled=false 和千问目标 REJECT。

结论：独立协议生成与自动化测试可交付；完整安全 Siri→DeepSeek 可用版尚未达到发布门槛。
