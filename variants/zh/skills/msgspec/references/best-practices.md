# msgspec 最佳实践

本文档提供 msgspec 使用过程中的最佳实践指南和常见错误避免方法。

## 1. 类型注解

**推荐。**始终为所有字段提供明确的类型注解，这不仅提高代码可读性，还能充分利用 msgspec 的类型验证功能。

```python
class User(msgspec.Struct):
    name: Annotated[str, msgspec.Meta(description="用户名")]
    age: Annotated[int, msgspec.Meta(description="年龄")]
    tags: Annotated[list[str], msgspec.Meta(description="标签列表")]
```

**需要避免。**

```python
class User(msgspec.Struct):
    data: Any  # 失去了类型安全性
```

## 2. 可变类型默认值

内置空可变集合可以直接作为默认值。msgspec 将 `[]`、`{}`、`set()` 和 `bytearray()` 视为对应默认值工厂的简写，因此每个实例都会得到新值。

```python
class User(msgspec.Struct):
    name: str
    tags: list[str] = []
    metadata: dict[str, str] = {}
```

动态默认值、非空可变值或自定义可变类型应使用 `msgspec.field(default_factory=...)`。

```python
class Request(msgspec.Struct):
    request_id: str = msgspec.field(default_factory=generate_request_id)
```

## 3. 字段顺序

**推荐。**

**方案 1：必选字段在前，可选字段在后**

```python
class User(msgspec.Struct):
    name: str
    role: str = "user"
```

**方案 2：使用 kw_only 允许任意顺序**

```python
class User(msgspec.Struct, kw_only=True):
    role: str = "user"
    name: str  # 现在可以放在后面
```

**错误。**带默认值的字段之后出现必选字段时，msgspec 会在定义 Struct 类时抛出 `TypeError`。

```python
# TypeError: Required field 'name' cannot follow optional fields
class User(msgspec.Struct):
    role: str = "user"  # 有默认值
    name: str  # 必选字段
```

## 4. 不可变数据

不可变数据（frozen）如下：

**推荐。**对于不应该被修改的数据结构（如配置对象、常量、坐标等），使用 `frozen=True`。

```python
class Point(msgspec.Struct, frozen=True):
    x: Annotated[float, msgspec.Meta(description="X 坐标")]
    y: Annotated[float, msgspec.Meta(description="Y 坐标")]

class Config(msgspec.Struct, frozen=True):
    api_key: Annotated[str, msgspec.Meta(description="API 密钥")]
    base_url: Annotated[str, msgspec.Meta(description="基础 URL")]
```

如果需要修改不可变对象，使用 `msgspec.structs.replace()` 创建新实例：

```python
point = Point(x=1.0, y=2.0)
new_point = msgspec.structs.replace(point, x=3.0)  # 创建新实例
```

**错误。**误用 `frozen=True` 后尝试直接修改字段会导致 `AttributeError`。

```python
class Point(msgspec.Struct, frozen=True):
    x: float
    y: float

point = Point(x=1.0, y=2.0)
point.x = 3.0  # AttributeError: cannot set attribute
```

## 5. 重用编解码器

**推荐。**在循环或频繁调用的场景中，创建并重用编码器/解码器实例以提升性能。

```python
encoder = msgspec.json.Encoder()
decoder = msgspec.json.Decoder(type=User)

for item in large_dataset:
    encoded = encoder.encode(item)
    # 处理编码后的数据...
```

**JSONL 格式提示。**如果要生成 JSONL 格式（JSON Lines），使用 `encoder.encode_lines()`：

```python
encoder = msgspec.json.Encoder()
items = [
    User(name="Alice", age=30),
    User(name="Bob", age=25),
]

# encode_lines 会为每个对象生成一行 JSON
jsonl_bytes = encoder.encode_lines(items)
# b'{"name":"Alice","age":30}\n{"name":"Bob","age":25}\n'

# 写入文件
with open("users.jsonl", "wb") as f:
    f.write(jsonl_bytes)
```

