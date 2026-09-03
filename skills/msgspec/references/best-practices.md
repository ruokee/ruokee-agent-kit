# msgspec best practices and common pitfalls

This document provides best practice guidelines and common error avoidance methods when using msgspec.

## 1. Type annotations

**Recommended.** Always provide explicit type annotations for all fields. This improves code readability and takes full advantage of msgspec's type validation.

```python
class User(msgspec.Struct):
    name: Annotated[str, msgspec.Meta(description="Username")]
    age: Annotated[int, msgspec.Meta(description="Age")]
    tags: Annotated[list[str], msgspec.Meta(description="Tag list")]
```

**Avoid.**

```python
class User(msgspec.Struct):
    data: Any  # Loses type safety
```

## 2. Mutable default values

Empty built-in mutable collections are safe as defaults. msgspec treats `[]`, `{}`, `set()`, and `bytearray()` as shorthand for the matching default factory, so each instance receives a fresh value.

```python
class User(msgspec.Struct):
    name: str
    tags: list[str] = []
    metadata: dict[str, str] = {}
```

Use `msgspec.field(default_factory=...)` for dynamic defaults, non-empty mutable values, or custom mutable types.

```python
class Request(msgspec.Struct):
    request_id: str = msgspec.field(default_factory=generate_request_id)
```

## 3. Field order

**Recommended.**

**Option 1: Required fields first, optional fields last**

```python
class User(msgspec.Struct):
    name: str
    role: str = "user"
```

**Option 2: Use kw_only to allow any order**

```python
class User(msgspec.Struct, kw_only=True):
    role: str = "user"
    name: str  # Can now be placed after fields with defaults
```

**Error.** A required field after a field with a default raises `TypeError` when the Struct class is defined.

```python
# TypeError: Required field 'name' cannot follow optional fields
class User(msgspec.Struct):
    role: str = "user"  # Has default
    name: str  # Required field
```

## 4. Immutable data (frozen)

**Recommended.** For data structures that shouldn't be modified (like config objects, constants, coordinates), use `frozen=True`.

```python
class Point(msgspec.Struct, frozen=True):
    x: Annotated[float, msgspec.Meta(description="X coordinate")]
    y: Annotated[float, msgspec.Meta(description="Y coordinate")]

class Config(msgspec.Struct, frozen=True):
    api_key: Annotated[str, msgspec.Meta(description="API key")]
    base_url: Annotated[str, msgspec.Meta(description="Base URL")]
```

If you need to modify immutable objects, use `msgspec.structs.replace()` to create new instances:

```python
point = Point(x=1.0, y=2.0)
new_point = msgspec.structs.replace(point, x=3.0)  # Create new instance
```

**Common mistake.** Attempting to modify fields after using `frozen=True` causes `AttributeError`.

```python
class Point(msgspec.Struct, frozen=True):
    x: float
    y: float

point = Point(x=1.0, y=2.0)
point.x = 3.0  # AttributeError: cannot set attribute
```

## 5. Reusing encoders/decoders

**Recommended.** In loops or frequently called scenarios, create and reuse encoder/decoder instances for better performance.

```python
encoder = msgspec.json.Encoder()
decoder = msgspec.json.Decoder(type=User)

for item in large_dataset:
    encoded = encoder.encode(item)
    # Process encoded data...
```

**JSONL format tip.** If generating JSONL format (JSON Lines), use `encoder.encode_lines()`:

```python
encoder = msgspec.json.Encoder()
items = [
    User(name="Alice", age=30),
    User(name="Bob", age=25),
]

# encode_lines generates one JSON line per object
jsonl_bytes = encoder.encode_lines(items)
# b'{"name":"Alice","age":30}\n{"name":"Bob","age":25}\n'

# Write to file
with open("users.jsonl", "wb") as f:
    f.write(jsonl_bytes)
```

**Inefficient.** Creating new instances each time adds overhead.

```python
for item in large_dataset:
    encoded = msgspec.json.encode(item)  # Extra overhead each time
    # Process...
```

## 6. Constraint validation

**Recommended.** Use constraints to ensure data quality, avoiding manual checks in business logic.

```python
class User(msgspec.Struct):
    name: Annotated[str, msgspec.Meta(min_length=1, max_length=100)]
    age: Annotated[int, msgspec.Meta(ge=0, le=150)]
    email: Annotated[str, msgspec.Meta(pattern=r"^[\w\.-]+@[\w\.-]+\.\w+$")]
```

**Benefits.**

- Automatic validation during deserialization
- Clear data quality requirements
- Reduced boilerplate code
- Improved maintainability

**Manual validation.**

