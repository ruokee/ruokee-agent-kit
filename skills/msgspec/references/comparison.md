# Comparing msgspec with other data-modeling tools

Choose by boundary and required behavior, not by a library-wide speed ratio. Performance depends on the schema, protocol, payload, validation work, and benchmark method.

## msgspec and Pydantic

Choose msgspec when the main boundary is typed serialization or deserialization and the application benefits from its JSON, MessagePack, YAML, or TOML APIs. `msgspec.Struct` keeps the model close to the wire format, and typed decoding performs conversion and validation in one step.

Choose Pydantic when the project already depends on its model API, validators, settings ecosystem, framework integration, or schema behavior. Migration cost and framework conventions often matter more than a synthetic benchmark.

Both libraries support JSON Schema and tagged unions. Their configuration and validation models differ, so compare the exact features the project uses.

## msgspec and dataclasses

`dataclasses` is part of the Python standard library and works well for ordinary in-memory data containers. It does not provide a serialization protocol or typed decoder by itself.

msgspec can encode and decode dataclass instances, but `msgspec.Struct` offers msgspec-specific options such as tags, encoded-name rules, `UNSET`, `array_like`, and unknown-field handling. Use a Struct when those behaviors belong to the data boundary. Keep a dataclass when standard-library interoperability and unrestricted class customization matter more.

## Performance comparisons

Use the [official benchmarks](https://jcristharif.com/msgspec/benchmarks.html) as a reproducible starting point. Re-run a representative workload before making a project decision. Record at least the library versions, Python version, schema, payload size, protocol, validation target, and whether encoder or decoder instances are reused.

## References

- [msgspec benchmarks](https://jcristharif.com/msgspec/benchmarks.html)
- [msgspec documentation](https://jcristharif.com/msgspec/)
- [Pydantic documentation](https://docs.pydantic.dev/)
- [Python dataclasses documentation](https://docs.python.org/3/library/dataclasses.html)
