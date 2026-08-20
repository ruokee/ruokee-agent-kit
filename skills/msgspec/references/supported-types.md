# msgspec supported types

msgspec uses Python type annotations to describe expected types. Most combinations of the following types are supported (with some limitations):

## Built-in types

msgspec natively supports the following Python built-in types without custom conversion hooks:

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

## msgspec-Specific types

- `msgspec.msgpack.Ext`: MessagePack extension type
- `msgspec.Raw`: Raw unparsed message data
- `msgspec.UNSET`: Marker type for unset values
- `msgspec.Struct`: msgspec struct type

## Standard library types

msgspec natively supports the following standard library types without custom conversion hooks:

- `datetime.datetime`: Date and time
- `datetime.date`: Date only
- `datetime.time`: Time only
- `datetime.timedelta`: Time delta
- `uuid.UUID`: UUID identifier
- `decimal.Decimal`: Decimal number
- `enum.Enum`: Enumeration type
- `enum.IntEnum`: Integer enumeration
- `enum.StrEnum`: String enumeration (Python 3.11+)
- `enum.Flag`: Flag enumeration
- `enum.IntFlag`: Integer flag enumeration
- `dataclasses.dataclass`: Dataclass

## typing module types

- `typing.Any`: Any type
- `typing.Optional`: Optional type
- `typing.Union`: Union type
- `typing.Literal`: Literal type
- `typing.NewType`: New type definition
- `typing.Final`: Final type
- `typing.TypeAliasType`: Type alias type
- `typing.TypeAlias`: Type alias
- `typing.NamedTuple` / `collections.namedtuple`: Named tuple
- `typing.TypedDict`: Typed dictionary
- `typing.Generic`: Generic type
- `typing.TypeVar`: Type variable

## Abstract types

Abstract base classes are supported as type hints, and msgspec automatically selects appropriate concrete types:

- `collections.abc.Collection` / `typing.Collection` → `list`
- `collections.abc.Sequence` / `typing.Sequence` → `list`
- `collections.abc.MutableSequence` / `typing.MutableSequence` → `list`
- `collections.abc.Set` / `typing.AbstractSet` → `set`
- `collections.abc.MutableSet` / `typing.MutableSet` → `set`
- `collections.abc.Mapping` / `typing.Mapping` → `dict`
- `collections.abc.MutableMapping` / `typing.MutableMapping` → `dict`

## Important notes

### Native support vs custom hooks

**Natively supported types.**
- All built-in types (int, str, list, dict, etc.)
- datetime, date, time, timedelta
- uuid.UUID
- decimal.Decimal
- enum.Enum and its subclasses
- dataclasses.dataclass

**Types requiring custom hooks.**
- `pathlib.Path`: Requires `enc_hook` and `dec_hook` to convert to/from strings
- Third-party library types (e.g., ORM models)
- Custom classes (not msgspec.Struct or dataclass)

### Example: natively supported types

```python
from datetime import datetime, date
from decimal import Decimal
from enum import Enum
import msgspec

class Status(Enum):
    ACTIVE = "active"
    INACTIVE = "inactive"

class Record(msgspec.Struct):
    # All these types are natively supported, no custom hooks needed
    created_at: datetime
    date_only: date
    amount: Decimal
    status: Status
    tags: list[str]
    metadata: dict[str, int]

# Serialize and deserialize directly, no hooks needed
record = Record(
    created_at=datetime.now(),
    date_only=date.today(),
    amount=Decimal("123.45"),
    status=Status.ACTIVE,
    tags=["tag1", "tag2"],
    metadata={"count": 10}
)

# No enc_hook or dec_hook required
encoded = msgspec.json.encode(record)
decoded = msgspec.json.decode(encoded, type=Record)
```

### Example: types requiring custom hooks

```python
from pathlib import Path
import msgspec

class Project(msgspec.Struct):
    name: str
    path: Path  # Path is not natively supported

# Custom hooks needed to handle Path
def enc_hook(obj):
    if isinstance(obj, Path):
        return str(obj)
    raise NotImplementedError(f"Unsupported type: {type(obj)}")

def dec_hook(type_, obj):
    if type_ is Path:
        return Path(obj)
    raise NotImplementedError(f"Unsupported type: {type_}")

project = Project(name="MyProject", path=Path("/home/user/project"))

encoder = msgspec.json.Encoder(enc_hook=enc_hook)
decoder = msgspec.json.Decoder(type=Project, dec_hook=dec_hook)

encoded = encoder.encode(project)
decoded = decoder.decode(encoded)
```

## Reference resources

- [msgspec supported-types documentation](https://jcristharif.com/msgspec/supported-types.html)