**低效。**每次都创建新实例会有额外开销。

```python
for item in large_dataset:
    encoded = msgspec.json.encode(item)  # 每次都有额外开销
    # 处理...
```

## 6. 约束验证

使用 `Meta` 约束在类型化解码或 `msgspec.convert` 时验证字段。直接构造 Struct 不检查类型或 `Meta` 约束，只运行 `__post_init__`。

```python
class User(msgspec.Struct):
    username: Annotated[str, msgspec.Meta(
        description="用户名",
        min_length=3,
        max_length=20,
        pattern=r"^[a-zA-Z0-9_]+$"
    )]
    age: Annotated[int, msgspec.Meta(
        description="年龄",
        ge=0,
        le=150
    )]
```

**注意。**并不是所有情况都需要使用约束验证。有些项目可能会将校验逻辑放在业务逻辑中实现。另外，`Meta` 支持的校验逻辑相对较少，如果需要复杂的校验逻辑，可以在 `__post_init__` 方法中实现自定义验证。

直接构造与类型化转换的区别：

```python
user = User(username="alice", age=-5)  # 直接构造不检查 Meta

try:
    msgspec.convert({"username": "alice", "age": -5}, type=User)
except msgspec.ValidationError as exc:
    print(exc)  # 年龄必须大于等于 0
```

## 7. 标签联合

标签联合（Tagged Unions）如下：

**推荐。**当有多种可能的数据结构时，使用标签联合来明确区分类型。

```python
class SuccessResponse(msgspec.Struct, tag="success"):
    type: ClassVar[Literal["success"]] = "success"
    data: Annotated[dict, msgspec.Meta(description="响应数据")]

class ErrorResponse(msgspec.Struct, tag="error"):
    type: ClassVar[Literal["error"]] = "error"
    message: Annotated[str, msgspec.Meta(description="错误消息")]
    code: Annotated[int, msgspec.Meta(description="错误代码")]

type Response = SuccessResponse | ErrorResponse
```

**避免。**使用嵌套的可选字段会导致结构混乱。

```python
class Response(msgspec.Struct):
    success: bool
    data: dict | None = None
    message: str | None = None
    code: int | None = None
```

**错误。**包含多个 Struct 的联合要求每个 Struct 都有标签。缺少标签时，创建解码器就会抛出 `TypeError`，尚未开始解码输入。

```python
class Dog(msgspec.Struct):
    name: str
    breed: str

class Cat(msgspec.Struct):
    name: str
    lives: int

type Animal = Dog | Cat

decoder = msgspec.json.Decoder(type=Animal)  # TypeError：所有 Struct 都必须有标签
```

为各 Struct 添加可区分的标签，见[标签联合示例](../examples/tagged_union.py)。

## 8. 自定义类型转换

**推荐。**仅为非原生类型定义编码和解码钩子。`datetime`、`Enum`、`UUID` 和 `Decimal` 等原生类型由 msgspec 处理，不会调用这些钩子。

```python
class CustomType:
    x: int

    def __init__(self, x: int) -> None:
        self.x = x

# 定义编码和解码钩子
def enc_hook(obj: Any) -> Any:
    if isinstance(obj, CustomType):
        return {"__custom__": obj.x}
    raise NotImplementedError(f"不支持类型 {type(obj)}")

def dec_hook(type: type, obj: Any) -> Any:
    if type is CustomType:
        if isinstance(obj, dict) and "__custom__" in obj:
            return CustomType(x=obj["__custom__"])
    raise NotImplementedError(f"不支持类型 {type}")

class Event(msgspec.Struct):
    name: str
    custom: CustomType

# 创建带钩子的编码器和解码器
encoder = msgspec.json.Encoder(enc_hook=enc_hook)
decoder = msgspec.json.Decoder(type=Event, dec_hook=dec_hook)

# 正常工作
event = Event(name="test", custom=CustomType(x=1))
encoded = encoder.encode(event)
decoded = decoder.decode(encoded)
print(decoded.custom.x)  # 1
```

