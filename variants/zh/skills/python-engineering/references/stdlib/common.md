# 常用标准库模块

本文件汇总了高频标准库模块的简要参考。每个模块解决一个特定的、反复出现的问题；使用合适的模块可以消除那些容易出错的手写代码。下面的模块彼此无关，因此每个模块独立成篇：不存在跨越它们的单一决策表。

## pathlib

`pathlib` 将文件系统路径建模为对象而不是字符串。`Path` 携带平台感知的语义：使用 `/` 拼接、拆分为 `parts`、读取 `.name`/`.stem`/`.suffix`，以及针对当前操作系统分隔符进行解析。

```python
from pathlib import Path

config = Path("config") / "settings.toml"
text = config.read_text(encoding="utf-8")
for log in Path("logs").glob("*.log"):
    archive(log)
```

优先使用 `Path` 而不是 `os.path` 字符串操作：`config / "settings.toml"` 比嵌套在 f-string 中的 `os.path.join` 调用更不易出错，并且对象传达了意图。`read_text`、`write_text`、`mkdir(parents=True, exist_ok=True)` 和 `iterdir` 等方法涵盖了大多数文件操作，无需使用 `open` 样板代码。

在 API 边界接受 `os.PathLike[str]`（或 `str | Path`），以便调用者可以传递字符串或 `Path`；在入口处一次性转换为 `Path`。不要在路径字面量中假设 POSIX 分隔符；让 `pathlib` 处理 `/` 和 `\` 之间的差异。仅在路径跨越需要文本的边界时（如序列化或子进程参数）才保留原始字符串。

## enum / StrEnum

`enum` 定义有限的、具名的值集合。当一个字段有封闭域，状态、模式、类别，时使用它，而不是使用类型检查器无法约束的裸字符串或魔法整数。

```python
from enum import Enum, StrEnum, auto

class Color(Enum):
    RED = auto()
    GREEN = auto()

class Role(StrEnum):
    ADMIN = "admin"
    VIEWER = "viewer"
```

`StrEnum`（3.11+）的成员*就是*字符串，因此它们可以直接序列化并与普通字符串比较：对于 JSON、配置和数据库列很方便。普通的 `Enum` 保持成员与其值不同，当你想要禁止意外字符串比较时更安全。`IntFlag`/`Flag` 建模使用 `|` 组合的位集选项。

枚举使穷尽性可见：对枚举成员的 `match` 可以被检查是否有缺失的 case。避免将枚举用于开放或频繁变化的值集合，在这种情况下它们只会增加仪式感而无回报。序列化时，将线格式固定为 `.value`（或使用 `StrEnum`）而不是 `.name`，这样重命名成员不会静默破坏已存储的数据。

## dataclasses

`dataclasses` 为主要作为结构化数据的类生成 `__init__`、`__repr__` 和 `__eq__`。它们适用于值对象、配置包和 DTO，其中字段*就是*类型。

```python
from dataclasses import dataclass, field

@dataclass(frozen=True, kw_only=True, slots=True)
class Endpoint:
    host: str
    port: int = 443
    headers: dict[str, str] = field(default_factory=dict)
```

对于可变默认值使用 `default_factory`：裸的 `[]` 或 `{}` 在实例之间共享，是一个经典错误。`frozen=True` 使实例可哈希且不可变；`kw_only=True` 避免随着字段增多而出现位置参数脆弱性；`slots=True` 减少内存并阻止意外的属性拼写错误。

对于行为很少的纯数据选择 dataclass。当需要更丰富的验证钩子或转换器而不引入完整框架时，使用 `attrs`；当需要对外部/不可信输入（请求体、配置文件）进行运行时解析和验证时，使用 pydantic。dataclass 在运行时验证任何内容；其注解是提示，而非守卫。参见 [`match-case`](../grammar/match-case.md) 了解如何匹配 dataclass 字段。

## logging

`logging` 将*发出*诊断事件与*决定*其去向分离。核心分工：**库**配置具名 logger 并发出记录，但从不配置处理器或级别；**应用程序**在启动时一次性配置处理器、级别和格式。

```python
import logging

logger = logging.getLogger(__name__)

def fetch(url: str) -> bytes:
    logger.debug("fetching %s", url)
    try:
        return _download(url)
    except DownloadError:
        logger.exception("download failed for %s", url)
        raise
```

在 `except` 块内使用 `logger.exception(...)` 自动捕获回溯；绝不使用 `logger.error(str(exc))`，它会丢弃栈信息。将消息参数作为 `%s` 参数传递，而不是预先格式化的 f-string，这样在级别禁用时可以跳过格式化。对于结构化日志，通过 `extra=` 字典或结构化日志库附加上下文，而不是将字段拼接到消息文本中。库应在其顶级 logger 中添加 `NullHandler`，以便在应用程序配置输出之前保持静默。

## collections

`collections` 提供了替代容易出错的手动模式的专业容器。

```python
from collections import Counter, defaultdict, deque

counts = Counter(words)                 # 频率统计
groups: dict[str, list[int]] = defaultdict(list)
recent: deque[int] = deque(maxlen=100)  # 有界环形缓冲区
```

`defaultdict` 消除了分组时的"检查然后初始化"模式；`Counter` 提供 `most_common` 和计数上的算术运算；`deque` 提供两端 O(1) 的追加/弹出操作以及 `list` 无法高效实现的有界 `maxlen` 环形缓冲区。`namedtuple` 在 dataclass 之前就已存在，仍然适用于轻量级不可变记录，尤其是兼容元组的返回值，但对于有行为、默认值或不断演化的字段的任何内容，优先使用 `@dataclass`，它更可读且可扩展。

## typing 运行时工具

大多数 `typing` 在运行时被擦除，但少数工具是设计用来运行的。`typing.get_type_hints(obj)` 将注解解析为真实对象，计算字符串/前向引用；这是框架读取注解的正确入口点，而不是直接访问 `__annotations__`。`TypeGuard`（以及 3.13 的 `TypeIs`）注解函数的返回值，使类型检查器在 `True` 结果时收窄参数类型：

```python
from typing import TypeGuard

def all_str(items: list[object]) -> TypeGuard[list[str]]:
    return all(isinstance(x, str) for x in items)
```

`@runtime_checkable` 允许 `Protocol` 与 `isinstance` 一起使用，但它仅检查属性的*存在性*，而非签名，因此将其视为粗略的守卫。对于 Python 3.14+ 的运行时内省，优先使用 `annotationlib.get_annotations()`，它是围绕延迟注解语义设计的。将运行时类型逻辑保持在边界处；不要在整个代码中散布 `isinstance` 阶梯，类型检查器可以在静态时验证这些。
