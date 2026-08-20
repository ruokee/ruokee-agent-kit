# 语法与机制参考

当 Python 语言构造是任务的核心时——决定是否使用它、判断现有用法或解释其行为——请阅读以下文件。

- `match-case.md`：结构化模式匹配（structural pattern matching，Python 3.10+），其语法形式，以及何时优于或劣于 `if`/`elif` 和调度表。
- `context-manager.md`：`with` / `async with` 协议、资源生命周期、基于生成器的管理器以及 `__exit__` 中的异常处理。
- `decorator.md`：作为高阶函数的装饰器（decorator）、参数化和基于类的形式、元数据保留以及类型成本。
- `exception-groups.md`：用于并发和批量失败的 `ExceptionGroup` 和 `except*`（Python 3.11+），以及何时单个异常才是正确的工具。

这些文档描述的是机制，而非审查策略。它们提供人类或代理判断特定用法所需的上下文；审查工作流本身位于 `workflow/` 下。