```python
class User(msgspec.Struct):
    name: str
    age: int
    email: str

def validate_user(user: User) -> None:
    if not (1 <= len(user.name) <= 100):
        raise ValueError("Name length must be between 1 and 100")
    if not (0 <= user.age <= 150):
        raise ValueError("Age must be between 0 and 150")
    if not re.match(r"^[\w\.-]+@[\w\.-]+\.\w+$", user.email):
        raise ValueError("Invalid email format")
```

## 7. Tagged unions

**Recommended.** Use tagged unions to distinguish between multiple data structures clearly.

```python
class SuccessResponse(msgspec.Struct, tag="success"):
    type: ClassVar[Literal["success"]] = "success"
    data: Annotated[dict, msgspec.Meta(description="Response data")]
    message: Annotated[str, msgspec.Meta(description="Success message")] = "OK"

class ErrorResponse(msgspec.Struct, tag="error"):
    type: ClassVar[Literal["error"]] = "error"
    message: Annotated[str, msgspec.Meta(description="Error message")]
    code: Annotated[int, msgspec.Meta(description="Error code")]
    details: Annotated[dict | None, msgspec.Meta(description="Error details")] = None

type APIResponse = SuccessResponse | ErrorResponse
```

**Why use tagged unions.**

- Clear type discrimination
- Type-safe pattern matching
- Better IDE support
- Easier to maintain and extend

**Avoid.** Using nested optional fields leads to confusing structures.

```python
class Response(msgspec.Struct):
    success: bool
    data: dict | None = None
    message: str | None = None
    code: int | None = None
    details: dict | None = None
```

**Problems with this approach.**

- Unclear which fields are valid in which scenarios
- Easy to create invalid states (e.g., `success=True` with `code=404`)
- No type safety
- Harder to use pattern matching

**Common mistake.** Forgetting to add tags to `Union` types prevents proper deserialization.

```python
class Dog(msgspec.Struct):
    name: str
    breed: str

class Cat(msgspec.Struct):
    name: str
    lives: int

type Animal = Dog | Cat

# Cannot distinguish during deserialization
data = b'{"name":"Fluffy","breed":"Husky"}'
decoder = msgspec.json.Decoder(type=Animal)
animal = decoder.decode(data)  # Ambiguous! Could be Dog or Cat
```

**Fix.** Add tags to make types distinguishable:

```python
class Dog(msgspec.Struct, tag="dog"):
    type: ClassVar[Literal["dog"]] = "dog"
    name: str
    breed: str

class Cat(msgspec.Struct, tag="cat"):
    type: ClassVar[Literal["cat"]] = "cat"
    name: str
    lives: int

type Animal = Dog | Cat

# Now it's unambiguous
data = b'{"type":"dog","name":"Fluffy","breed":"Husky"}'
decoder = msgspec.json.Decoder(type=Animal)
animal = decoder.decode(data)  # Correctly parsed as Dog
```

## 8. Custom type conversion

**Recommended.** For non-native types (like `pathlib.Path`), use custom hooks for conversion.

**Note.** Native types (datetime, Enum, UUID, Decimal, etc.) don't need hooks. msgspec handles them automatically.

```python
from pathlib import Path
import msgspec

class Project(msgspec.Struct):
    name: str
    path: Path  # Path is not natively supported

def enc_hook(obj):
    """Encoding hook for Path type"""
    if isinstance(obj, Path):
        return str(obj)
    raise NotImplementedError(f"Unsupported type: {type(obj)}")

def dec_hook(type_, obj):
    """Decoding hook for Path type"""
    if type_ is Path:
        return Path(obj)
    raise NotImplementedError(f"Unsupported type: {type_}")

# Create reusable encoder/decoder
encoder = msgspec.json.Encoder(enc_hook=enc_hook)
decoder = msgspec.json.Decoder(type=Project, dec_hook=dec_hook)

# Use them
project = Project(name="MyApp", path=Path("/home/user/myapp"))
encoded = encoder.encode(project)
decoded = decoder.decode(encoded)
```

**Key points.**

- `enc_hook` is called only for non-native types
- For native types (datetime, Enum, etc.), msgspec uses built-in serialization and ignores enc_hook
- Always reuse encoder/decoder instances for better performance

