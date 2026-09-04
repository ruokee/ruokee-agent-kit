---
name: architect
description: 当需要进行架构或系统设计时使用，涵盖系统级架构分析、设计、审查、技术选型与演进。
disable-model-invocation: true
---

# 架构（Architecture）

使用本技能进行系统层面的架构分析、设计、审查、技术选型和演进。主要推理由模型完成；参考文档提供架构知识、判断依据、常见取舍和例子，不把架构工作固化成固定步骤。

## 职责范围（Scope）

本技能处理系统边界、数据与状态、质量属性、故障、规模和长期变化等系统层面的判断，覆盖分析、设计、审查、选型和演进五类工作。适用边界：单模块内部设计、编码实现、代码级质量审查不在范围内；产品行为定义与优先级排序不在范围内；这两类按各自常规流程处理。

本技能不负责具体实现。项目事实以当前代码和配置为准，产品行为以产品文档为准，优先级取舍由用户决定，本技能不替代其中任何一项。记录架构决策时服从当前项目的记录约定。

## 参考导航（Reference Navigation）

按当前问题的信号选择文档，只读取需要的内容。编号只用于目录导航，不要求按顺序读取。

| 信号 | 优先读取 | 常搭配阅读 |
| --- | --- | --- |
| 从需求、约束和质量属性形成架构判断；取舍框架 | [架构判断与取舍](./references/01-thinking-and-tradeoffs.md) | system-design, technology-selection/principles |
| 拆解陌生系统：从代码、配置和运行证据入手 | [系统分析](./references/02-system-analysis.md) | views, distributed-systems |
| 选择视图和抽象层级，表达边界、关系和数据流 | [视图](./references/03-views.md) | system-analysis |
| 比较单体、微服务、事件驱动等架构风格的适用条件 | [架构风格](./references/04-architecture-styles.md) | organization-and-ownership |
| 状态归属、数据生命周期、存储边界 | [数据与状态](./references/05-data-and-state.md) | consistency, technology-selection/data-stores |
| 从需求推导完整、可验证的系统设计 | [系统设计](./references/06-system-design.md) | thinking-and-tradeoffs, scaling |
| 记录候选方案、取舍、后果和重审条件 | [架构决策](./references/07-architecture-decisions.md) | thinking-and-tradeoffs |
| 网络、时间、并发和部分失败带来的约束 | [分布式系统](./references/08-distributed-systems.md) | consistency, resilience |
| 一致性模型、事务边界、冲突处理 | [一致性](./references/09-consistency.md) | distributed-systems, data-and-state |
| 超时、重试、幂等、隔离和降级设计 | [韧性](./references/10-resilience.md) | distributed-systems, scaling |
| 根据负载证据识别瓶颈并选择扩展方式 | [规模化](./references/11-scaling.md) | data-and-state |
| 拆分、迁移、回滚、退役；演进触发信号 | [演进与迁移](./references/12-evolution-and-migration.md) | architecture-decisions, organization-and-ownership |
| 团队归属、沟通结构与系统边界的关系 | [组织与归属](./references/13-organization-and-ownership.md) | architecture-styles, evolution-and-migration |
| 信任边界、身份权限、数据隔离、多租户风险 | [安全与多租户](./references/14-security-and-tenancy.md) | data-and-state |
| AI 组件带来的不确定性、成本和能力边界 | [AI 时代的架构判断](./references/ai/01-ai-era-judgment.md) | ai/ai-system-design |
| 模型、上下文、工具、记忆和编排的系统边界 | [AI 系统设计](./references/ai/02-ai-system-design.md) | ai/01-ai-era-judgment, ai/05-evaluation-driven |
| 把架构约束写成 AI 可执行、可验证的规格 | [面向 AI 的规格](./references/ai/03-specifications-for-ai.md) | ai/04-reviewing-ai-output |
| 审查 AI 架构产出的特有遗漏 | [审查 AI 产出](./references/ai/04-reviewing-ai-output.md) | consistency, resilience, scaling, security-and-tenancy |
| 用评测目标、数据集和反馈定义 AI 系统质量 | [评测驱动](./references/ai/05-evaluation-driven-architecture.md) | ai/02-ai-system-design |
| 技术选型的通用问题、比较维度和退出条件 | [选型原则](./references/technology-selection/01-principles.md) | architecture-decisions |
| 语言与后端框架的约束、团队适配、维护成本 | [语言与框架](./references/technology-selection/02-languages-and-frameworks.md) | technology-selection/01-principles |
| 数据存储的数据模型、一致性和运维代价 | [数据存储](./references/technology-selection/03-data-stores.md) | data-and-state, consistency |
| 缓存、消息队列和事件系统各自解决的问题 | [缓存、消息与事件](./references/technology-selection/04-cache-messaging-and-events.md) | consistency, resilience |
| API 和服务通信方式的耦合、性能与演进成本 | [API 与通信](./references/technology-selection/05-api-and-communication.md) | architecture-styles |
| 部署形态和云平台的交付、弹性与运维约束 | [云与部署](./references/technology-selection/06-cloud-and-deployment.md) | scaling, security-and-tenancy |
| 可观测性与可靠性工具如何支撑故障检测和响应 | [可观测性与可靠性](./references/technology-selection/07-observability-and-reliability.md) | resilience |
| AI 基础设施在训练、推理、数据和成本上的取舍 | [AI 基础设施](./references/technology-selection/08-ai-infrastructure.md) | ai/01-ai-era-judgment, ai/05-evaluation-driven |

术语含义或中英文对应不清楚时，读取[术语表](./glossary.md)。

## 证据要求（Evidence Requirements）

- 区分项目事实、假设、建议和由用户决定的事项，在输出中显式标注类别。
- 判断优先依据当前项目的代码、配置和运行证据；参考文档提供通用判断依据，不替代项目事实。项目事实给出 `path:line`、配置键、命令输出或观测时间窗。
- 缺少证据时说明不确定性，不要用通用假设冒充项目证据。
- 带数字的公司案例、影响决策且可能随版本变化的产品能力、外部研究结论，必须给一手来源及发布日期、产品版本或访问日期；稳定的类别级判断和无法核验的经验数值不需要逐项引用，后者明确标为启发式，不当升级开关；纯推导结论不需要外部引用。
- 派生结论（估算、容量推导、成本测算）展示输入、公式和不确定性。
- 输出至少区分：已观察（有项目证据）、由事实推导、未验证假设、建议、用户决策。
- 引用上游资料只作为判断依据的出处，不作为决定本身。

## 输出约定（Output Contract）

- 给出候选方案、每个方案的取舍和适用条件，而不是唯一答案；说清每个判断依赖的假设。
- 把技术取舍翻译成成本、风险和时间等业务后果；优先级由用户排定。
- 分析和设计输出以视图和边界描述为主；是否进入实现由用户决定。

## 来源与许可（Sources）

参考文档的主题地图来自 [awesome-architecture](https://github.com/study8677/awesome-architecture/tree/7f43e49b95ad9c255418733738fddab4eb0f6a68)（作者 JingWen Fan，[MIT 许可证](https://github.com/study8677/awesome-architecture/blob/7f43e49b95ad9c255418733738fddab4eb0f6a68/LICENSE)）。
