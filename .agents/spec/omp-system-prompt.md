# omp-system-prompt

English | [中文](./omp-system-prompt.zh.md)

Spec for [projects/omp-system-prompt](../../projects/omp-system-prompt/README.md).

## Goals

- Apply the maintained English strategy to the main system prompt only on turns whose main block the host rendered from the component's own template.
- Ship that template as an optional example, `host-template.hbs`, generated from the component's template source. The user decides whether to use it.
- Append user-authored rule documents for the model in use, whether or not a template is in use.
- Let the `renderDelivery` plugin setting switch the owned `# Delivery` chapter.

## Non-goals

- Recognizing, converting, or rewriting the text structure of the host's default system prompt.
- Writing, copying, or selecting a template file, writing user configuration or installed host files, or modifying or deleting any of the user's system prompt inputs.
- Reading the host version to decide activation, transformation, diagnostics, or fallback.
- Reordering other extensions or claiming the final word over later handlers.

## Public surface

- Template route and the optional installation step: [How it works](../../projects/omp-system-prompt/README.md#how-it-works) and [Selecting the template](../../projects/omp-system-prompt/README.md#selecting-the-template).
- `renderDelivery` setting: [Delivery setting](../../projects/omp-system-prompt/README.md#delivery-setting).
- Model rule documents: [Model prompt rules](../../projects/omp-system-prompt/README.md#model-prompt-rules).
- Pass-through and diagnostics: [Fallback behavior](../../projects/omp-system-prompt/README.md#fallback-behavior) and [Coverage boundaries](../../projects/omp-system-prompt/README.md#coverage-boundaries).
- Installation, updates, and handler order: [Installation](../../projects/omp-system-prompt/README.md#installation).

## Invariants

- The installation guide in both README languages lists the template as an optional step and names both ways to enable it: passing `--system-prompt-template <path to host-template.hbs>` at run time, or placing the file as a project-level or user-level `SYSTEM_TEMPLATE.md`.
- The installation guide states the host's selection order: command-line arguments win over discovered files, the project level wins over the user level, and at the same level `SYSTEM.md` wins over `SYSTEM_TEMPLATE.md`. A higher-priority `SYSTEM.md` therefore hides an installed template.
- The committed `host-template.hbs` is generated from the owned template source and cannot drift from it.
- When the turn's main block is a render of the component template, the extension handles it through the template route: the template block stays byte-for-byte, the Delivery chapter follows it unless disabled, and the `<project-context>` footer is corrected. Footer correction recognizes both the main-agent tail and the subagent tail that OMP 18.5.0 introduced.
- When the turn's main block is not a render of the component template, the extension changes nothing in the system prompt, including the `<project-context>` footer, and reports no diagnostic. This covers no template, `SYSTEM.md`, `--system-prompt`, and any other template.
- Model rule documents are appended on every covered turn independently of the template route, with the same matching and append behavior.
- Diagnostics carry a bounded reason without prompt bodies, Skill names, private paths, or session context, and are deduplicated per session.
- The component keeps no code path, probe, fixture, test, or documentation section that exists only for hosts earlier than OMP 18.5.0. This includes the default-block route and the older `PROJECT` footer handling.

## Host lower bound

OMP `18.5.0`, declared in [Compatibility](../../projects/omp-system-prompt/README.md#compatibility). The `@oh-my-pi/*` development dependencies are locked at `18.5.0`, and tests use that host's behavior as their baseline. The general rules are in [.agents/spec/host-compatibility.md](./host-compatibility.md).

## Acceptance criteria

- `bun run typecheck`, `bun test`, and `bun run build:template` pass in the component directory, and the template drift test passes.
- On OMP 18.5.0 or later, after the template is installed as the README describes, the main agent's system prompt is rendered from that template and handled by the template route. Evidence comes from the provider-facing request, not from a handler return value alone.
- With no template, `SYSTEM.md`, or `--system-prompt`, the system prompt the provider receives is byte-for-byte the host's input apart from appended model rule blocks, and the session shows no diagnostic from the component.
- The user's system prompt files are unchanged after the component runs.
- No source branch is conditioned on a host earlier than OMP 18.5.0.

## Related ADRs

- [Render the system prompt strategy only from the component template](../adr/decision/2026-10-04-use-system-prompt-template-only.md)
- [Add model-scoped prompt rules to the system prompt extension](../adr/decision/2026-09-14-add-model-prompt-rules.md)
- [Maintain host components against a shared OMP floor](../adr/decision/2026-10-04-raise-omp-host-floor.md)
- [Keep distributable components self-contained](../adr/decision/2026-08-24-keep-components-self-contained.md)
