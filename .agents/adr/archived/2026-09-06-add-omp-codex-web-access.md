# ADR decision: Add OMP Codex web access

Decision owner: Ruokee
Decision writer: OMP GPT-6 Astra
Archived: 2026-09-10
Reversed by: [ADR decision: Use native plugin settings for Codex web access](../decision/2026-09-10-use-codex-web-plugin-settings.md)

English | [中文](./2026-09-06-add-omp-codex-web-access.zh.md)

## Motivation

OMP's built-in `web_search` supports Codex subscriptions supplied directly to OMP, but it cannot use a Codex subscription exposed through a third-party forwarding Provider. The Codex Harness supports this arrangement. OMP therefore needs web search and page extraction tools that run the forwarding Provider's `openai-responses` model registered in OMP and coexist with its built-in tools. Users also need to choose independently whether each tool is available and whether its schema is presented directly to the model or discovered through `xd://`.

## Decision

### Component and tools

The repository maintains a self-contained OMP extension package at `projects/omp-codex-web-access`, named `@ruokee/omp-codex-web-access`. Its runtime, package metadata, checks, and `README.md` and `README.zh.md` documentation live inside the component directory. Each README is the component's complete document in its language, covering the tools, installation, configuration, load modes, model execution, development checks, and license. The extension entry is declared through `omp.extensions` in `package.json`. The repository `README.md` and `README.zh.md` list the component under OMP extensions, linking each language to the corresponding component README.

The package exposes two tools:

| Tool | Parameters | Result |
| --- | --- | --- |
| `codex_web_search` | Required non-empty `query` | Model-generated answer and cited source URLs |
| `codex_web_fetch` | Required `url` (HTTP or HTTPS); optional `prompt` | Model-assisted extraction from the specified page and cited source URLs |

Page extraction can summarize or clean content; it is not a raw HTML response or a verbatim page snapshot. Tool descriptions and the component documentation identify the output as model-assisted. Both tools use OMP's `read` approval tier and pass cancellation to the request.

Page extraction validates that the URL protocol is HTTP or HTTPS before any model resolution, credential lookup, or network request. The model performs the web access; the extension never fetches the target URL itself and does not perform DNS or private-address probing.

The package registers only these names. It does not change OMP's built-in search or fetch settings.

### Configuration

The extension reads `omp-codex-web-access.yml` from OMP's active agent directory, resolved with `getAgentDir()`, when it initializes. The configuration is read once per activation, so configuration changes apply to new OMP sessions.

```yaml
model: provider/model-id
tools:
  codex_web_search:
    enabled: true
    loadMode: essential
  codex_web_fetch:
    enabled: true
    loadMode: discoverable
```

`model` selects a model registered in OMP. The placeholder above is not a default model. Omitted tool settings use the values shown above, including when the file is absent. Only a missing key takes the omission semantics: an explicit `null` for `model`, for `tools`, or for a tool entry is a type error that invalidates the configuration. A missing or empty model selector produces an error when a tool is called. Malformed YAML, unknown fields, or invalid field types or values produce a configuration error and register neither tool.

Each tool has independent `enabled` and `loadMode` settings:

| Setting | Effect |
| --- | --- |
| `enabled: false` | Do not register the tool; neither top-level calls nor `xd://` can invoke it |
| `enabled: true`, `loadMode: essential` | Register the tool for top-level presentation |
| `enabled: true`, `loadMode: discoverable` | Register the tool for discovery through `xd://codex_web_search` or `xd://codex_web_fetch` |

`loadMode` accepts only `essential` and `discoverable`. When a tool is disabled, its valid loading mode has no effect.

Discovery follows OMP's host rules. With `tools.xdev` enabled and the required read/write transport available, discoverable tools use `xd://` unless explicitly pinned to the top level by the host. When xd is unavailable, OMP can present them at the top level. Use `enabled: false` to make a tool unavailable, not `discoverable`. The extension does not change host settings or provide its own discovery transport.

### Model execution

Both tools use the configured model through the `openai-responses` API with native web search, so the selected model must support it. Model identity, endpoint, headers, and credentials resolve through OMP's model registry and credential APIs. Requests go directly to the model's Responses endpoint; the extension does not launch Codex CLI.

The YAML file is the package's configuration source. It contains a model selector, not credentials. Both tools share the request and response implementation, including answer text, citation collection, Responses error handling, and JSON and SSE response support.

## Alternatives considered

None

## Consequences

OMP gains two independently controllable web tools whose load modes follow the host's discovery rules. Component tests cover registration, configuration semantics, the request transport, and cancellation; a real OMP smoke test remains the verification entry point for host integration.

Model-assisted extraction may omit or rewrite page content. A caller who treats it as a verbatim source can draw conclusions from altered text. Tool descriptions and the component documentation mitigate this by identifying the output as model-assisted, but they cannot remove the limitation.
