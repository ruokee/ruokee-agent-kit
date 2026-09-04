# msgspec Struct 详解

本文档详细介绍 msgspec Struct 的功能和特性。

## 初始化

请注意，结构体定义中禁止重写 `__init__` 和 `__new__` 方法，但可以根据需要重写或添加其他方法。如果结构体类型定义了 `__post_init__(self)` 方法，则会在生成的 `__init__` 方法结束时调用此方法。此方法可用于向初始化过程添加额外逻辑（例如自定义验证）。

除了在 `__init__` 中调用之外，`__post_init__` 钩子函数也会在以下情况下被调用：

- 解码为结构体类型（例如 `msgspec.json.decode(..., type=MyStruct)`）
- 转换为结构体类型（例如 `msgspec.convert(..., type=MyStruct)`）

## 基本字段定义

最简单的字段定义方式是直接使用类型注解：

```python
class User(msgspec.Struct):
    name: str
    email: str
    age: int
    tags: list[str]

# 创建实例
user = User(name="Alice", email="alice@example.com", age=30, tags=["admin", "user"])
```

字段也可以使用 `Annotated` 和 `msgspec.Meta` 标注，添加元数据和描述：

```python
class User(msgspec.Struct):
    name: Annotated[str, msgspec.Meta(description="用户名")]
    email: Annotated[str, msgspec.Meta(description="邮箱地址")]
    age: Annotated[int, msgspec.Meta(description="年龄")]
    tags: Annotated[list[str], msgspec.Meta(description="用户标签列表")]
```

## 默认值字段

不可变默认值可以直接赋值。内置空可变集合也可以直接使用，msgspec 将 `[]`、`{}`、`set()` 和 `bytearray()` 视为对应默认值工厂的简写。

```python
class User(msgspec.Struct):
    name: Annotated[str, msgspec.Meta(description="用户名")]
    role: Annotated[str, msgspec.Meta(description="角色")] = "user"
    tags: Annotated[list[str], msgspec.Meta(description="标签")] = []
    metadata: Annotated[dict[str, str], msgspec.Meta(description="元数据")] = {}
```

动态默认值、非空可变值或自定义可变类型应使用 `msgspec.field(default_factory=...)`。

```python
class Request(msgspec.Struct):
    request_id: str = msgspec.field(default_factory=generate_request_id)
```

## 特殊类型

### UNSET 类型

`msgspec.UNSET` 是一个单例对象，用于表示字段没有设置值。这在需要区分字段缺失和字段显式设置为 `None` 的场景中非常有用。

**编码时。**任何包含 `UNSET` 的字段都会从消息中省略。

**解码时。**如果字段在消息中未显式设置，则会设置默认值 `UNSET`。这让下游使用者可以判断字段是未设置还是显式设置为 `None`。

`UNSET` 字段支持用于 `msgspec.Struct`、`dataclasses` 和 `attrs` 类型。在这些类型的字段之外的任何地方使用 `msgspec.UNSET` 或 `msgspec.UnsetType` 都会导致错误。

```python
class UpdateRequest(msgspec.Struct):
    name: Annotated[str | msgspec.UnsetType, msgspec.Meta(description="用户名")] = msgspec.UNSET
    email: Annotated[str | None | msgspec.UnsetType, msgspec.Meta(description="邮箱")] = msgspec.UNSET
    age: Annotated[int | msgspec.UnsetType, msgspec.Meta(description="年龄")] = msgspec.UNSET

# 只更新 name 字段
req1 = UpdateRequest(name="Alice")
encoded1 = msgspec.json.encode(req1)
# b'{"name":"Alice"}'，未设置的字段被省略

# 将 email 显式设置为 None
req2 = UpdateRequest(name="Bob", email=None)
encoded2 = msgspec.json.encode(req2)
# b'{"name":"Bob","email":null}'，None 会被编码

# 解码时可以判断字段是否被设置
decoded = msgspec.json.decode(b'{"name":"Charlie"}', type=UpdateRequest)
print(decoded.name)   # "Charlie"
print(decoded.email)  # msgspec.UNSET（未设置）
print(decoded.age)    # msgspec.UNSET（未设置）
```

## 字段顺序

默认情况下，带默认值的字段必须排在必选字段之后：

**正确写法。**

```python
class Example(msgspec.Struct):
    required_field: Annotated[str, msgspec.Meta(description="必选字段")]
    optional_field: Annotated[str | None, msgspec.Meta(description="可选字段")] = None
```

**错误写法。**定义 Struct 类时会抛出 `TypeError`。

```python
class Example(msgspec.Struct):
    optional_field: Annotated[str | None, msgspec.Meta(description="可选字段")] = None
    required_field: Annotated[str, msgspec.Meta(description="必选字段")]
```

如果需要将默认值字段排在前面，使用 `kw_only=True`：

