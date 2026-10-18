---
name: architect
description: 用于跨模块、服务或部署边界的系统级架构分析、设计、审查、技术选型或演进，尤其是系统边界、数据与状态归属、质量属性、故障、规模或长期变化。不要用于单模块设计、具体实现、代码级审查、产品行为、优先级排序、一般讨论或只提到架构的情况。
metadata:
  version: "1.0.8"
---

# 架构

使用本技能进行系统层面的架构（Architecture）分析、设计、审查、技术选型和演进。主要推理由模型完成；参考文档提供架构知识、判断依据、常见取舍和例子，不把架构工作固化成固定步骤。

## 职责范围

职责范围（Scope）：本技能处理系统边界、数据与状态、质量属性、故障、规模和长期变化等系统层面的判断，覆盖分析、设计、审查、选型和演进五类工作。适用边界：单模块内部设计、编码实现、代码级质量审查不在范围内；产品行为定义与优先级排序不在范围内；这两类按各自常规流程处理。

本技能不负责具体实现。项目事实以当前代码和配置为准，产品行为以产品文档为准，优先级取舍由用户决定，本技能不替代其中任何一项。记录架构决策时服从当前项目的记录约定。

## 参考导航

参考导航（Reference Navigation）：按当前问题的信号选择文档，只读取需要的内容。编号只用于目录导航，不要求按顺序读取。

- 从需求、约束和质量属性形成架构判断时，读[架构判断](./references/01-architecture-judgment.md)；搭配 system-design 和 technology-selection/principles。
- 拆解陌生系统时，从代码、配置和运行证据入手，读[系统分析](./references/02-system-analysis.md)；搭配 views 和 distributed-systems。
- 选择视图和抽象层级来表达边界、关系和数据流时，读[视图](./references/03-views.md)；搭配 system-analysis。
- 比较单体、微服务、事件驱动等架构风格的适用条件时，读[架构风格](./references/04-architecture-styles.md)；搭配 organization。
- 处理状态归属、数据生命周期和存储边界时，读[数据归属](./references/05-data-ownership.md)；搭配 consistency 和 technology-selection/data-stores。
- 从需求推导完整、可验证的系统设计时，读[系统设计](./references/06-system-design.md)；搭配 architecture-judgment 和 scaling。
- 记录候选方案、取舍、后果和重审条件时，读[架构决策](./references/07-architecture-decisions.md)；搭配 architecture-judgment。
- 面对网络、时间、并发和部分失败带来的约束时，读[分布式系统](./references/08-distributed-systems.md)；搭配 consistency 和 resilience。
- 处理一致性模型、事务边界和冲突时，读[一致性](./references/09-consistency.md)；搭配 distributed-systems 和 data-ownership。
- 设计超时、重试、幂等、隔离和降级时，读[韧性](./references/10-resilience.md)；搭配 distributed-systems 和 scaling。
- 根据负载证据识别瓶颈并选择扩展方式时，读[规模化](./references/11-scaling.md)；搭配 data-ownership。
- 拆分、迁移、回滚、退役或判断演进触发信号时，读[演进](./references/12-evolution.md)；搭配 architecture-decisions 和 organization。
- 分析团队归属、沟通结构与系统边界的关系时，读[组织](./references/13-organization.md)；搭配 architecture-styles 和 evolution。
- 处理信任边界、身份权限、数据隔离和多租户风险时，读[安全](./references/14-security.md)；搭配 data-ownership。
- 评估 AI 组件带来的不确定性、成本和能力边界时，读 [AI 时代的架构判断](./references/ai/01-ai-era-judgment.md)；搭配 ai/ai-system-design。
- 界定模型、上下文、工具、记忆和编排的系统边界时，读 [AI 系统设计](./references/ai/02-ai-system-design.md)；搭配 ai/ai-era-judgment 和 ai/evaluation-driven-architecture。
- 把架构约束写成 AI 可执行、可验证的规格时，读[面向 AI 的规格](./references/ai/03-specifications-for-ai.md)；搭配 ai/reviewing-ai-output。
- 审查 AI 架构产出的特有遗漏时，读[审查 AI 产出](./references/ai/04-reviewing-ai-output.md)；搭配 consistency、resilience、scaling 和 security。
- 用评测目标、数据集和反馈定义 AI 系统质量时，读[评测驱动架构](./references/ai/05-evaluation-driven-architecture.md)；搭配 ai/ai-system-design。
- 处理技术选型的通用问题、比较维度和退出条件时，读[选型原则](./references/technology-selection/01-principles.md)；搭配 architecture-decisions。
- 评估语言与后端框架的约束、团队适配和维护成本时，读[语言](./references/technology-selection/02-languages.md)；搭配 technology-selection/principles。
- 评估数据存储的数据模型、一致性和运维代价时，读[数据存储](./references/technology-selection/03-data-stores.md)；搭配 data-ownership 和 consistency。
- 理解缓存、消息队列和事件系统各自解决的问题时，读[消息](./references/technology-selection/04-messaging.md)；搭配 consistency 和 resilience。
- 评估 API 和服务通信方式的耦合、性能与演进成本时，读[通信](./references/technology-selection/05-communication.md)；搭配 architecture-styles。
- 评估部署形态和云平台的交付、弹性与运维约束时，读[部署](./references/technology-selection/06-deployment.md)；搭配 scaling 和 security。
- 了解可观测性与可靠性工具如何支撑故障检测和响应时，读[可观测性](./references/technology-selection/07-observability.md)；搭配 resilience。
- 评估 AI 基础设施在训练、推理、数据和成本上的取舍时，读 [AI 基础设施](./references/technology-selection/08-ai-infrastructure.md)；搭配 ai/ai-era-judgment 和 ai/evaluation-driven-architecture。

术语含义或中英文对应不清楚时，读取[术语表](./glossary.md)。

## 证据要求

证据要求（Evidence Requirements）如下：

- 区分项目事实、假设、建议和由用户决定的事项，在输出中显式标注类别。
- 判断优先依据当前项目的代码、配置和运行证据；参考文档提供通用判断依据，不替代项目事实。项目事实给出 `path:line`、配置键、命令输出或观测时间窗。
- 缺少证据时说明不确定性，不要用通用假设冒充项目证据。
- 带数字的公司案例、影响决策且可能随版本变化的产品能力、外部研究结论，必须给一手来源及发布日期、产品版本或访问日期；稳定的类别级判断和无法核验的经验数值不需要逐项引用，后者明确标为启发式，不当升级开关；纯推导结论不需要外部引用。
- 派生结论（估算、容量推导、成本测算）展示输入、公式和不确定性。
- 输出至少区分：已观察（有项目证据）、由事实推导、未验证假设、建议、用户决策。
- 引用上游资料只作为判断依据的出处，不作为决定本身。

## 输出约定

输出约定（Output Contract）如下：

- 给出候选方案、每个方案的取舍和适用条件，而不是唯一答案；说清每个判断依赖的假设。
- 把技术取舍翻译成成本、风险和时间等业务后果；优先级由用户排定。
- 分析和设计输出以视图和边界描述为主；是否进入实现由用户决定。

## 来源

来源（Sources）：参考文档的主题地图来自 [awesome-architecture](https://github.com/study8677/awesome-architecture/tree/7f43e49b95ad9c255418733738fddab4eb0f6a68)（作者 JingWen Fan，[MIT 许可证](https://github.com/study8677/awesome-architecture/blob/7f43e49b95ad9c255418733738fddab4eb0f6a68/LICENSE)）。
