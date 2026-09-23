# ADR decision: Use native plugin settings for Codex web access

Decision owner: Ruokee
Decision writer: OMP GPT-6 Astra
Reverses: [ADR decision: Add OMP Codex web access](../archived/2026-09-06-add-omp-codex-web-access.md)

English | [中文](./2026-09-10-use-codex-web-plugin-settings.zh.md)

## Motivation

`omp-codex-web-access` provides web search and page extraction through a forwarding Provider's Codex subscription, configured through OMP's native plugin settings. OMP's built-in `web_search` supports Codex subscriptions supplied directly to OMP but cannot use this forwarding arrangement, which the Codex Harness supports. The extension runs the forwarding Provider's `openai-responses` model registered in OMP and coexists with OMP's built-in tools. Users need independent control over each tool's availability and whether its schema is presented at the top level or discovered through `xd://`.

The component also needs one OMP configuration contract that supports user values and project overrides. Native plugin settings provide that contract through OMP's CLI and public settings getter while keeping model credentials in OMP's existing model registry and credential APIs.

## Decision

### Component and tools

The repository maintains a self-contained OMP extension package at `projects/omp-codex-web-access`, named `@ruokee/omp-codex-web-access`. Its runtime, package metadata, checks, and `README.md` and `README.zh.md` documentation live inside the component directory. Each README is the component's complete document in its language, covering the tools, installation, configuration, load modes, model execution, development checks, and license. The extension entry is declared through `omp.extensions` in `package.json`. The repository READMEs list the component under OMP extensions and link to the corresponding component README in each language.

The package exposes exactly two tools:

| Tool | Parameters | Result |
| --- | --- | --- |
| `codex_web_search` | Required non-empty `query` | Model-generated answer and cited source URLs |
| `codex_web_fetch` | Required `url` using HTTP or HTTPS; optional `prompt` | Model-assisted extraction from the specified page and cited source URLs |

Page extraction may summarize or clean content. It is not raw HTML or a verbatim page snapshot. Tool descriptions and component documentation identify the result as model-assisted. Both tools use OMP's `read` approval tier and pass cancellation to the request.

The fetch tool validates the URL protocol as HTTP or HTTPS before model resolution, credential lookup, or network work. The model performs web access. The extension does not fetch the target URL itself and does not perform DNS or private-address probing. The package does not change OMP's built-in search or fetch settings.

### Native settings and scopes

OMP native plugin settings are the sole configuration source for `@ruokee/omp-codex-web-access`. The package declares these flat keys in its `omp.settings` schema:

| Key | Type | Default | Replaces old YAML path |
| --- | --- | --- | --- |
| `model` | string | `""` | `model` |
| `searchEnabled` | boolean | `true` | `tools.codex_web_search.enabled` |
| `searchLoadMode` | enum | `essential` | `tools.codex_web_search.loadMode` |
| `fetchEnabled` | boolean | `true` | `tools.codex_web_fetch.enabled` |
| `fetchLoadMode` | enum | `discoverable` | `tools.codex_web_fetch.loadMode` |

Both load-mode enums accept only `essential` and `discoverable`. The runtime trims whitespace around `model`. A missing or empty model selector remains a tool-call error and does not prevent registration. Plugin settings store only the model selector. OMP resolves the endpoint, headers, and credentials; plugin settings do not define them.

The extension reads effective settings through the public `getPluginSettings(packageName, cwd)` API. OMP merges user settings with the package entry under `settings` in `.omp/plugin-overrides.json`; a project value replaces a user value with the same key. The extension adds no OMP file reader, storage format, or merge rule. Project override examples must preserve other plugin entries.

Users configure user-level values with OMP's native CLI, for example:

```bash
omp plugin config set @ruokee/omp-codex-web-access model provider/model-id
omp plugin config set @ruokee/omp-codex-web-access fetchEnabled false
```

OMP parses its own configuration before the extension sees it. A missing user runtime JSON produces an empty user-level settings object; a valid project override can still contribute values. Malformed user runtime JSON causes the public getter to reject. A missing project override candidate makes OMP continue to the next candidate directory. A malformed candidate is skipped. If no valid project candidate exists, there is no project override. The extension validates only the object returned by the getter and does not parse OMP files to recover errors that OMP has swallowed or rejected.

