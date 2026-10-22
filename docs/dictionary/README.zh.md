# 词典

[English](./README.md) | 中文

本词典是本仓库开发工作的共享词汇表。它是共享词的权威定义：在仓库文档、规则、规格、决定、任务材料和围绕本仓库工作的讨论中，使用词典的规范用词和定义。

每个词条给出规范英文用词、对应中文术语和一句定义。带链接的词条有说明页，包含机制、示例和边界说明；没有链接的词条只在这里定义。

组件术语表保留各自的副本，供安装到其他项目后使用。本词典只覆盖本仓库的开发工作。

## 仓库与组件

**[组件](./component.zh.md)**（component）

以宿主原生或构建原生格式维护的第一方能力，带有自己的文档、检查和版本。

**能力**（capability）

仓库以组件形式分发的 Agent 功能单元，例如技能、扩展、可执行程序或宿主包。

**[技能](./skill.zh.md)**（Skill）

宿主可发现的一组指令，包含 `SKILL.md` 和辅助文件。公开 Skill 是自包含组件，内部项目 Skill 属于仓库维护材料。

**[语言变体](./component.zh.md#语言变体)**（language variant）

组件的完整翻译，与英文基础版具有相同的文件集和范围，并排维护。

**扩展**（extension）

改变或增加 Harness 行为的宿主插件或运行时附加项，不是技能。

**[宿主](./agent.zh.md#宿主)**（host）

发现、加载并运行组件的 Agent Harness 或产品。

**[技能根目录](./skill.zh.md#技能根目录)**（skill root）

容纳已安装技能目录的父目录，每个技能位于 `<skill root>/<name>/`。

**[自包含](./component.zh.md#自包含)**（self-contained）

可分发组件的属性：文件只引用该组件内部的文件，代码不依赖仓库中的其他内容。组件正文可以声明其他组件、工具或 Skill 作为运行时前置条件。

**[用户调用](./skill.zh.md#用户调用)**（user-invoked）

需要用户显式命令才会加载的技能调用方式，例如 `/skill:grill-me`。

**[Agent 调用](./skill.zh.md#agent-调用)**（Agent-invoked）

任务匹配时允许模型自行加载技能的调用方式。

**选择器**（selector）

把变更路径映射到受影响检查的 check-changed 脚本；分类不确定时回退到完整检查。

**受影响检查**（affected check）

为一次变更选出的检查子集，通常在开发过程中和请求审查前运行。

**完整检查**（complete check）

在干净、已提交的最终候选上运行的全部仓库检查，用于合入之前。

## 文档与决策

**[规格](./spec.zh.md)**（spec）

对目标状态及其验收的说明：长期组件或仓库规格位于 `.agents/spec/`，任务规格（Task Spec）说明单个任务的需求和验收条件。

**[不变量](./spec.zh.md#不变量)**（invariant）

规格要求在不同变更之间保持为真的属性，与实现细节无关。

**[验收条件](./spec.zh.md#验收条件)**（acceptance criterion）

区分符合要求的结果与偏离的可观察条件。

**[公共面](./spec.zh.md#公共面)**（public surface）

用户或其他组件依赖的命令、格式、文件和行为；变更必须保留或同步更新它们。

**[范围外](./spec.zh.md#范围外)**（out of scope）

组件或仓库区域明确不覆盖的工作或内容。

**规则**（rule）

`.agents/rule/` 下的规范陈述，说明工作如何开展：做什么、按什么顺序、需要什么权限，以及禁止什么。

**归属层**（owning layer）

拥有某条规范陈述的唯一文档层，避免同一条规则在多处以冲突的方式出现。

**[ADR](./adr.zh.md)**（ADR）

`.agents/adr/` 下的双语记录，保存一项长期仓库决定的理由和契约，形式为提案或决定。

**[提案](./adr.zh.md#提案)**（proposal）

在实施之前、在创建或反转任何决定之前，用于评审的 ADR。

**[决定](./adr.zh.md#决定)**（decision）

记录当前完整选择、理由、替代方案、边界和后果的 ADR。

**[更新决定](./adr.zh.md#更新决定)**（update decision）

在 `Changes` 下向当前决定追加不冲突的内容，不归档该决定。

**[反转决定](./adr.zh.md#反转决定)**（reverse decision）

从旧决定仍然有效的规则和一份指出冲突的已接受提案创建完整后继，旧版本归档。

**[归档版本](./adr.zh.md#归档版本)**（archived version）

被替换的决定，保存在 `.agents/adr/archived/` 下，保留身份日期和修订号。

## 工作流程

**[任务](./task.zh.md)**（Task）

由 tk 管理的、项目内长期存在的工作单元，带有材料目录和生命周期。

**[计划](./plan.zh.md)**（Plan）

任务的执行依据，把工作分成可独立评估的单元，并写明引用、动作、验收、权限和依赖。

**[工作单元](./plan.zh.md#工作单元)**（unit）

计划中带稳定标签、可独立评估的结果，例如 U01。

**[独立验证](./verify.zh.md)**（Verify）

在隔离的上下文中，对照需求和证据独立检查候选，并给出最终结论。

**[交付](./ship.zh.md)**（Ship）

把已接受的结果实际交付，包括本地提交和合入既定目标。

**资深顾问**（Senior）

可选的咨询角色，为一次已分配的执行敲定范围内的关键选择，并解答执行疑问。

**[材料](./task.zh.md#材料)**（material）

任务材料目录中的文件，记录该任务的分析、计划、决定或证据。

## 审查用语

**[事实](./review-language.zh.md#事实)**（Fact）

可以从代码、配置、测试或运行行为中直接观察到的内容。

**[推断](./review-language.zh.md#推断)**（Inference）

根据事实得出的结论，但仍可能存在其他解释。

**[判断](./review-language.zh.md#判断)**（Judgment）

根据明确的工程关注点或取舍，对证据作出的评价。

**[建议](./review-language.zh.md#建议)**（Recommendation）

有证据支持的方向或行动，不是决定；在审查中，指针对发现项或已明确界定的决策的最小充分行动。

**[发现项](./review-language.zh.md#发现项)**（Finding）

说明证据、影响和建议的关注点，单纯的风格偏好不构成发现项。

**[误报](./review-language.zh.md#误报)**（False positive）

在考虑周边约束或意图后不再成立的关注点。

## AI 编程

**[模型](./agent.zh.md#模型)**（model）

模型是 Agent 调用的 token 预测器；每个请求接收 token 并返回 token，请求之间不保留状态。

**[Agent](./agent.zh.md)**（agent）

模型与 Harness 的组合：Harness 提供工具和指令、持有上下文，并运行工具循环。

**[Harness](./agent.zh.md#harness)**（Harness）

模型周围的运行时层，提供工具和系统提示、管理上下文窗口、落实权限，并运行工具循环。

**[上下文](./context-window.zh.md#上下文)**（context）

模型在单个请求中可以使用的 token，包括指令、对话、工具结果和检索材料。

**[上下文窗口](./context-window.zh.md#上下文窗口)**（context window）

模型在单个请求中能够处理的最大 token 数，由输入和输出共用。

**[token](./context-window.zh.md#token)**（token）

模型消费和产生的最小文本单位；窗口限制单个请求能容纳的数量。

**[压缩](./context-window.zh.md#压缩)**（compaction）

用更短的摘要替换部分对话，让剩余上下文适合窗口。

**[交接](./handoff.zh.md)**（handoff）

让全新会话或 Agent 在没有先前对话的情况下继续工作的持久记录。

**[子代理](./subagent.zh.md)**（subagent）

由另一个 Agent 启动的 Agent，拥有自己的上下文、任务和结果边界。

**[自动检查](./review-tiers.zh.md#自动检查)**（automated check）

验证语法、类型、测试、格式或链接的确定性命令，不判断设计质量。

**[自动审查](./review-tiers.zh.md#自动审查)**（automated review）

由模型或工具执行的检查，寻找命令无法表达的缺陷，但不能建立正确性，也不能授予接受。

**[人工审查](./review-tiers.zh.md#人工审查)**（human review）

由人员判断自动证据无法解决的意图、取舍和可接受性。

**[人在回路](./work-patterns.zh.md#人在回路)**（human-in-the-loop）

人员在会话期间持续参与，在既定节点审查、纠正方向或作出决定的工作模式。

**[AFK](./work-patterns.zh.md#afk)**（AFK）

让 Agent 无人值守运行，只返回需要人员决定的事项的工作模式。

**[质询](./work-patterns.zh.md#质询)**（grilling）

每轮最多提出三个独立问题、不设轮次上限、记录每个回答，并在总结确认后结束，用户也可以提前结束的访谈模式。

**[原型验证](./work-patterns.zh.md#原型验证)**（prototyping）

在正式实现前构建小型可运行版本，以解决不确定性的工作模式。

**会话**（session）

与 Harness 的一次有界交互，包含其对话、工具调用和上下文。

**回合**（turn）

会话工作的一次单位：一条用户消息和模型的响应，包括模型在让出前发起的工具调用。

**工具调用**（tool call）

模型向 Harness 发出的结构化请求，要求用指定参数运行工具。

**工具结果**（tool result）

Harness 执行工具调用后返回给模型的输出。

**权限模式**（permission mode）

Agent 可以在不询问的情况下执行哪些操作的配置级别，例如读取、编辑或运行命令。

**沙箱**（sandbox）

隔离的执行环境，限制进程或 Agent 可以读取、写入或访问的范围。

**记忆系统**（memory system）

上下文窗口之外的持久存储，Harness 在后续会话中从中加载选定的内容。

**AGENTS.md**（AGENTS.md）

仓库或目录中的指令文件，Harness 自动加载它以指导 Agent 行为。

**渐进披露**（progressive disclosure）

先加载技能的主要指令，仅在任务需要时加载参考材料，以保持上下文精简。

**推理强度**（effort）

控制模型在回答前投入多少计算的设置，以延迟和成本换取更深的推理。

**非确定性**（non-determinism）

相同输入在重复运行中可能得到不同结果的属性，因此结果需要检查而不是精确复现。

**幻觉**（hallucination）

模型自信地给出可用证据不支持或不存在的内容。

## 来源

条目组织借鉴 [Matt Pocock 的 AI Coding Dictionary](https://github.com/mattpocock/dictionary-of-ai-coding)：简短描述、定义、可选的避免用词和示例。该仓库没有许可证文件，因此本词典不复制其正文。