```python
class Example(msgspec.Struct, kw_only=True):
    optional_field: Annotated[str | None, msgspec.Meta(description="可选字段")] = None
    required_field: Annotated[str, msgspec.Meta(description="必选字段")]

# 使用时必须使用关键字参数
example = Example(required_field="value", optional_field="optional")
```

## 类变量

类变量不会被当作字段处理，可以用于定义在所有实例间共享的数据：

```python
class User(msgspec.Struct):
    # 类变量：不是实例字段，不会被序列化
    DEFAULT_ROLE: ClassVar[str] = "user"
    MAX_NAME_LENGTH: ClassVar[int] = 100

    # 实例字段
    name: Annotated[str, msgspec.Meta(description="用户名")]
    role: Annotated[str, msgspec.Meta(description="用户角色")] = "user"

# 类变量可以通过类访问
print(User.DEFAULT_ROLE)  # "user"

# 实例字段需要通过实例访问
user = User(name="Alice")
print(user.name)  # "Alice"
```

**要点。**

- 使用 `ClassVar` 注解标记类变量
- 类变量不会出现在 `__init__` 方法中
- 类变量不会被序列化或反序列化
- 常用于定义常量、配置值或类型标记

## 字段重命名

使用 `msgspec.field(name=...)` 可以将 Python 字段名映射到不同的序列化名称：

```python
class APIResponse(msgspec.Struct):
    # Python 使用 snake_case，JSON 使用 camelCase
    user_id: Annotated[int, msgspec.Meta(description="用户 ID")] = msgspec.field(name="userId")
    created_at: Annotated[str, msgspec.Meta(description="创建时间")] = msgspec.field(name="createdAt")
    is_active: Annotated[bool, msgspec.Meta(description="是否激活")] = msgspec.field(name="isActive")

# 序列化时使用重命名后的名称
response = APIResponse(user_id=123, created_at="2024-01-01", is_active=True)
encoded = msgspec.json.encode(response)
# b'{"userId":123,"createdAt":"2024-01-01","isActive":true}'

# 反序列化也支持重命名
data = b'{"userId":456,"createdAt":"2024-01-02","isActive":false}'
decoded = msgspec.json.decode(data, type=APIResponse)
print(decoded.user_id)  # 456

# 也可以在类级别使用 rename 参数批量重命名
class User(msgspec.Struct, rename="camel"):
    user_id: int
    first_name: str
    last_name: str
    is_active: bool

user = User(user_id=1, first_name="Alice", last_name="Smith", is_active=True)
encoded = msgspec.json.encode(user)
# b'{"userId":1,"firstName":"Alice","lastName":"Smith","isActive":true}'
```

**使用场景。**

- 适配外部 API 的命名约定（如 `camelCase`、`PascalCase`）
- 处理 Python 保留字（如 `class`、`type`）
- 保持代码风格一致性

## 继承

Struct 支持继承，子类会继承父类的所有字段：

```python
class Animal(msgspec.Struct):
    name: Annotated[str, msgspec.Meta(description="动物名称")]
    age: Annotated[int, msgspec.Meta(description="年龄")]

class Dog(Animal):
    breed: Annotated[str, msgspec.Meta(description="品种")]

class Cat(Animal):
    indoor: Annotated[bool, msgspec.Meta(description="是否室内猫")]

# 子类包含父类的所有字段
dog = Dog(name="Buddy", age=5, breed="Golden Retriever")
cat = Cat(name="Whiskers", age=3, indoor=True)
```

**继承规则。**

- 子类继承父类的所有字段和选项
- 字段顺序：父类字段在前，子类字段在后
- 可以继承多个 Struct 类
- 如果父类使用 `frozen=True`，子类也会是不可变的（除非显式覆盖）

```python
# 多重继承示例
class Timestamped(msgspec.Struct):
    created_at: Annotated[str, msgspec.Meta(description="创建时间")]
    updated_at: Annotated[str, msgspec.Meta(description="更新时间")]

class Identifiable(msgspec.Struct):
    id: Annotated[int, msgspec.Meta(description="唯一标识")]

class User(Identifiable, Timestamped):
    name: Annotated[str, msgspec.Meta(description="用户名")]
    email: Annotated[str, msgspec.Meta(description="邮箱")]

# User 包含所有父类字段：id, created_at, updated_at, name, email
```

## 比较和哈希

默认情况下，Struct 实例支持相等性比较（`==`、`!=`）：

```python
class Point(msgspec.Struct):
    x: Annotated[float, msgspec.Meta(description="X 坐标")]
    y: Annotated[float, msgspec.Meta(description="Y 坐标")]

p1 = Point(x=1.0, y=2.0)
p2 = Point(x=1.0, y=2.0)
p3 = Point(x=3.0, y=4.0)

print(p1 == p2)  # True（字段值相同）
print(p1 == p3)  # False
```

