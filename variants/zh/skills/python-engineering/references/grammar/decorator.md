# 装饰器

装饰器（decorator）是高阶函数的语法糖：定义上方的 `@d` 意味着 `f = d(f)`。定义在定义时被传递给 `d`，名称被重新绑定到 `d` 返回的任何内容。装饰器能做的所有事情都可以写成显式调用；语法的存在是为了将转换放在读者看到被转换对象的位置。

## 简单装饰器

不带参数的装饰器接受一个可调用对象并返回一个替换品。替换品通常是一个包装闭包（wrapper closure），在原对象周围添加行为：

```python
from collections.abc import Callable
from functools import wraps
from typing import ParamSpec, TypeVar

P = ParamSpec("P")
R = TypeVar("R")


def traced(func: Callable[P, R]) -> Callable[P, R]:
    @wraps(func)
    def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
        log.debug("enter %s", func.__name__)
        try:
            return func(*args, **kwargs)
        finally:
            log.debug("exit %s", func.__name__)

    return wrapper
```

`ParamSpec` 和 `TypeVar` 让包装器为类型检查器保留被包装的签名，因此调用者仍然能看到原始的参数和返回类型。

## functools.wraps 与签名保留

没有辅助工具时，包装闭包会替换原始对象的身份：`__name__`、`__doc__`、`__module__`、`__qualname__`、`__annotations__` 和 `__wrapped__` 都描述 `wrapper`，而不是 `func`。这会破坏内省、文档生成、打印函数名称的日志记录以及某些读取元数据的框架。

`functools.wraps`（它本身是一个应用于内部包装器的装饰器）会复制这些元数据。始终使用它。它还会设置 `__wrapped__`，这让工具可以解包到原始对象。注意 `wraps` 会复制 `__annotations__`，但无法让类型检查器理解其调用签名与原始对象不同的包装器——这是 `ParamSpec` 的用途。

## 带参数的装饰器

接受配置的装饰器是一个工厂：一个返回装饰器的函数。这增加了一层嵌套——外层调用捕获参数，中间函数是实际的装饰器，内层闭包是包装器：

```python
def retry(*, attempts: int) -> Callable[[Callable[P, R]], Callable[P, R]]:
    def decorate(func: Callable[P, R]) -> Callable[P, R]:
        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            last: Exception | None = None
            for _ in range(attempts):
                try:
                    return func(*args, **kwargs)
                except TransientError as exc:
                    last = exc
            raise RetryExhausted from last

        return wrapper

    return decorate
```

用作 `@retry(attempts=3)`。注意，不带调用的 `@retry` 会将函数作为 `attempts` 传入，这是一个常见错误。保持参数少且为关键字-only；选项过多通常意味着该行为需要一个显式的策略对象。

## 类装饰器

装饰器可以应用于类。它接收类对象并返回一个类（通常是同一个，经过修改）。这就是 `@dataclass` 的工作方式：它检查注解并合成 `__init__`、`__repr__` 等。类装饰器适用于注册、附加框架元数据或小型后处理。当它们以类型检查器和读者无法理解的方式修改构造、继承或属性时，就会变得危险。

## 装饰器类

其实例通过 `__call__` 可调用的类可以作为装饰器。当包装器需要命名状态、超出单个闭包变量的设置，或更清晰的对象边界时，可以使用这种形式：

```python
class RateLimited:
    def __init__(self, limiter: Limiter) -> None:
        self._limiter = limiter

    def __call__(self, func: Callable[P, R]) -> Callable[P, R]:
        @wraps(func)
        def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            self._limiter.acquire()
            return func(*args, **kwargs)

        return wrapper
```

区分*装饰器类*（其 `__call__` 接受函数）和用于包装*实例*的类。前者是装饰；后者是普通组合。

## 堆叠与执行顺序

堆叠的装饰器在定义时从下到上应用，生成的包装器在调用时从上到下执行：

```python
@cache
@retry(attempts=3)
def fetch(key: str) -> bytes: ...
```

这里 `retry` 先包装 `fetch`，然后 `cache` 再包装它。在调用时 `cache` 在最外层运行，因此缓存命中会完全跳过重试。顺序会改变行为，因此当两个装饰器交互时（缓存和重试、授权和日志记录），顺序是一个真正的决策，值得加上注释。

## 类型保留的挑战

除非你有意保留，否则包装器会擦除类型信息。对于保留签名的包装器，使用 `ParamSpec` 加上返回 `TypeVar`。*改变*签名的装饰器——添加注入的参数、更改返回类型——无法通过简单的 `ParamSpec` 透传来表达，需要手写的返回类型或 `typing.overload`。将函数转变为不同类型对象（描述符、注册处理函数）的装饰器应注解该新类型，以免误导调用者。

## 何时有帮助，何时有害

装饰器适用于稳定的、横切关注点（cross-cutting concerns），其名称确切说明了变化内容：注册、路由、缓存（`@cache`）、重试或超时策略、授权、指标、追踪和弃用标记。标准库提供了几个你应该认识的装饰器：`@property`、`@staticmethod` 和 `@classmethod` 塑造属性和方法绑定；`@functools.cached_property` 按实例记忆化；`@dataclass` 生成样板代码；`@typing.overload` 声明多个签名；`@functools.singledispatch` 提供基于类型的分发。

当装饰器隐藏了读者需要追踪的控制流、将业务逻辑偷偷放在没人检查的地方、不可见地更改返回类型或吞掉异常，或通过将真正的调用埋在多层包装器下使调试更难时，它们就有害了。检验标准：如果理解函数的行为需要阅读装饰器的源代码，那么该行为很可能应该属于显式调用或上下文管理器。
