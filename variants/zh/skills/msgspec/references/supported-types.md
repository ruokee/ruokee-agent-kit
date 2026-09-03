# msgspec 支持的类型

msgspec 使用 Python 类型注解来描述预期的类型。以下类型的大多数组合都受支持（有一些限制）：

## 内置类型

msgspec 原生支持以下 Python 内置类型，无需自定义转换钩子：

- `None`
- `bool`
- `int`
- `float`
- `str`
- `bytes`
- `bytearray`
- `tuple` / `typing.Tuple`
- `list` / `typing.List`
- `dict` / `typing.Dict`
- `set` / `typing.Set`
- `frozenset` / `typing.FrozenSet`

## msgspec 专有类型

- `msgspec.msgpack.Ext` - MessagePack 扩展类型
- `msgspec.Raw` - 原始未解析的消息数据
- `msgspec.UNSET` - 未设置值的标记类型
- `msgspec.Struct` - msgspec 结构体类型

## 标准库类型

msgspec 原生支持以下标准库类型，无需自定义转换钩子：

- `datetime.datetime` - 日期时间
- `datetime.date` - 日期
- `datetime.time` - 时间
- `datetime.timedelta` - 时间间隔
- `uuid.UUID` - UUID 标识符
- `decimal.Decimal` - 十进制数
- `enum.Enum` - 枚举类型
- `enum.IntEnum` - 整数枚举
- `enum.StrEnum` - 字符串枚举（Python 3.11+）
- `enum.Flag` - 标志枚举
- `enum.IntFlag` - 整数标志枚举
- `dataclasses.dataclass` - 数据类

## typing 模块类型

- `typing.Any` - 任意类型
- `typing.Optional` - 可选类型
- `typing.Union` - 联合类型
- `typing.Literal` - 字面量类型
- `typing.NewType` - 新类型定义
- `typing.Final` - 最终类型
- `typing.TypeAliasType` - 类型别名类型
- `typing.TypeAlias` - 类型别名
- `typing.NamedTuple` / `collections.namedtuple` - 命名元组
- `typing.TypedDict` - 类型化字典
- `typing.Generic` - 泛型类型
- `typing.TypeVar` - 类型变量

## 抽象类型

支持使用抽象基类作为类型提示，msgspec 会自动选择合适的具体类型：

- `collections.abc.Collection` / `typing.Collection` → `list`
- `collections.abc.Sequence` / `typing.Sequence` → `list`
- `collections.abc.MutableSequence` / `typing.MutableSequence` → `list`
- `collections.abc.Set` / `typing.AbstractSet` → `set`
- `collections.abc.MutableSet` / `typing.MutableSet` → `set`
- `collections.abc.Mapping` / `typing.Mapping` → `dict`
- `collections.abc.MutableMapping` / `typing.MutableMapping` → `dict`

## 重要说明

### 原生支持 vs 自定义钩子

**原生支持的类型。**

- 所有内置类型（int, str, list, dict 等）
- datetime, date, time, timedelta
- uuid.UUID
- decimal.Decimal
- enum.Enum 及其子类
- dataclasses.dataclass

**需要自定义钩子的类型。**

- `pathlib.Path` - 需要使用 `enc_hook` 和 `dec_hook` 转换为字符串
- 第三方库类型（如 ORM 模型）
- 自定义类（非 msgspec.Struct 或 dataclass）

### 示例：原生支持的类型

```python
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
import msgspec

class Status(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

class Record(msgspec.Struct):
    # 这些类型都原生支持，无需自定义钩子
    created_at: datetime
    date_only: date
    amount: Decimal
    status: Status
    tags: list[str]
    metadata: dict[str, int]

# 直接序列化和反序列化，无需钩子
record = Record(
    created_at=datetime.now(),
    date_only=date.today(),
    amount=Decimal("123.45"),
    status=Status.ACTIVE,
    tags=["tag1", "tag2"],
    metadata={"count": 10}
)

# 无需 enc_hook 或 dec_hook
encoded = msgspec.json.encode(record)
decoded = msgspec.json.decode(encoded, type=Record)
```

### 示例：需要自定义钩子的类型

```python
from pathlib import Path
import msgspec

class Project(msgspec.Struct):
    name: str
    path: Path  # Path 不是原生支持的类型

# 需要自定义钩子处理 Path
def enc_hook(obj):
    if isinstance(obj, Path):
        return str(obj)
    raise NotImplementedError(f"不支持的类型：{type(obj)}")

def dec_hook(type_, obj):
    if type_ is Path:
        return Path(obj)
    raise NotImplementedError(f"不支持的类型：{type_}")

project = Project(name="MyProject", path=Path("/home/user/project"))

encoder = msgspec.json.Encoder(enc_hook=enc_hook)
decoder = msgspec.json.Decoder(type=Project, dec_hook=dec_hook)

encoded = encoder.encode(project)
decoded = decoder.decode(encoded)
```

## 参考资源

- [msgspec 官方文档：支持的类型](https://jcristharif.com/msgspec/supported-types.html)
