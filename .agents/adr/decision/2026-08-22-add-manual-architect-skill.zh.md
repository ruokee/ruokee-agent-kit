# ADR 决定：添加手动启用的 architect Skill

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

[English](./2026-08-22-add-manual-architect-skill.md) | 中文

## 动机

Ruokee 希望添加一项第一方 `architect` Skill。这是新增能力的需求，不是对现有实现缺陷的修复。

这项 Skill 用于系统级架构分析、设计、审查、技术选型和演进。它应帮助 Agent 分析系统边界、数据与状态、质量属性、故障、规模和长期变化，并根据当前项目的事实给出判断。参考文档、原始资料和目录结构都服务于这项需求，不是需求本身。

Ruokee 希望自行决定何时使用这项能力，通常是在规划或设计时。日常编码或一般性讨论不得自动加载它。

## 决定

### 能力

仓库包含名为 `architect` 的第一方 Skill。英文内容位于 `skills/architect/`，中文变体位于 `variants/zh/skills/architect/`。

Skill 处理系统层面的分析、设计、审查、选型和演进。它不负责具体实现，也不替代项目事实、当前产品文档或用户决定。

主要推理能力来自模型本身。参考文档提供架构知识、判断依据、常见取舍和例子，不把架构工作固化成逐步执行的流程。

### 启用条件

手动调用通过配置保证，不靠正文反复声明。中英文变体都在 `SKILL.md` 前置元数据中设置 `disable-model-invocation: true`，并在 `agents/openai.yaml` 中设置 `policy.allow_implicit_invocation: false`。仅提出“做一下架构分析”之类的自然语言请求不会触发这项 Skill。

`description` 同时说明适用条件和覆盖范围：需要进行架构或系统设计时使用 `architect`，涵盖系统级分析、设计、审查、技术选型和演进。它不重复调用策略。

手动调用是这项 Skill 的定位，不是对可发现性的退让，也不应列为风险。多数任务不需要架构设计，误触会让工作偏离实际目标，其负面影响大于偶尔由模型主动发现适用场景的收益。

架构和系统层面的设计需要人参与。Agent 无法仅凭当前任务独立判断真实需求是否需要架构设计。显式调用表明人已经判断当前任务确实需要这项能力，并且清楚自己正在进行架构设计。

