# msgspec serialization guide

This document provides detailed guidance on msgspec's serialization capabilities.

## Overview

[msgspec Serialization Documentation](https://jcristharif.com/msgspec/usage.html)

msgspec supports multiple serialization protocols:

- **JSON.** Human-readable, widely compatible
- **MessagePack.** Binary format, compact, fast
- **YAML.** Configuration files (requires `msgspec[yaml]`)
- **TOML.** Configuration files (requires `msgspec[toml]`)

## Basic usage

### Simple encoding and decoding

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

All protocols use the same API. Change only the module:

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

## Encoders and decoders

### Creating encoders and decoders

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

### Reusing encoders/decoders

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

### Encoding/Decoding options

**Encoder options.**

```python
encoder = msgspec.json.Encoder(
    enc_hook=custom_encoder,  # Custom type encoding hook
    order="sorted",           # Sort dict keys: None (default) | "sorted" | "deterministic"
)
```

**Decoder options.**

```python
decoder = msgspec.json.Decoder(
    type=User,                # Expected type
    dec_hook=custom_decoder,  # Custom type decoding hook
    strict=True,              # Strict validation (default: True)
)
```

## Custom type handling

### Using enc_hook and dec_hook

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

## Protocol-specific features

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

### YAML and TOML

YAML and TOML support require optional dependencies. Install `msgspec[yaml]`, `msgspec[toml]`, or both before using their encode and decode functions.

```python
msgspec.yaml.encode(data)
msgspec.toml.encode(data)
```

## Best practices

1. **Reuse encoder/decoder instances** for better performance
2. **Use appropriate protocol** for your use case:
    - APIs → JSON or MessagePack
    - Config files → YAML or TOML
    - Logs → JSONL
3. **Use typed decoders** (`Decoder(type=User)`) for automatic validation
4. **Use JSONL for large datasets** instead of JSON arrays
5. **Only write hooks for non-native types** (Path, ORM objects, etc.)

## Reference resources

- [msgspec Official Documentation](https://jcristharif.com/msgspec/)
- [msgspec Usage Guide](https://jcristharif.com/msgspec/usage.html)
- [Supported Types](./supported-types.md)
- [Converters Guide](./converters.md)