**Common mistake.** Writing hooks for native types (they won't be called):

```python
from datetime import datetime

def enc_hook(obj):
    if isinstance(obj, datetime):
        return int(obj.timestamp() * 1000)  # This won't be called!
    # ...

# datetime is natively supported, so enc_hook is ignored for it
```

## 9. Error handling

**Recommended.** Use specific error handling for validation errors.

```python
try:
    user = msgspec.json.decode(data, type=User)
except msgspec.ValidationError as e:
    # Handle validation error specifically
    print(f"Validation failed: {e}")
    # e contains detailed information about what failed
except msgspec.DecodeError as e:
    # Handle decoding error (malformed JSON, etc.)
    print(f"Decode failed: {e}")
```

**Catching too broadly.**

```python
try:
    user = msgspec.json.decode(data, type=User)
except Exception as e:
    # Too broad; cannot distinguish validation from decoding errors
    print(f"Something failed: {e}")
```

## 10. Protocol selection

**Recommended.** Choose the right protocol for your use case.

**JSON.** Human-readable and widely supported.

```python
encoded = msgspec.json.encode(data)
```

**MessagePack.** Binary and compact.

```python
encoded = msgspec.msgpack.encode(data)
```

**YAML.** Human-editable configuration files.

```python
encoded = msgspec.yaml.encode(data)  # Requires msgspec[yaml]
```

**TOML.** Configuration files with TOML syntax.

```python
encoded = msgspec.toml.encode(data)  # Requires msgspec[toml]
```

**Guidelines.**

- **APIs.** JSON (widest compatibility) or MessagePack (performance)
- **Configuration.** YAML or TOML
- **Internal services.** MessagePack (best performance)
- **Logs.** JSON or JSONL

## 11. Testing

**Recommended.** Test serialization roundtrips and validation.

```python
import msgspec

def test_user_serialization():
    original = User(name="Alice", age=30, email="alice@example.com")

    # Roundtrip test
    encoded = msgspec.json.encode(original)
    decoded = msgspec.json.decode(encoded, type=User)

    assert decoded == original
    assert decoded.name == "Alice"
    assert decoded.age == 30

def test_user_validation():
    # Test constraint validation
    import pytest

    with pytest.raises(msgspec.ValidationError):
        msgspec.json.decode('{"name":"","age":30,"email":"alice@example.com"}', type=User)

    with pytest.raises(msgspec.ValidationError):
        msgspec.json.decode('{"name":"Alice","age":200,"email":"alice@example.com"}', type=User)

    with pytest.raises(msgspec.ValidationError):
        msgspec.json.decode('{"name":"Alice","age":30,"email":"invalid"}', type=User)
```

## 12. Other recommendations

### Use descriptive field names

```python
# Good
class User(msgspec.Struct):
    email_address: str
    created_timestamp: datetime
    is_active: bool

# Avoid: Unclear
class User(msgspec.Struct):
    e: str
    ts: datetime
    a: bool
```

### Document complex structures

```python
class Order(msgspec.Struct):
    """Represents a customer order.

    Fields:
        order_id: Unique identifier for the order
        items: List of items in the order
        total_amount: Total cost in USD
        status: Current order status
    """
    order_id: Annotated[str, msgspec.Meta(description="Order ID")]
    items: Annotated[list[OrderItem], msgspec.Meta(description="Order items")]
    total_amount: Annotated[Decimal, msgspec.Meta(description="Total in USD", ge=0)]
    status: Annotated[OrderStatus, msgspec.Meta(description="Order status")]
```

### Use enums for fixed sets

```python
from enum import Enum

class OrderStatus(Enum):
    PENDING = "pending"
    CONFIRMED = "confirmed"
    SHIPPED = "shipped"
    DELIVERED = "delivered"
    CANCELLED = "cancelled"

class Order(msgspec.Struct):
    status: OrderStatus  # Type-safe, no need for string validation
```

### Keep structs focused

```python
# Good: single responsibility
class User(msgspec.Struct):
    id: int
    name: str
    email: str

class UserProfile(msgspec.Struct):
    user_id: int
    bio: str
    avatar_url: str

# Avoid: too many responsibilities
class User(msgspec.Struct):
    id: int
    name: str
    email: str
    bio: str
    avatar_url: str
    orders: list[Order]
    preferences: dict[str, Any]
    login_history: list[LoginEvent]
    # ...
```

## Summary

The key best practices:

1. **Always use explicit type annotations** for type safety
2. **Use `field(default_factory=...)` for mutable defaults** to avoid shared state
3. **Order fields properly** (required first) or use `kw_only=True`
4. **Use `frozen=True` for immutable data** (configs, constants)
5. **Reuse encoder/decoder instances** for performance
6. **Use constraints for validation** instead of manual checks
7. **Use tagged unions** for discriminated union types
8. **Only write hooks for non-native types** (Path, ORM objects, etc.)
9. **Handle errors specifically** (ValidationError vs DecodeError)
10. **Choose the right protocol** for your use case
11. **Test serialization roundtrips** and validation
12. **Keep structs focused** with single responsibility

Following these practices will lead to more maintainable, performant, and reliable code.
