# Builder

## Intent

Separate the construction of a complex object from its final representation, so the same construction process can be driven step by step, validated along the way, or reused to produce different outputs.

## Problem it solves

Some objects are awkward to create in a single constructor call: many optional parameters, construction that happens in stages, inputs that arrive from several sources, or validation that depends on combinations of fields. Stuffing all of this into `__init__` produces long parameter lists, telescoping constructors, and validation logic tangled with assignment. Builder gives the assembly process its own named home where it can be tested and reused.

## Structure and participants

The classic form has a **director** that drives a sequence of steps against a **builder** interface; **concrete builders** accumulate state and produce a **product**. In practice the director often collapses into a plain function, and the builder is whatever accumulates the partial state.

## Python forms

Python rarely needs the full fluent-builder machinery. Several lighter forms usually cover the need:

- **Keyword-only parameters with defaults** handle "many optional parameters" directly:

  ```python
  @dataclass(kw_only=True)
  class Report:
      title: str
      sections: list[Section] = field(default_factory=list)
      summary: str | None = None
  ```

- **A construction function** ("staged construction" as a named phase) keeps the assembly logic together and testable:

  ```python
  def build_report(config: ReportConfig, rows: Iterable[Row]) -> Report:
      sections = collect_sections(rows, config.section_rules)
      summary = summarize(sections, timezone=config.timezone)
      return Report(title=config.title, sections=sections, summary=summary)
  ```

- **kwargs accumulation / incremental dicts** when fields arrive piecemeal, finalized by one validated constructor call.
- **Fluent builder** (`builder.with_x(...).with_y(...).build()`) only when chained construction genuinely reads better, e.g. query builders.

## When to use

- The object has many optional parameters or several valid construction shapes.
- Construction proceeds in stages, with intermediate validation between them.
- The same construction process must yield different representations (HTML, PDF, JSON) — the canonical Builder justification.
- The assembly logic itself is worth naming, testing, and reusing independently of the product.

## When NOT to use

- A plain dataclass with keyword defaults already says it clearly. A fluent builder over a simple value object is pure ceremony.
- A Pydantic / msgspec model already gives you validated construction from raw data.
- The builder hides a pile of mutable state where call order matters but isn't enforced — that's harder to reason about than a single constructor.

## Failure modes

- A fluent builder that can produce a half-initialized product if `build()` is called before required steps run. Validate in `build()` or make required fields constructor arguments.
- Mutable builder state shared or reused across products, leaking one build into the next.
- The builder duplicates the product's invariants instead of delegating to the product's own validation, so the two drift apart.

## Relationship to other patterns

A [factory.md](./factory.md) decides *which* class to make in one step; Builder handles complex *how-to-assemble* over several steps. [abstract-factory.md](./abstract-factory.md) often uses builders to construct its individual products. The Prototype approach (`dataclasses.replace` to derive a variant from a template) is an alternative when you mostly need small deltas from an existing object rather than fresh staged construction.
