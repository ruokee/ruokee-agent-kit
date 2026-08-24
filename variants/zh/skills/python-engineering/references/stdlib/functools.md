# functools

`functools` 提供高阶辅助工具：接受或返回函数的工具。它们减少了围绕分发、偏函数应用、记忆化和装饰器编写的样板代码。下面的每个辅助工具解决不同的需求；当手动替代方案更容易出错时才使用它们，而不是默认使用。

## singledispatch

`@singledispatch` 将一个函数转换为泛型函数（generic function），根据其*第一个*参数的运行时类型选择实现。使用 `.register` 注册类型特定的变体：

```python
from functools import singledispatch

@singledispatch
def render(value: object) -> str:
    raise TypeError(f"no renderer for {type(value).__name__}")

@render.register
def _(value: int) -> str:
    return f"int:{value}"

@render.register
def _(value: list) -> str:
    return "[" + ", ".join(render(v) for v in value) + "]"
```

自 Python 3.11 起，注册的注解可以是联合类型（`int | float`），一次注册覆盖一个类型家族。`singledispatch` 适用于开放扩展，即新类型无需编辑中央函数即可添加处理程序；这是一种轻量级的访问者模式。它不根据第二个参数、字段值或组合进行分发；这些需要显式分支、`match` 或分发映射。对于方法，使用 `singledispatchmethod`。保持基本实现有意义（一个合理的默认值或清晰的错误），因为当没有已注册的类型匹配时它就会运行。

## partial

`partial` 绑定可调用对象的部分参数，生成一个只需要其余参数的新可调用对象。它无需包装 `lambda` 或闭包即可捕获上下文：

```python
from functools import partial

def connect(host: str, port: int, *, timeout: float) -> Connection: ...

connect_local = partial(connect, "localhost", timeout=5.0)
conn = connect_local(8080)
```

当你只是固定参数时，优先使用 `partial` 而非 `lambda`；它是可 pickle 的、可内省的（`.func`、`.args`、`.keywords`），并且读起来就是意图。对于复杂签名，类型检查器推断 `partial` 结果不完美，因此在推断类型不明确时注解绑定点。将其用于回调、依赖注入和为特定调用点配置泛型函数；避免将许多 `partial` 堆叠成不透明的链条。

## lru_cache / cache

`@lru_cache(maxsize=...)` 以参数为键记忆化结果；`@cache`（3.9+）是 `lru_cache(maxsize=None)`：一个无界记忆化。它们加速具有可哈希参数的纯函数，且这些函数被重复调用：

```python
from functools import cache

@cache
def factorial(n: int) -> int:
    return 1 if n <= 1 else n * factorial(n - 1)
```

缓存仅在函数引用透明时才是正确的：相同输入、相同输出、无可观察的副作用。缓存不纯函数（读取文件、时钟、可变全局变量）会隐藏陈旧性错误。另外两个隐患：长时间运行进程上的无界 `@cache` 是内存泄漏；方法或持有对象引用的任何函数上的缓存会保持该对象存活。参数必须是可哈希的，因此列表或字典等不可哈希的输入在未转换时不能被缓存。当输入种类繁多时，使用 `lru_cache(maxsize=...)` 限制大小，并暴露 `.cache_clear()` 以供测试。

## reduce

`reduce` 将二元函数折叠到可迭代对象上，生成单个值。对于没有内置函数的真正累积操作，它是可读的：

```python
from functools import reduce
from operator import or_

merged = reduce(or_, dict_list, {})  # 多个字典的并集
```

当存在普通的 `for` 循环或内置函数（`sum`、`math.prod`、`any`、`all`、`"".join`）时，优先使用它们：对大多数读者来说更清晰。`reduce` 仅适用于结合性组合，其中在循环中命名运行中的累加器并不会增加清晰度。`reduce` 内嵌套的 `lambda` 通常是一个信号，表明应切换回显式循环。

## wraps

`@wraps(func)` 将被包装函数的身份（`__name__`、`__doc__`、`__module__`、`__qualname__`、`__annotations__` 和 `__wrapped__`）复制到包装器上。每个返回内部函数的手写装饰器都应使用它：

```python
from functools import wraps

def logged(func):
    @wraps(func)
    def wrapper(*args, **kwargs):
        return func(*args, **kwargs)
    return wrapper
```

没有 `wraps`，内省、文档工具、`help()` 和测试报告都会看到包装器的身份而不是原始对象的身份。`__wrapped__` 还允许工具解包到底层函数。参见 [`decorator`](../grammar/decorator.md) 了解其支持的更广泛的装饰器机制。
