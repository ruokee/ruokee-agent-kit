# ADR 决定：允许模型调用 architect

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Reverses: [添加手动启用的 architect Skill](../archived/2026-08-22-add-manual-architect-skill.zh.md)

[English](./2026-09-18-make-architect-model-invoked.md) | 中文

## 动机

仓库提供第一方 `architect` Skill，用于系统级架构分析、设计、审查、技术选型和演进。它的参考导航、证据要求和输出约定帮助 Agent 根据项目事实判断系统边界、数据与状态、质量属性、故障、规模和长期变化。

任务可能已经明确要求这类工作，却没有说出 Skill 名称。要求用户记住名称，可能使 Agent 在没有加载仓库架构指引的情况下直接开展架构工作。任务出现明确的系统级信号时，Agent 应加载 architect；用户仍可显式调用，普通工程或产品工作仍处于触发范围之外。

## 决定

### 能力与范围

在 `skills/architect/` 保留独立完整的英文 Skill，在 `variants/zh/skills/architect/` 保留完整中文变体。每个组件都覆盖系统级架构分析、设计、审查、技术选型和演进。

Skill 处理系统边界、数据与状态归属、质量属性、故障、规模和长期变化等判断。它不负责具体实现、单模块内部设计、代码级质量审查、产品行为定义或优先级排序。项目事实来自当前代码与配置，产品行为来自当前产品文档，优先级由用户决定。

主要推理能力来自模型本身。参考文档提供架构知识、判断依据、常见取舍和例子，不把架构工作固化成固定步骤。架构决策知识服从当前项目的记录约定。

### 调用契约

Architect 由模型调用。中英文变体均不设置 `disable-model-invocation`，组件中也不包含阻止隐式调用的 `agents/openai.yaml` 策略。

任务需要系统级架构分析、设计、审查、技术选型或演进时使用 architect。正向信号包括跨越模块、服务或部署边界的决定，以及有关系统边界、数据与状态归属、质量属性、故障、规模或长期变化的判断。

单模块内部设计、具体实现、代码级质量审查、产品行为、优先级排序、一般讨论，以及只提到架构或该 Skill 却没有要求系统级架构工作的情况，不触发 architect。

这些信号约束模型调用或隐式调用。宿主支持 Skill 命令时，即使原始请求不符合模型调用信号，用户仍可显式调用 architect。加载 Skill 不扩大其范围，也不授权进入实现。

中英文前置元数据中的描述以一致语义提供正向和排除信号。Skill 加载后，正文仍是详细行为的权威来源。

### 知识结构

每种语言组件包含 29 篇 Markdown 文档：`SKILL.md`、根目录术语表、14 篇核心参考、5 篇 AI 参考和 8 篇技术选型参考。组件没有 `agents/` 或 `workflow/` 目录。同一参考目录内的文档使用两位数字前缀，以保持稳定导航；目录不编号，编号也不要求顺序阅读。

```text
skills/architect/
  SKILL.md
  glossary.md
  references/
    01-thinking-and-tradeoffs.md
    02-system-analysis.md
    03-views.md
    04-architecture-styles.md
    05-data-and-state.md
    06-system-design.md
    07-architecture-decisions.md
    08-distributed-systems.md
    09-consistency.md
    10-resilience.md
    11-scaling.md
    12-evolution-and-migration.md
    13-organization-and-ownership.md
    14-security-and-tenancy.md
    ai/
      01-ai-era-judgment.md
      02-ai-system-design.md
      03-specifications-for-ai.md
      04-reviewing-ai-output.md
      05-evaluation-driven-architecture.md
    technology-selection/
      01-principles.md
      02-languages-and-frameworks.md
      03-data-stores.md
      04-cache-messaging-and-events.md
      05-api-and-communication.md
      06-cloud-and-deployment.md
      07-observability-and-reliability.md
      08-ai-infrastructure.md
```

各文档承担以下职责：

