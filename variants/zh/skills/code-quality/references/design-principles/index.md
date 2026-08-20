# 设计原则（Design Principles）

代码质量评审过程中使用的设计原则和工程判断框架的参考文档。这些不是机械规则。它们大多用于管理复杂度、控制变更、保护行为和改善可读性。将它们视为推理权衡的共享词汇，在实际问题的语境中解决它们之间的张力。

每份文档解释了该原则是什么、它所依赖的假设、何时适用、何时不适用、常见的误用方式，以及如何在 Python（而非 Java 或 C++ 的仪式性写法）中落地。当原则之间相互影响或冲突时，相关文档会用文字说明。

根据你在代码中看到的信号，导航到对应的文档。

| 信号 | 阅读 |
|-|-|
| 知识重复，一条规则在多处表达，错误的抽象 | [dry.md](./dry.md) |
| 两个相似案例，不确定是否要抽象 | [rule-of-three.md](./rule-of-three.md) |
| 不必要的复杂度，脑中容纳的概念太多 | [kiss.md](./kiss.md) |
| 投机性功能，没有经证实的扩展点 | [yagni.md](./yagni.md) |
| 职责、可替换性、接口宽度、依赖方向 | [solid.md](./solid.md) |
| 此行为应放在哪里，谁拥有此职责 | [grasp.md](./grasp.md) |
| 火车残骸链，调用者穿透深层对象结构 | [law-of-demeter.md](./law-of-demeter.md) |
| 调用者拉取字段后在外部做决策 | [tell-dont-ask.md](./tell-dont-ask.md) |
| 继承 vs 组合、Mixin、为复用而子类化 | [composition-over-inheritance.md](./composition-over-inheritance.md) |
| 高层逻辑耦合到 I/O、时间、随机性、外部服务 | [dependency-inversion.md](./dependency-inversion.md) |
| 测试优先、红-绿-重构、行为规约 | [tdd.md](./tdd.md) |
| 复杂业务领域、通用语言、限界上下文 | [ddd.md](./ddd.md) |
| 抽象深度、信息隐藏、浅模块、接口设计 | [deep-modules.md](./deep-modules.md) |

关于 SOLID 的依赖方向原则有两种视角：[solid.md](./solid.md) 将其作为五个原则之一覆盖，而 [dependency-inversion.md](./dependency-inversion.md) 更深入地讨论 DIP 和 Python 中的依赖注入。在连接外部依赖时请阅读两者。

具体的设计模式（工厂、策略、观察者、适配器等）位于 `variants/zh/skills/code-quality/references/design-patterns` 目录下。本目录关注的是何时抽象、何时等待、职责归属于谁，以及如何降低变更成本，而不是特定的命名结构。
