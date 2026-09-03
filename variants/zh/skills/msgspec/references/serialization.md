# msgspec 序列化详解

## 多协议支持

msgspec 通过不同的子模块支持多种序列化协议：

- `msgspec.json`：JSON（内置支持）
- `msgspec.msgpack`：MessagePack（内置支持）
- `msgspec.yaml`：YAML（需要额外安装）
- `msgspec.toml`：TOML（需要额外安装）

四种协议都提供 `encode` 和 `decode` 函数。JSON 与 MessagePack 还提供可配置的 `Encoder` 和 `Decoder` 类。

### 安装额外协议支持

部分协议需要安装额外的依赖包：

```shell
# YAML 支持（需要 PyYAML）
uv add msgspec[yaml]

# TOML 支持（需要 tomli/tomli-w）
uv add msgspec[toml]

# 或者一次性安装所有协议支持
uv add msgspec[yaml,toml]
```

## 基本用法

```python
# 编码（序列化）
data = {"name": "Alice", "age": 30}
encoded = msgspec.json.encode(data)  # b'{"name":"Alice","age":30}'

# 解码（反序列化）
decoded = msgspec.json.decode(encoded)  # {"name": "Alice", "age": 30}

# 解码到特定类型
class User(msgspec.Struct):
    name: str
    age: int

user = msgspec.json.decode(encoded, type=User)  # User(name="Alice", age=30)
```

## 协议切换

msgspec 支持在不同序列化协议之间轻松切换：

```python
import msgspec.json
import msgspec.msgpack
import msgspec.yaml

class User(msgspec.Struct):
    name: str
    age: int

user = User(name="Alice", age=30)

# JSON
json_encoded = msgspec.json.encode(user)
json_decoded = msgspec.json.decode(json_encoded, type=User)

# MessagePack
msgpack_encoded = msgspec.msgpack.encode(user)
msgpack_decoded = msgspec.msgpack.decode(msgpack_encoded, type=User)

# YAML
yaml_encoded = msgspec.yaml.encode(user)
yaml_decoded = msgspec.yaml.decode(yaml_encoded, type=User)
```

## 编码器和解码器

对于重复使用的场景，创建编码器/解码器实例可以获得更好的性能：

```python
# 创建编码器和解码器
encoder = msgspec.json.Encoder()
decoder = msgspec.json.Decoder(type=User)

# 重复使用
encoded = encoder.encode(user)
user = decoder.decode(encoded)
```

### 重用编码器/解码器

在循环或频繁调用的场景中，重用编码器/解码器实例：

```python
encoder = msgspec.json.Encoder()
decoder = msgspec.json.Decoder(type=User)

for item in large_dataset:
    encoded = encoder.encode(item)
    # 处理...
```

### JSONL 格式

生成 JSON Lines 格式（每行一个 JSON 对象）：

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

### 编码选项

编码器支持多种配置选项：

```python
encoder = msgspec.json.Encoder(
    enc_hook=custom_encoder,  # 自定义类型编码钩子
    decimal_format="number",   # Decimal 格式（"string" 或 "number"）
    uuid_format="canonical",   # UUID 格式
    order="deterministic"      # 确定性排序（字典键排序）
)
```

### 解码选项

解码器也支持多种配置：

```python
decoder = msgspec.json.Decoder(
    type=User,                 # 目标类型
    dec_hook=custom_decoder,   # 自定义类型解码钩子
    strict=True,               # 严格模式
    float_hook=handle_floats   # 自定义浮点数处理
)
```

## 自定义类型处理

msgspec 原生支持 `datetime`、`Enum`、`UUID` 和 `Decimal` 等类型。只为不受支持的类型编写钩子，例如 `pathlib.Path`。

```python
from pathlib import Path

def enc_hook(obj):
    if isinstance(obj, Path):
        return str(obj)
    raise NotImplementedError(f"不支持类型 {type(obj)}")

def dec_hook(type_, obj):
    if type_ is Path:
        return Path(obj)
    raise NotImplementedError(f"不支持类型 {type_}")

class Project(msgspec.Struct):
    name: str
    path: Path

encoder = msgspec.json.Encoder(enc_hook=enc_hook)
decoder = msgspec.json.Decoder(type=Project, dec_hook=dec_hook)
```

## 流式处理

对于大型数据集，可以使用流式编码和解码：

```python
import msgspec

# 流式解码 JSONL
decoder = msgspec.json.Decoder(type=User)

with open("users.jsonl", "rb") as f:
    for line in f:
        user = decoder.decode(line)
        # 处理每个用户...
```

## 错误处理

msgspec 对语法无效的输入抛出 `msgspec.DecodeError`，对不符合目标类型或约束的输入抛出 `msgspec.ValidationError`。异常消息包含错误路径和预期条件。

```python
try:
    user = msgspec.json.decode(b'{"name":"Alice"}', type=User)
except msgspec.ValidationError as exc:
    print(f"验证失败：{exc}")
```

## 参考资源

- [msgspec 序列化文档](https://jcristharif.com/msgspec/usage.html)
- [msgspec 编码器/解码器 API](https://jcristharif.com/msgspec/api.html)
- [msgspec 性能测试](https://jcristharif.com/msgspec/benchmarks.html)