| 文档 | 内容边界 | 来源线索 |
| --- | --- | --- |
| `SKILL.md` | 写明职责边界、导航、证据和输出约定。 | 本 ADR |
| `glossary.md` | 定义 Skill 使用的架构术语及中英文对应。 | 术语表 |
| `references/01-thinking-and-tradeoffs.md` | 从需求、约束和质量属性形成架构判断。 | 第 02、06、09 章 |
| `references/02-system-analysis.md` | 从代码、配置和运行证据拆解陌生系统。 | 第 18 章 |
| `references/03-views.md` | 选择视图并用图表达边界、关系和数据流。 | 第 03 章 |
| `references/04-architecture-styles.md` | 比较常见架构风格的适用条件与取舍。 | 第 04 章 |
| `references/05-data-and-state.md` | 说明状态归属、数据生命周期和存储边界。 | 第 05 章 |
| `references/06-system-design.md` | 展示从需求到可验证系统设计的完整推导。 | 第 07、19 章 |
| `references/07-architecture-decisions.md` | 记录候选方案、取舍、后果和重审条件。 | 第 08 章 |
| `references/08-distributed-systems.md` | 说明网络、时间、并发和部分失败带来的约束。 | 第 10 章 |
| `references/09-consistency.md` | 比较一致性模型、事务边界和冲突处理方法。 | 第 11 章 |
| `references/10-resilience.md` | 说明超时、重试、幂等、隔离和降级设计，以及 RPO/RTO 与恢复设计。 | 第 12 章 |
| `references/11-scaling.md` | 根据负载证据识别瓶颈并选择扩展方式。 | 第 13 章 |
| `references/12-evolution-and-migration.md` | 根据演进触发信号和技术债证据规划拆分、迁移、回滚和退役。 | 第 08、14、20、21 章与《演进触发信号》附录 |
| `references/13-organization-and-ownership.md` | 说明团队归属、沟通结构与系统边界的关系。 | 第 08、15 章 |
| `references/14-security-and-tenancy.md` | 说明信任边界、身份权限、数据隔离和多租户风险。 | 第 16 章 |
| `references/ai/01-ai-era-judgment.md` | 说明 AI 组件带来的不确定性、成本和能力边界。 | 第 17 章 |
| `references/ai/02-ai-system-design.md` | 说明模型、上下文、工具、记忆和编排的系统边界。 | 第 22 章 |
| `references/ai/03-specifications-for-ai.md` | 把架构约束写成 AI 可执行、可验证的规格。 | 第 23 章 |
| `references/ai/04-reviewing-ai-output.md` | 只审查 AI 架构产出特有的遗漏，一致性、韧性、扩展和安全复用对应主题文档。 | 第 24 章 |
| `references/ai/05-evaluation-driven-architecture.md` | 用评测目标、数据集和反馈定义 AI 系统质量。 | 第 25 章 |
| `references/technology-selection/01-principles.md` | 给出技术选型的通用问题、比较维度和退出条件。 | 第 34 章 |
| `references/technology-selection/02-languages-and-frameworks.md` | 比较语言与后端框架的约束、团队适配和维护成本。 | 第 27 章 |
| `references/technology-selection/03-data-stores.md` | 比较数据存储的数据模型、一致性和运维代价。 | 第 28 章 |
| `references/technology-selection/04-cache-messaging-and-events.md` | 区分缓存、消息队列和事件系统解决的问题与边界。 | 第 29 章 |
| `references/technology-selection/05-api-and-communication.md` | 比较 API 和服务通信方式的耦合、性能与演进成本。 | 第 30 章 |
| `references/technology-selection/06-cloud-and-deployment.md` | 比较部署形态和云平台的交付、弹性与运维约束。 | 第 31 章 |
| `references/technology-selection/07-observability-and-reliability.md` | 说明可观测性与可靠性工具如何支撑故障检测和响应需求。 | 第 32 章 |
| `references/technology-selection/08-ai-infrastructure.md` | 比较 AI 基础设施在训练、推理、数据和成本上的取舍。 | 第 33 章 |

第 23 至 25 章处理 AI 参与系统级架构工作时的约束表达、产出审查和质量验证，因此纳入 `ai/`。第 01 章以职业和学习动机为主，第 26 章讨论一般协作方式，第 35 至 40 章讨论 AI 原生组织，它们不是这项系统架构 Skill 的重点。模板与案例可以提供例子，但不作为独立模板库复制进 Skill。

### 证据与输出约定

Skill 区分已观察的项目事实、由事实推导的结论、未验证假设、建议和用户决定。项目事实引用当前代码、配置、运行证据或观测时间窗。派生估算展示输入、公式和不确定性。可能随版本变化的外部能力主张及带数字的案例使用包含日期或版本的一手来源。

输出给出候选方案、取舍、适用条件和依赖的假设，并把技术选择转化为成本、风险和时间后果。分析和设计以系统视图和边界为主，是否进入实现由用户决定。

### 参考资料与改写

[`awesome-architecture`](https://github.com/study8677/awesome-architecture/tree/7f43e49b95ad9c255418733738fddab4eb0f6a68) 是参考范围的主题地图和内容来源。项目证据、一手技术资料和其他可靠架构资料用于补充和校正技术判断。Skill 不追踪上游目录结构或措辞。

发布内容围绕模型执行架构任务时需要的判断独立编写，不逐字复制上游材料。中英文 `SKILL.md` 都注明 JingWen Fan 和 MIT 许可证，并链接审查过的上游版本。参考文档不追踪上游的每次更新。

解释、推导、反例、完整案例和经验判断能够帮助模型理解方案为何适用时予以保留。面向课程进度、读者练习或连续阅读的组织方式不纳入 Skill。

## 考虑过的替代方案

**保留手动调用。** 被反转的决定选择由用户主动启用，并防止自动误触。同时，任务可能已经明确要求系统级架构工作，Agent 仍无法加载仓库的架构指引，除非用户记得 Skill 名称。

**直接采用 `architecture-copilot`。** 它提供相关 Skill，但参考资料压缩较多，交互方式也偏向持续提问。仓库选择独立编写能力，并按当前契约设计参考资料。

**添加任务工作流。** 工作流可以统一输出步骤，但会把模型推理限制在预设流程中。这项能力需要简短的 Skill 入口和参考导航，不需要 `workflow/` 层。

**把所有知识放进一个文件。** 单文件会把系统设计、分布式系统、安全、演进和技术选型混在一起。按主题切分后，Agent 可以只读取当前问题需要的内容。

## 结果

- Architect 可以根据明确的系统级任务信号加载，也可以由用户显式调用。误触仍有可能，因此能力目录中的描述提供收窄的正向和排除信号。
- 中英文公开能力索引把 architect 列为由 Agent 触发。`grill-me` 继续通过自身配置由用户主动调用。
- 每种语言组件保留 29 篇 Markdown 文档、术语表和参考资料布局，并且没有 `workflow/` 目录。策略专用的 `agents/openai.yaml` 文件被删除。
- 系统级职责、来源与许可义务、证据要求、参考导航和输出约定继续生效。具体实现和产品优先级工作仍处于 Skill 范围之外。
- 两种语言变体继续保持完整和语义一致。模型、宿主和语言差异仍可能产生不同的触发判断，因此真实宿主检查记录环境与加载证据。
- 这项能力仍依靠模型推理，不能保证分析一定正确。输出继续区分证据、推导、假设、建议和用户决定。
