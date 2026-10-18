---
name: code-quality
description: 当需要评估或改善代码质量时使用，涵盖可维护性、抽象、设计原则与模式、重构、代码坏味、测试设计和架构。
metadata:
  version: "1.0.5"
---

# 代码质量

代码质量（Code Quality）：使用本技能判断代码、测试、架构、重构计划和抽象是否具备合理的结构、变更边界和维护成本。

## 进入条件

进入条件（Entry Conditions）：在涉及可维护性、设计质量、测试质量或测试坏味、抽象边界、重构、代码坏味、编程范式选择、设计模式使用或设计原则时激活本技能。按信号加载参考叶子文档，不要一次性全部读取。

如果任务没有明确要求分析代码质量，即使已经加载本 `SKILL.md`，也不要继续加载 `references/` 下的任何文档。

## 模式选择

模式选择（Mode Selection）：提供三种模式，默认为快速审查（Fast Review）。

- 快速审查是日常自查、小型 diff 和 PR 审查的默认模式，读 `./workflow/fast-review.md`。
- 用户明确要求「完整审查」「架构审查」「系统性审查」或「重构评估」时用完整审查，读 `./workflow/full-review.md`。
- 用户请求讨论、头脑风暴、设计探索、范式比较或机制分析时用分析模式，读 `./workflow/analysis.md`。

## 判断顺序

判断顺序（Judgment Order）如下：

1. 确定主要关注点：正确性、可读性、变更成本、可测试性、性能或交付成本。
2. 判断问题属于原则、模式、重构还是范式。
3. 路由到下方相关的叶子文档。
4. 仅报告有充分证据的问题。

