---
name: msgspec
description: Use when defining Structs, validating data, or handling serialization with msgspec, including fields and options, constraints and typed conversion, encoding and decoding, tagged unions, and custom hooks.
---

# msgspec

Use this Skill primarily to define msgspec Structs. It also covers validation, conversion, encoding, decoding, and troubleshooting.

## Entry conditions

Activate this Skill when a task involves defining `msgspec.Struct` models, validating or converting typed data, or encoding and decoding through JSON, MessagePack, YAML, or TOML. It also covers constraints, defaults, tagged unions, custom hooks, and migration from another Python data-modeling library.

## Judgment order

Route to the smallest relevant document. Read only what the task requires.

|Signal|Read first|Often pair with|
|-|-|-|
|Struct fields, defaults, renaming, inheritance, options|[struct](./references/struct.md)|supported-types, validation|
|`Meta`, constraints, `ValidationError`, `__post_init__`|[validation](./references/validation.md)|struct|
|Supported annotations, `UNSET`, native and custom types|[supported-types](./references/supported-types.md)|struct, converters|
|`enc_hook`, `dec_hook`, `convert`, `from_attributes`|[converters](./references/converters.md)|supported-types, serialization|
|JSON, MessagePack, YAML, TOML, JSONL, reusable encoders or decoders|[serialization](./references/serialization.md)|supported-types, converters|
|Choice between msgspec, Pydantic, and dataclasses|[comparison](./references/comparison.md)|best-practices|
|Usage guidance and common mistakes|[best-practices](./references/best-practices.md)|the relevant API document|
|Runnable end-to-end examples|[basic usage](./examples/basic_usage.py), [tagged unions](./examples/tagged_union.py), [custom conversion](./examples/custom_conversion.py)|the matching reference document|

When terminology is unclear or inconsistent, read the [glossary](./glossary.md).

## Working rules

- Distinguish direct `Struct` construction from typed decoding or conversion. Type and `Meta` constraints apply during decoding and conversion, while direct construction only runs `__post_init__`.
- Treat `UNSET` as distinct from `None`. An `UNSET` field is omitted during encoding; `None` is encoded as a null value.
- Use hooks only for types msgspec does not support natively.
- Check optional dependencies before using YAML or TOML.
- Reuse configured encoder and decoder instances in repeated operations.
- Use the official benchmark method and workload when making performance comparisons. Do not repeat unqualified speed ratios.
