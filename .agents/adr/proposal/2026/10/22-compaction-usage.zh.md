# 压缩用量

Draft owner: Ruokee
Draft writer: OMP gpt-6-astra

[English](./22-compaction-usage.md) | 中文

## 动机

将 soft 和 Handoff 用量补记从 QoL 迁入 smart-context。

[现行决定](../../../decision/2026/10/13-compaction-usage.zh.md)将记账归属 QoL 并受其总开关控制。记账应与上下文能力共同维护，但它观察已完成用量，不改写请求，也不共享对齐协调器。

## 提议

延续 `13-compaction-usage` 身份。将 QoL 归属、总开关依赖及 `/qol` 状态改为 smart-context 归属、独立 `compactionUsageEnabled` 及 `/smart-context` 状态。保留布尔默认值 `true`、激活快照、模块局部校验及独立进程级 telemetry 所有权。

保留四种 purpose：`compaction:summary`、`compaction:short-summary`、`compaction:turn-prefix`、`compaction:handoff`。不扩展到 `compaction_native`、`branch_summary` 或其他请求。每个完成且消耗 token 的范围内请求通过所属 session manager 追加一条 `model_usage`，使用自身 span 身份及实际解析的 API、Provider、模型、token 数、停止原因和宿主携带的 Provider 成本。保留既有身份缺失处理及计数，不猜测 API、Provider 或价格。零 token 请求不写入。

保留用户 telemetry 的 tracer、估价器和回调。没有用户 telemetry 时保留既有不导出数据的惰性配置。不读取或保存请求正文、摘要或 Handoff 文档，不改变请求内容、路由或时序。登记及访问器释放独立于对齐包装。

保留激活时检测 `compactionRequestUsage`，报告原生记账并停用补偿，防止重复条目。[上游 PR #15034](https://github.com/can1357/oh-my-pi/pull/15034) 合并后复核实际原生记录及会话统计。原生行为能够替代时，移除本模块及其设置、状态、文档和检查，更新自己的决定及能力清单。不删除对齐能力或历史用量记录，也不因一个模块退出就改变包级合同。

迁移移除 QoL 实现及用户级、项目级的 `compactionUsageEnabled` 键。分别保留原 `enabled && compactionUsageEnabled` 的有效结果，新默认值不能启用原先被 QoL 总开关关闭的记账。其余 QoL 设置不变。不增加运行时回退或自动用户配置写入。

使用仓库检查和实际宿主记账路径的受控请求验收，包括统计增量。以此替代继承的真实 CLI 证据门槛；保留历史证据，写明实际宿主和运行条件。

## 考虑过的替代方案

无

## 验收标准

- 只有 smart-context 安装或停止补偿，记账独立于请求改写。
- 范围内用量向所属会话及宿主统计写入一次，零用量、范围外请求及原生记账不产生重复条目。
- 既有 telemetry 回调及 Provider 成本数据保持不变。
- 迁移后的有效开关保留用户意图，清除迁出键后 QoL 无关行为保持不变。

## 风险

telemetry 包装仍增加宿主工作，身份或分支错误会产生看似合理的错误总量。原生替代后保留模块可能重复记账，因此检测必须有效。QoL 遗留迁出键会使其整体拒绝配置。

宿主的活跃窗口记账规则可能变化而不拒绝 journal 记录，导致总量遗漏这些条目。Provider 成本仍取决于宿主是否携带该字段；请求类型或 span 身份不再可用时，补偿不写入，不猜测。
