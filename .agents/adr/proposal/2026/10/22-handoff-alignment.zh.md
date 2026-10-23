# Handoff 对齐

Draft owner: Ruokee
Draft writer: OMP gpt-6-astra

[English](./22-handoff-alignment.md) | 中文

## 动机

在 smart-context 中维护 Handoff 对齐，保留其独立协议合同。

[现行决定](../../../decision/2026/10/12-handoff-alignment.zh.md)将能力归属 smart-cache。整合上下文能力不能让 Handoff 依赖远端 Provider 选择，也不能把文档请求视为 Responses V2 压缩。

## 提议

延续 `12-handoff-alignment` 身份，将包归属和 `/smart-cache` 改为 smart-context 与 `/smart-context`。保留独立默认关闭的 `handoffCacheEnabled`，使用激活快照，关闭时保持原生行为。它仍独立于远端开关、Provider 选择和模式。

保留 Chat Completions 与 Responses 适用范围、同次 dispatch 的传输确认普通参照、不可变操作快照、完整所有权复查、失效规则、有界状态，以及逐独立轴投影后完整替换。保留现有正例边界、原生历史、新尾部、工具、图片、路由、取消和显式策略。证明不足时保留完整原生请求，不延迟或丢弃。

Chat Completions 保留既有 system、reasoning-effort 和 tool-choice 投影。Responses 只恢复已证明缺失的 system 内容，保留原生 `none`、嵌套 reasoning 及配置更新，保留原生仅限 auto 的兼容重试。不复制远端 V2 算法，不重跑 handler，不伪造摘要，不执行返回的工具，不增加重试。OMP 继续负责生成、调度、回退、采用、历史提交和续接。

[共享对齐合同](./22-request-alignment.zh.md)负责每方法一层包装、逐会话登记、按所有权释放，以及每条物理请求最多一个改写方。其他上下文模块不加入该协调器。保留独立状态、阶段原因、计数及原生替代条件。

使用仓库检查和实际宿主库上的本地受控请求验证整合。宣称真实 Provider 收益仍需可比测量，但真实模型调用及全量 CLI/TUI 矩阵不作为整合门槛。保留历史试验和安装证据，不将其改称新包证据。重启迁移移除旧入口，不叠加包装。

## 考虑过的替代方案

无

## 验收标准

- 两类 API 保留正例投影及保守拒绝，包括原生策略差异。
- 远端关闭或配置不同时，Handoff 仍可工作，不共享其他会话参照。
- 上下文 handler 不执行两次，一条物理请求不被两项能力改写，状态不触发模型请求。
- 受控证据区分投影、原生结果采用及另行测量的 Provider 收益。

## 风险

Chat Completions 的 tool-choice 恢复仍可能产生工具调用而非文档，扩展不执行该工具，也不增加重试。共享准备或传输变化可能让两项对齐证明失效，因此迁移须覆盖两项能力，不能只检查 Handoff。
