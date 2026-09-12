# msgspec 验证与约束

本文档详细介绍 msgspec 的验证机制和约束功能。

## 约束（Constraints）

[msgspec Constraints Documentation](https://jcristharif.com/msgspec/constraints.html)

msgspec 支持对字段值进行约束验证：

```python
class User(Struct):
    # 字符串长度约束
    username: Annotated[str, Meta(
        description="用户名",
        min_length=3,
        max_length=20
    )]

    # 数值范围约束
    age: Annotated[int, Meta(
        description="年龄",
        ge=0,  # 大于等于
        le=150  # 小于等于
    )]

    # 正则表达式约束
    email: Annotated[str, Meta(
        description="邮箱",
        pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$"
    )]

    # 列表长度约束
    tags: Annotated[list[str], Meta(
        description="标签",
        min_length=1,
        max_length=10
    )]
```

## 支持的约束类型

### 字符串约束

- `min_length`：最小长度
- `max_length`：最大长度
- `pattern`：正则表达式模式

```python
class StringExample(msgspec.Struct):
    username: Annotated[str, msgspec.Meta(
        min_length=3,
        max_length=20,
        pattern=r"^[a-zA-Z0-9_]+$"
    )]

    # 电子邮件验证
    email: Annotated[str, msgspec.Meta(
        pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$"
    )]

    # URL 验证
    website: Annotated[str, msgspec.Meta(
        pattern=r"^https?://[\w\.-]+(:\d+)?(/.*)?$"
    )]
```

### 数值约束

- `gt`：大于（greater than）
- `ge`：大于等于（greater than or equal）
- `lt`：小于（less than）
- `le`：小于等于（less than or equal）
- `multiple_of`：倍数

```python
class NumberExample(msgspec.Struct):
    # 正整数
    positive_int: Annotated[int, msgspec.Meta(gt=0)]

    # 年龄范围
    age: Annotated[int, msgspec.Meta(ge=0, le=150)]

    # 评分范围
    rating: Annotated[float, msgspec.Meta(ge=0.0, le=5.0)]

    # 偶数
    even_number: Annotated[int, msgspec.Meta(multiple_of=2)]

    # 百分比（0-100）
    percentage: Annotated[int, msgspec.Meta(ge=0, le=100, multiple_of=5)]
```

### 集合约束

- `min_length`：最小长度
- `max_length`：最大长度

```python
class CollectionExample(msgspec.Struct):
    # 列表长度约束
    tags: Annotated[list[str], msgspec.Meta(
        min_length=1,
        max_length=10
    )]

    # 非空列表
    items: Annotated[list[int], msgspec.Meta(min_length=1)]

    # 字典大小约束
    metadata: Annotated[dict[str, str], msgspec.Meta(
        min_length=0,
        max_length=20
    )]
```

### 通用元数据

- `examples`：示例值
- `title`：标题
- `description`：描述

```python
class MetadataExample(msgspec.Struct):
    user_id: Annotated[int, msgspec.Meta(
        title="用户ID",
        description="用户的唯一标识符",
        examples=[1, 42, 1000],
        gt=0
    )]

    status: Annotated[str, msgspec.Meta(
        title="状态",
        description="用户账户状态",
        examples=["active", "inactive", "suspended"],
        pattern=r"^(active|inactive|suspended)$"
    )]
```

## 约束组合

多个约束可以同时使用：

```python
class Product(msgspec.Struct):
    # 产品名称：3-100 字符，只允许字母、数字、空格和连字符
    name: Annotated[str, msgspec.Meta(
        description="产品名称",
        min_length=3,
        max_length=100,
        pattern=r"^[a-zA-Z0-9\s\-]+$"
    )]

    # 价格：大于 0，最多两位小数
    price: Annotated[float, msgspec.Meta(
        description="产品价格（元）",
        gt=0,
        multiple_of=0.01  # 确保最多两位小数
    )]

    # 库存：0-10000 的整数
    stock: Annotated[int, msgspec.Meta(
        description="库存数量",
        ge=0,
        le=10000
    )]

    # 标签：1-20 个标签
    tags: Annotated[list[str], msgspec.Meta(
        description="产品标签",
        min_length=1,
        max_length=20
    )]
```

## 自定义验证

对于更复杂的验证逻辑，可以使用 `__post_init__` 方法：

```python
class User(msgspec.Struct):
    username: Annotated[str, msgspec.Meta(min_length=3, max_length=20)]
    email: Annotated[str, msgspec.Meta(pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")]
    age: Annotated[int, msgspec.Meta(ge=0, le=150)]
    password: str
    password_confirm: str

    def __post_init__(self):
        # 自定义验证：密码必须匹配
        if self.password != self.password_confirm:
            raise ValueError("密码和确认密码不匹配")

        # 自定义验证：密码强度
        if len(self.password) < 8:
            raise ValueError("密码长度必须至少为 8 个字符")

        # 自定义验证：用户名不能是邮箱前缀
        email_prefix = self.email.split("@")[0]
        if self.username == email_prefix:
            raise ValueError("用户名不能与邮箱前缀相同")
```

## 验证错误处理

msgspec 在输入不符合目标类型或约束时抛出 `msgspec.ValidationError`。异常消息包含错误路径和预期条件。

```python
import msgspec

class User(msgspec.Struct):
    name: Annotated[str, msgspec.Meta(min_length=3)]
    age: Annotated[int, msgspec.Meta(ge=0, le=150)]

try:
    user = msgspec.json.decode(b'{"name":"AB","age":200}', type=User)
except msgspec.ValidationError as exc:
    print(f"验证失败：{exc}")
```

## 验证时机

msgspec 在类型化解码和 `msgspec.convert` 过程中应用类型注解与 `Meta` 约束。

```python
user = msgspec.json.decode(data, type=User)
user = msgspec.convert(data_dict, type=User)
```

直接构造 Struct 不会应用这些约束。

```python
user = User(name="AB", age=200)
print(user.age)  # 200
```

字段赋值同样不会应用这些约束。`frozen=True` 只会禁止赋值，不负责验证。

**直接构造时的验证。**在 `__post_init__` 中显式实现不变量检查。不要在该钩子中重新编码并解码同一个 Struct。

## 验证测试

约束测试同时覆盖允许的边界值与边界外的值。为错误类型、缺失必填字段、空字符串和不允许的 `null` 增加负例。断言异常类型和必要的字段路径，避免绑定完整错误消息的措辞。

```python
from typing import Annotated

import msgspec
import pytest


class User(msgspec.Struct):
    name: Annotated[str, msgspec.Meta(min_length=1)]
    age: Annotated[int, msgspec.Meta(ge=0, le=150)]


@pytest.mark.parametrize("age", [0, 150])
def test_age_boundaries(age):
    user = msgspec.convert({"name": "Alice", "age": age}, type=User)
    assert user.age == age


@pytest.mark.parametrize("payload", [
    b'{"name":"Alice","age":-1}',
    b'{"name":"Alice","age":151}',
    b'{"name":"Alice","age":"thirty"}',
    b'{"name":"","age":30}',
    b'{"age":30}',
    b'{"name":null,"age":30}',
])
def test_invalid_user(payload):
    with pytest.raises(msgspec.ValidationError):
        msgspec.json.decode(payload, type=User)
```

将往返测试与这些负例一起执行，避免测试只证明有效数据可以编码，却没有证明无效输入会被拒绝。完整往返示例见[测试建议](./best-practices.md#9-测试)。

## 最佳实践

更多最佳实践和常见陷阱参见[最佳实践与常见陷阱](./best-practices.md)。

## 参考资源

- [msgspec 约束文档](https://jcristharif.com/msgspec/constraints.html)
- [msgspec 验证错误处理](https://jcristharif.com/msgspec/api.html#msgspec.ValidationError)
- [msgspec Structs 验证机制](https://jcristharif.com/msgspec/structs.html#type-validation)
