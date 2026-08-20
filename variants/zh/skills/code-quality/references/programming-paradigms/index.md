# 编程范式（Programming Paradigms）

代码质量审查中涉及的编程范式与执行模型的参考文档。Python 是一门多范式语言：函数、模块、对象、类型、协议、资源生命周期和异步任务都是可组合的工具。这些文档的目的是帮助你判断哪种范式适合给定的问题，而不是强制推行单一的代码风格。

一个常见的失败模式——尤其是在智能体生成的代码中——是首先选定一个范式，然后强行将问题套入其中：所有东西都变成类，或者所有东西都变成高阶函数的链条，或者每个工作流都变成隐式的布尔标志缠绕。更好的做法是阅读问题的形状，然后选择默认假设与之匹配的范式。

每份文档解释该范式是什么、它所依赖的假设、何时适用、何时不适用、常见的误用方式，以及如何将其转化为地道的 Python 代码。在范式交互的地方，相关文档会用文字说明。

根据你正在查看的信号，选择对应的文档。

| 信号 | 阅读 |
|-|-|
| 逐步的状态变更、脚本、编排、入口点 | [imperative.md](./imperative.md) |
| 描述什么而非如何——配置、模式、路由、规则表 | [declarative.md](./declarative.md) |
| 长生命周期的有状态实体、多态、框架扩展 | [object-oriented.md](./object-oriented.md) |
| 难以测试的逻辑与 I/O、时间、随机性、外部调用混合 | [functional-core.md](./functional-core.md) |
| 数据形态驱动结构——ETL、API、批处理、类型化记录 | [data-oriented.md](./data-oriented.md) |
| 解耦生产者与消费者、钩子、信号、消息队列 | [event-driven.md](./event-driven.md) |
| 有限命名状态、命名事件、非法转换很重要 | [state-machine.md](./state-machine.md) |
| 谁创建谁关闭——文件、锁、连接、池 | [resource-lifecycle.md](./resource-lifecycle.md) |
| 并发 I/O、任务组、取消、背压 | [async-concurrency.md](./async-concurrency.md) |

设计原则（DRY、SOLID、KISS 等）位于 `variants/zh/skills/code-quality/references/design-principles` 目录下，命名结构模式（Factory、Strategy、Observer）位于 `variants/zh/skills/code-quality/references/design-patterns` 目录下。本目录关注的是底层的执行模型，以及状态、决策和副作用应该放在哪里，而不是特定的命名结构。

这些范式并非互斥。一个真实的服务可以结合命令式外壳、函数式或面向数据的核心、用于生命周期的状态机、声明式配置，以及用于 I/O 的结构化异步。阅读正确的范式意味着将系统的每个部分与使其最易于推理的模型相匹配。
