# omp-codex-web-access

English | [中文](./omp-codex-web-access.zh.md)

Spec for [projects/omp-codex-web-access](../../projects/omp-codex-web-access/README.md).

## Goals

- Add web search and page extraction to OMP through a model that OMP has registered for the `openai-responses` API, alongside OMP's built-in tools.
- Configure the component through OMP native plugin settings and keep credentials in OMP's model registry.

## Non-goals

- Launching Codex CLI or changing OMP's built-in search and fetch settings.
- Fetching the target URL itself, or probing DNS or private addresses.
- Returning raw HTML or a verbatim page snapshot.
- Reading, importing, deleting, or rewriting the old `omp-codex-web-access.yml` file.

## Public surface

- `codex_web_search` and `codex_web_fetch`: [Tools](../../projects/omp-codex-web-access/README.md#tools).
- Settings, user values, and project overrides: [Configuration](../../projects/omp-codex-web-access/README.md#configuration).
- Manual migration from the old file: [Manual migration from the old YAML](../../projects/omp-codex-web-access/README.md#manual-migration-from-the-old-yaml).
- Model execution and errors: [Model execution](../../projects/omp-codex-web-access/README.md#model-execution).

## Invariants

- The component can register only two tool names, `codex_web_search` and `codex_web_fetch`. It registers only the tools enabled in the effective settings snapshot; a disabled tool is not registered. Each registered tool keeps its own load mode, runs at OMP's `read` approval tier, and passes cancellation to the model request.
- `codex_web_fetch` rejects a URL whose protocol is not HTTP or HTTPS before model resolution, credential lookup, or network work.
- Native plugin settings are the only configuration source. The manifest and the runtime validator share the same keys, types, enumerations, and defaults.
- Settings are validated as one complete object at the first `session_start`. An invalid object registers neither tool; switching sessions in the same process does not refresh the settings.
- Plugin settings store only the model selector. Endpoints, headers, and credentials come from OMP.
- Errors are bounded and never expose credentials or headers.

## Host lower bound

OMP `18.5.0`, declared in [Compatibility](../../projects/omp-codex-web-access/README.md#compatibility). The `@oh-my-pi/*` development dependency is locked at `18.5.0`, and tests use that host's behavior as their baseline. The general rules are in [.agents/spec/host-compatibility.md](./host-compatibility.md).

## Acceptance criteria

- `bun run typecheck` and `bun test` pass in the component directory.
- In a real OMP CLI session with a real model, `codex_web_search` and `codex_web_fetch` each return an answer with cited source URLs.
- The manifest and the runtime validator agree on every setting.

## Related ADRs

- [Use native plugin settings for Codex web access](../adr/decision/2026-09-10-use-codex-web-plugin-settings.md)
- [Maintain host components against a shared OMP floor](../adr/decision/2026-10-04-raise-omp-host-floor.md)
- [Keep distributable components self-contained](../adr/decision/2026-08-24-keep-components-self-contained.md)
