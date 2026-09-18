# ADR 提案：允许模型调用 architect

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

[English](./2026-09-18-make-architect-model-invoked.md) | 中文

## 动机

[当前 architect 决定](../decision/2026-08-22-add-manual-architect-skill.zh.md)把这项 Skill 定义为由用户调用。中英文变体都禁止模型调用，公开能力索引则把 architect 列在“由用户触发的”分组中。

即使任务已经明确要求系统级架构工作，现有契约仍要求用户说出 Skill 名称。Agent 可能直接进行架构分析或设计，却没有加载 architect 的参考导航、证据要求和输出约定。

Ruokee 希望 Agent 在任务本身出现明确的系统级架构信号时加载 architect，同时保留用户显式调用。普通工程和产品工作仍应处于模型调用范围之外。

## 提议

### 调用契约

将中英文 architect 变体改为由模型调用。从两个 `SKILL.md` 删除 `disable-model-invocation: true`，并删除两个设置 `policy.allow_implicit_invocation: false` 的 `agents/openai.yaml`。目前只有 architect 和 grill-me 同时使用这两项手动调用限制。从 architect 移除后，grill-me 仍由用户调用，architect 的组件形态则与其他由模型调用的 Skill 一致。支持 Skill 命令的宿主仍可接受用户显式调用。

任务需要系统级架构分析、设计、审查、技术选型或演进时使用 architect。触发信号包括跨越模块、服务或部署边界的决定，以及有关系统边界、数据与状态归属、质量属性、故障、规模或长期变化的判断。

单模块内部设计、具体实现、代码级质量审查、产品行为、优先级排序和一般讨论不触发 architect。只提到架构或 architect Skill，但没有要求系统级架构工作，也不构成触发信号。

这些正向和排除信号只约束模型调用或隐式调用。宿主支持 Skill 命令时，用户显式调用应加载 architect，即使原始请求不满足模型调用信号。加载 Skill 不扩大其范围，也不授权进入实现。

收紧中英文前置元数据中的 `description`，让能力目录提供语义一致的正向和排除信号。描述只说明适用条件和范围，不复述调用策略。Skill 加载后，正文仍是详细行为的权威来源。

### 保留的能力契约

保留现有的系统级范围、29 篇 Markdown 文档、术语表与参考资料布局、没有 `workflow/` 目录的结构、来源与许可义务、参考导航、证据要求和输出约定。组件文件树只删除两个策略专用的 `agents/openai.yaml`。替代决定必须同步更新文件树、职责说明和数量描述，不能继续保留已经删除的策略文件。实现只改变 Agent 取得这项能力的方式，不把 architect 变成实现工作流，也不把代码级工作或产品优先级纳入范围。

### 决定替换与文档

本提案与当前决定中的手动调用选择冲突。如果提案获准并完成实现，将反转[添加手动启用的 architect Skill](../decision/2026-08-22-add-manual-architect-skill.zh.md)。替代决定必须把本提案获准的调用契约与当前决定中仍然有效的规则合并为一份完整决定。

在 [README.md](../../../README.md) 和 [README.zh.md](../../../README.zh.md) 中，把 architect 从用户触发分组移到 Agent 触发分组。

修复所有指向当前决定的引用及其承载的陈述，不能只替换链接目标。已知引用包括 [grill-me 决定](../decision/2026-09-06-add-grill-me-skill.zh.md)、活跃的 [ADR 维护提案](./2026-09-03-add-adr-maintenance-skill.zh.md)和活跃的 [well-said 提案](./2026-09-12-add-well-said-skill.zh.md)。grill-me 决定必须自行说明并负责自己的用户调用配置，不再依赖 architect 的调用契约或配置惯例。ADR 维护提案必须直接说明手动调用替代方案，不能继续把 architect 当作当前先例。well-said 提案应把来源与改写示例指向 architect 替代决定中的对应章节。

## 考虑过的替代方案

**保留手动调用。** 当前 architect 决定采用了这条路径。它让用户主动选择何时使用该 Skill，并防止自动误触。同时，任务可能已经明确要求系统级架构工作，Agent 仍无法加载仓库的架构指引，除非用户记得 Skill 名称。

## 验收标准

1. 中英文 architect 组件都由模型调用：两个 `SKILL.md` 均不包含 `disable-model-invocation`，两个组件也均不包含 `agents/openai.yaml`。
2. 中英文描述以一致含义落实上文的调用契约，公开能力索引把 architect 列入“由 Agent 触发的”分组。
3. 在支持 Skill 命令的宿主中，至少有一个不满足模型调用信号的请求仍可通过用户显式调用加载 architect。
4. 上文保留的能力契约不变。替代决定中的组件文件树和数量说明不再包含 `agents/openai.yaml`，并继续保留 29 篇 Markdown 文档、术语表与参考资料布局，以及没有 `workflow/` 目录的结构。
5. 每份新决定通过 `Reverses` 链接到同语言的归档决定。每份归档文件包含 `Archived: YYYY-MM-DD`，其后是指向同语言新决定的 `Reversed by`，语言链接位于完整元数据块之后。实施时把两个旧文件移入 `archived/`，并删除已经消费的提案。
6. 按照上文要求，修复所有指向被反转决定的引用及其周围的事实或契约陈述。当前记录不得把已归档决定当作当前权威来源。
7. 按当前项目测试规则通过真实 OMP CLI 验证上文调用契约中的全部正向和排除信号，并验证用户显式调用一个排除场景。记录准确输入、预期结果、实际 Skill 加载证据、模型与宿主版本、语言变体和限制。仅凭最终回答内容不能证明 Skill 已加载。

## 风险

如果描述仍然过宽，architect 可能在普通工程讨论中加载。额外上下文和系统级框架可能使小任务偏离实际范围。

不同模型、宿主或语言可能对同一能力目录描述作出不同判断。一种变体可能漏掉适用的架构工作，或在另一种变体明确排除的请求中加载，造成支持环境之间的行为不一致。

如果实现归档当前决定时没有修复全部相关引用，当前决定或提案可能继续把已归档选择当作当前权威，导致 ADR 集合内部不一致。
