# 对齐 Responses Handoff

Draft owner: Ruokee
Draft writer: OMP GPT-6.1 Sol

[English](./16-align-responses-handoff.md) | 中文

## 动机

将 smart-cache 的 Handoff 对齐扩展到原生 Responses 侧请求。

[现行 Handoff 决定](../../../decision/2026/10/12-handoff-alignment.zh.md#适用性)将 `openai-completions` 会话交给 Handoff，将 `openai-responses` 会话留给 remote 对齐。原生 Responses Handoff 请求不携带 remote 所需的 V2 压缩 trigger。即使同一会话已经发送可复用的普通内容，两项能力也都不对齐这类请求。

Responses 的系统提示词和 reasoning 表达也不同于 Chat Completions。只扩展 API 条件，仍不能完成其参照捕获和投影。需要在 Handoff 内提供独立的 Responses 投影，同时保留 [remote 的 V2 复用合同](../../../decision/2026/10/10-remote-alignment.zh.md)。

## 提议

### 请求归属

证明操作归属后，按实际请求种类选择能力。`openai-responses` 会话的原生 Handoff 侧请求可以由 Handoff 处理，符合资格的 V2 请求由 remote 处理。一条实际请求最多由一项能力改写。`openai-completions` 和 `openai-responses` 之外的 API 不在两项能力范围内。

保留 `handoffCacheEnabled` 作为 Handoff 唯一开关，默认值和激活语义不变。remote 关闭、Provider 未选中或模式不同时，Responses Handoff 仍须能捕获参照。不新增 Provider 清单、设置、模式、包或扩展入口。

### 已确认观察

只有已确认的普通主循环 dispatch 提供参照。来源、完成准备、最终出站载荷及传输确认必须属于同一次 dispatch。Handoff 和其他侧请求永远不能成为参照。保留准备请求必须携带工具集的现有要求。

两项能力可以通过既有协调器共享该 dispatch 的不可变观察事实。各项能力按自己的协议解释这些事实，并独立证明资格。不共享协议规则、载荷形状规则、原因码或收益证据。remote V2 的证明不能建立 Handoff 资格，一项能力拒绝请求或缺少接口不影响另一项。

### Responses 投影

保留现有 Chat Completions 投影及其逐轴行为。在宿主 payload hook 之后采用独立的 Responses 投影，并在实际发送边界校验。

改写前必须证明操作归属、系统提示词前缀、共同历史前缀与已发送结果的对应、新增尾部边界及工具归属。缺少必要证明时，整条原生请求保持不变。在此边界内，无法还原的独立轴跳过并计数，无关字段差异不否决其余轴。完整候选校验后一次原子替换，相同候选不重新序列化。

尊重 Responses 的原生系统提示词表达，包括顶层 `instructions` 或已证明的前置 `developer` 片段。不将历史中的 developer 消息提为系统提示词。保留新增历史与 Handoff 指令、原生工具 schema 与调用配对、图片、reasoning replay 及用户有效思考选择。嵌套 reasoning 和原生配置更新状态必须一致，不能只复制单一 effort 字段。

保留 Responses Handoff 的原生 `toolChoice: none` 及宿主已有的 auto-only 兼容重试。不将普通请求的 auto 恢复到文档生成请求。保留缓存键、路由、独立 side session 身份、取消及其他原生请求选项。不改变 Chat Completions 的工具选择行为，不新增重试。

### 保留合同

[扩展归属及能力模型](../../../decision/2026/10/12-smart-cache.zh.md)和 remote 决定保持不变。保留 Handoff 的原生配置权威、逐会话身份与隔离、不可变操作快照、epoch 失效、导航结算、失败行为、有界资源及按归属还原包装。新的普通发送可以恢复后续资格，但不能恢复失效操作或其晚到响应。

继续使用同一协调器及每个原生方法的一层自有包装。外部包装、归属丢失及混装仍属于冲突，不构成抢占函数的许可。关闭一项能力或会话不能停止有效邻居。OMP 继续负责文档生成、调度、取消、认证与传输重试、回退、校验、采用、提交和续接。不增加压缩入口、否决、凭据请求、参照请求、处理器重跑或设置修改。

`/smart-cache` 仍是一条命令，各项能力分别保留状态、分阶段原因及有界的操作、发送和重试计数。命令不启动模型 turn，不泄露请求内容、opaque、凭据、端点、私密路径或动态私密键。客户端对齐、原生采用和 Provider 缓存收益分别判断。

### 决定反转

反转 [Handoff 对齐](../../../decision/2026/10/12-handoff-alignment.zh.md)。冲突条款如下：

- 公共配置及适用性将 Handoff 限于 Chat Completions 形状，并将 Responses 会话留给 remote。以按请求种类归属和独立 Responses 支持取代按会话排他分流。
- 投影边界及原生职责条款把普通请求的 `reasoning_effort` 与工具选择还原到侧请求。这些适用于整条侧请求的还原规则，不能同时保留 Responses 的原生文档生成工具选择和 reasoning 表达。保留 Chat Completions 规则，为 Responses 采用独立的系统提示词和 reasoning 语义，并保留其原生文档生成工具选择。
- 独立性规定本包、协调器、登记及包装之外一概不共享。允许共享普通 dispatch 的不可变观察事实，仍独立维护协议证明、载荷形状规则、原因和收益证据。

完整后继决定必须保留所有无冲突的 Handoff 合同，包括另行授权、通过重启完成的试验扩展切换。[组件规格](../../../../spec/omp-smart-cache.zh.md)及其证据共享措辞须与后继决定一致。不反转扩展决定或 remote 决定。在实现变更形成后继决定之前，现行决定和规格继续生效。

## 考虑过的替代方案

### 在原生准备阶段还原

在选择共同内容的还原阶段时，考虑过先还原上下文，再交给原生 serializer，而不投影最终载荷。该方案直接处理的 wire 字段更少，但后置 hook 和有状态序列化仍可能改变共同前缀。它扩大准备阶段介入范围，又不能省去最终发送证明，因此优先选择最终载荷投影。

### 只扩展 API 条件

在选择 API 范围时，考虑过让 Responses 进入现有 Handoff 路径。该路径依赖 Chat Completions 的消息及 reasoning 字段。只改变资格判断，仍不能捕获和投影 Responses，也不能保留原生 Responses 文档生成语义。

## 验收标准

1. Responses 会话可以在各自独立开关下使用 Handoff 和 V2，每条请求最多一个改写方。remote 不具备资格时 Handoff 仍工作，连续 Handoff 使用已确认普通参照，而不是先前侧请求。
2. 合格的最终 Handoff 请求在 payload hook 之后复用已证明的共同内容，保留 Handoff 指令、新增历史、原生系统提示词表达、工具、reasoning 状态、缓存路由和 side session 身份。Responses 保留原生 none 及宿主已有兼容重试。
3. 必要归属或前缀证明失败时，完整原生请求保持不变。某个独立轴无法还原时，不阻止其余有效轴，无关字段差异只用于诊断，不成为整条请求相等闸门。
4. 身份、工具、思考选择变化，取消、导航、晚到确认、重试及并发会话不能恢复旧参照或影响有效邻居。外部包装及混装报告冲突或不可用，不抢占归属。
5. Chat Completions Handoff 和 remote 保留现有合同。普通及非目标请求保持不变，包括 Anthropic。不增加参照请求、处理器执行或重试。
6. 受维护宿主的原生行为与最终请求证据覆盖文档采用、提交及续接，包括维护下限。分阶段状态与计数反映客户端行为，原生结果单独判断。真实 Provider 收益须由独立的可比测量证明，受控响应和合成 usage 不提供该收益证据。
7. 完整后继决定、组件规格和双语公共文档对请求归属、协议独立性、已确认观察及已验证范围保持一致。所有无关合同继续有效。

## 风险

源历史与最终 Responses 内容对应错误，可能插入旧内容或其他会话的内容，或丢失新增 Handoff 尾部。独立协议证明、不可变归属和原子替换必须保护这些边界。

Responses 的 reasoning 和系统提示词表达可能独立于 Chat Completions 演进。套用后者的投影规则，可能改变有效思考选择、重复 developer 内容或构造无效文档请求。分别维护投影增加了工作，也需要原生行为证据。

两项能力共用协调器，为 Handoff 修改参照捕获或包装，可能使 remote 回归或使两项能力都停止对齐。因此仍需各自的协议验收与冲突处理。保留原生工具选择也可能留下 Provider 特有的缓存差异，客户端对齐本身不证明未缓存输入减少。
