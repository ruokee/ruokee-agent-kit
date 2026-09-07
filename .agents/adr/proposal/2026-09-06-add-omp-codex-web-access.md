# ADR proposal: Add OMP Codex web access

Decision owner: Ruokee
Draft writer: OMP GPT-6 Astra

English | [中文](./2026-09-06-add-omp-codex-web-access.zh.md)

## Motivation

OMP needs model-assisted web search and page extraction with tool names that can coexist with its built-in tools. Users also need to choose independently whether each tool is available and whether its schema is presented directly to the model or discovered through `xd://`.

## Proposal

### Component and tools

Maintain a self-contained OMP extension package at `projects/omp-codex-web-access`, named `@ruokee/omp-codex-web-access`. Include its runtime, package metadata, checks, `README.md` and `README.zh.md` entry pages, and `docs/usage.md` and `docs/usage.zh.md` usage guides within the component directory. The entry pages introduce the component and link to the corresponding usage guide. Register the extension entry through `omp.extensions` in `package.json`. Add the component to the OMP extension sections of the repository `README.md` and `README.zh.md`, linking each language to the corresponding component entry page.

Expose two tools:

| Tool | Parameters | Result |
| --- | --- | --- |
| `codex_web_search` | Required non-empty `query` | Model-generated answer and cited source URLs |
| `codex_web_fetch` | Required public `url`; optional `prompt` | Model-assisted extraction from the specified page and cited source URLs |

Page extraction can summarize or clean content; it is not a raw HTML response or a verbatim page snapshot. Both tools use OMP's `read` approval tier and pass cancellation to the request.

The package registers only these names. It does not change OMP's built-in search or fetch settings.

### Configuration

Read `omp-codex-web-access.yml` from OMP's active agent directory, resolved with `getAgentDir()`, when the extension initializes. Configuration changes apply to new OMP sessions.

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

`model` selects a model registered in OMP. The placeholder above is not a default model. Omitted tool settings use the values shown above, including when the file is absent. A missing or empty model selector produces an error when a tool is called. Malformed YAML, unknown fields, or invalid field types or values produce a configuration error and register neither tool.

Each tool has independent `enabled` and `loadMode` settings:

| Setting | Effect |
| --- | --- |
| `enabled: false` | Do not register the tool; neither top-level calls nor `xd://` can invoke it |
| `enabled: true`, `loadMode: essential` | Register the tool for top-level presentation |
| `enabled: true`, `loadMode: discoverable` | Register the tool for discovery through `xd://codex_web_search` or `xd://codex_web_fetch` |

`loadMode` accepts only `essential` and `discoverable`. When a tool is disabled, its valid loading mode has no effect.

Discovery follows OMP's host rules. With `tools.xdev` enabled and the required read/write transport available, discoverable tools use `xd://` unless explicitly pinned to the top level by the host. When xd is unavailable, OMP can present them at the top level. Use `enabled: false` to make a tool unavailable, not `discoverable`. The extension does not change host settings or provide its own discovery transport.

### Model execution

Both tools use the configured model through the `openai-responses` API with native web search. Resolve model identity, endpoint, headers, and credentials through OMP's model registry and credential APIs. The selected model must support native web search. Requests go directly to its Responses endpoint; the extension does not launch Codex CLI.

The YAML file is the package's configuration source. It contains a model selector, not credentials. Both tools share the request and response implementation, including answer text, citation collection, Responses error handling, and JSON and SSE response support.

## Alternatives considered

None

## Acceptance criteria

- The component can be installed as an OMP extension package without another repository component. Its package name, tool registrations, examples, and documentation use the names defined here. The repository README pair lists the component under OMP extensions and links each language to the corresponding component README.
- Each tool independently supports disabled, `essential`, and `discoverable` configurations. A disabled tool is absent from both top-level tools and xd discovery. Changing one tool's settings does not change the other's.
- In an OMP session with xd available, `discoverable` tools not explicitly pinned to the top level by the host can be inspected and invoked through their `xd://` addresses, while `essential` tools remain top-level. With xd disabled, enabled `discoverable` tools follow OMP's top-level presentation behavior.
- Default settings match the configuration contract, and configuration changes apply to new sessions. A missing or empty model selector errors at call time; invalid configuration registers neither tool.
- Search returns a generated answer and citations; page extraction accepts a URL and an optional instruction and describes its output as model-assisted. Both tools use the selected OMP model and propagate cancellation and request errors.
- The component README and usage-guide pairs agree across English and Chinese and link reciprocally. Component checks cover registration and configuration behavior, and a real OMP smoke test exercises search, page extraction, and xd discovery and invocation.

## Risks

Model-assisted extraction may omit or rewrite page content. A caller who treats it as a verbatim source can draw conclusions from altered text. Tool descriptions and usage documentation must identify the output as model-assisted.
