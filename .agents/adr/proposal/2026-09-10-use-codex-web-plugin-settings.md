# ADR proposal: Use native plugin settings for Codex web access

Decision owner: Ruokee
Draft writer: OMP GPT-6 Astra

English | [中文](./2026-09-10-use-codex-web-plugin-settings.zh.md)

## Motivation

The [Codex web access extension](../../../projects/omp-codex-web-access/README.md) stores five scalar choices in a dedicated YAML file. OMP native plugin settings can expose these choices through `omp plugin config` and apply project overrides. Using this OMP facility gives users one configuration interface and permits different model and tool choices per project.

The [current Codex web access decision](../decision/2026-09-06-add-omp-codex-web-access.md) requires YAML as the sole configuration source. This proposal reverses that choice. The resulting decision must retain the current component, tool, discovery, approval, and model execution contracts alongside the replacement configuration contract.

## Proposal

### Settings and scope

Use OMP native plugin settings as the sole configuration source for `@ruokee/omp-codex-web-access`. Declare the following flat keys in the package's `omp.settings` schema:

| Key | Type | Default | Replaces YAML path |
| --- | --- | --- | --- |
| `model` | string | `""` | `model` |
| `searchEnabled` | boolean | `true` | `tools.codex_web_search.enabled` |
| `searchLoadMode` | enum | `essential` | `tools.codex_web_search.loadMode` |
| `fetchEnabled` | boolean | `true` | `tools.codex_web_fetch.enabled` |
| `fetchLoadMode` | enum | `discoverable` | `tools.codex_web_fetch.loadMode` |

Both enums accept only `essential` and `discoverable`. Trim whitespace around `model`. A missing or empty model selector remains a tool-call error and does not prevent tool registration. Settings contain a model selector, never credentials.

Read effective settings through the public `getPluginSettings(packageName, cwd)` API. Use OMP's user settings and project `.omp/plugin-overrides.json` precedence, with project values replacing user values for the same key. The extension adds no file reader, storage format, or merge rules for OMP configuration.

Users configure user-level settings through the native CLI, for example:

```bash
omp plugin config set @ruokee/omp-codex-web-access model provider/model-id
omp plugin config set @ruokee/omp-codex-web-access fetchEnabled false
```

Project settings use the package entry under `settings` in `.omp/plugin-overrides.json`. Documentation must distinguish this override from user-level CLI writes and show how to preserve other plugin entries.

### Activation and OMP prerequisites

Read and validate settings once per extension activation, before registering either tool. Await the read and use the same snapshot for the model selector, enabled flags, and load modes. Changes apply on the next activation; existing sessions retain their snapshot.

The getter must receive the cwd provided by OMP for that extension's session. A process working directory or global settings singleton is not a substitute. Concurrent sessions with different project directories must resolve their own project overrides.

Implementation depends on a public OMP API that supplies this cwd before registration. OMP 18.1.11 supports an asynchronous extension factory, but its public factory API does not expose a reliable session cwd. An event context provides cwd later in the lifecycle. Support for the required activation context must be verified in the target OMP version before implementation. If it is unavailable, revise this proposal to specify OMP support or a verified registration lifecycle before proceeding. Do not silently move reads to tool execution or register tools from a later event. Any required OMP compatibility range change must be explicit and verified.

### Validation and failures

The extension validates the effective settings object and supplies runtime defaults matching the manifest. A manifest default alone does not supply a value through the getter. An empty settings object uses all defaults. Only missing keys receive defaults; explicit `null`, unknown keys, wrong types, and invalid enum values invalidate the whole object. Validate load modes even when their tool is disabled.

A rejected settings read or invalid effective object registers neither tool and emits a bounded configuration diagnostic. Diagnostics identify the field and reason without dumping the configuration. No tool is registered before the complete settings object passes validation.

OMP parses its own configuration files. If the public getter turns a missing or malformed file into absent settings, the extension applies defaults to those absent values. It cannot promise the old YAML reader's file-level parse diagnostics. Verify and document the behavior of supported OMP versions rather than parsing OMP files to recover suppressed errors.

### Migration and retained behavior

Remove all reading of `omp-codex-web-access.yml`, including fallback behavior. Do not automatically read, import, delete, or rewrite the old file. Component documentation must provide the field mapping above, native CLI commands, a project override example, activation timing, and the OMP error boundary. Existing users must transfer their choices before using the migrated extension. An old YAML file alone leaves native defaults in effect, including an empty model selector.

Preserve both tool names, parameters, `read` approval, HTTP(S) validation before model or network work, model and credential resolution, Responses transport, citations, and cancellation. A disabled tool is not registered and cannot be called through either top-level tools or `xd://`. Enabled tools retain OMP's `essential` and `discoverable` behavior, including its fallback when discovery is unavailable. The extension does not change built-in tools or add discovery transport.

## Alternatives considered

Keep the dedicated YAML file. It already supports all five choices and registration-time reads without requiring a project cwd. It retains a separate configuration interface and cannot provide the requested native project overrides. Native settings are preferred once the activation prerequisite is satisfied.

## Acceptance criteria

- The public OMP API supplies the correct session cwd before registration. Tests cover a session cwd different from the process cwd and concurrent sessions using different project overrides.
- All five manifest keys, types, enum values, and defaults match runtime validation. Missing values use defaults; explicit nulls, unknown keys, invalid types, and invalid enum values reject the complete settings object.
- An actual public-getter integration check proves user/project precedence and OMP missing-file and malformed-file behavior without modifying real user settings.
- Each activation reads one settings snapshot. A pending or rejected read and an invalid object register zero tools. Later configuration edits affect the next activation only.
- Tool enablement and load modes cover both tools independently, including both disabled. Missing or empty model selection errors at call time. Existing execution and cancellation checks continue to pass.
- An existing YAML file has no effect and is neither read nor modified. Both component README languages document migration and the OMP error boundary.
- Component type checks and tests, repository checks, and OMP registration/discovery verification pass on the declared supported OMP versions.
- The complete replacement decision retains the old decision's still-effective contracts and replaces its YAML-specific configuration rules. Both language versions remain equivalent.

## Risks

- Users who upgrade without transferring YAML settings will lose their previous model selection and tool choices. Default enablement can expose a previously disabled tool, and the empty model default prevents successful calls. Migration instructions must make these effects explicit.
- An incorrect activation cwd can apply another project's model and tool settings. The OMP prerequisite and separate-session tests are required before implementation can claim project override support.
- An OMP getter that suppresses malformed configuration files can leave tools enabled by default despite an intended disable setting. Documentation must state the verified OMP behavior; extension validation covers only the effective values the getter returns.
