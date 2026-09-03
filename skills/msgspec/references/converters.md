# msgspec converters guide

This guide covers msgspec's converter system for handling custom types and type conversion.

## Overview

[msgspec Converters Documentation](https://jcristharif.com/msgspec/converters.html)

**Note.** msgspec natively supports many standard library types, including datetime, date, UUID, Decimal, and Enum, without custom hooks. Converters are mainly for types msgspec does not natively support, such as `pathlib.Path`, third-party library types such as ORM models, and custom classes.

See [supported-types.md](./supported-types.md) for the complete list of natively supported types.

## Encoding hooks (enc_hook)

Encoding hooks serialize custom types to msgspec-supported basic types.

**Hook scope.** `enc_hook` is called only for non-native types. msgspec does not invoke `enc_hook` for natively supported types like datetime, Enum, UUID, Decimal, etc. It uses built-in serialization directly.

### Basic usage

```python
from pathlib import Path
import msgspec

def enc_hook(obj):
    """Custom encoding hook for Path type"""
    if isinstance(obj, Path):
        return str(obj)
    raise NotImplementedError(f"Unsupported type: {type(obj)}")

# Create encoder with hook
encoder = msgspec.json.Encoder(enc_hook=enc_hook)

# Use
data = {"project_path": Path("/home/user/project"), "value": 42}
encoded = encoder.encode(data)
# b'{"project_path":"/home/user/project","value":42}'
```

### Multiple type handling

```python
from pathlib import Path
import msgspec

class CustomUser:
    """Custom user class (not msgspec.Struct or dataclass)"""
    def __init__(self, name: str, email: str):
        self.name = name
        self.email = email

def enc_hook(obj):
    """Handle multiple custom types"""
    if isinstance(obj, Path):
        return str(obj)
    elif isinstance(obj, CustomUser):
        # Convert custom object to dict
        return {"name": obj.name, "email": obj.email}
    raise NotImplementedError(f"Unsupported type: {type(obj)}")

encoder = msgspec.json.Encoder(enc_hook=enc_hook)

data = {
    "user": CustomUser("Alice", "alice@example.com"),
    "workspace": Path("/home/alice/workspace")
}
encoded = encoder.encode(data)
# b'{"user":{"name":"Alice","email":"alice@example.com"},"workspace":"/home/alice/workspace"}'
```

### Custom type encoding

```python
from pathlib import Path

class ProjectConfig:
    """Project configuration class"""
    def __init__(self, name: str, root: Path):
        self.name = name
        self.root = root

def enc_hook(obj):
    if isinstance(obj, ProjectConfig):
        # Encode custom type as dict
        return {
            "name": obj.name,
            "root": str(obj.root)
        }
    elif isinstance(obj, Path):
        return str(obj)
    raise NotImplementedError(f"Unsupported type: {type(obj)}")

encoder = msgspec.json.Encoder(enc_hook=enc_hook)

config = ProjectConfig("MyProject", Path("/home/user/projects/myproject"))
encoded = encoder.encode({"config": config})
# b'{"config":{"name":"MyProject","root":"/home/user/projects/myproject"}}'
```

## Decoding hooks (dec_hook)

Decoding hooks deserialize data into custom types.

### Basic usage

```python
from pathlib import Path

def dec_hook(type_, obj):
    """Custom decoding hook for Path type"""
    if type_ is Path:
        return Path(obj)
    raise NotImplementedError(f"Unsupported type: {type_}")

# Create decoder with hook
decoder = msgspec.json.Decoder(type=dict, dec_hook=dec_hook)

# Use
encoded = b'{"project_path":"/home/user/project","value":42}'
decoded = decoder.decode(encoded)
# {"project_path": Path("/home/user/project"), "value": 42}
```

### Typed decoding

```python
from pathlib import Path
import msgspec

class Project(msgspec.Struct):
    name: str
    path: Path  # Path requires decoding hook

def dec_hook(type_, obj):
    if type_ is Path:
        return Path(obj)
    raise NotImplementedError(f"Unsupported type: {type_}")

decoder = msgspec.json.Decoder(type=Project, dec_hook=dec_hook)

encoded = b'{"name":"MyProject","path":"/home/user/project"}'
project = decoder.decode(encoded)
# Project(name='MyProject', path=Path('/home/user/project'))
```

### Multiple type decoding

```python
from pathlib import Path
import msgspec

class Config(msgspec.Struct):
    workspace: Path
    cache_dir: Path

def dec_hook(type_, obj):
    """Handle multiple custom types"""
    if type_ is Path:
        return Path(obj)
    # Can add other types here
    raise NotImplementedError(f"Unsupported type: {type_}")

decoder = msgspec.json.Decoder(type=Config, dec_hook=dec_hook)

encoded = b'{"workspace":"/home/user/workspace","cache_dir":"/tmp/cache"}'
config = decoder.decode(encoded)
```

### Custom type decoding

```python
from pathlib import Path

class CustomPath:
    """Custom path class"""
    def __init__(self, path: str):
        self.path = Path(path)
        self.absolute = self.path.absolute()

def dec_hook(type_, obj):
    if type_ is CustomPath:
        return CustomPath(obj)
    elif type_ is Path:
        return Path(obj)
    raise NotImplementedError(f"Unsupported type: {type_}")

# Use with typing.Any or explicit type annotation
import msgspec
from typing import Any

decoder = msgspec.json.Decoder(type=dict[str, Any], dec_hook=dec_hook)
```

## Complete examples

### Example 1: Path type handling

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
    raise NotImplementedError(f"Unsupported type: {type(obj)}")

def dec_hook(type_, obj):
    if type_ is Path:
        return Path(obj)
    raise NotImplementedError(f"Unsupported type: {type_}")

# Encoding
file_info = FileInfo(
    name="document.pdf",
    path=Path("/home/user/documents/document.pdf"),
    size=1024000
)

encoder = msgspec.json.Encoder(enc_hook=enc_hook)
encoded = encoder.encode(file_info)
print(encoded.decode())
# {"name":"document.pdf","path":"/home/user/documents/document.pdf","size":1024000}

# Decoding
decoder = msgspec.json.Decoder(type=FileInfo, dec_hook=dec_hook)
decoded = decoder.decode(encoded)
print(decoded)
# FileInfo(name='document.pdf', path=Path('/home/user/documents/document.pdf'), size=1024000)
```

### Example 2: ORM object handling

```python
import msgspec

# Simulate ORM model
class ORMUser:
    def __init__(self, **kwargs):
        for k, v in kwargs.items():
            setattr(self, k, v)

class UserDTO(msgspec.Struct):
    id: int
    name: str
    email: str

def enc_hook(obj):
    """Convert ORM object to dict"""
    if isinstance(obj, ORMUser):
        return {k: v for k, v in obj.__dict__.items() if not k.startswith('_')}
    raise NotImplementedError(f"Unsupported type: {type(obj)}")

# Encode ORM object
orm_user = ORMUser(id=1, name="Alice", email="alice@example.com")
encoder = msgspec.json.Encoder(enc_hook=enc_hook)
encoded = encoder.encode(orm_user)
print(encoded.decode())
# {"id":1,"name":"Alice","email":"alice@example.com"}

# Can decode directly to Struct (no hook needed, target is msgspec.Struct)
decoder = msgspec.json.Decoder(type=UserDTO)
user_dto = decoder.decode(encoded)
print(user_dto)
# UserDTO(id=1, name='Alice', email='alice@example.com')
```

## msgspec.convert function

`msgspec.convert` converts between data structures without serialization/deserialization.

### Basic usage

```python
import msgspec

class User(msgspec.Struct):
    name: str
    age: int

# Dict to Struct
user_dict = {"name": "Alice", "age": 30}
user = msgspec.convert(user_dict, type=User)
print(user)
# User(name='Alice', age=30)

# Struct to dict
user_dict_back = msgspec.to_builtins(user)
print(user_dict_back)
# {'name': 'Alice', 'age': 30}
```

### Dict to Struct conversion

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

# Nested dict to Struct
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

### Conversion with hooks

```python
from pathlib import Path
import msgspec

class Project(msgspec.Struct):
    name: str
    path: Path

def dec_hook(type_, obj):
    if type_ is Path:
        return Path(obj)
    raise NotImplementedError(f"Unsupported type: {type_}")

# Needs hook to handle Path
project_dict = {"name": "MyProject", "path": "/home/user/project"}
project = msgspec.convert(project_dict, type=Project, dec_hook=dec_hook)
print(project)
# Project(name='MyProject', path=Path('/home/user/project'))
```

### ORM object conversion

```python
import msgspec

# Simulate ORM object
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

# Convert from ORM object (using from_attributes)
orm_user = UserORM(id=1, name="Alice", email="alice@example.com")
user_dto = msgspec.convert(orm_user, type=UserDTO, from_attributes=True)
print(user_dto)
# UserDTO(id=1, name='Alice', email='alice@example.com')
```

**from_attributes parameter.**

- `from_attributes=True`: Read values from object attributes (`obj.attr`)
- Default (`False`): Read values from object keys (`obj["key"]`)

This is useful for converting ORM objects, namedtuples, and custom classes to msgspec.Struct.

### Batch conversion

```python
import msgspec

class User(msgspec.Struct):
    name: str
    age: int

# List conversion
users_data = [
    {"name": "Alice", "age": 30},
    {"name": "Bob", "age": 25},
    {"name": "Carol", "age": 35}
]

users = msgspec.convert(users_data, type=list[User])
print(users)
# [User(name='Alice', age=30), User(name='Bob', age=25), User(name='Carol', age=35)]
```

## Advanced techniques

### Conditional encoding

Encode differently based on object state or attributes:

```python
from pathlib import Path

def enc_hook(obj):
    if isinstance(obj, Path):
        # Different representation based on whether path exists
        if obj.exists():
            return {"path": str(obj), "exists": True}
        else:
            return {"path": str(obj), "exists": False}
    raise NotImplementedError(f"Unsupported type: {type(obj)}")
```

### Nested custom types

Handle complex structures with multiple levels of custom types:

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
    raise NotImplementedError(f"Unsupported type: {type(obj)}")

def dec_hook(type_, obj):
    if type_ is Path:
        return Path(obj)
    raise NotImplementedError(f"Unsupported type: {type_}")

# Create nested structure
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

### Version compatibility

Handle different data format versions in hooks:

```python
def dec_hook(type_, obj):
    if type_ is Path:
        # Support old {"path": "..."} format
        if isinstance(obj, dict) and "path" in obj:
            return Path(obj["path"])
        # New version: direct string
        return Path(obj)
    raise NotImplementedError(f"Unsupported type: {type_}")
```

### Error handling and fallbacks

```python
from pathlib import Path

def dec_hook(type_, obj):
    if type_ is Path:
        try:
            return Path(obj)
        except (TypeError, ValueError) as e:
            # Fallback to default path
            print(f"Warning: Cannot parse path {obj}, using default: {e}")
            return Path(".")
    raise NotImplementedError(f"Unsupported type: {type_}")
```

## Native types and enc_hook limitation

**Note.** msgspec does not call `enc_hook` for natively supported types. It uses built-in serialization directly.

### Native types (no hook needed)

```python
from datetime import datetime, date
from enum import Enum
from decimal import Decimal
import msgspec

class Status(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

class User(msgspec.Struct):
    created: datetime  # Native; no hook needed
    birthday: date     # Native; no hook needed
    status: Status     # Native; no hook needed
    balance: Decimal   # Native; no hook needed

user = User(
    created=datetime(2024, 1, 15, 10, 30),
    birthday=date(1990, 5, 20),
    status=Status.ACTIVE,
    balance=Decimal("19.99")
)

# No enc_hook is needed because all types are natively supported
encoded = msgspec.json.encode(user)
print(encoded.decode())
# {"created":"2024-01-15T10:30:00","birthday":"1990-05-20","status":"active","balance":"19.99"}
```

### enc_hook is not called for native types

```python
from datetime import datetime
import msgspec

def enc_hook(obj):
    print(f"enc_hook called for: {type(obj).__name__}")
    if isinstance(obj, datetime):
        # THIS WON'T BE CALLED! datetime is natively supported
        return int(obj.timestamp() * 1000)
    raise NotImplementedError(f"Unsupported type: {type(obj)}")

encoder = msgspec.json.Encoder(enc_hook=enc_hook)

data = {"timestamp": datetime(2024, 1, 15, 10, 30)}
encoded = encoder.encode(data)
# enc_hook is not called for datetime
print(encoded.decode())
# {"timestamp":"2024-01-15T10:30:00"} uses ISO format rather than a timestamp
```

**Proof.**

```python
from datetime import datetime
from pathlib import Path
import msgspec

def enc_hook(obj):
    print(f"enc_hook called for: {type(obj).__name__}")
    if isinstance(obj, Path):
        return str(obj)
    elif isinstance(obj, datetime):
        return int(obj.timestamp() * 1000)
    raise NotImplementedError

encoder = msgspec.json.Encoder(enc_hook=enc_hook)

data = {
    "dt": datetime(2024, 1, 15, 10, 30),
    "path": Path("/tmp/test")
}

encoded = encoder.encode(data)
# Output: enc_hook called for: WindowsPath
# datetime is absent because enc_hook was not called for it

print(encoded.decode())
# {"dt":"2024-01-15T10:30:00","path":"/tmp/test"}
# datetime is ISO format (native), path is string (via hook)
```

## Best practices

1. **Reuse encoder/decoder instances**: Create once, use many times for performance
2. **Use explicit type annotations**: Help msgspec handle data correctly
3. **Add error handling**: Validate and handle errors in hooks
4. **Prefer native support**: For natively supported types (datetime, Enum, etc.), no hooks needed
5. **Focus hooks on non-native types**: Only write hooks for types msgspec doesn't natively support (Path, ORM objects, etc.)
6. **enc_hook doesn't override native types**: msgspec uses built-in serialization for native types, ignoring enc_hook
7. **Document hook rationale**: Why is custom encoding/decoding needed?

## Reference resources

- [msgspec converter documentation](https://jcristharif.com/msgspec/converters.html)
- [supported-types.md](./supported-types.md): List of natively supported types