**排序支持。**

使用 `order=True` 启用比较运算符（`<`、`<=`、`>`、`>=`）：

```python
class Version(msgspec.Struct, order=True):
    major: Annotated[int, msgspec.Meta(description="主版本号")]
    minor: Annotated[int, msgspec.Meta(description="次版本号")]
    patch: Annotated[int, msgspec.Meta(description="补丁版本号")]

v1 = Version(major=1, minor=0, patch=0)
v2 = Version(major=1, minor=2, patch=3)
v3 = Version(major=2, minor=0, patch=0)

print(v1 < v2)  # True
print(v2 < v3)  # True
sorted_versions = sorted([v3, v1, v2])  # 可以排序
```

**哈希支持。**

不可变的 Struct（`frozen=True`）可以用作字典键或集合元素：

```python
class Point(msgspec.Struct, frozen=True):
    x: Annotated[int, msgspec.Meta(description="X 坐标")]
    y: Annotated[int, msgspec.Meta(description="Y 坐标")]

# frozen=True 的 Struct 可以哈希
p1 = Point(x=1, y=2)
p2 = Point(x=3, y=4)

# 用作字典键
distances = {p1: 5.0, p2: 10.0}

# 用作集合元素
points = {p1, p2, Point(x=1, y=2)}  # 去重
print(len(points))  # 2（p1 和 Point(x=1, y=2) 相同）
```

## 联合类型（Tagged Unions）

msgspec 使用标签联合（tagged unions）来处理多态类型。通过 `tag` 参数定义不同的变体：

```python
class GetRequest(msgspec.Struct, tag="get"):
    key: Annotated[str, msgspec.Meta(description="要获取的键")]

class SetRequest(msgspec.Struct, tag="set"):
    key: Annotated[str, msgspec.Meta(description="要设置的键")]
    value: Annotated[Any, msgspec.Meta(description="要设置的值")]

class DeleteRequest(msgspec.Struct, tag="delete"):
    key: Annotated[str, msgspec.Meta(description="要删除的键")]

# 定义联合类型
type Request = GetRequest | SetRequest | DeleteRequest

# 使用
decoder = msgspec.json.Decoder(type=Request)
request = decoder.decode(b'{"type":"get","key":"name"}')  # GetRequest(key="name")
```

**工作原理。**

- `tag` 参数指定用于区分不同类型的字段名（默认为 "type"）
- 序列化时会自动添加标签字段
- 反序列化时根据标签字段选择正确的类型

**注。**如果希望访问 `type` 属性，可以定义 `ClassVar`，例如：

```python
class GetRequest(msgspec.Struct, tag="get"):
    type: ClassVar[Literal["get"]] = "get"
    key: Annotated[str, msgspec.Meta(description="要获取的键")]
```

**联合类型的限制。**

msgspec 支持类型联合，但有一些限制。这些限制是为了在解码时消除歧义。对于给定的编码值，在 `typing.Union` 中必须始终只有一个类型可以解码该值。

联合类型的限制如下：

- 联合类型最多只能包含一个编码为整数的类型（`int`、`enum.IntEnum`）
- 联合类型最多只能包含一个编码为字符串的类型（`str`、`enum.Enum`、`bytes`、`bytearray`、`datetime.datetime`、`datetime.date`、`datetime.time`、`uuid.UUID`、`decimal.Decimal`）
- 联合类型最多只能包含一个编码为对象的类型（`dict`、`typing.TypedDict`、`dataclasses`、`attrs`、`array_like=False` 的 `Struct`）
- 联合类型最多只能包含一个编码为数组的类型（`list`、`tuple`、`set`、`frozenset`、`typing.NamedTuple`、`array_like=True` 的 `Struct`）
- 联合类型最多只能包含一个未添加 `tag` 标记的 `Struct` 类型。包含多个 `Struct` 类型的联合只能通过标签联合来支持
- 不支持包含自定义类型的联合，除了可选类型（例如 `Optional[CustomType]`）

