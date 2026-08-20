# msgspec 转换器详解

本文档详细介绍 msgspec 的转换器（Converters）功能，包括自定义类型处理和类型转换。

## 概述

[msgspec Converters Documentation](https://jcristharif.com/msgspec/converters.html)

**重要说明。**msgspec 原生支持许多标准库类型（datetime, date, UUID, Decimal, Enum 等），这些类型无需自定义钩子。转换器主要用于处理 msgspec 不原生支持的类型，如 `pathlib.Path`、第三方库类型（ORM 模型）、自定义类等。

参考 [supported-types.md](./supported-types.md) 了解 msgspec 原生支持的完整类型列表。

## 编码钩子（enc_hook）

编码钩子用于将自定义类型序列化为 msgspec 支持的基本类型。

### 基本用法

```python
from pathlib import Path
import msgspec

def enc_hook(obj):
    """自定义编码钩子：处理 Path 类型"""
    if isinstance(obj, Path):
        return str(obj)
    raise NotImplementedError(f"不支持类型 {type(obj)}")

# 创建带钩子的编码器
encoder = msgspec.json.Encoder(enc_hook=enc_hook)

# 使用
data = {"project_path": Path("/home/user/project"), "value": 42}
encoded = encoder.encode(data)
# b'{"project_path":"/home/user/project","value":42}'
```

### 多类型处理

```python
from pathlib import Path
import msgspec

class CustomUser:
    """自定义用户类（不是 msgspec.Struct 或 dataclass）"""
    def __init__(self, name: str, email: str):
        self.name = name
        self.email = email

def enc_hook(obj):
    """处理多种自定义类型"""
    if isinstance(obj, Path):
        return str(obj)
    elif isinstance(obj, CustomUser):
        # 将自定义对象转换为字典
        return {"name": obj.name, "email": obj.email}
    raise NotImplementedError(f"不支持类型 {type(obj)}")

encoder = msgspec.json.Encoder(enc_hook=enc_hook)

data = {
    "user": CustomUser("Alice", "alice@example.com"),
    "workspace": Path("/home/alice/workspace")
}
encoded = encoder.encode(data)
# b'{"user":{"name":"Alice","email":"alice@example.com"},"workspace":"/home/alice/workspace"}'
```

### 自定义类型编码

```python
from pathlib import Path

class ProjectConfig:
    """项目配置类"""
    def __init__(self, name: str, root: Path):
        self.name = name
        self.root = root

def enc_hook(obj):
    if isinstance(obj, ProjectConfig):
        # 将自定义类型编码为字典
        return {
            "name": obj.name,
            "root": str(obj.root)
        }
    elif isinstance(obj, Path):
        return str(obj)
    raise NotImplementedError(f"不支持类型 {type(obj)}")

encoder = msgspec.json.Encoder(enc_hook=enc_hook)

config = ProjectConfig("MyProject", Path("/home/user/projects/myproject"))
encoded = encoder.encode({"config": config})
# b'{"config":{"name":"MyProject","root":"/home/user/projects/myproject"}}'
```

## 解码钩子（dec_hook）

解码钩子用于将序列化数据反序列化为自定义类型。

### 基本用法

```python
from pathlib import Path

def dec_hook(type, obj):
    """自定义解码钩子：处理 Path 类型"""
    if type is Path:
        return Path(obj)
    raise NotImplementedError(f"不支持类型 {type}")

# 创建带钩子的解码器
decoder = msgspec.json.Decoder(type=dict, dec_hook=dec_hook)

# 使用
encoded = b'{"project_path":"/home/user/project","value":42}'
decoded = decoder.decode(encoded)
# {"project_path": Path("/home/user/project"), "value": 42}
```

### 类型化解码

```python
from pathlib import Path
import msgspec

class Project(msgspec.Struct):
    name: str
    path: Path  # Path 需要解码钩子

def dec_hook(type, obj):
    if type is Path:
        return Path(obj)
    raise NotImplementedError(f"不支持类型 {type}")

decoder = msgspec.json.Decoder(type=Project, dec_hook=dec_hook)

encoded = b'{"name":"MyProject","path":"/home/user/project"}'
project = decoder.decode(encoded)
# Project(name='MyProject', path=Path('/home/user/project'))
```

### 多类型解码

```python
from pathlib import Path
import msgspec

class Config(msgspec.Struct):
    workspace: Path
    cache_dir: Path

def dec_hook(type, obj):
    """处理多种自定义类型"""
    if type is Path:
        return Path(obj)
    # 可以在这里添加其他类型的处理
    raise NotImplementedError(f"不支持类型 {type}")

decoder = msgspec.json.Decoder(type=Config, dec_hook=dec_hook)

encoded = b'{"workspace":"/home/user/workspace","cache_dir":"/tmp/cache"}'
config = decoder.decode(encoded)
```

### 自定义类型解码

```python
from pathlib import Path

class CustomPath:
    """自定义路径类"""
    def __init__(self, path: str):
        self.path = Path(path)
        self.absolute = self.path.absolute()

def dec_hook(type, obj):
    if type is CustomPath:
        return CustomPath(obj)
    elif type is Path:
        return Path(obj)
    raise NotImplementedError(f"不支持类型 {type}")

# 使用 typing.Any 或明确的类型注解
import msgspec
from typing import Any

decoder = msgspec.json.Decoder(type=dict[str, Any], dec_hook=dec_hook)
```

## 完整示例

### 示例 1：Path 类型处理

```python
from pathlib import Path
import msgspec

class FileInfo(msgspec.Struct):
    name: str
    path: Path
    size: int

def enc_hook(obj):
    if isinstance(obj, Path):
        return str(obj)
    raise NotImplementedError(f"不支持类型 {type(obj)}")

def dec_hook(type, obj):
    if type is Path:
        return Path(obj)
    raise NotImplementedError(f"不支持类型 {type}")

# 编码
file_info = FileInfo(
    name="document.pdf",
    path=Path("/home/user/documents/document.pdf"),
    size=1024000
)

encoder = msgspec.json.Encoder(enc_hook=enc_hook)
encoded = encoder.encode(file_info)
print(encoded.decode())
# {"name":"document.pdf","path":"/home/user/documents/document.pdf","size":1024000}

# 解码
decoder = msgspec.json.Decoder(type=FileInfo, dec_hook=dec_hook)
decoded = decoder.decode(encoded)
print(decoded)
# FileInfo(name='document.pdf', path=Path('/home/user/documents/document.pdf'), size=1024000)
```

### 示例 2：ORM 对象处理

```python
import msgspec

# 模拟 ORM 模型
class ORMUser:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

class UserDTO(msgspec.Struct):
    id: int
    name: str
    email: str

def enc_hook(obj):
    """将 ORM 对象转换为字典"""
    if isinstance(obj, ORMUser):
        return {k: v for k, v in obj.__dict__.items() if not k.startswith('_')}
    raise NotImplementedError(f"不支持类型 {type(obj)}")

# 将 ORM 对象编码
orm_user = ORMUser(id=1, name="Alice", email="alice@example.com")
encoder = msgspec.json.Encoder(enc_hook=enc_hook)
encoded = encoder.encode(orm_user)
print(encoded.decode())
# {"id":1,"name":"Alice","email":"alice@example.com"}

# 可以直接解码为 Struct（无需钩子，因为目标是 msgspec.Struct）
decoder = msgspec.json.Decoder(type=UserDTO)
user_dto = decoder.decode(encoded)
print(user_dto)
# UserDTO(id=1, name='Alice', email='alice@example.com')
```

## msgspec.convert 函数

`msgspec.convert` 用于在不同数据结构间转换，无需序列化和反序列化。

### 基本用法

```python
import msgspec

class User(msgspec.Struct):
    name: str
    age: int

# 字典到 Struct
user_dict = {"name": "Alice", "age": 30}
user = msgspec.convert(user_dict, type=User)
print(user)
# User(name='Alice', age=30)

# Struct 到字典
user_dict_back = msgspec.to_builtins(user)
print(user_dict_back)
# {'name': 'Alice', 'age': 30}
```

### 字典到 Struct 转换

```python
import msgspec

class Address(msgspec.Struct):
    street: str
    city: str
    zip_code: str

class User(msgspec.Struct):
    name: str
    age: int
    address: Address

# 嵌套字典到 Struct
data = {
    "name": "Bob",
    "age": 25,
    "address": {
        "street": "123 Main St",
        "city": "Boston",
        "zip_code": "02101"
    }
}

user = msgspec.convert(data, type=User)
print(user)
# User(name='Bob', age=25, address=Address(street='123 Main St', city='Boston', zip_code='02101'))
```

### 带钩子的转换

```python
from pathlib import Path
import msgspec

class Project(msgspec.Struct):
    name: str
    path: Path

def dec_hook(type, obj):
    if type is Path:
        return Path(obj)
    raise NotImplementedError(f"不支持类型 {type}")

# 需要钩子处理 Path
project_dict = {"name": "MyProject", "path": "/home/user/project"}
project = msgspec.convert(project_dict, type=Project, dec_hook=dec_hook)
print(project)
# Project(name='MyProject', path=Path('/home/user/project'))
```

### ORM 对象转换

```python
import msgspec

# 模拟 ORM 对象
class UserORM:
    def __init__(self, id, name, email):
        self.id = id
        self.name = name
        self.email = email
        self._private = "should not be converted"

class UserDTO(msgspec.Struct):
    id: int
    name: str
    email: str

# 从 ORM 对象转换（使用 from_attributes）
orm_user = UserORM(id=1, name="Alice", email="alice@example.com")
user_dto = msgspec.convert(orm_user, type=UserDTO, from_attributes=True)
print(user_dto)
# UserDTO(id=1, name='Alice', email='alice@example.com')
```

**from_attributes 参数说明。**
- `from_attributes=True`：从对象的属性（`obj.attr`）读取值
- 默认（`False`）：从对象的键（`obj["key"]`）读取值

这对于将 ORM 对象、命名元组、自定义类转换为 msgspec.Struct 非常有用。

### 批量转换

```python
import msgspec

class User(msgspec.Struct):
    name: str
    age: int

# 列表转换
users_data = [
    {"name": "Alice", "age": 30},
    {"name": "Bob", "age": 25},
    {"name": "Carol", "age": 35}
]

users = msgspec.convert(users_data, type=list[User])
print(users)
# [User(name='Alice', age=30), User(name='Bob', age=25), User(name='Carol', age=35)]
```

## 高级技巧

### 条件编码

根据对象的状态或属性选择不同的编码方式：

```python
from pathlib import Path

def enc_hook(obj):
    if isinstance(obj, Path):
        # 根据路径是否存在使用不同的表示
        if obj.exists():
            return {"path": str(obj), "exists": True}
        else:
            return {"path": str(obj), "exists": False}
    raise NotImplementedError(f"不支持类型 {type(obj)}")
```

### 嵌套自定义类型

处理包含多层自定义类型的复杂结构：

```python
from pathlib import Path
import msgspec

class FileNode(msgspec.Struct):
    name: str
    path: Path
    children: list["FileNode"] = msgspec.field(default_factory=list)

def enc_hook(obj):
    if isinstance(obj, Path):
        return str(obj)
    raise NotImplementedError(f"不支持类型 {type(obj)}")

def dec_hook(type, obj):
    if type is Path:
        return Path(obj)
    raise NotImplementedError(f"不支持类型 {type}")

# 创建嵌套结构
root = FileNode(
    name="root",
    path=Path("/"),
    children=[
        FileNode(name="home", path=Path("/home")),
        FileNode(name="etc", path=Path("/etc"))
    ]
)

encoder = msgspec.json.Encoder(enc_hook=enc_hook)
decoder = msgspec.json.Decoder(type=FileNode, dec_hook=dec_hook)

encoded = encoder.encode(root)
decoded = decoder.decode(encoded)
```

### 版本兼容性处理

在钩子中处理不同版本的数据格式：

```python
def dec_hook(type, obj):
    if type is Path:
        # 兼容旧版本的 {"path": "..."} 格式
        if isinstance(obj, dict) and "path" in obj:
            return Path(obj["path"])
        # 新版本直接是字符串
        return Path(obj)
    raise NotImplementedError(f"不支持类型 {type}")
```

### 错误处理和回退

```python
from pathlib import Path

def dec_hook(type, obj):
    if type is Path:
        try:
            return Path(obj)
        except (TypeError, ValueError) as e:
            # 回退到默认路径
            print(f"警告：无法解析路径 {obj}，使用默认值：{e}")
            return Path(".")
    raise NotImplementedError(f"不支持类型 {type}")
```

## 最佳实践

1. **重用编码器/解码器**：创建一次，多次使用，避免重复创建的开销
2. **明确类型注解**：使用清晰的类型注解帮助 msgspec 正确处理数据
3. **错误处理**：在钩子中添加适当的错误处理和验证
4. **优先使用原生支持**：对于 msgspec 原生支持的类型（datetime, Enum 等），无需编写钩子
5. **钩子聚焦于非原生类型**：只为 msgspec 不原生支持的类型（如 Path、ORM 对象）编写钩子
6. **enc_hook 不会覆盖原生类型**：msgspec 对原生支持的类型（datetime、Enum 等）不会调用 enc_hook，直接使用内置序列化

## 参考资源

- [msgspec 官方文档：Converters](https://jcristharif.com/msgspec/converters.html)
- [supported-types.md](./supported-types.md)：msgspec 原生支持的类型列表
