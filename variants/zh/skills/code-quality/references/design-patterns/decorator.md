# 装饰器模式（Decorator Pattern）

本文档涵盖 GoF *结构型*装饰器模式——包装对象以添加行为。这不是关于 Python 的 `@decorator` 语法，尽管两者相关，并且将在下面讨论其关系。

## 意图（Intent）

通过将一个对象包装在另一个共享相同接口的对象中，动态地向该对象附加额外职责。装饰器为扩展行为提供了一种比子类化更灵活的替代方案，并且可以在运行时组合和堆叠。

## 解决的问题

你有一个组件和几个可选的、独立的行为需要添加：缓冲、压缩、加密、指标、重试。为每一种组合创建子类会导致爆炸——`BufferedCompressedStream`、`BufferedEncryptedStream` 等等。装饰器让每个行为成为自己的包装器，遵循组件的接口并委托给被包装的对象。你通过嵌套包装器在运行时组合所需的行为，以任何情况和顺序。

## 结构和参与者

- **组件（Component）**：原始对象及其装饰器共享的接口。
- **具体组件（Concrete component）**：被装饰的基础对象。
- **装饰器（Decorator）**：持有 Component，实现 Component，并委托给被包装的对象，在委托之前或之后添加行为。
- **具体装饰器（Concrete decorators）**：每个添加一个职责。

因为每个装饰器都实现相同的 Component 接口并持有一个 Component，装饰器和基础对象可互换并且可以任意嵌套。`Compress(Encrypt(FileStream(path)))` 本身就是一个 `Component`。

## Python 惯用实现

当"组件"是函数或可调用对象时，Python 的 `@decorator` 语法直接表达了该模式，是惯用的选择：

```python
def with_metrics(handler: Handler) -> Handler:
    @functools.wraps(handler)
    async def wrapped(request: Request) -> Response:
        with timer("handler.duration"):
            return await handler(request)
    return wrapped
```

`functools.wraps` 保留了被包装的可调用对象的名称、文档字符串和签名元数据——省略它会破坏内省和工具支持。

当你包装一个有多个方法的状态对象并希望在运行时组合行为时，完整的*对象*形式是值得编写的：

```python
class Stream(Protocol):
    def read(self, n: int) -> bytes: ...
    def write(self, data: bytes) -> int: ...


class CompressingStream:
    def __init__(self, inner: Stream) -> None:
        self._inner = inner

    def read(self, n: int) -> bytes:
        return decompress(self._inner.read(n))

    def write(self, data: bytes) -> int:
        return self._inner.write(compress(data))
```

对于包装具有大型接口的对象而只需修改少数方法时，`__getattr__` 可以将其余方法转发给内部对象——功能强大但有魔法性，因此应谨慎使用并做好文档记录。

## 何时使用

- 需要在运行时以不同组合或顺序组合独立的行为。
- 行为是横切且稳定的：日志、缓存、重试、认证、验证、指标、事务边界。
- 为每种组合创建子类会导致类数量爆炸。

## 何时不使用

- 只有一个固定行为要添加且没有运行时组合——普通 `@decorator` 函数，或直接内联行为，比对象装饰器层次结构更简单。
- 添加的行为需要资源生命周期（获取/释放）。上下文管理器表达设置和清理比装饰器清晰得多。
- 你试图用装饰器添加真正的业务逻辑。装饰器应保持薄层；业务规则属于组件。

## 失败模式

- **隐藏的控制流**：堆叠的装饰器模糊了执行顺序、异常捕获位置和耗时分布。深层堆栈变得难以调试。
- **元数据丢失**：忘记 `functools.wraps` 会破坏 `__name__`、文档字符串和签名。
- **行为漂移**：装饰器微妙地改变组件的契约（返回类型、抛出的错误），使得包装和未包装的对象不再可互换。
- **性能意外**：每一层增加一个调用帧，可能还有 I/O；一个指标加重试加缓存的栈可能比操作本身代价更高。

## 与其他模式的关系

[adapter.md](./adapter.md) 改变接口；装饰器保持相同接口并添加行为。[proxy](./index.md) 也用相同接口包装，但控制*访问*（懒加载、权限）而非丰富行为——两者结构几乎相同，差别在于意图。链式装饰器类似于管道；对于顺序请求处理，请参见责任链模式（Chain of Responsibility）。当行为涉及资源生命周期时，优先选择上下文管理器而非装饰器。