- 知识重复或抽象错误时，读 [DRY](./references/design-principles/dry.md)，常搭配三次法则和重复代码。
- 两个相似案例诱使你抽象时，读 [三次法则（Rule of Three）](./references/design-principles/rule-of-three.md)，常搭配 DRY 和 KISS。
- 复杂性不必要时，读 [KISS](./references/design-principles/kiss.md)，常搭配 YAGNI 和深模块。
- 扩展点或不必要的灵活性出现在需求之前时，读 [YAGNI](./references/design-principles/yagni.md)，常搭配 KISS 和深模块。
- 处理职责、可替换性、接口大小和依赖方向时，读 [SOLID](./references/design-principles/solid.md)，常搭配组合优于继承和依赖反转。
- 判断行为该归谁时，读 [GRASP](./references/design-principles/grasp.md)，常搭配问而不说和依恋情结。
- 代码走消息链、知道远处对象结构时，读 [迪米特法则（Law of Demeter）](./references/design-principles/law-of-demeter.md)，常搭配深模块和外观模式。
- 调用者查询字段后做出领域决策时，读 [问而不说（Tell Don't Ask）](./references/design-principles/tell-dont-ask.md)，常搭配 GRASP 和依恋情结。
- 在继承和组合之间选择，或处理混入和子类化时，读 [组合优于继承（Composition over Inheritance）](./references/design-principles/composition-over-inheritance.md)，常搭配 SOLID 和依赖反转。
- 处理依赖反转、DI 和组合根时，读 [依赖反转（Dependency Inversion）](./references/design-principles/dependency-inversion.md)，常搭配适配器、仓库和工作单元。
- 实践 TDD、红-绿-重构或行为优先测试时，读 [TDD](./references/design-principles/tdd.md)，常搭配安全重构。
- 处理测试设计、测试坏味道、脆弱或不稳定测试、过度 mock、覆盖率策略或更少更强的测试时，读 [测试原则](./references/testing/principles.md)，常搭配测试坏味道和 TDD。
- 测试在重构时失败、充当变更检测器、晦涩或重复，或测配置和 utils 时，读 [测试坏味道](./references/testing/test-smells.md)，常搭配测试原则和代码坏味道。
- 做领域驱动设计、限界上下文和领域建模时，读 [DDD](./references/design-principles/ddd.md)，常搭配深模块和仓库。
- 处理抽象深度、信息隐藏和浅模块时，读 [深模块（Deep Modules）](./references/design-principles/deep-modules.md)，常搭配 KISS 和外观模式。
- 对象创建因类型、配置或环境而异时，读 [工厂模式（Factory）](./references/design-patterns/factory.md)，常搭配抽象工厂和建造者。
- 一组匹配的产品一同变化时，读 [抽象工厂（Abstract Factory）](./references/design-patterns/abstract-factory.md)，常搭配工厂和建造者。
- 构造过程复杂且分阶段时，读 [建造者（Builder）](./references/design-patterns/builder.md)，常搭配工厂和抽象工厂。
- 算法或行为在稳定调用点后变化时，读 [策略模式（Strategy）](./references/design-patterns/strategy.md)，常搭配工厂和函数式核心。
- 一个事件要通知多个订阅者时，读 [观察者模式（Observer）](./references/design-patterns/observer.md)，常搭配事件驱动和命令模式。
- 外部接口需要翻译适配时，读 [适配器（Adapter）](./references/design-patterns/adapter.md)，常搭配外观模式和依赖反转。
- 横切行为要包装调用或对象时，读 [装饰器（Decorator）](./references/design-patterns/decorator.md)，常搭配外观模式和薄包装。
- 要给复杂子系统提供简单表面时，读 [外观模式（Facade）](./references/design-patterns/facade.md)，常搭配深模块和适配器。
- 请求需要排队、重试、审计、撤销或调度时，读 [命令模式（Command）](./references/design-patterns/command.md)，常搭配状态模式和观察者模式。
- 处理状态特有行为或 GoF 状态模式时，读 [状态模式（State）](./references/design-patterns/state.md)，常搭配状态机和命令模式。
- 操作随稳定的节点类型（AST、树或模式）而变化时，读 [访问者模式（Visitor）](./references/design-patterns/visitor.md)，常搭配策略模式。
- 处理持久化边界和 ORM 隔离时，读 [仓库模式（Repository）](./references/design-patterns/repository.md)，常搭配工作单元和依赖反转。
- 处理跨仓库的事务或一致性时，读 [工作单元（Unit of Work）](./references/design-patterns/unit-of-work.md)，常搭配仓库和依赖反转。
- 进行行为保持的 Fowler 式重构时，读 [Fowler 重构（Fowler Refactoring）](./references/refactoring/fowler-refactoring.md)，常搭配安全重构和代码坏味。
- 需要通用坏味分类和坏味图谱时，读 [代码坏味（Code Smells）](./references/refactoring/code-smells.md)，常搭配具体重构叶子文档。
- 执行安全的行为保持式重构流程时，读 [安全重构（Safe Refactoring）](./references/refactoring/safe-refactoring.md)，常搭配 Fowler 重构和 TDD。
- 函数混合阶段、策略、I/O 和分支时，读 [过长函数（Long Function）](./references/refactoring/long-function.md)，常搭配提取函数和重复代码。
- 规则、映射、模式或知识被复制时，读 [重复代码（Duplicated Code）](./references/refactoring/duplicated-code.md)，常搭配 DRY 和提取函数。
- 字符串、字典或基本类型承载稳定的领域含义时，读 [基本类型偏执（Primitive Obsession）](./references/refactoring/primitive-obsession.md)，常搭配 DDD 和数据导向。
- 函数嫉妒另一个对象或模块的数据时，读 [依恋情结（Feature Envy）](./references/refactoring/feature-envy.md)，常搭配搬移函数和 GRASP。
- 一个变更需要多处分散修改时，读 [霰弹式修改（Shotgun Surgery）](./references/refactoring/shotgun-surgery.md)，常搭配发散式变更和搬移函数。
- 一个模块因多个不相关原因而变更时，读 [发散式变更（Divergent Change）](./references/refactoring/divergent-change.md)，常搭配霰弹式修改。
- 辅助或包装函数没有增加语义边界时，读 [薄包装（Thin Wrapper Function）](./references/refactoring/thin-wrapper-function.md)，常搭配 KISS 和外观模式。
- 要把连贯阶段提取为函数时，读 [提取函数（Extract Function）](./references/refactoring/extract-function.md)，常搭配过长函数和内联函数。
- 要内联误导性或过浅的函数时，读 [内联函数（Inline Function）](./references/refactoring/inline-function.md)，常搭配提取函数。
- 要把行为移到更合适的归属时，读 [搬移函数（Move Function）](./references/refactoring/move-function.md)，常搭配依恋情结和 GRASP。
- 处理直接步骤、脚本、处理器和编排时，读 [命令式（Imperative）](./references/programming-paradigms/imperative.md)，常搭配声明式。
- 处理配置、模式、表驱动和声明时，读 [声明式（Declarative）](./references/programming-paradigms/declarative.md)，常搭配命令式。
- 处理对象标识、状态、不变量和多态时，读 [面向对象（Object-Oriented）](./references/programming-paradigms/object-oriented.md)，常搭配组合优于继承和 SOLID。
- 要把纯逻辑与副作用外壳分离时，读 [函数式核心（Functional Core）](./references/programming-paradigms/functional-core.md)，常搭配策略模式和声明式。
- 处理显式数据形状、映射、模式和表时，读 [数据导向（Data-Oriented）](./references/programming-paradigms/data-oriented.md)，常搭配基本类型偏执和声明式。
- 处理事件、钩子、事件总线、发布/订阅和领域事件时，读 [事件驱动（Event-Driven）](./references/programming-paradigms/event-driven.md)，常搭配观察者模式和命令模式。
- 处理状态、状态值、事件和转换工作流时，读 [状态机（State Machine）](./references/programming-paradigms/state-machine.md)，常搭配状态模式和资源生命周期。
- 处理资源获取、所有权和清理时，读 [资源生命周期（Resource Lifecycle）](./references/programming-paradigms/resource-lifecycle.md)，常搭配状态机和工作单元。
- 处理异步任务、取消、超时和背压时，读 [异步/并发（Async/Concurrency）](./references/programming-paradigms/async-concurrency.md)，常搭配事件驱动和资源生命周期。

术语含义或中英文对应不清楚时，读取[术语表](./glossary.md)。

## 输出约定

输出约定（Output Contract）：以发现项开头。原则不是机械规则，需要说明权衡。模式不是默认模板，先证明变化点确实存在。区分事实、推断、判断和建议，不要混为一谈。不要重复格式化工具或 linter 可以自动捕获的问题。

输出格式取决于模式。请遵循对应的工作流文档（`./workflow/fast-review.md`、`./workflow/full-review.md` 或 `./workflow/analysis.md`）。分析模式提供权衡和选项，而非发现项列表。

根据全局、项目或用户指令所要求的语言输出；若未指定，使用当前对话的语言。

## 停止规则

停止规则（Stop Rules）如下：

- 不要为了满足某个原则而强行制造发现项。
- 不要仅仅因为代码看起来相似就进行抽象。
- 未经证明两个位置的共享意图相同，不要将相似代码视为重复知识。
- 不要自动应用重构、补丁、不安全修复或批量压制。
- 只读和分析任务不修改被审查文件。已有的报告或任务材料维护授权继续适用。
- 不要报告格式化工具或 linter 可以自动捕获的问题。如果相关，最多提一次，然后继续。
