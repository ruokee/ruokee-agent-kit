# Specifications

English | [中文](./README.zh.md)

A specification, or spec, states the current target state of one component or repository area: what it should be, where its boundaries are, and which observable results show that it meets them. ADRs record the decisions and reasons behind that target.

## Spec files

| Spec | Subject |
| --- | --- |
| [.agents/spec/repository.md](./repository.md) | Repository conventions: boundary, layout, documentation, Git workflow, and checks |
| [.agents/spec/host-compatibility.md](./host-compatibility.md) | Maintenance lower bounds for components that load code into a host process |
| [.agents/spec/skills.md](./skills.md) | The Skill system: `skills/` and the Chinese variants under `variants/zh/skills/` |
| [.agents/spec/tk.md](./tk.md) | `projects/tk` as a whole |
| [.agents/spec/omp-context-pin.md](./omp-context-pin.md) | `projects/omp-context-pin` |
| [.agents/spec/omp-system-prompt.md](./omp-system-prompt.md) | `projects/omp-system-prompt` |
| [.agents/spec/omp-qol.md](./omp-qol.md) | `projects/omp-qol` |
| [.agents/spec/omp-smart-cache.md](./omp-smart-cache.md) | `projects/omp-smart-cache` |
| [.agents/spec/omp-status-bar.md](./omp-status-bar.md) | `projects/omp-status-bar` |
| [.agents/spec/omp-codex-web-access.md](./omp-codex-web-access.md) | `projects/omp-codex-web-access` |

Each component under `projects/` has a spec named after its directory. A change that adds or removes a component, or a repository area that needs its own spec, updates this list in the same change.

## Writing a spec

Each spec is a same-directory pair, `name.md` and `name.zh.md`, with reciprocal language links directly below the title. Both languages describe the same target and change together.

A spec uses these sections, in this order, where they apply to its subject:

- Goals
- Non-goals
- Public surface
- Invariants
- Host lower bound
- Acceptance criteria
- Related ADRs

A section that does not apply is omitted. Repository conventions, for example, have no host lower bound.

A spec states the current target and is edited in place. It keeps no revision history, review notes, task records, or session information. Its content comes from current decisions, including their `Changes` entries, and from component documentation. Archived decisions are not current authority, and a spec neither cites nor copies them.

A spec links to the page that owns a detail instead of restating it. Command and parameter references, settings tables, file formats, and a component's maintenance declaration stay on their owning pages, and the spec adds only the context its readers need. Related ADRs are listed as links. Links follow the repository's document-relative link rules.

## Division of work

- A spec states what its subject should be.
- An ADR records a durable choice, its reasons, its alternatives, and its consequences.
- Component documentation tells users how to install and use the component.
- The repository instructions and README tell contributors how to work in the repository.

A spec must not conflict with a current decision. A target change that conflicts with a current decision goes through the [ADR process](../adr/README.md) before the spec changes. A spec change that alters no durable choice needs no ADR, and the ADR rules decide when one is required. A decision may link to a spec, but the link does not replace the contract the decision records.

A change that alters a component's target updates the spec, the component, and the component documentation in the same change.

## Reference direction

References run one way. A spec may link to component files, component documentation, and ADRs. No file inside a distributable component links to, names a path in, or depends on `.agents/spec/`, so an installed component stays usable without the repository.

Specs are explanatory documentation. No component depends on them to run, build, or be distributed, and repository checks treat them like other Markdown documentation.

## Related ADRs

- [Add a specification layer](../adr/decision/2026-10-04-add-spec-layer.md)
