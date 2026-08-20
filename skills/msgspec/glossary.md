# Glossary

These terms carry specific meanings in this Skill. Use the routing table in [SKILL.md](./SKILL.md) when a term needs exact syntax, configuration, or examples.

## Data model

**Struct**

A typed data structure defined by subclassing `msgspec.Struct`. Its annotations describe fields used for construction, encoding, typed decoding, and conversion.

**Field**

A named, annotated value in a Struct. `msgspec.field` can configure its default, default factory, or encoded name.

**Default factory**

A zero-argument callable that creates a fresh default value for each Struct instance. Empty built-in collections are treated as shorthand for their corresponding default factories.

**`UNSET`**

A singleton value that distinguishes a missing field from a field explicitly set to `None`. A field containing `UNSET` is omitted during encoding.

**Tagged union**

A union whose Struct variants carry a discriminator so a decoder can select one variant without ambiguity.

**Tag field**

The encoded discriminator field for a tagged Struct. Its default name is `type`, and `tag_field` can change it.

## Serialization and conversion

**Serialization protocol**

The wire or text format used to encode and decode data. msgspec has APIs for JSON, MessagePack, YAML, and TOML.

**Encoder**

A configured object that converts supported Python values into a serialization format. Reusing one avoids rebuilding its configuration for each operation.

**Decoder**

A configured object that parses serialized input. A typed decoder also validates and converts the result against its target type.

**Typed decoding**

Decoding with an explicit target type so msgspec validates input and constructs that type instead of returning only generic Python containers.

**Encoding hook (`enc_hook`)**

A callback that maps an otherwise unsupported Python object to a value msgspec can encode.

**Decoding hook (`dec_hook`)**

A callback that maps a decoded supported value to a requested custom type.

**Conversion**

Transforming an in-memory value to a target type with `msgspec.convert`, without first encoding it to bytes and decoding it again.

**Attribute conversion**

Conversion with `from_attributes=True`, which reads source values from object attributes rather than mapping keys.

## Validation

**Constraint**

A rule attached to a type through `typing.Annotated` and `msgspec.Meta`, such as a numeric bound, length limit, or string pattern.

**`Meta`**

Metadata attached to an annotated type. It can define validation constraints and schema information such as a title or description.

**Validation error**

A `msgspec.ValidationError` raised when typed decoding or conversion cannot satisfy the target type or its constraints.

**Post-init validation**

Custom checks implemented in `__post_init__`. They run after direct Struct construction and after msgspec constructs the Struct during decoding or conversion.
