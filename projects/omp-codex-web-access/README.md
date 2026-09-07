# omp-codex-web-access

[中文](./README.zh.md)

This OMP extension lets OMP use a Codex subscription through a forwarding Provider for web search and page extraction. OMP's built-in `web_search` supports a directly supplied Codex subscription, but not this forwarded setup. The extension runs the Provider's OMP-registered `openai-responses` model with native web search and returns generated text with cited source URLs. No Codex CLI is launched.

## Tools

| Tool | Parameters | Result |
| --- | --- | --- |
| `codex_web_search` | Required non-empty `query` | Model-generated answer and cited source URLs |
| `codex_web_fetch` | Required `url` (HTTP or HTTPS); optional `prompt` | Model-assisted extraction from the specified page and cited source URLs |

`codex_web_search` answers a search query. `codex_web_fetch` reads one specific HTTP(S) URL and extracts information from it. The extraction is model-assisted: it may summarize or clean page content, and it is not raw HTML or a verbatim page snapshot. Callers who need an exact copy should fetch the page directly. Both tools use OMP's `read` approval tier and pass cancellation to the request. The extension registers only these two names and does not change OMP's built-in search or fetch settings.

## Installation

The package has not been published. After cloning the GitHub repository, install its locked dependencies and install the package into OMP:

```bash
git clone https://github.com/ruokee/ruokee-agent-kit.git
cd ruokee-agent-kit/projects/omp-codex-web-access
bun install
omp install "$(pwd)" --scope user
```

`omp install` is an alias of `omp plugin install`; `omp plugin link "$(pwd)" --scope user` works the same. OMP reads `omp.extensions` from `package.json` and loads `src/extension.ts`; no manual extension-path setting is required. The supported OMP range is `>=18.1.8 <19`.

## Configuration

The extension reads one file when it initializes:

```text
<agentDir>/omp-codex-web-access.yml
```

`agentDir` comes from `getAgentDir()` in `@oh-my-pi/pi-coding-agent`; it is usually `~/.omp/agent`, and with a non-default OMP profile the actual directory can differ. The configuration is read once per activation; edits apply to new OMP sessions only.

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

The placeholder `provider/model-id` is not a default model. Omitted tool settings use the values shown above, including when the file is absent.

### Top-level fields

| Field | Required | Contract |
| --- | --- | --- |
| `model` | no | Model selector for a model registered in OMP; a missing key or the explicit empty string `model: ""` errors at call time, while the bare value `model:` (YAML null) invalidates the configuration |
| `tools` | no | Mapping of per-tool settings; a missing key keeps that tool's defaults |

A malformed YAML document, an unknown field, a wrong type, an explicit `null`, or an invalid value produces a configuration error and registers neither tool. A missing file or an empty document registers both tools with their defaults.

### Per-tool settings

Each tool has independent `enabled` and `loadMode` settings:

| Setting | Effect |
| --- | --- |
| `enabled: false` | Do not register the tool; neither top-level calls nor `xd://` can invoke it |
| `enabled: true`, `loadMode: essential` | Register the tool for top-level presentation |
| `enabled: true`, `loadMode: discoverable` | Register the tool for discovery through `xd://codex_web_search` or `xd://codex_web_fetch` |

`loadMode` accepts only `essential` and `discoverable`. When a tool is disabled, its load mode has no effect.

Discovery follows OMP's host rules. With `tools.xdev` enabled and the required read/write transport available, discoverable tools use `xd://` unless the host explicitly pins them to the top level. When xd is unavailable, OMP can present them at the top level. To make a tool unavailable, set `enabled: false`, not `discoverable`. The extension does not change host settings or provide its own discovery transport.

## Model execution

Both tools use the configured model through the `openai-responses` API with native web search, so the selected model must support it. Model identity, endpoint, headers, and credentials resolve through OMP's model registry and credential APIs; the YAML file carries a model selector, not credentials. A missing model key or the explicit empty string `model: ""`, an unregistered model, or a missing credential produces a clear tool error when the tool is called.

The two tools share one request and response implementation: answer text, citation collection, Responses error handling, and JSON and SSE response support. Page extraction validates that the URL protocol is HTTP or HTTPS before any model, credential, or network work; the model performs the web access, and the extension does not fetch the target URL itself.

## Development

```bash
cd projects/omp-codex-web-access
bun install
bun run typecheck
bun test
```

The runtime imports are limited to one peer dependency: `@oh-my-pi/pi-coding-agent`.

## License

MIT.
