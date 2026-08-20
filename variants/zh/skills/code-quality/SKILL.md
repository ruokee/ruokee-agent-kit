---
name: code-quality
description: 通用代码质量审查与设计指导，涵盖设计原则、设计模式、重构、编程范式、代码与测试坏味、测试质量、状态机、资源生命周期、抽象质量以及 Agent/Skill 配置坏味。在评估代码或测试质量、设计权衡、重构机会、测试套件可维护性、范式适用性、抽象边界或 AGENTS.md/SKILL.md/配置质量时使用。
---

# 代码质量（Code Quality）

使用本技能判断代码、测试、架构、重构计划、抽象、设计原则、设计模式、编程范式以及 Agent 配置是否具备合理的结构、变更边界和维护成本。

对于 Python 代码审查或日常 Python 自查，也请配合使用 `python-engineering`，除非用户明确缩小范围。

## 进入条件（Entry Conditions）

在涉及可维护性、设计质量、测试质量或测试坏味、抽象边界、重构、代码坏味、编程范式选择、设计模式使用、设计原则或 Agent/Skill 配置质量时激活本技能。参考叶子文档涵盖设计原则、设计模式、重构、测试、编程范式和智能编码（agentic-coding）；按信号加载，而非一次性全部读取。

## 模式选择（Mode Selection）

提供三种模式，默认为快速审查（Fast Review）。

| 模式 | 触发条件 | 读取文档 |
|-|-|-|
| 快速审查（Fast Review） | 日常自查、小型 diff、PR 审查的默认模式 | `./workflow/fast-review.md` |
| 完整审查（Full Review） | 用户明确要求"完整审查"、"架构审查"、"系统性审查"或"重构评估" | `./workflow/full-review.md` |
| 分析（Analysis） | 用户请求讨论、头脑风暴、设计探索、范式比较、机制分析 | `./workflow/analysis.md` |

## 判断顺序（Judgment Order）

1. 确定主要关注点：正确性、可读性、变更成本、可测试性、性能或交付成本。
2. 判断问题属于原则、模式、重构、范式还是 Agent 配置的范畴。
3. 路由到下方相关的叶子文档。
4. 仅报告有充分证据的问题。

