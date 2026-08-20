# 设计模式（Design Patterns）

设计模式是针对重复出现的设计问题的词汇，而非默认套用的模板。每种模式命名了一种解决特定变体问题的形态：某些东西会变化，而该模式将变化隔离在一个稳定的接口后面。代价总是多一层间接性。

在选用模式之前，请问自己：

- 变体点是真实的，还是推测的？抽象一个从未出现的变体的模式纯粹是开销。
- 更简单的构造是否足够？在 Python 中，一等函数、`dataclass`、`Protocol`、`match`、装饰器、上下文管理器、迭代器和分发映射可以吸收或简化许多经典的面向对象模式。
- 该模式降低了调用方的理解成本，还是仅仅增加了一次跳转？
- 故障成本是什么：全局状态、隐藏的控制流、类爆炸、更难测试、性能问题，还是不清晰的生命周期？

先解决问题，再决定命名模式是否值得。不要先选一个模式，再去找问题来套。

## 创建型（Creational）

- [factory.md](./factory.md)：工厂方法（Factory Method）—— 将创建与调用方解耦；在 Python 中通常就是一个函数。
- [abstract-factory.md](./abstract-factory.md)：抽象工厂（Abstract Factory）—— 创建必须一起变化的相关对象族。
- [builder.md](./builder.md)：生成器（Builder）—— 分步构建复杂对象。

## 结构型（Structural）

- [adapter.md](./adapter.md)：适配器（Adapter）—— 使不兼容的接口协同工作。
- [decorator.md](./decorator.md)：装饰器模式（Decorator pattern）—— 通过包裹来添加行为（与 Python 的 `@decorator` 语法不同）。
- [facade.md](./facade.md)：外观模式（Facade）—— 为复杂子系统提供简单接口。

## 行为型（Behavioral）

- [strategy.md](./strategy.md)：策略模式（Strategy）—— 可互换的算法，背后是稳定接口。
- [observer.md](./observer.md)：观察者模式（Observer）/ 发布-订阅（Pub-Sub）—— 一对多的事件通知。
- [command.md](./command.md)：命令模式（Command）—— 将请求封装为对象。
- [state.md](./state.md)：状态模式（State）—— 通过多态状态对象实现状态特定行为。
- [visitor.md](./visitor.md)：访问者模式（Visitor）—— 为稳定的节点类型添加操作。

## 持久化 / 应用（Persistence / application）

- [repository.md](./repository.md)：仓库模式（Repository）—— 将持久化抽象为类似集合的接口。
- [unit-of-work.md](./unit-of-work.md)：工作单元（Unit of Work）—— 跟踪变更并原子提交。

关于状态机（不限于状态模式），请参阅 [state-machine](variants/zh/skills/code-quality/references/programming-paradigms/state-machine.md)。
