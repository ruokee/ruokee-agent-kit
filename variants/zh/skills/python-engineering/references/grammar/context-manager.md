# 上下文管理器

上下文管理器（context manager）将设置操作与清理操作配对，并保证无论代码块如何退出，清理操作都会执行。`with` 语句（以及用于异步资源的 `async with`）是 Python 将资源的生命周期绑定到词法作用域的方式。

## 它解决的问题

资源有生命周期：文件必须关闭、锁必须释放、事务必须提交或回滚、连接必须归还到连接池。使用裸 `try`/`finally` 来做是正确的，但冗长且容易出错：清理代码与获取代码分离，嵌套资源会产生深度缩进的脆弱代码块。

```python
with open(path) as handle:
    process(handle)
# 即使 process() 抛出异常，handle 也会在此处关闭
```

`with` 块让生命周期清晰可见：顶部获取资源，主体限定作用域，结束时保证释放。本文档只讨论语言机制。

## 协议

上下文管理器是实现两个方法的任何对象：

- `__enter__(self)` 在进入时运行。其返回值绑定到 `as` 目标。它通常返回 `self`，但也可以返回任何句柄（文件、游标、连接）。
- `__exit__(self, exc_type, exc, tb)` 在退出时运行，始终会执行。三个参数在正常退出时为 `None`，否则描述正在传播的异常。

```python
class Transaction:
    def __init__(self, conn: Connection) -> None:
        self._conn = conn

    def __enter__(self) -> Connection:
        self._conn.begin()
        return self._conn

    def __exit__(self, exc_type, exc, tb) -> bool:
        if exc_type is None:
            self._conn.commit()
        else:
            self._conn.rollback()
        return False
```

## `__exit__` 中的异常处理

`__exit__` 的返回值是一个控制流决策，也是协议中最容易被误解的部分。返回假值（包括 `None`）会让任何正在传播的异常正常传播。返回真值会*抑制*（suppress）异常，就像从未发生过一样。

静默抑制异常几乎总是错误。上面的事务返回 `False`，因此失败的块仍然会抛出异常；它既回滚*又*传播。仅在吞掉异常是管理器的明确目的时才返回 `True`（即便如此，也优先使用 [`contextlib.suppress`](../stdlib/contextlib.md) 以获得清晰性）。执行清理的管理器不应隐藏触发清理的失败。

## 基于生成器的上下文管理器

对于不需要类的常见情况，`@contextlib.contextmanager` 将生成器（generator）转换为上下文管理器。`yield` 之前的代码是设置，yield 的值成为 `as` 目标，`yield` 之后的代码是清理：

```python
from contextlib import contextmanager

@contextmanager
def timed(label: str):
    start = time.perf_counter()
    try:
        yield
    finally:
        log.info("%s took %.3fs", label, time.perf_counter() - start)
```

`try`/`finally` 是必不可少的：没有它，主体中的异常会跳过清理，因为异常是在 `yield` *处*重新抛出的。此功能和其他 `contextlib` 辅助工具的详细信息在 [contextlib 参考](../stdlib/contextlib.md)中介绍。

## 异步资源

异步资源，在设置或清理期间必须 `await` 的连接、会话、连接池，实现 `__aenter__` 和 `__aexit__`，并使用 `async with`：

```python
async with pool.acquire() as conn:
    await conn.execute(query)
```

语义与同步协议相同，但进入和退出可以暂停。当释放涉及 I/O 时，使用 `async with`；当有异步管理器可用时，永远不要在 `async` 函数内调用阻塞式 close。生成器辅助工具的异步等效是 `@contextlib.asynccontextmanager`。

## 嵌套上下文

可以在一个语句中管理多个资源。括号形式（Python 3.10+）使长列表保持可读并产生清晰的差异：

```python
with (
    open(src) as fin,
    open(dst, "w") as fout,
):
    fout.write(transform(fin.read()))
```

管理器从左到右进入，从右到左退出，因此依赖前面资源的资源会更早释放。当资源的*集合*在运行时才可知时，可变数量的文件、动态构建的管理器栈，使用 [`contextlib.ExitStack`](../stdlib/contextlib.md) 代替嵌套语句。

## 何时编写自己的管理器

当你有一个真正的获取/释放对，且与自己的资源或不变量相关时，编写自定义上下文管理器：域锁、必须恢复的临时状态更改、事务类边界、指标或追踪跨度。对于简单的线性设置/清理，优先使用 `@contextmanager`；当管理器携带命名状态、作为对象被重用或需要被检查时，优先使用类。

当标准库辅助工具已经适用时，不要编写自己的管理器。`suppress`、`redirect_stdout`、`closing` 和 `nullcontext` 覆盖了常见需求，而一次性的 `try`/`finally` 对于永远不会被重用的单个本地清理也足够了。使用自定义类来替代本可以用三行 `try`/`finally` 完成的工作，会增加间接性而无益。
