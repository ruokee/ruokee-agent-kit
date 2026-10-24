---
name: msgspec
description: Use when defining Structs, validating data, or handling serialization with msgspec, including fields and options, constraints and typed conversion, encoding and decoding, tagged unions, and custom hooks.
metadata:
  version: "1.0.5"
---

# msgspec

Use this Skill primarily to define msgspec Structs. It also covers validation, conversion, encoding, decoding, and troubleshooting.

## Entry conditions

Activate this Skill when a task involves defining `msgspec.Struct` models, validating or converting typed data, or encoding and decoding through JSON, MessagePack, YAML, or TOML. It also covers constraints, defaults, tagged unions, custom hooks, and migration from another Python data-modeling library.

## Judgment order

Route to the smallest relevant document. Read only what the task requires.

- For Struct fields, defaults, renaming, inheritance, and options, read [struct](./references/struct.md), often alongside supported-types and validation.
- For `Meta`, constraints, `ValidationError`, and `__post_init__`, read [validation](./references/validation.md), often alongside struct.
- For supported annotations, `UNSET`, and native or custom types, read [supported-types](./references/supported-types.md), often alongside struct and converters.
- For `enc_hook`, `dec_hook`, `convert`, and `from_attributes`, read [converters](./references/converters.md), often alongside supported-types and serialization.
- For JSON, MessagePack, YAML, TOML, JSONL, or reusable encoders and decoders, read [serialization](./references/serialization.md), often alongside supported-types and converters.
- When choosing between msgspec, Pydantic, and dataclasses, read [comparison](./references/comparison.md), often alongside best-practices.
- For usage guidance and common mistakes, read [best-practices](./references/best-practices.md), often alongside the relevant API document.
- For runnable end-to-end examples, read [basic usage](./examples/basic_usage.py), [tagged unions](./examples/tagged_union.py), and [custom conversion](./examples/custom_conversion.py), often alongside the matching reference document.

When terminology is unclear or inconsistent, read the [glossary](./glossary.md).

## Working rules

- Distinguish direct `Struct` construction from typed decoding or conversion. Type and `Meta` constraints apply during decoding and conversion, while direct construction only runs `__post_init__`.
- Treat `UNSET` as distinct from `None`. An `UNSET` field is omitted during encoding; `None` is encoded as a null value.
- Use hooks only for types msgspec does not support natively.
- Check optional dependencies before using YAML or TOML.
- Reuse configured encoder and decoder instances in repeated operations.
- Use the official benchmark method and workload when making performance comparisons. Do not repeat unqualified speed ratios.
