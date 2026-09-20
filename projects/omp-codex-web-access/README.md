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

`omp install` is an alias of `omp plugin install`; `omp plugin link "$(pwd)" --scope user` works the same. OMP reads `omp.extensions` from `package.json` and loads `src/extension.ts`, so no extension path needs to be set by hand. The supported OMP range is `>=18.2.3 <19`, because the extension uses the asynchronous model header API introduced in OMP 18.2.3.

### Updating

The registration points at this checkout, so the installation keeps reading the package and its locked dependencies from that directory. Update it from the repository root:

```bash
cd /path/to/ruokee-agent-kit
git pull
cd projects/omp-codex-web-access
bun install --frozen-lockfile
```

Restart OMP afterwards: a running process keeps the extension code it loaded at startup, and starting another session in the same process does not reload it. Settings are read on the first `session_start` of an activation, so a restart is also what picks up a settings file change made outside the OMP CLI.

## Configuration

The extension uses OMP's native plugin settings. User settings are written with the OMP plugin CLI; project settings are read from `.omp/plugin-overrides.json` and override matching user values for that project.

### Five settings

| Setting | Type | Default | Effect |
| --- | --- | --- | --- |
| `model` | string | `""` | OMP model selector in `provider/model-id` form; an empty value fails when a tool is called |
| `searchEnabled` | boolean | `true` | Register `codex_web_search` |
| `searchLoadMode` | `essential` or `discoverable` | `essential` | How `codex_web_search` is presented by OMP |
| `fetchEnabled` | boolean | `true` | Register `codex_web_fetch` |
| `fetchLoadMode` | `essential` or `discoverable` | `discoverable` | How `codex_web_fetch` is presented by OMP |

The manifest and runtime validator use the same five keys, types, enum values, and defaults. Missing keys receive these defaults. Explicit `null`, unknown keys, wrong types, and invalid enum values reject the complete settings object, so neither tool is registered.

### User settings

Use the OMP CLI for user-level values:

```bash
omp plugin config set @ruokee/omp-codex-web-access model provider/model-id
omp plugin config set @ruokee/omp-codex-web-access searchEnabled true
omp plugin config set @ruokee/omp-codex-web-access searchLoadMode essential
omp plugin config set @ruokee/omp-codex-web-access fetchEnabled true
omp plugin config set @ruokee/omp-codex-web-access fetchLoadMode discoverable

omp plugin config list @ruokee/omp-codex-web-access
omp plugin config get @ruokee/omp-codex-web-access model
omp plugin config delete @ruokee/omp-codex-web-access model
```

`delete` removes the user-level key; a same-name project override remains effective, and the runtime default applies only when both user and project values are absent. The model selector is not a credential. Model identity, endpoint, headers, and credentials continue to come from OMP's model registry and credential APIs.

### Project override

Place a project override at `.omp/plugin-overrides.json`. Keep the other plugin entries and settings in the object when adding this package:

```json
{
  "settings": {
    "@other/plugin": {
      "keepThisSetting": true
    },
    "@ruokee/omp-codex-web-access": {
      "searchEnabled": false,
      "fetchLoadMode": "essential"
    }
  }
}
```

OMP merges the project package entry over the user package entry. A missing project override leaves user settings unchanged. OMP's loader handles file parsing: a missing user runtime JSON produces empty user settings, malformed user runtime JSON rejects the public getter, and missing or malformed project candidates are skipped while OMP checks its candidate directories. If no valid project candidate exists, there is no project override. The extension validates only the object returned by `getPluginSettings`; it does not parse OMP files to recover swallowed or rejected file errors. A getter failure registers neither tool and emits a bounded diagnostic without dumping raw exceptions or configuration values.

### Activation and snapshots

The extension factory installs a `session_start` handler and does not read settings or register tools during factory loading. The first `session_start` awaits `getPluginSettings(PACKAGE_NAME, ctx.cwd)`, validates one complete effective object, and registers enabled tools from that snapshot. Repeated or concurrent `session_start` events in the same activation share one promise, do not refresh settings, and do not duplicate tools. A later extension activation reads again; changing a file during an existing activation is not hot reload. An initialization error fails that activation and is not retried within the same activation.

OMP modes wait for extension initialization before their first prompt. A direct OMP SDK caller must explicitly initialize the OMP extension runtime and emit `session_start` before calling `prompt`, then await that event handler. This extension does not add a separate initialization API or make a model request during registration.

### Enablement and discovery

`enabled: false` in the old file maps to the corresponding native `*Enabled: false` key. The tool is not registered and cannot be called through top-level tools or `xd://`. `essential` and `discoverable` apply only to enabled tools. `essential` keeps a tool in OMP's top-level presentation; `discoverable` registers it for OMP discovery and may use `xd://` when the OMP transport is available. OMP can fall back to top-level presentation when discovery is unavailable. `discoverable` does not disable a tool.

### Manual migration from the old YAML

The extension does not read, import, delete, or rewrite `omp-codex-web-access.yml`. Transfer values manually before using the native settings:

| Old YAML field | Native setting |
| --- | --- |
| `model` | `model` |
| `tools.codex_web_search.enabled` | `searchEnabled` |
| `tools.codex_web_search.loadMode` | `searchLoadMode` |
| `tools.codex_web_fetch.enabled` | `fetchEnabled` |
| `tools.codex_web_fetch.loadMode` | `fetchLoadMode` |

An old YAML file by itself has no effect. Transfer the values to native settings, then restart the OMP process so the extension is activated again and reads the new values. Creating or switching a session in the same process does not refresh the snapshot; if initialization fails, the same activation does not retry. If no native value is set, both tools use their defaults and the model selector is empty, so calls fail until a valid OMP model selector is configured.

## Model execution

Both tools use the configured model through the `openai-responses` API with native web search, so the selected model must support it. The native settings carry a model selector, not credentials. A missing model key, an explicitly empty native `model` string, an unregistered model, or a missing credential produces a clear tool error when the tool is called.

The two tools share one request and response implementation: answer text, citation collection, Responses error handling, and JSON and SSE response support. Page extraction validates that the URL protocol is HTTP or HTTPS before any model, credential, or network work; the model performs the web access, and the extension does not fetch the target URL itself.

Before each HTTP request, the extension awaits Provider headers and the model's complete configured Header chain. It does not cache either result. Model headers override Provider headers with case-insensitive names, and an existing `Authorization` value takes precedence over the API key fallback. Credential lookup, model Header resolution, and HTTP receive the tool's cancellation signal. The Provider Header API has no signal parameter, so the extension checks cancellation before and after that lookup and does not send the HTTP request after cancellation. Header resolution errors return bounded tool errors without exposing Header values or credentials.

Tool failures return `isError: true`, a fixed diagnostic in `content` and `details.error`, and a local error category in `details.code`. HTTP failures also include the numeric `details.status`. Remote error bodies, status text, request headers and IDs, parser messages, credential exceptions, and cancellation reasons are excluded from both output fields and are not logged. Unknown exceptions use `request_failed`; an aborted tool signal uses `cancelled`. Successful answer text and citations retain their existing behavior.

Non-success HTTP bodies are cancelled without reading them. SSE readers are cancelled and released after completion or failure. A cleanup error does not replace the original outcome. JSON and SSE protocol errors use fixed messages without quoting the response payload.

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