**错误。**使用自定义类型但未设置转换 Hook 会导致编码失败。

```python
class CustomType:
    x: int

    def __init__(self, x: int) -> None:
        self.x = x

class Event(msgspec.Struct):
    name: str
    custom: CustomType

# 这会失败
msgspec.json.encode(Event(name="test", custom=CustomType(x=1)))
# TypeError: Encoding objects of type CustomType is unsupported
```

## 9. 错误处理

先捕获 `ValidationError`，再捕获其父类 `DecodeError`，以区分字段验证失败和输入语法错误。避免用宽泛的 `Exception` 捕获隐藏其他故障。见[分支捕获示例](./serialization.md#错误处理)。

## 10. 协议选型

根据互操作性、可编辑性、记录分帧方式和实际工作负载选择协议。API、配置、内部服务和日志的建议见[协议选型](./serialization.md#协议选型)。

## 11. 测试

测试类型化序列化往返与验证失败，包含默认值、可选字段和约束边界。使用解码或 `msgspec.convert` 触发类型与 `Meta` 约束；直接构造 Struct 不能代替验证测试。以下示例需要开发依赖 `pytest`。

```python
from typing import Annotated

import msgspec
import pytest


class User(msgspec.Struct):
    name: Annotated[str, msgspec.Meta(min_length=1)]
    age: Annotated[int, msgspec.Meta(ge=0, le=150)]
    email: str | None = None


def test_user_roundtrip():
    original = User(name="Alice", age=30)
    encoded = msgspec.json.encode(original)
    decoded = msgspec.json.decode(encoded, type=User)
    assert decoded == original
    assert decoded.email is None


def test_user_validation():
    with pytest.raises(msgspec.ValidationError):
        msgspec.json.decode(b'{"name":"","age":30}', type=User)
    with pytest.raises(msgspec.ValidationError):
        msgspec.convert({"name": "Alice", "age": 151}, type=User)
```

更多负例与边界用例见[验证测试](./validation.md#验证测试)。自定义 Hook 或 `__post_init__` 涉及业务不变量时，也应分别测试成功与失败路径。

## 12. 其他建议

### 字段命名

使用表达含义的名称，例如 `email_address`、`created_timestamp` 和 `is_active`，避免 `e`、`ts`、`a` 这类含义不明的缩写。

### 可选字段

字段同时允许缺省和 null 时，使用 `Optional[T]` 或 `T | None`，并提供 `None` 默认值。仅允许 null 的类型注解不会让字段变为可省略。

```python
class User(msgspec.Struct):
    name: Annotated[str, msgspec.Meta(description="用户名")]
    email: Annotated[Optional[str], msgspec.Meta(description="邮箱（可选）")] = None
    phone: Annotated[str | None, msgspec.Meta(description="电话（可选）")] = None
```

### 文档化

说明字段含义、单位和业务约束。描述只表达意图，验证需要受支持的约束或 `__post_init__`。

```python
class OrderItem(msgspec.Struct):
    product_id: Annotated[str, msgspec.Meta(
        description="产品 ID，格式为 'PROD-XXXXXX'"
    )]
    quantity: Annotated[int, msgspec.Meta(
        description="数量，必须大于 0",
        gt=0
    )]
    discount: Annotated[float, msgspec.Meta(
        description="折扣率，0.0 表示无折扣，0.5 表示 50% 折扣",
        ge=0.0,
        le=1.0
    )] = 0.0
```

### 固定取值

用枚举表达固定集合，让类型化解码验证取值。

```python
from enum import Enum

class OrderStatus(Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

class Order(msgspec.Struct):
    status: OrderStatus
```

### Struct 职责

将描述同一概念、一起变化的字段放在一个 Struct 中。分开无关的职责，不把资料、订单和登录历史都塞进同一个 Struct。

```python
class User(msgspec.Struct):
    id: int
    name: str
    email: str

class UserProfile(msgspec.Struct):
    user_id: int
    bio: str
    avatar_url: str
```