**扩展阅读。**[msgspec 联合类型和可选类型详解](https://jcristharif.com/msgspec/supported-types.html#union-optional)

## 嵌套结构体

结构体可以嵌套使用：

```python
class Address(msgspec.Struct):
    street: Annotated[str, msgspec.Meta(description="街道地址")]
    city: Annotated[str, msgspec.Meta(description="城市")]
    country: Annotated[str, msgspec.Meta(description="国家")]

class Company(msgspec.Struct):
    name: Annotated[str, msgspec.Meta(description="公司名称")]
    address: Annotated[Address, msgspec.Meta(description="公司地址")]

class Employee(msgspec.Struct):
    name: Annotated[str, msgspec.Meta(description="员工姓名")]
    company: Annotated[Company, msgspec.Meta(description="所属公司")]
    skills: Annotated[dict[str, int], msgspec.Meta(description="技能评分（技能名->分数）")]
```

## 结构体选项

Struct 支持多个类选项来控制行为：

```python
# 不可变结构体（类似 frozen dataclass）
class Point(msgspec.Struct, frozen=True):
    x: Annotated[float, msgspec.Meta(description="X 坐标")]
    y: Annotated[float, msgspec.Meta(description="Y 坐标")]

# 所有字段都是关键字参数
class Config(msgspec.Struct, kw_only=True):
    host: Annotated[str, msgspec.Meta(description="主机地址")]
    port: Annotated[int, msgspec.Meta(description="端口号")]

# 禁止额外字段（反序列化时）
class StrictUser(msgspec.Struct, forbid_unknown_fields=True):
    name: Annotated[str, msgspec.Meta(description="用户名")]
    age: Annotated[int, msgspec.Meta(description="年龄")]

# 省略默认值字段（序列化时）
class OptimizedData(msgspec.Struct, omit_defaults=True):
    id: Annotated[int, msgspec.Meta(description="ID")]
    status: Annotated[str, msgspec.Meta(description="状态")] = "active"
```

**所有可用选项。**

| 选项 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `frozen` | bool | False | 设为 True 时，实例不可变且可哈希 |
| `order` | bool | False | 启用比较运算符（<、<=、>、>=） |
| `eq` | bool | True | 启用相等性比较（==、!=） |
| `kw_only` | bool | False | 所有字段必须通过关键字参数传递 |
| `omit_defaults` | bool | False | 序列化时省略值为默认值的字段 |
| `forbid_unknown_fields` | bool | False | 反序列化时拒绝未知字段 |
| `tag` | str \| int | None | 标签联合的标签字段值 |
| `tag_field` | str | "type" | 标签联合使用的字段名 |
| `rename` | str \| dict | None | 字段重命名规则（"lower"、"upper"、"camel"、"pascal" 或映射字典） |
| `array_like` | bool | False | 使 Struct 表现得像元组（位置访问） |
| `gc` | bool | True | 启用垃圾回收支持 |
| `weakref` | bool | False | 启用弱引用支持 |
| `dict` | bool | False | 为实例添加 `__dict__`，允许设置未声明的属性 |
| `repr_omit_defaults` | bool | False | repr 中省略默认值字段 |

**高级选项示例。**

```python
# array_like：元组式访问
class Point(msgspec.Struct, array_like=True):
    x: Annotated[float, msgspec.Meta(description="X 坐标")]
    y: Annotated[float, msgspec.Meta(description="Y 坐标")]

p = Point(x=1.0, y=2.0)
print(p[0])  # 1.0（通过索引访问）
print(p[1])  # 2.0
x, y = p  # 支持解包

# rename：批量字段重命名
class APIModel(msgspec.Struct, rename="camel"):
    user_id: Annotated[int, msgspec.Meta(description="用户 ID")]
    first_name: Annotated[str, msgspec.Meta(description="名")]
    last_name: Annotated[str, msgspec.Meta(description="姓")]

# 序列化为 camelCase
# {"userId": 123, "firstName": "John", "lastName": "Doe"}

# weakref：启用弱引用
class Node(msgspec.Struct, weakref=True):
    value: Annotated[int, msgspec.Meta(description="节点值")]

node = Node(value=42)
ref = weakref.ref(node)  # 创建弱引用

# gc=False：禁用 GC，适用于不包含循环引用的简单结构
class SimpleData(msgspec.Struct, gc=False):
    id: Annotated[int, msgspec.Meta(description="ID")]
    value: Annotated[str, msgspec.Meta(description="值")]

# repr_omit_defaults：简化 repr 输出
class Config(msgspec.Struct, repr_omit_defaults=True):
    host: Annotated[str, msgspec.Meta(description="主机")]
    port: Annotated[int, msgspec.Meta(description="端口")] = 8080
    debug: Annotated[bool, msgspec.Meta(description="调试模式")] = False

cfg = Config(host="localhost")
print(cfg)  # Config(host='localhost')（省略了默认值的 port 和 debug）
```

## 类型验证

[msgspec 类型验证文档](https://jcristharif.com/msgspec/structs.html#type-validation)

与某些其他库不同，直接构造 `msgspec.Struct` 不会检查类型注解。msgspec 会在类型化解码或 `msgspec.convert` 过程中检查类型。

使用 `mypy` 或 `pyright` 检查静态可见的构造调用。如果直接构造也必须满足运行时不变量，请在 `__post_init__` 中显式检查。

程序输入只能在运行时确定。为类型化解码或 `msgspec.convert` 提供目标类型后，msgspec 会验证并转换输入。性能结论应以代表真实负载的基准测试为准。
