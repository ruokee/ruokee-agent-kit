# omp-smart-cache

[中文](./README.zh.md)

`@ruokee/omp-smart-cache` is an extension that improves how OMP uses the Provider's cache. It aims to avoid unexpected cache misses on requests, and ordinary requests and the native request path stay unchanged.

Each optimization the package carries lives in its own section.

## Documentation

- [Design](./docs/design.md) covers how a reference is confirmed, what may be reused, and when a request stays native.
- [Verification](./docs/verification.md) lists the host interfaces the package relies on and the scenarios already checked.

## Install

From this component directory:

```bash
omp install . --scope user
```

## Configuration

Install this package through OMP's native plugin manager. Its manifest declares the extension and settings, so no separate extension entry or settings file is needed.

```bash
omp plugin config list @ruokee/omp-smart-cache
omp plugin config set @ruokee/omp-smart-cache compactionCacheProvider example-provider
omp plugin config set @ruokee/omp-smart-cache compactionCacheEnabled true
```

| Key | Default | Accepted | Effect |
| --- | --- | --- | --- |
| `compactionCacheEnabled` | `false` | boolean | Enable remote alignment. |
| `compactionCacheProvider` | `""` | string | Exact configured Provider name. An empty value keeps alignment unavailable. |
| `compactionCacheMode` | `"hooks"` | `standard`, `hooks` | Select the reuse contract. Enabling alignment takes the switch and the exact Provider name. |

OMP merges project overrides over user settings. It reads and validates the settings once for each activation, so restart OMP after a change; navigation does not refresh the snapshot, and a child uses its own actual model, tools, prompt, and session identities. A missing key takes its default. An explicit `null`, a wrong type, an unknown key, or an unsupported mode makes the capability unavailable, and the diagnostic reports a fixed reason without printing the rejected value. [Design](./docs/design.md#modes) describes the two modes.

## Remote compaction alignment

Remote compaction resends conversation content, much of which an ordinary request already sent. This optimization rewrites a fully proved target request at the final sending boundary, so the selected Provider's compaction reuses the confirmed results of that same ordinary request and the body stays consistent with what was already sent. OMP keeps triggering, preparation, trimming, credentials, retries, fallback, speculative adoption, history commits, and continuation, and ordinary requests reach transport unchanged.

An ordinary main-loop dispatch becomes a reference only when its source, completed preparation, existing callbacks, and actual outgoing payload belong to the same dispatch and reach transport unchanged. Title, warming, advisor, and Handoff are side requests that keep their own bodies. Any unknown field, explicit policy difference, model or tool mismatch, ambiguous identity, missing reference, cancelled operation, foreign wrapper, or unavailable interface leaves the whole request native. The rewrite covers the non-Codex Responses V2 remote compaction path only, in the main session and in native task and Eval children.

Turn the setting off, or remove the package and restart OMP, to return to the native request path. Alignment rewrites the outgoing body on the client, and client alignment, native usability, and real Provider benefit stay separate outcomes. [Design](./docs/design.md) covers the full mechanism.

## Status

`/smart-cache` starts no model turn. It reports the current session's state:

| State | Meaning |
| --- | --- |
| `disabled` | The explicit switch is off. |
| `unavailable` | Configuration, interface, identity, or wrapper ownership is unusable. |
| `awaiting-reference` | No confirmed ordinary reference is ready for a new operation. |
| `already-aligned` | The valid candidate matches the native body, so nothing is reserialized. |
| `rewritten` | A complete validated candidate was delegated. |
| `rejected` | Proof failed, so the target was delegated unchanged. |

Separate fields report online confirmation, operation binding, candidate validation, and sending. Local dispatch, operation, and reference numbers are session-local counters. Logical operations, physical sends, retries, rewrites, and refusals are counted separately with bounded counters, and refusals stay in the total. The report carries states and bounded counters, and it is the package's only output. Message bodies, opaque bytes, credentials, raw endpoints, and private paths stay in the session, and configuration comes only from the native settings above.

## Compatibility

The minimum maintained OMP version is `18.5.0`, with no upper maintenance bound. This section records the maintenance commitment; installation and runtime follow the host's own rules. Verification covers this floor and the maintained hosts above it, and a host below the floor may still run the package.

The package declares `@oh-my-pi/pi-agent-core`, `@oh-my-pi/pi-ai`, and `@oh-my-pi/pi-coding-agent` as unrestricted host peers (`*`) and locks its development dependencies to `18.5.0`. A missing interface fails conservatively and keeps the native path. [Verification](./docs/verification.md) records the interfaces and scenarios checked.

## Development

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
```

## License

MIT.
