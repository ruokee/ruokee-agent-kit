# msgspec 最佳实践与常见陷阱

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

**方案1：必选字段在前，可选字段在后**

```python
class User(msgspec.Struct):
    name: str
    role: str = "user"
```

**方案2：使用 kw_only 允许任意顺序**

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


## 4. 不可变数据（frozen）

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

## 5. 重用编码器/解码器

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

**推荐。**使用约束来确保数据质量，避免在业务逻辑中手动检查。

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

**常见问题。**没有使用约束导致可以创建无效数据。

```python
class User(msgspec.Struct):
    age: int  # 没有约束

# 可以创建无效数据
user = User(age=-5)  # 负数年龄！
user = User(age=999)  # 不合理的年龄！
```

## 7. 标签联合（Tagged Unions）

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

**错误。**忘记为 Union 类型添加标签会导致反序列化时无法正确区分类型。

```python
class Dog(msgspec.Struct):
    name: str
    breed: str

class Cat(msgspec.Struct):
    name: str
    lives: int

type Animal = Dog | Cat

# 反序列化时无法区分
data = b'{"name":"Fluffy","breed":"Husky"}'
decoder = msgspec.json.Decoder(type=Animal)
animal = decoder.decode(data)  # 不确定性！可能被解析为 Dog 或 Cat
```

## 8. 自定义类型转换

**推荐。**使用自定义类型时，定义编码和解码钩子函数。

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

## 9. 其他建议

### 可选字段

对于可选字段，使用 `Optional[T]` 或 `T | None` 并提供 `None` 作为默认值。

```python
class User(msgspec.Struct):
    name: Annotated[str, msgspec.Meta(description="用户名")]
    email: Annotated[Optional[str], msgspec.Meta(description="邮箱（可选）")] = None
    phone: Annotated[str | None, msgspec.Meta(description="电话（可选）")] = None
```

### 文档化

为复杂字段和业务逻辑添加清晰的描述。

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
