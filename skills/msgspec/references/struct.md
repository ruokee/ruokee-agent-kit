# msgspec Struct guide

This guide covers `msgspec.Struct`, a typed data structure designed for serialization, typed decoding, and conversion.

## Overview

[msgspec Structs documentation](https://jcristharif.com/msgspec/structs.html)

`msgspec.Struct` defines fields through type annotations and supports JSON, MessagePack, YAML, and TOML through msgspec's protocol modules.

## Initialization and `__post_init__` hook

Structs support a `__post_init__` method that runs after initialization:

```python
import msgspec

class User(msgspec.Struct):
    name: str
    age: int

    def __post_init__(self):
        """Validate after initialization"""
        if self.age < 0:
            raise ValueError(f"Age cannot be negative: {self.age}")

user = User(name="Alice", age=30)  # OK
# User(name="Bob", age=-5)  # Raises ValueError
```

## Basic field definition

Define fields with type annotations:

```python
from typing import Annotated
import msgspec

class Product(msgspec.Struct):
    """Product information"""

    name: Annotated[str, msgspec.Meta(description="Product name")]
    price: Annotated[float, msgspec.Meta(description="Price in USD", gt=0)]
    stock: Annotated[int, msgspec.Meta(description="Stock quantity", ge=0)]
    sku: Annotated[str, msgspec.Meta(description="SKU code", pattern=r"^[A-Z]{3}-\d{6}$")]
```

Benefits of `msgspec.Meta`:

- Self-documenting fields
- Automatic validation during deserialization
- No runtime overhead for validation
- Clear data quality requirements

## Default value fields

### Immutable defaults

For immutable types (str, int, bool, None, etc.), use direct assignment:

```python
class Config(msgspec.Struct):
    host: str = "localhost"
    port: int = 8080
    debug: bool = False
    timeout: float = 30.0
```

### Mutable defaults

Empty built-in mutable collections are safe defaults. msgspec treats `[]`, `{}`, `set()`, and `bytearray()` as shorthand for the matching default factory.

```python
class UserProfile(msgspec.Struct):
    name: str
    tags: list[str] = []
    metadata: dict[str, str] = {}

user1 = UserProfile(name="Alice")
user1.tags.append("admin")

user2 = UserProfile(name="Bob")
print(user2.tags)  # Each instance has a separate list
```

Use `msgspec.field(default_factory=...)` for dynamic defaults, non-empty mutable values, or custom mutable types.

## Special types (UNSET type)

`msgspec.UNSET` represents a field that can be omitted during serialization:

```python
from typing import Annotated
import msgspec

class UserUpdate(msgspec.Struct):
    """Partial update struct"""

    name: str | msgspec.UnsetType = msgspec.UNSET
    email: str | msgspec.UnsetType = msgspec.UNSET
    age: int | msgspec.UnsetType = msgspec.UNSET

# Create partial update
update = UserUpdate(email="newemail@example.com")

# Encode only the email field
encoded = msgspec.json.encode(update)
print(encoded.decode())
# {"email":"newemail@example.com"}

# UNSET fields are omitted from serialization
```

**UNSET vs none.**

- `None`: Field is explicitly set to null value
- `UNSET`: Field is omitted entirely from serialization

```python
class Example(msgspec.Struct):
    optional: str | None = None
    ignoreable: str | msgspec.UnsetType = msgspec.UNSET

obj1 = Example(optional=None, ignoreable=msgspec.UNSET)
# {"optional":null}; optional is included with a null value

obj2 = Example(optional="value", ignoreable=msgspec.UNSET)
# {"optional":"value"}; ignoreable is omitted
```

## Field order

Fields without defaults must come before fields with defaults:

```python
# Correct
class User(msgspec.Struct):
    name: str          # Required field
    email: str         # Required field
    role: str = "user" # Optional field with default

# TypeError: Required field 'name' cannot follow optional fields
class BadUser(msgspec.Struct):
    role: str = "user"  # Has default
    name: str  # Required field
```

**Solution.** Use `kw_only=True` to allow any field order:

```python
class User(msgspec.Struct, kw_only=True):
    role: str = "user"  # Can be first
    name: str           # Required field can be after defaults
    email: str

# Must use keyword arguments
user = User(name="Alice", email="alice@example.com")
```

## Class variables

Use `typing.ClassVar` for class-level attributes:

```python
from typing import ClassVar, Literal
import msgspec

class APIResponse(msgspec.Struct):
    """API response with version info"""

    # Class variable; not serialized
    API_VERSION: ClassVar[str] = "v1"

    # Instance fields
    status: str
    data: dict

response = APIResponse(status="success", data={"id": 1})
encoded = msgspec.json.encode(response)
# {"status":"success","data":{"id":1}}
# API_VERSION is not included
```

**Use classVar with tagged unions.**

```python
class SuccessResponse(msgspec.Struct, tag="success"):
    type: ClassVar[Literal["success"]] = "success"
    data: dict

class ErrorResponse(msgspec.Struct, tag="error"):
    type: ClassVar[Literal["error"]] = "error"
    message: str
    code: int

type Response = SuccessResponse | ErrorResponse
```

## Field renaming

The `rename` parameter converts field names during serialization:

```python
class UserAPI(msgspec.Struct, rename="camel"):
    """Python snake_case → JSON camelCase"""

    user_id: int
    first_name: str
    last_name: str
    email_address: str

user = UserAPI(
    user_id=1,
    first_name="Alice",
    last_name="Smith",
    email_address="alice@example.com"
)

encoded = msgspec.json.encode(user)
print(encoded.decode())
# {"userId":1,"firstName":"Alice","lastName":"Smith","emailAddress":"alice@example.com"}

# Decode also works
decoded = msgspec.json.decode(encoded, type=UserAPI)
print(decoded.first_name)  # "Alice"
```

**Available rename options.**

- `"camel"`: snake_case → camelCase
- `"pascal"`: snake_case → PascalCase
- `"kebab"`: snake_case → kebab-case
- Custom mapping: `rename={"python_field": "json_field"}`

**Custom field renaming.**

```python
class User(msgspec.Struct, rename={"user_id": "id", "email_address": "email"}):
    user_id: int
    email_address: str
    name: str  # Not renamed, stays as "name"

user = User(user_id=1, email_address="alice@example.com", name="Alice")
encoded = msgspec.json.encode(user)
# {"id":1,"email":"alice@example.com","name":"Alice"}
```

## Inheritance

Structs support single inheritance:

```python
class Person(msgspec.Struct):
    """Base struct"""
    name: str
    age: int

class Employee(Person):
    """Inherits from Person"""
    employee_id: int
    department: str

employee = Employee(
    name="Alice",
    age=30,
    employee_id=12345,
    department="Engineering"
)

# All fields are included
encoded = msgspec.json.encode(employee)
# {"name":"Alice","age":30,"employee_id":12345,"department":"Engineering"}
```

**Field order with inheritance.**

```python
class Base(msgspec.Struct):
    base_field: str = "default"

# A required field cannot follow an optional field inherited from the base class
class Child(Base):
    required_field: str  # TypeError when the class is defined

# Use kw_only=True when this ordering is required
class ChildKwOnly(Base, kw_only=True):
    required_field: str
```

## Comparison and hashing

Structs support equality comparison by default:

```python
class Point(msgspec.Struct):
    x: float
    y: float

p1 = Point(x=1.0, y=2.0)
p2 = Point(x=1.0, y=2.0)
p3 = Point(x=3.0, y=4.0)

print(p1 == p2)  # True
print(p1 == p3)  # False
```

**Ordering comparison.** Not supported by default:

```python
# p1 < p2  # TypeError: '<' not supported

# Implement manually if needed
class Point(msgspec.Struct):
    x: float
    y: float

    def __lt__(self, other):
        if not isinstance(other, Point):
            return NotImplemented
        return (self.x, self.y) < (other.x, other.y)
```

**Hashing.** Frozen structs are hashable:

```python
class Point(msgspec.Struct, frozen=True):
    x: float
    y: float

p1 = Point(x=1.0, y=2.0)
p2 = Point(x=1.0, y=2.0)

# Can be used in sets and as dict keys
points = {p1, p2}  # {Point(x=1.0, y=2.0)}

point_map = {p1: "origin area"}
print(point_map[p2])  # "origin area"; same hash
```

## Union types (tagged unions)

Tagged unions allow discriminating between multiple struct types:

```python
from typing import ClassVar, Literal
import msgspec

class Dog(msgspec.Struct, tag="dog"):
    type: ClassVar[Literal["dog"]] = "dog"
    name: str
    breed: str

class Cat(msgspec.Struct, tag="cat"):
    type: ClassVar[Literal["cat"]] = "cat"
    name: str
    lives: int

type Animal = Dog | Cat

# Serialization includes tag
dog = Dog(name="Rex", breed="Labrador")
encoded = msgspec.json.encode(dog)
# {"type":"dog","name":"Rex","breed":"Labrador"}

# Deserialization uses tag to determine type
decoder = msgspec.json.Decoder(type=Animal)
animal = decoder.decode(b'{"type":"cat","name":"Whiskers","lives":9}')
print(type(animal).__name__)  # "Cat"
print(animal.lives)  # 9
```

**Custom tag field.**

```python
class Success(msgspec.Struct, tag_field="status", tag="ok"):
    status: ClassVar[Literal["ok"]] = "ok"
    data: dict

class Error(msgspec.Struct, tag_field="status", tag="error"):
    status: ClassVar[Literal["error"]] = "error"
    message: str

type Response = Success | Error

# Tag field is "status" instead of "type"
error = Error(message="Not found")
encoded = msgspec.json.encode(error)
# {"status":"error","message":"Not found"}
```

## Nested structs

Structs can contain other structs:

```python
class Address(msgspec.Struct):
    street: str
    city: str
    zip_code: str

class Person(msgspec.Struct):
    name: str
    age: int
    address: Address  # Nested struct

person = Person(
    name="Alice",
    age=30,
    address=Address(
        street="123 Main St",
        city="Boston",
        zip_code="02101"
    )
)

# Nested serialization
encoded = msgspec.json.encode(person)
# {"name":"Alice","age":30,"address":{"street":"123 Main St","city":"Boston","zip_code":"02101"}}

# Nested deserialization
decoded = msgspec.json.decode(encoded, type=Person)
print(decoded.address.city)  # "Boston"
```

## Struct options

### frozen=True (immutable)

```python
class Point(msgspec.Struct, frozen=True):
    x: float
    y: float

point = Point(x=1.0, y=2.0)
# point.x = 3.0  # AttributeError: cannot set attribute

# Use replace() to create modified copies
new_point = msgspec.structs.replace(point, x=3.0)
print(new_point)  # Point(x=3.0, y=2.0)
```

**Benefits.**

- Thread-safe (immutable)
- Hashable (can be used in sets/dict keys)
- Prevents accidental modification
- Ideal for config objects, coordinates, constants

### kw_only=True (keyword-Only arguments)

```python
class Config(msgspec.Struct, kw_only=True):
    api_key: str
    timeout: int = 30
    max_retries: int = 3

# Must use keyword arguments
config = Config(api_key="secret-123")

# Positional arguments fail
# Config("secret-123")  # TypeError
```

**Benefits.**

- Explicit field names improve readability
- Allows fields with defaults before required fields
- Prevents argument order mistakes

### omit_defaults=True (omit default values)

```python
class User(msgspec.Struct, omit_defaults=True):
    name: str
    role: str = "user"
    active: bool = True

user = User(name="Alice")
encoded = msgspec.json.encode(user)
# {"name":"Alice"}; role and active omitted because they have default values

user2 = User(name="Bob", role="admin")
encoded2 = msgspec.json.encode(user2)
# {"name":"Bob","role":"admin"}; role included because it differs from the default
```

**Benefits.**

- Smaller payload size
- Cleaner JSON output
- Useful for partial updates

### forbid_unknown_fields=True (strict validation)

```python
class User(msgspec.Struct, forbid_unknown_fields=True):
    name: str
    age: int

# Valid JSON
data = b'{"name":"Alice","age":30}'
user = msgspec.json.decode(data, type=User)  # OK

# Invalid: extra field
data_extra = b'{"name":"Alice","age":30,"role":"admin"}'
# msgspec.json.decode(data_extra, type=User)  # ValidationError: unknown field 'role'
```

**Benefits.**

- Catches typos in field names
- Enforces strict schema compliance
- Prevents silent data loss

### Combining options

```python
class ImmutableConfig(msgspec.Struct, frozen=True, kw_only=True, forbid_unknown_fields=True):
    """Strict, immutable configuration"""

    api_key: str
    base_url: str
    timeout: int = 30
    max_retries: int = 3

# Keyword-only, immutable, and rejects unknown fields during typed decoding
config = ImmutableConfig(api_key="secret", base_url="https://api.example.com")
```

## Type validation

msgspec applies type annotations and `Meta` constraints during typed decoding and `msgspec.convert`, not direct Struct construction.

```python
class User(msgspec.Struct):
    name: str
    age: int

# Valid
user = msgspec.json.decode(b'{"name":"Alice","age":30}', type=User)

# Invalid: wrong type
try:
    msgspec.json.decode(b'{"name":"Alice","age":"thirty"}', type=User)
except msgspec.ValidationError as e:
    print(e)  # Expected `int`, got `str`
```

See [validation.md](./validation.md) for detailed constraint validation.

## Best practices

1. Use `msgspec.Meta` when fields need constraints or schema metadata.
2. Use direct empty built-in collections or a suitable `default_factory` for per-instance mutable defaults.
3. Use `frozen=True` when instances must be immutable and hashable.
4. Use `kw_only=True` when keyword-only construction or flexible field ordering is required.
5. Use tagged unions when a decoder must distinguish Struct variants.
6. Use `forbid_unknown_fields=True` only when rejecting extra input fields is part of the schema contract.

## Reference resources

- [msgspec Struct documentation](https://jcristharif.com/msgspec/structs.html)
- [best-practices.md](./best-practices.md): Best-practices guide
- [validation.md](./validation.md): Validation and constraints guide
