# 重构（Refactoring）

Martin Fowler 风格重构的参考文档：由代码坏味驱动的、保持行为不变的重构。目标不是"为了整洁而整洁"，而是一种有纪律的实践——识别症状，保护当前行为，然后应用一个小的、命名的、可逆的变换。此目录包含框架文档、坏味目录，以及日常和代理辅助工作中最常见坏味和重构的独立文档。

如果你正在决定*是否*以及*如何*重构，请从框架文档开始。当你已经发现某个症状并想理解它及其修复方式时，查阅特定坏味文档。当你知道要执行什么操作时，查阅重构文档。

## 框架

| 问题 | 阅读 |
|-|-|
| 什么是重构，何时该做，何时不该做 | [fowler-refactoring.md](./fowler-refactoring.md) |
| 什么是代码坏味，属于哪个类别，是否值得现在修复 | [code-smells.md](./code-smells.md) |
| 如何在不破坏行为的前提下重构 | [safe-refactoring.md](./safe-refactoring.md) |

## 坏味

| 症状 | 阅读 |
|-|-|
| 函数做的事太多，混合了抽象层级，难以命名 | [long-function.md](./long-function.md) |
| 同一知识在多处表达 | [duplicated-code.md](./duplicated-code.md) |
| 应该使用领域类型的地方用了字符串/整数/字典 | [primitive-obsession.md](./primitive-obsession.md) |
| 方法使用另一个对象的数据比使用自己的多 | [feature-envy.md](./feature-envy.md) |
| 一个逻辑变更迫使在多处修改 | [shotgun-surgery.md](./shotgun-surgery.md) |
| 一个模块因多个无关原因而变更 | [divergent-change.md](./divergent-change.md) |
| 函数仅转发调用或重命名，未增加价值 | [thin-wrapper-function.md](./thin-wrapper-function.md) |

## 重构

| 操作 | 阅读 |
|-|-|
| 将一个连贯的片段提取为独立的命名函数 | [extract-function.md](./extract-function.md) |
| 将一个函数折叠回其调用方 | [inline-function.md](./inline-function.md) |
| 将行为迁移到更合适的所有者 | [move-function.md](./move-function.md) |

坏味和重构是一个实践的两个方面：坏味命名问题，重构命名解法。坏味文档指向解决它们的重构，重构文档则指出激发它们的坏味。关于这些判断背后的原则——DRY、三次法则、单一职责——请参见 `variants/zh/skills/code-quality/references/design-principles`。