| 信号 | 优先读取 | 常搭配使用 |
|-|-|-|
| DRY、重复知识、错误抽象 | [DRY](./references/design-principles/dry.md) | 三次法则、重复代码 |
| 两个相似案例、过早抽象 | [三次法则（Rule of Three）](./references/design-principles/rule-of-three.md) | DRY、KISS |
| 不必要的复杂性 | [KISS](./references/design-principles/kiss.md) | YAGNI、深模块 |
| 过早扩展点、不必要的灵活性 | [YAGNI](./references/design-principles/yagni.md) | KISS、深模块 |
| SOLID、职责、可替换性、接口大小、依赖方向 | [SOLID](./references/design-principles/solid.md) | 组合优于继承、依赖反转 |
| 职责分配、行为归属 | [GRASP](./references/design-principles/grasp.md) | 问而不说（Tell Don't Ask）、依恋情结 |
| 消息链、远程对象结构知识 | [迪米特法则（Law of Demeter）](./references/design-principles/law-of-demeter.md) | 深模块、外观模式 |
| 调用者查询字段后做出领域决策 | [问而不说（Tell Don't Ask）](./references/design-principles/tell-dont-ask.md) | GRASP、依恋情结 |
| 继承 vs 组合、混入、子类化 | [组合优于继承（Composition over Inheritance）](./references/design-principles/composition-over-inheritance.md) | SOLID、依赖反转 |
| 依赖反转、DI、组合根 | [依赖反转（Dependency Inversion）](./references/design-principles/dependency-inversion.md) | 适配器、仓库、工作单元 |
| TDD、红-绿-重构、行为优先测试 | [TDD](./references/design-principles/tdd.md) | 安全重构 |
| 测试设计、测试坏味道、脆弱/不稳定测试、过度 mock、覆盖率策略、更少更强的测试 | [测试原则](./references/testing/principles.md) | 测试坏味道、TDD |
| 重构就挂的测试、变更检测器、晦涩/重复测试、测配置或 utils | [测试坏味道](./references/testing/test-smells.md) | 测试原则、代码坏味道 |
| 领域驱动设计、限界上下文、领域建模 | [DDD](./references/design-principles/ddd.md) | 深模块、仓库 |
| 抽象深度、信息隐藏、浅模块 | [深模块（Deep Modules）](./references/design-principles/deep-modules.md) | KISS、外观模式 |
| 对象创建因类型/配置/环境而异 | [工厂模式（Factory）](./references/design-patterns/factory.md) | 抽象工厂、建造者 |
| 匹配的产品族一同变化 | [抽象工厂（Abstract Factory）](./references/design-patterns/abstract-factory.md) | 工厂、建造者 |
| 复杂的分阶段构造 | [建造者（Builder）](./references/design-patterns/builder.md) | 工厂、抽象工厂 |
| 算法/行为在稳定调用点后变化 | [策略模式（Strategy）](./references/design-patterns/strategy.md) | 工厂、函数式核心 |
| 一个事件通知多个订阅者 | [观察者模式（Observer）](./references/design-patterns/observer.md) | 事件驱动、命令模式 |
| 外部接口需要翻译适配 | [适配器（Adapter）](./references/design-patterns/adapter.md) | 外观模式、依赖反转 |
| 横切行为包装调用/对象 | [装饰器（Decorator）](./references/design-patterns/decorator.md) | 外观模式、薄包装函数 |
| 为复杂子系统提供简单表面 | [外观模式（Facade）](./references/design-patterns/facade.md) | 深模块、适配器 |
| 请求排队、重试、审计、撤销、调度 | [命令模式（Command）](./references/design-patterns/command.md) | 状态模式、观察者模式 |
| 状态特有行为、GoF 状态模式 | [状态模式（State）](./references/design-patterns/state.md) | 状态机、命令模式 |
| 对稳定节点类型（AST/树/模式）的操作变化 | [访问者模式（Visitor）](./references/design-patterns/visitor.md) | 策略模式 |
| 持久化边界、ORM 隔离 | [仓库模式（Repository）](./references/design-patterns/repository.md) | 工作单元、依赖反转 |
| 跨仓库的事务/一致性 | [工作单元（Unit of Work）](./references/design-patterns/unit-of-work.md) | 仓库、依赖反转 |
| 行为保持的 Fowler 式重构 | [Fowler 重构（Fowler Refactoring）](./references/refactoring/fowler-refactoring.md) | 安全重构、代码坏味 |
| 通用坏味分类与坏味图谱 | [代码坏味（Code Smells）](./references/refactoring/code-smells.md) | 具体重构叶子文档 |
| 安全的行为保持式重构流程 | [安全重构（Safe Refactoring）](./references/refactoring/safe-refactoring.md) | Fowler 重构、TDD |
| 函数混合阶段、策略、I/O、分支 | [过长函数（Long Function）](./references/refactoring/long-function.md) | 提取函数、重复代码 |
| 重复的规则、映射、模式、复制的知识 | [重复代码（Duplicated Code）](./references/refactoring/duplicated-code.md) | DRY、提取函数 |
| 字符串/字典/基本类型承载稳定的领域含义 | [基本类型偏执（Primitive Obsession）](./references/refactoring/primitive-obsession.md) | DDD、数据导向 |
| 函数嫉妒另一个对象/模块的数据 | [依恋情结（Feature Envy）](./references/refactoring/feature-envy.md) | 搬移函数、GRASP |
| 一个变更需要多处分散修改 | [霰弹式修改（Shotgun Surgery）](./references/refactoring/shotgun-surgery.md) | 发散式变更、搬移函数 |
| 一个模块因多个不相关原因而变更 | [发散式变更（Divergent Change）](./references/refactoring/divergent-change.md) | 霰弹式修改 |
| 辅助/包装函数未增加语义边界 | [薄包装函数（Thin Wrapper Function）](./references/refactoring/thin-wrapper-function.md) | KISS、外观模式 |
| 将连贯阶段提取为函数 | [提取函数（Extract Function）](./references/refactoring/extract-function.md) | 过长函数、内联函数 |
| 内联误导性或过浅的函数 | [内联函数（Inline Function）](./references/refactoring/inline-function.md) | 提取函数 |
| 将行为移至更合适的归属 | [搬移函数（Move Function）](./references/refactoring/move-function.md) | 依恋情结、GRASP |
| 直接步骤、脚本、处理器、编排 | [命令式（Imperative）](./references/programming-paradigms/imperative.md) | 声明式 |
| 配置、模式、表驱动、声明 | [声明式（Declarative）](./references/programming-paradigms/declarative.md) | 命令式 |
| 对象标识、状态、不变量、多态 | [面向对象（Object-Oriented）](./references/programming-paradigms/object-oriented.md) | 组合优于继承、SOLID |
| 将纯逻辑与副作用外壳分离 | [函数式核心（Functional Core）](./references/programming-paradigms/functional-core.md) | 策略模式、声明式 |
| 显式数据形状、映射、模式、表 | [数据导向（Data-Oriented）](./references/programming-paradigms/data-oriented.md) | 基本类型偏执、声明式 |
| 事件、钩子、事件总线、发布/订阅、领域事件 | [事件驱动（Event-Driven）](./references/programming-paradigms/event-driven.md) | 观察者模式、命令模式 |
| 状态/状态值/事件/转换工作流 | [状态机（State Machine）](./references/programming-paradigms/state-machine.md) | 状态模式、资源生命周期 |
| 资源获取、所有权、清理 | [资源生命周期（Resource Lifecycle）](./references/programming-paradigms/resource-lifecycle.md) | 状态机、工作单元 |
| 异步任务、取消、超时、背压 | [异步/并发（Async/Concurrency）](./references/programming-paradigms/async-concurrency.md) | 事件驱动、资源生命周期 |
| AGENTS.md、SKILL.md、提示词/规则/工作流配置 | [配置坏味（Config Smells）](./references/agentic-coding/config-smells.md) | DRY、KISS |

目录的 `index.md` 文件服务于人工导航。仅在目录边界本身不清晰时才读取 `index.md`。

## 偏好设置（Preferences）

确定相关叶子文档后，读取项目事实与可选偏好：

1. 读取最近的 `AGENTS.md` 或项目规则。
2. 读取与审查相关的项目代码、测试、配置和 diff。
3. 按启发式查找偏好：
   - 优先查找项目层级：`.agents/preferences/code-quality.md`，然后是 `.agents/preferences/code-quality/index.md`。
   - 若未找到，尝试用户层级目录：`~/.codex/preferences/code-quality.md`、`~/.claude/preferences/code-quality.md` 或等效的用户配置目录。
4. 若任何层级均未找到偏好，则继续静默执行。

偏好可指定：审查优先级、架构约束、项目特定坏味或额外规则。切勿将偏好表述为普适的工程真理。

## 输出约定（Output Contract）

以发现项（findings）开头。原则不是机械化的规则——请写出权衡。模式不是默认模板——先证明变化点确实存在。区分事实、推断、判断、偏好和建议；切勿混为一谈。不要重复格式化工具或 linter 可以自动捕获的问题。

输出格式与模式相关——请遵循对应的工作流文档（`./workflow/fast-review.md`、`./workflow/full-review.md` 或 `./workflow/analysis.md`）。分析模式提供权衡和选项，而非发现项列表。

根据全局、项目或用户指令所要求的语言输出；若未指定，使用当前对话的语言。

## 停止规则（Stop Rules）

- 不要为了满足某个原则而强行制造发现项。
- 不要仅仅因为代码看起来相似就进行抽象。
- 未经证明两个位置的共享意图相同，不要将相似代码视为重复知识。
- 不要自动应用重构、补丁、不安全修复或批量压制。
- 不要将偏好转化为普适的工程规则。
- 在只读或分析任务期间不要修改文件。
- 不要报告格式化工具或 linter 可以自动捕获的问题——如果相关，最多提一次，然后继续。
