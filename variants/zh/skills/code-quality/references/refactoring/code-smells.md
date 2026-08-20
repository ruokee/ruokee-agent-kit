# 代码坏味（Code Smells）

## 什么是坏味

代码坏味是一个**表明更深层结构问题的表面症状**——但它不是问题本身，也不是一个判决。Kent Beck 故意用这个类比：就像气味让你停下来靠近看，而不是证明一定有东西坏了。一个长函数可能是个问题，也可能是一个清晰的线性序列，读起来没问题。重复代码可能是一个规则在三处编码，也可能是三个今天只是看起来相似的片段。

这个区别——症状，而非诊断——是坏味最重要的一点。将坏味视为自动缺陷会导致机械性的"修复"，反而使代码更糟：提取不需要提取的函数，去重并非真正重复的代码，为永远不会到来的变化引入抽象。坏味是邀请你去调查，而调查可以合理地得出结论："这没问题。"

## 主要类别

Fowler 和 Beck 将坏味分为若干家族。了解家族有助于你选择合适的修复方式。

- **臃肿体（Bloaters）**——代码变得过于庞大难以舒服地处理。过长函数（Long Function）、过大类（Large Class）、过长参数列表（Long Parameter List）、数据泥团（Data Clumps）、基本类型偏执（Primitive Obsession）。它们逐渐累积；每次添加似乎都合理，直到整体变得笨重。参见 [long-function.md](./long-function.md) 和 [primitive-obsession.md](./primitive-obsession.md)。
- **面向对象滥用者（Object-orientation abusers）**——对 OO 机制的不完整或不正确使用。本应是多态的 Switch 语句、被拒绝的遗赠（Refused Bequest）、临时字段（Temporary Field）、具有不同接口的替代类（Alternative Classes with Different Interfaces）。
- **变更阻止者（Change preventers）**——一个变更迫使许多其他变更的结构。发散式变更（Divergent Change，一个模块因多种原因被修改）和霰弹式修改（Shotgun Surgery，一个变更分散在多个模块中）是两种典型的、互逆的形式。参见 [divergent-change.md](./divergent-change.md) 和 [shotgun-surgery.md](./shotgun-surgery.md)。
- **可有可无者（Dispensables）**——没有它们代码会更干净的东西。重复代码（Duplicated Code）、死代码（Dead Code）、投机性泛化（Speculative Generality）、懒惰元素（Lazy Element，一个没有发挥应有作用的类或函数——与过薄包装密切相关，参见 [thin-wrapper-function.md](./thin-wrapper-function.md)）、用于解释糟糕代码的注释（Comments）。参见 [duplicated-code.md](./duplicated-code.md)。
- **耦合者（Couplers）**——模块间过度耦合的坏味。依恋情节（Feature Envy）、不恰当的亲密关系（Inappropriate Intimacy）、消息链（Message Chains）、中间人（Middle Man）。参见 [feature-envy.md](./feature-envy.md)。

这些类别有重叠，同一段代码可能表现出多种坏味。分类的作用是帮助回忆——当感觉不对时，这些家族提示你命名所见之物。

## 如何分类处理：现在值得修复吗？

发现坏味是容易的部分。判断是否要行动，而答案常常是"现在不"。快速分类处理：

1. **它是确认的，还是仅仅是外观？** 看透表象。重复的代码真的是同一个规则，还是两个看起来相似的东西？长函数是混合了抽象层级，还是一个清晰的序列？如果你不能阐明底层的结构问题，就此打住。
2. **它挡了你的路吗？** 你在积极修改或即将修改的代码中的坏味值得修复——预备性和理解性重构能立即得到回报。稳定的、没人碰的代码中的坏味通常最好不管；修改工作代码的风险超过了整洁的收益。
3. **放任它的成本是多少？** 高风险的知识重复（安全、金钱、协议契约、模式）无论出现频率多低都值得立即修复，因为分叉的成本太高。安静角落里一个稍微有点长的函数则不然。
4. **有安全网吗？** 如果你不能验证行为被保留，暂时不要重组。参见 [safe-refactoring.md](./safe-refactoring.md)。

分类的目标是将重构精力花在能够降低实际未来成本的地方，而不是将每个坏味计数都归零。

## 代理辅助开发中的坏味

代理编码既提高了代码生产速度，也提高了坏味出现的速度。典型问题不是"代码看起来不像是人写的"，而是结构性的：重复的适配器、过薄的包装辅助函数、过宽的 Protocol、投机性的注册表、深度 mock、同一领域规则在模式、服务和测试夹具中分别编写。由于代码量更大，坏味检测需要比传统手写代码更主动、更刻意——但上面的分类纪律也更重要，因为机械性地"清理"代理产生的所有东西的诱惑是存在的。

## 与各独立文档的关系

本文档是地图。本目录中的每个独立叶子文档深入探讨一个坏味或一种变换：它到底是什么，区分真正问题和误报的信号，坏味何时实际上是可接受的，以及哪个命名重构来处理它。当分类认为某个坏味值得调查时，请跳转到具体文档。变换本身——提取函数（Extract Function）、内联函数（Inline Function）、移动函数（Move Function）——位于 [extract-function.md](./extract-function.md)、[inline-function.md](./inline-function.md) 和 [move-function.md](./move-function.md)，而安全应用它们的整体纪律位于 [fowler-refactoring.md](./fowler-refactoring.md)。
