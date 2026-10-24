# msgspec serialization guide

This document provides detailed guidance on msgspec's serialization capabilities.

## Overview

[msgspec Serialization Documentation](https://jcristharif.com/msgspec/usage.html)

msgspec supports multiple serialization protocols:

- **JSON.** Human-readable, widely compatible
- **MessagePack.** Binary format, compact, fast
- **YAML.** Configuration files (requires `msgspec[yaml]`)
- **TOML.** Configuration files (requires `msgspec[toml]`)

## Protocol selection

- APIs: use JSON for broad interoperability. Consider MessagePack when both peers support it and measurements show a useful size or latency benefit.
- Configuration: choose YAML or TOML for human-edited files. Install the corresponding optional dependencies.
- Internal services: MessagePack supports binary exchange. Compare payload size and encode/decode cost on the actual workload before choosing it over JSON.
- Logs: use JSONL for a sequence of independently readable records, or JSON for one complete document.

## Basic usage

### Simple round trip

```python
import msgspec

class User(msgspec.Struct):
    name: str
    age: int

# Encode
user = User(name="Alice", age=30)
encoded = msgspec.json.encode(user)
# b'{"name":"Alice","age":30}'

# Decode
decoded = msgspec.json.decode(encoded, type=User)
# User(name='Alice', age=30)
```

### Protocol switching

All four protocols provide `encode` and `decode` functions. JSON and MessagePack also provide configurable `Encoder` and `Decoder` classes.

```python
# JSON
json_data = msgspec.json.encode(user)
user = msgspec.json.decode(json_data, type=User)

# MessagePack
msgpack_data = msgspec.msgpack.encode(user)
user = msgspec.msgpack.decode(msgpack_data, type=User)

# YAML (requires msgspec[yaml])
yaml_data = msgspec.yaml.encode(user)
user = msgspec.yaml.decode(yaml_data, type=User)

# TOML (requires msgspec[toml])
toml_data = msgspec.toml.encode(user)
user = msgspec.toml.decode(toml_data, type=User)
```

## Codecs

### Creating codecs

For better performance, create reusable encoder/decoder instances:

```python
# Create encoder
encoder = msgspec.json.Encoder()

# Create typed decoder
decoder = msgspec.json.Decoder(type=User)

# Use them
encoded = encoder.encode(user)
decoded = decoder.decode(encoded)
```

### Reusing codecs

**Efficient.**

```python
encoder = msgspec.json.Encoder()
decoder = msgspec.json.Decoder(type=User)

for item in large_dataset:
    encoded = encoder.encode(item)
    decoded = decoder.decode(encoded)
```

**Inefficient.**

```python
for item in large_dataset:
    encoded = msgspec.json.encode(item)  # Creates new encoder each time
    decoded = msgspec.json.decode(encoded, type=User)  # Creates new decoder
```

### JSONL format

For JSON Lines (newline-delimited JSON):

```python
encoder = msgspec.json.Encoder()

users = [
    User(name="Alice", age=30),
    User(name="Bob", age=25),
]

# Encode as JSONL
jsonl_bytes = encoder.encode_lines(users)
# b'{"name":"Alice","age":30}\n{"name":"Bob","age":25}\n'

# Write to file
with open("users.jsonl", "wb") as f:
    f.write(jsonl_bytes)

# Read from file
decoder = msgspec.json.Decoder(type=User)
with open("users.jsonl", "rb") as f:
    for line in f:
        user = decoder.decode(line.strip())
        print(user)
```

### Codec options

**Encoder options.**

```python
encoder = msgspec.json.Encoder(
    enc_hook=custom_encoder,  # Custom type encoding hook
    decimal_format="number",  # Decimal: "string" (default) or "number"
    uuid_format="canonical",  # UUID format
    order="deterministic",    # Sort dict keys and set elements; also None or "sorted"
)
```

**Decoder options.**

```python
decoder = msgspec.json.Decoder(
    type=User,                # Expected type
    dec_hook=custom_decoder,  # Custom type decoding hook
    strict=True,              # Strict validation (default: True)
    float_hook=handle_floats,  # Parse untyped JSON floats
)
```

## Custom type handling

### Using hooks

For types not natively supported (like `pathlib.Path`):

```python
from pathlib import Path

def enc_hook(obj):
    """Custom encoding hook"""
    if isinstance(obj, Path):
        return str(obj)
    raise NotImplementedError(f"Unsupported type: {type(obj)}")

def dec_hook(type_, obj):
    """Custom decoding hook"""
    if type_ is Path:
        return Path(obj)
    raise NotImplementedError(f"Unsupported type: {type_}")

class Project(msgspec.Struct):
    name: str
    path: Path

encoder = msgspec.json.Encoder(enc_hook=enc_hook)
decoder = msgspec.json.Decoder(type=Project, dec_hook=dec_hook)

project = Project(name="MyApp", path=Path("/home/user/myapp"))
encoded = encoder.encode(project)
decoded = decoder.decode(encoded)
```

**Note.** Hooks are ONLY called for non-native types. msgspec natively supports datetime, Enum, UUID, Decimal, etc., so hooks are not needed for these types.

See [Converters Guide](./converters.md) for detailed hook usage.

## Incremental processing

msgspec does not expose a streaming parser for one large JSON array. Use JSON Lines when records must be processed without loading the full dataset.

```python
decoder = msgspec.json.Decoder(type=User)

with open("users.jsonl", "rb") as file:
    for line in file:
        user = decoder.decode(line)
        process(user)
```

`Decoder.decode` accepts a complete message, and decoding to `list[User]` builds the full list. Splitting one array into arbitrary byte chunks is not incremental parsing. Use a framed format such as JSONL or a parser designed for incremental input when the dataset exceeds available memory. `decode_lines` also returns a full list from an already loaded JSONL buffer; it does not replace the loop above.

## Error handling

Malformed input raises `msgspec.DecodeError`; input that violates the target type or constraints raises `msgspec.ValidationError`. Validation errors describe the expected condition and include a field path where applicable. `ValidationError` is a subclass of `DecodeError`, so catch it first when the two cases need different handling. Do not catch `Exception` merely to hide other failures.

```python
import msgspec

class User(msgspec.Struct):
    name: str
    age: int

for data in (
    b'{"name":"Alice","age":30}',
    b'{"name":"Alice","age":"invalid"}',
    b'{"name":',
):
    try:
        user = msgspec.json.decode(data, type=User)
    except msgspec.ValidationError as exc:
        print(f"Validation failed: {exc}")
    except msgspec.DecodeError as exc:
        print(f"Decode failed: {exc}")
    else:
        print(user)
```

## Protocol specific features

### JSON

JSON is a text format intended for interoperability. `msgspec.json.Encoder` also supports JSON Lines through `encode_lines`.

```python
msgspec.json.encode(data)
```

### MessagePack

MessagePack is a binary format and supports extension values through `msgspec.msgpack.Ext`.

```python
msgspec.msgpack.encode(data)
```

### Other protocols

YAML and TOML support require optional dependencies. Install `msgspec[yaml]`, `msgspec[toml]`, or both before using their encode and decode functions.

```python
msgspec.yaml.encode(data)
msgspec.toml.encode(data)
```

## Best practices

1. **Reuse encoder/decoder instances** for better performance
2. **Use typed decoders** (`Decoder(type=User)`) for automatic validation
3. **Use JSONL for large datasets** instead of JSON arrays
4. **Only write hooks for non-native types** (Path, ORM objects, etc.)

## Reference resources

- [msgspec Official Documentation](https://jcristharif.com/msgspec/)
- [msgspec Usage Guide](https://jcristharif.com/msgspec/usage.html)
- [Supported Types](./supported-types.md)
- [Converters Guide](./converters.md)
