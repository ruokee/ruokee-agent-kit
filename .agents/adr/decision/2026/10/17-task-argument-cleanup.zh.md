# 任务参数清理

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash

[English](./17-task-argument-cleanup.md) | 中文

## 动机

`@ruokee/omp-qol` 新增一项调整，在宿主校验前删除非 seance 任务项中的 seance 专用字段 `sourceSession` 与 `model`。

当会话声明 `seance` Agent 时，OMP 18.11.3 会在每个 `task` 项上暴露这两个字段，不只限于选择 `seance` 的项。[`validateSeanceFields`](https://github.com/can1357/oh-my-pi/blob/v18.11.3/packages/coding-agent/src/task/seance.ts) 在解析出的 Agent 不是 `seance` 时拒绝任何已存在的值，因为它与 `undefined` 比较，而不是判断值是否有意义。把可选字段当成输入参数的模型可能发送 `""`、`/dev/null` 或模型名，使整个调用在派发前失败。一个会话出现过四次这类失败，`sourceSession` 的值为 `""` 和 `/dev/null`，`model` 的值为 `""` 和 `@ds-flash`。省略这两个字段的重试成功。

宿主在派发前校验整批任务。若推测启动生效，已经从已闭合 `tasks[]` 项启动的子 Agent 会被丢弃。上游修复，即忽略空值或只向 `seance` 项暴露这两个字段，不在本仓库范围内。qol 组件可以在扩展接缝处删除字段，不改变 task schema 或宿主派发路径。

## 分析

### 宿主校验

会话暴露 `seance` Agent 时，task schema 在每个任务项上展开这两个可选字段。当默认 Agent 符合 schema 的标识符模式时，schema 还会填入默认 Agent，因此省略 `agent` 的模型仍可能带着具体的非 seance 值进入事件。`tool_call` 事件通常收到 schema 校验后的参数；schema 失败后的宽松回退可能保留原始参数。处理器返回的 `input` 会替换后续用于派发、展示、持久化和执行的参数。task 工具自身的 `validateSeanceParams` 在 `execute` 内执行，晚于事件。处理器因此可以在失败的检查之前删除字段，不需要包装工具。

schema 的正常校验会删除可选字段中的 `null` 和字符串 `"null"`。schema 失败后的宽松回退可能保留原始参数，因此不按字段值判断的清理规则能覆盖两条路径。

字段集合同时是兼容标记。维护下限 OMP 18.5.0 的 task schema 把 `model` 作为普通可选选择器，且没有 `sourceSession`；OMP 18.11.3 通过 `seanceTaskSchemaFields` 同时加入这两个字段。若模块见到 `model` 就删除，会在维护下限上移除合法选择。因此模块探测内建 schema 中的 `sourceSession`，只在字段存在时清理。

### 推测执行

推测执行是 OMP 在工具调用完成流式生成前提前开始工作的优化。对于批量 `task` 调用，宿主在每个任务项的 JSON 对象闭合后立即启动对应子 Agent，不等完整调用结束。完整调用校验失败、被拦截或参数变化时，宿主中止已启动的运行。[`task.speculativeLaunch`](https://github.com/can1357/oh-my-pi/blob/v18.11.3/packages/coding-agent/src/task/settings.ts) 默认开启这项行为。

另一个实验性设置 `tools.speculativeExecution.enabled` 默认关闭。它允许通过校验的本地读取在正常派发前开始。网络请求、provider 完成和文件系统写入不在此列。

扩展注册 `tool_call`、`tool_result` 或审批生命周期处理器时，或任务审批不是自动允许时，OMP 会关闭这两类提前执行。处理器可能拦截调用或要求审批，而非自动允许的调用不能提前开始。注册清理处理器因此会让启用该模块的每个会话失去推测启动，而不只是带有这两个字段的调用。

### 与组件的契合

`@ruokee/omp-qol` 在一个包、一个设置入口和一套检查下提供可独立开关的调整。[OMP QoL 决定](../09/20-omp-qol.zh.md)已经确定该边界。[组件 README](../../../../../projects/omp-qol/README.zh.md) 与[组件规格](../../../../spec/omp-qol.zh.md)负责模块机制和逐项证据。wait 模块已经确立了一种模式：会话没有暴露预期的内建工具时拒绝动作。组件的维护下限是 OMP 18.5.0，该版本提供这里使用的 `tool_call` 输入替换契约。在未暴露 seance 字段的宿主上，模块保持 `unavailable` 且不注册 handler。

## 决定

### 公共配置

组件在 [OMP QoL 决定](../09/20-omp-qol.zh.md)下新增第七项调整 `taskArgs`。其公开合同是一个原生 OMP 设置键 `taskArgsEnabled`，boolean，默认 `true`，受组件总开关约束。它可独立开关，按既有设置规则被拒绝或报告，并与其他键在同一激活快照中读取，因此改动在下次启动 OMP 时生效。

其效果是：内建 task schema 暴露 `sourceSession` 时，带有该字段、`model` 或两者的非 seance 项在交给宿主派发时不再包含它们。`seance` 项保留这两个字段，并继续遵循宿主对非空 `sourceSession` 的要求。只有普通 `model` 选择器的 schema 会让模块报告 `unavailable` 且不做改动。

### 介入位置

模块读取内建 task schema，只在 schema 暴露 `sourceSession` 时为内建 `task` 工具注册一个 `tool_call` handler。它读取事件输入，只在确有改动时返回新的 `input`，并保留原生工具。宿主把返回的输入用于显示、持久化与执行，因此清理能到达原本拒绝该调用的同一个检查。

模块不替换工具定义、schema、描述、审批策略、派发路径、后台生命周期或结果渲染。它不自行新增会话条目，也不改写更早的历史。宿主会把改写后的参数持久化到当前 assistant 消息，后续请求和会话文件会看到它们。

### 改写规则

扁平调用视为一个条目，`tasks` 数组视为批次。对 `agent` 为字符串、去除首尾空白后非空且不等于 `seance` 的每个条目，处理器删除该条目自身的 `sourceSession` 与 `model` 键。字段值不参与判断：空字符串、占位值和非空值都删除。两个键都不存在的项保持不变。

批量调用对每个 `tasks[]` 项应用该规则，不改批量顶层的字段。处理器只复制发生改动的对象。其他参数，包括 `task`、`solutionSpace`、`tools`、`context`、`name` 和未知字段，保持值和结构不变。

`agent` 缺失、为空、纯空白、非字符串或为 `seance` 的项保持不变。宿主可能在事件之后解析默认 Agent，扩展无法以与宿主同等的权威得知该默认值。

### 激活与状态

只有在会话暴露的 `task` 工具的 `sourceInfo.source` 为 `builtin` 且 schema 暴露 `sourceSession` 时，模块才注册处理器。工具缺失报告 `unavailable` 与 `task-tool-absent`，工具被遮蔽报告 `incompatible` 与 `task-tool-shadowed`，内建 schema 没有 `sourceSession` 报告 `unavailable` 与 `task-tool-without-seance-fields`。OMP 18.5.0 只有普通 `model` 选择器且没有 `sourceSession`，因此模块在那里保持 `unavailable` 且不注册 handler。模块开关关闭报告 `disabled`，总开关关闭也报告 `disabled`。`taskArgsEnabled` 值非法时只停用本模块。

`/qol` 报告模块状态和本次激活期间 `input` 发生改动的调用次数。批量调用改动多个任务项时只计一次改写调用。计数器是诊断状态，不持久化。

### 推测执行成本

seance schema 存在时，注册处理器会使该会话的 `task.speculativeLaunch` 失效，包括不携带这两个字段的 task 调用。模块不修改宿主设置；是注册的处理器让 OMP 拒绝提前启动。需要推测启动的用户可以关闭清理。实验性的推测读取在启用时也会被拒绝。schema 没有 `sourceSession` 时不注册 handler，因此该成本不适用。本决定接受 seance 契约存在时的这一代价。

### 边界

模块不修复所有畸形任务形状。`agent` 缺失或为空的调用保持原样，由宿主按默认 Agent 和原生规则解析、校验。把字段放在批量顶层的调用也保持原样，由宿主原生校验。模块不重试、不拦截结果，也不增加模型可见的提示。它只是宿主扩展接缝处的输入清理。

schema 守卫依据宿主暴露的 `sourceSession` 字段，而不是版本号。因此它在只有普通 `model` 选择器的 18.5.0 schema 上保持停用，并在后续宿主暴露 seance 字段时生效。

模块也不让其他原因无效的调用变得有效。其他 schema 失败、审批决定和派发错误保持原生行为。多个扩展为同一调用返回 `input` 时，宿主采用最后一个结果，因此本次改写可能覆盖其他扩展的改写，也可能被后注册的处理器覆盖。

### 上游修复

宿主应忽略空值，或只向 `seance` 项暴露这两个字段。本决定不替代该修复。当组件的维护下限包含修正后的宿主契约时，可以停用该模块。

## 考虑过的替代方案

- **通过扩展工具 API 包装 `task`。** 扩展 API 可以通过 `ctx.invokeTool` 委托同名原生实现，因此不必复刻派发、审批或后台生命周期。它仍需要替换工具定义、schema、描述和原生渲染路径，并随宿主变化保持这些内容同步。`tool_call` 处理器改动更少，且保留原生工具。已否决。
- **在提示词或 Skill 中要求模型省略字段。** 不增加处理器，也不付出推测执行代价，但依赖每个模型和会话遵守指示。观察到的失败说明这不可靠。已否决。
- **收到 `tool_result` 错误后让模型重试。** 不改写参数，但消耗一轮失败调用，并且仍依赖重试正确。已否决。
- **只删除空字符串。** 范围更窄，也能保留未来宿主可能接受的 `model` 非空值，但观察到的占位值包括 `/dev/null` 和 `@ds-flash`，因此无法修复已报告的情况。已否决。
- **在 `agent` 缺失或为空时推断默认 Agent。** 能覆盖更多形状，但需要复制宿主 spawn 策略，结果也可能是 `seance`。扩展无法可靠得知宿主默认值。已否决。
- **模块默认关闭。** 默认保留推测执行，但不改设置的用户仍然会遇到失败。模块只改变宿主本来会拒绝的调用。已否决。
- **等待上游修复并记录规避方法。** 不增加新的组件行为，但当前宿主没有修复，用户会继续损失整批任务。作为唯一动作时已否决。

## 结果

- **已接受的推测启动损失。** 只有在未注册生命周期处理器且任务审批为自动允许时，OMP 才会在完整调用结束前启动批量子 Agent。seance schema 存在且模块启用时，每个启用 qol 的会话都会在每次批量 task 调用中失去提前启动，包括不带这两个字段的调用。启用了推测读取的用户也会失去该优化。这会给批量派发增加延迟。schema 没有 `sourceSession` 时不注册 handler，因此该成本不适用。
- **上游修复后仍付代价。** 如果后续宿主不再向非 seance 项暴露这两个字段但 schema 仍保留 `sourceSession`，处理器在当前进程内仍然注册，推测执行代价会持续到模块被关闭或停用。字段从 schema 消失时，下一激活报告 `unavailable` 且不注册 handler。
- **未来合法的 `model` 选择器。** 宿主若在暴露 `sourceSession` 的同时允许普通 Agent 通过 `model` 选择模型，该选择会被删除；当前 18.11.3 的 seance schema 不会这样。只有普通选择器的 schema 保持 `unavailable` 且不被改写。
- **输入改写的后写生效。** 多个扩展为同一次调用返回 `input` 时，宿主采用最后一个结果。qol 的改写可能覆盖另一个扩展的改写，也可能被后注册的处理器覆盖。每个处理器看到的都是原始输入。
- **覆盖不完整。** 没有可用 `agent` 的调用保持原样，结果取决于宿主默认 Agent 和原生校验；把字段放在批量顶层的调用也保持原样。用户可能把该模块理解为对所有 seance 字段错误的完整修复。
- **静默修正。** 模块隐藏模型的参数错误。`/qol` 计数器是唯一信号，提示词或 schema 的问题可能在无可见失败的情况下持续存在。
- **依赖宿主细节。** 清理依赖事件输入替换契约、`sourceSession` schema 标记、schema 默认行为和内建工具来源。宿主对任一项的变化都可能让模块失效，或删除宿主现在接受的字段。
- **验证缺口。** 自动检查覆盖改写规则、守卫、扁平与批次 seance schema 形态、model-only schema 和状态行。真实 OMP CLI 在 `18.11.3` 上以 `gpt-6-luna` 与 `ds-flash` 预设派发了一个带两个字段的非 seance 批次条目，清理后调用成功；推测启动的损失、真实 seance 条目、扁平单调用与多项批次仍未验证。
