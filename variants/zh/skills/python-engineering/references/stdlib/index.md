# 标准库参考

当标准库机制是任务的核心时，请阅读以下文件。每个文件解释该机制、其问题域、惯用用法以及它停止发挥作用的边界。

- [common](./common.md)：高频模块——`pathlib`、`enum`/`StrEnum`、`dataclasses`、`logging`、`collections` 和运行时 `typing` 工具。在需要选择合适的值容器、路径 API、有限值集合或日志记录形式时阅读。
- [functools](./functools.md)：`singledispatch`、`partial`、`lru_cache`/`cache`、`reduce` 和 `wraps`。用于基于类型的分发、偏函数应用、记忆化和装饰器支持。
- [itertools](./itertools.md)：惰性迭代、批处理、分组、链接和多次消费陷阱。在构建数据管道或转换序列时阅读。
- [contextlib](./contextlib.md)：`@contextmanager`、`ExitStack`、`suppress`、`redirect_*`、`nullcontext` 和 `closing`。在编写或组合上下文管理器时阅读。

标准库是默认依赖。仅当标准库机制确实不足时才使用第三方包，而不是在此之前。这些参考描述的是机制，而非审查规则；审查工作流位于 [`workflow`](variants/zh/skills/python-engineering/workflow/index.md) 下。