### Activation and validation

The factory only installs a `session_start` handler. It does not read settings or register either tool during factory loading. On the first `session_start` for an extension activation, the handler awaits `getPluginSettings(PACKAGE_NAME, ctx.cwd)`, validates one complete effective object, and registers enabled tools from that snapshot. The model selector and both tool definitions use the same snapshot.

Each activation memoizes one initialization promise. Repeated or concurrent `session_start` events share it and do not reread settings or duplicate tool registration. A rejected settings read or invalid effective object terminates that activation without a retry. Restarting the OMP process activates the extension again and reads updated values. Creating or switching a session in the same OMP process does not refresh an existing activation's snapshot. Normal OMP modes await this initialization before making `prompt` available. A direct OMP SDK caller must initialize the OMP extension runtime, emit `session_start`, and await the event before calling `prompt`.

The runtime defaults match the manifest, but manifest defaults alone do not replace a getter result. An empty effective settings object returned by the getter uses all defaults. Only missing keys receive defaults. Explicit `null`, unknown keys, wrong types, and invalid enum values invalidate the complete object. Load modes are validated even when their tool is disabled. A rejected getter or invalid object registers neither tool and emits a bounded diagnostic that identifies the field and reason without dumping configuration values.

The registration API is called after configuration validation, but a registration API failure may leave tools registered before the failure. The extension reports the failure and stops further registration; it does not promise global rollback of a partial registration prefix.

### Migration and presentation

The extension does not read, import, delete, or rewrite `omp-codex-web-access.yml`, including any fallback behavior. Existing users transfer values manually using the mapping above. The old YAML file is not automatically deleted. After migration, restart the OMP process so the extension activates again and reads the native values. If the old YAML file is the only configuration, it has no effect and the native defaults apply, including an empty model selector.

Each tool has independent enablement and presentation:

- `enabled: false` maps to the native `*Enabled: false` key. The tool is not registered and cannot be called through top-level tools or `xd://`.
- `essential` keeps an enabled tool in OMP's top-level presentation.
- `discoverable` registers an enabled tool for OMP discovery and may mount it through `xd://` when the OMP transport is available.
- When discovery is unavailable, OMP may present a discoverable tool at the top level.

The extension does not modify OMP built-in tools or add a discovery transport.

### Model execution

Both tools use the configured model through the `openai-responses` API with native web search. The selected model must support that capability. Model identity, endpoint, headers, and credentials resolve through OMP's model registry and credential APIs. Requests go directly to the model's Responses endpoint; the extension does not launch Codex CLI.

The tools share request and response behavior for answer text, citation collection, Responses errors, cancellation, and JSON and SSE responses. The model-assisted extraction limitation remains part of the public tool contract.

## Alternatives considered

Keep the dedicated YAML file as the configuration source. It preserves the existing file and registration-time behavior, but it leaves a separate configuration interface and cannot provide OMP's native project overrides. It was rejected in favor of the native settings contract.

## Consequences

OMP provides one native CLI and getter contract for the component, with user values and per-project overrides resolved by OMP. Tool registration remains tied to one effective settings snapshot per activation. Configuration changes require an OMP process restart for the user-facing reactivation path; a same-process session switch or new session does not refresh an existing snapshot.

Users who migrate without transferring their YAML values lose their previous model and tool choices. The old YAML file remains in place unless the user removes it manually, but it has no effect. A missing or empty model selector still allows registration and fails only when a tool is called.

OMP owns file parsing and scope merging, while the extension owns schema validation, bounded diagnostics, and tool registration. A malformed user runtime file can reject the getter, and a malformed project candidate can be skipped according to OMP's loader rules. A failure inside the registration API can leave a partial registration prefix, so the contract does not promise global rollback after registration begins.

The component continues to coexist with OMP built-in tools, uses OMP's discovery and approval rules, and keeps model-assisted page extraction distinct from raw page retrieval.
