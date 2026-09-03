---
name: msgspec
description: 当需要定义结构体、进行数据验证和处理序列化时使用，涵盖 msgspec Struct 字段与选项、约束和类型化转换、编码与解码、标签联合及自定义钩子。
---

# msgspec

本技能主要用于定义 msgspec Struct，也涵盖验证、转换、编码、解码和故障排查。

## 进入条件（Entry Conditions）

当任务涉及定义 `msgspec.Struct` 模型、验证或转换类型化数据，或通过 JSON、MessagePack、YAML、TOML 编码与解码时，激活本技能。它也涵盖约束、默认值、标签联合、自定义钩子，以及从其他 Python 数据建模库迁移。

## 判断顺序（Judgment Order）

根据任务信号选择最小范围的文档。只阅读任务所需内容。

|信号|优先阅读|常搭配阅读|
|-|-|-|
|Struct 字段、默认值、重命名、继承、选项|[struct](./references/struct.md)|supported-types、validation|
|`Meta`、约束、`ValidationError`、`__post_init__`|[validation](./references/validation.md)|struct|
|支持的类型注解、`UNSET`、原生类型和自定义类型|[supported-types](./references/supported-types.md)|struct、converters|
|`enc_hook`、`dec_hook`、`convert`、`from_attributes`|[converters](./references/converters.md)|supported-types、serialization|
|JSON、MessagePack、YAML、TOML、JSONL、可复用编码器或解码器|[serialization](./references/serialization.md)|supported-types、converters|
|在 msgspec、Pydantic 和 dataclasses 之间选择|[comparison](./references/comparison.md)|best-practices|
|用法建议和常见错误|[best-practices](./references/best-practices.md)|对应的 API 文档|
|可运行的端到端示例|[基础用法](./examples/basic_usage.py)、[标签联合](./examples/tagged_union.py)、[自定义转换](./examples/custom_conversion.py)|对应的参考文档|

术语含义或中英文对应不清楚时，读取[术语表](./glossary.md)。

## 工作规则（Working Rules）

- 区分直接构造 `Struct` 与类型化解码或转换。类型和 `Meta` 约束在解码及转换时生效，直接构造只运行 `__post_init__`。
- 区分 `UNSET` 与 `None`。编码时省略值为 `UNSET` 的字段，`None` 则编码为空值。
- 只为 msgspec 不原生支持的类型编写钩子。
- 使用 YAML 或 TOML 前检查可选依赖。
- 重复操作时复用已配置的编码器和解码器实例。
- 比较性能时采用官方基准测试的方法和负载，不复述缺少限定条件的倍数。
