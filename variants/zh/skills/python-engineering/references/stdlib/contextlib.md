# contextlib

`contextlib` 提供构建和组合上下文管理器的辅助工具，无需编写完整的 `__enter__`/`__exit__` 类。它是对 [`with` 协议](variants/zh/skills/python-engineering/references/grammar/context-manager.md)的补充：语法文档涵盖协议是什么以及何时使用它；本文档涵盖廉价生成上下文管理器的标准工具。

## @contextmanager 和 @asynccontextmanager

`@contextmanager` 将生成器转换为上下文管理器。`yield` 之前的代码在进入时运行，yield 的值成为 `as` 目标，`yield` 之后的代码在退出时运行。要处理异常，请将 `yield` 包装在 `try`/`finally` 中：

```python
from contextlib import contextmanager

@contextmanager
def acquired(resource):
    resource.open()
    try:
        yield resource
    finally:
        resource.close()
```

生成器必须恰好 yield 一次。在 `with` 主体内抛出的异常会在 `yield` *处*被重新抛出，这就是为什么清理代码属于 `finally` 而不是裸 `yield` 之后。`@asynccontextmanager` 是协程等效版本，由 `async with` 驱动，允许在 `yield` 周围使用 `await`。

这种装饰器形式是顺序设置/清理逻辑的默认选择。仅在需要作为实例重用、多个方法或可重入性时才使用完整的类。

## ExitStack 和 AsyncExitStack

`ExitStack` 管理*动态*的上下文管理器集合，当资源的数量在解析时未知，或资源在循环中获取时：

```python
from contextlib import ExitStack

with ExitStack() as stack:
    files = [stack.enter_context(open(p)) for p in paths]
    process(files)
# 每个文件在此关闭，逆序关闭，即使其中一个抛出异常
```

`enter_context` 注册一个已创建的上下文管理器；`callback` 注册一个任意的清理函数；`push` 注册一个 `__exit__` 风格的可调用对象。一个有用的模式是部分初始化安全性：将资源构建到栈上，然后一旦构造完全成功，调用 `stack.pop_all()` 将所有权转移出去，这样中途的失败仍会展开所有已获取的资源。`AsyncExitStack` 是 `async with` 对应物，具有 `enter_async_context` 和异步回调。

## suppress

`suppress(*exceptions)` 忽略其块中抛出的指定异常；这是 `try/except SomeError: pass` 的清晰替代品：

```python
from contextlib import suppress

with suppress(FileNotFoundError):
    path.unlink()
```

将主体限制为你想忽略其失败的单个操作。包装多个语句可能会让后续不相关的同类失败静默通过。

## redirect_stdout 和 redirect_stderr

这些在块的持续时间内临时将 `sys.stdout` / `sys.stderr` 重新绑定到任何类文件对象。它们适用于捕获你无法控制的代码的输出：

```python
import io
from contextlib import redirect_stdout

buffer = io.StringIO()
with redirect_stdout(buffer):
    legacy_function_that_prints()
```

它们是进程全局的且不是线程安全的，因此将它们限制在狭窄的作用域内，而不是在大的区域中保持激活。

## nullcontext

`nullcontext(value)` 是一个在退出时不执行任何操作并在进入时产生 `value` 的上下文管理器。当资源可能需要也可能不需要管理时，它消除了分支：

```python
from contextlib import nullcontext

cm = open(path) if path else nullcontext(sys.stdout)
with cm as out:
    write_report(out)
```

这保持了一个 `with` 块，而不是在 `if`/`else` 中复制主体。

## closing 和 aclosing

`closing(thing)` 在退出时调用 `thing.close()`，适配那些有 `close()` 方法但自身未实现上下文管理器协议的对象。`aclosing(thing)`（3.10+）调用 `await thing.aclose()`，是确定性地终结异步生成器的推荐方式。

## 常见错误：吞掉异常

重复出现的 contextlib 错误是在清理期间静默丢弃异常。基于生成器的管理器在 `yield` 之后返回控制权；如果其清理抛出了异常，或者如果 `__exit__` 返回真值，原始错误可能被掩盖。`suppress` 使这一点显式且有意，这没问题，但过宽的 `suppress`、抛出异常的 `finally`，或意外返回 `True` 的 `__exit__` 会隐藏真正的失败。仅抑制你理解的具体异常，保持抑制区域最小化，绝不让清理代码吞掉触发它的错误。