Matt Pocock 的 [Model-invoked vs user-invoked](https://github.com/mattpocock/skills/blob/321658273cb1d20b76026717d027d505790106d4/.agents/invocation.md) 也把由谁调用作为区分 Skill 定位的主轴：用户调用的 Skill 只有在人输入名称时才能启用，模型调用的 Skill 则可由模型或人使用。本提案沿用这一定位区分。

### 知识结构

`SKILL.md` 保持简短。调用策略放在前置元数据和 `agents/openai.yaml` 中，正文只保留职责范围、参考文档导航、证据要求和输出约定。Skill 不添加 `workflow/` 目录。

知识放在 `references/` 中，术语表沿用现有 Skill 的约定放在根目录。参考文档同时面向 Agent 和开发者。同一目录内的文档使用两位数字前缀，使列表保持稳定的阅读顺序。文件夹不编号，编号只用于目录导航，不要求 Agent 按顺序读取。这套编号约定只适用于 `architect`。

下面的树定义每个语言目录第一版交付的全部文件：29 篇 Markdown 文档，以及 `agents/openai.yaml` 调用策略。不交付文档子集。如果中文初稿审查后需要合并或拆分文档，先同步更新本 ADR 两个语言版本中的文件树和职责表，再重新分配编号。第一版仍交付更新后文件树中的全部文档。

```text
skills/architect/
  SKILL.md
  agents/
    openai.yaml
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

每篇文档的第一版重点如下。短句限定内容边界，不要求固定章节结构：

| 文档 | 内容边界 | 来源线索 |
|-|-|-|
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

第 23 至 25 章处理 AI 参与系统级架构工作时的约束表达、产出审查和质量验证，因此纳入 `ai/`。第 01 章以职业和学习动机为主，第 26 章讨论一般协作方式，第 35 至 40 章讨论 AI 原生组织，它们不属于第一版系统架构知识的重点。模板与案例可以为参考文档提供例子，但不作为独立模板库复制进 Skill。

### 参考资料与改写

[`awesome-architecture`](https://github.com/study8677/awesome-architecture/tree/7f43e49b95ad9c255418733738fddab4eb0f6a68) 是第一版的主题地图，决定 `references/` 覆盖哪些主题。项目证据、一手技术资料和其他可靠架构资料用于补充和校正技术判断，不要求 Skill 追踪上游的目录和措辞。

实现不能逐字复制教程。应围绕模型执行架构任务时需要的判断重新撰写。中英文 `SKILL.md` 都要链接评审所依据的上游版本，注明作者 JingWen Fan 和 MIT 许可证。参考文档不追踪上游仓库的每次更新。

教学内容不需要一律删除。原文中的解释、推导、反例、完整案例和经验判断，如果能帮助模型理解为什么这样判断，就应保留并调整侧重点。需要改写的是面向课程进度、读者练习或连续阅读的组织方式。

架构决策相关参考只讲决策方法，并服从项目现有的记录约定。例如在本仓库中应使用 ADR，而不是另建一种决策记录格式。这是普通的本地规则要求。

### 开发次序

中文变体先完成，并接受了主题覆盖、文档切分、技术判断、例子和实际架构任务可用性审查。中文版本通过后，再撰写英文正式 Skill。

英文版本根据审定后的中文语义自然表达，不逐句翻译。两种语言已经完整并保持语义一致。这个次序利用了中文材料，同时保持本仓库规定的英文路径为对外发布默认入口。

## 考虑过的替代方案

**直接采用 `architecture-copilot`。** 它已经提供一项相关 Skill，但参考资料压缩较多，交互方式也偏向持续提问。本提案以 `awesome-architecture` 作为第一版主题地图，并按照当前需求重新设计 references，因此不能直接采用它。

**添加任务工作流。** 工作流可以统一输出步骤，但会把模型的架构推理限制在预设流程中。当前需求只需要简短的 Skill 入口和参考资料，没有证据表明还需要 `workflow/` 层。

**把所有知识放进一个文件。** 单文件简单，但系统设计、分布式系统、安全、演进和技术选型会互相混在一起。按主题切分更容易只读取当前问题需要的内容。

**允许自动启用。** 自动启用有偶尔发现适用场景的收益，但误触会把不需要架构设计的任务带偏。模型也无法仅凭当前任务独立判断真实需求是否需要架构设计，因此误触成本更高。

## 结果

- `architect` 的英文内容位于 `skills/architect/`，中文内容位于 `variants/zh/skills/architect/`，用于系统级分析、设计、审查、技术选型和演进，不负责具体实现。
- 中英文变体都在 `SKILL.md` 中设置 `disable-model-invocation: true`，并在 `agents/openai.yaml` 中设置 `policy.allow_implicit_invocation: false`，由配置保证手动调用。`description` 说明何时需要架构或系统设计，并概括覆盖范围。
- 每个变体包含 29 篇 Markdown 文档：简短的 `SKILL.md`、根目录术语表、14 篇核心参考、5 篇 AI 参考和 8 篇技术选型参考。没有 `workflow/` 目录。参考文件只在各自目录内使用两位数字前缀。
- `awesome-architecture` 固定提交 `7f43e49b95ad9c255418733738fddab4eb0f6a68` 仍是主题地图。中英文 `SKILL.md` 都注明 JingWen Fan 和 MIT 许可证，发布内容经过重写，不逐字复制上游材料。
- 参考文档保留支撑判断的解释、推导、反例和案例。架构决策知识服从当前项目的记录约定，不另设一套格式。
- 中文变体先完成并通过审查，英文版本随后完成。两个版本又经过语义一致性、技术准确性、来源和链接审查。
- 中英文能力索引说明手动调用条件和职责范围。已实现文件通过仓库检查。

主题拆分用一定的导航和组合成本换取按需阅读。如果关联知识变得难以一起定位，应调整文档边界，而不是提前增加另一套导航系统。

参考文档保留理由和取舍，不压缩成只有结论和检查项，也不继续沿用对架构任务无帮助的课程节奏和读者练习。

这项能力仍依靠模型推理，不能保证每次分析都正确。因此，输出继续区分项目事实、假设、建议和由用户决定的事项，并在缺少证据时说明不确定性。
