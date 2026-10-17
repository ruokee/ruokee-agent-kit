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
omp plugin config set @ruokee/omp-smart-cache handoffCacheEnabled true
```

- `compactionCacheEnabled`: default `false`, accepts a boolean. Enable remote alignment.
- `compactionCacheProvider`: default `""`, accepts a string. Exact configured Provider name. An empty value keeps alignment unavailable.
- `compactionCacheMode`: default `"hooks"`, accepts `standard` or `hooks`. Select the remote reuse contract. Enabling remote alignment takes the switch and the exact Provider name.
- `handoffCacheEnabled`: default `false`, accepts a boolean. Enable Handoff alignment. It takes this switch alone, with no Provider name and no mode.

OMP merges project overrides over user settings. It reads and validates the settings once for each activation, so restart OMP after a change; navigation does not refresh the snapshot, and a child uses its own actual model, tools, prompt, and session identities. A missing key takes its default. An explicit `null`, a wrong type, or an unknown key makes the affected capability unavailable, and it fails the remote capability alone when the value belongs to a remote key; an unsupported mode fails remote alignment the same way. The diagnostic reports a fixed reason without printing the rejected value. [Design](./docs/design.md#modes) describes the two remote modes.

## Remote compaction alignment

Remote compaction resends conversation content, much of which an ordinary request already sent. This optimization rewrites a fully proved target request at the final sending boundary, so the selected Provider's compaction reuses the confirmed results of that same ordinary request and the body stays consistent with what was already sent. OMP keeps triggering, preparation, trimming, credentials, retries, fallback, speculative adoption, history commits, and continuation, and ordinary requests reach transport unchanged.

Alignment rewrites the outgoing body on the client, and client alignment, native usability, and real Provider benefit stay separate outcomes. [Design](./docs/design.md) covers the full mechanism.

## Handoff alignment

Handoff generates a document or summary as a side request that repeats common content already sent by the ordinary main-loop dispatch. This capability restores the proved ordinary system prompt at final transport, preserving the side instruction, new history, cache key, independent side session, cancellation signal, and other native options.

Handoff alignment supports `openai-completions` and `openai-responses` sessions. Native Responses Handoff and V2 compaction belong to Handoff and remote alignment respectively, with at most one rewriting capability per request. Handoff uses only its own switch, independently of the remote switch, Provider selection, or mode. Other APIs stay native.

[Design](./docs/design.md#handoff-alignment) covers the boundary conditions, the restored axes, and how the reference is invalidated.

## Status

`/smart-cache` starts no model turn. It reports each capability in its own section: the remote section keeps its wording and fields, and Handoff adds its own state, staged reasons, and bounded counters. The states below describe both sections:

- `disabled`: the explicit switch is off.
- `unavailable`: configuration, interface, identity, or wrapper ownership is unusable.
- `awaiting-reference`: no confirmed ordinary reference is ready for a new operation.
- `already-aligned`: the valid candidate matches the native body, so nothing is reserialized.
- `rewritten`: a complete validated candidate was delegated.
- `rejected`: proof failed, so the target was delegated unchanged.

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

## Changes

### 0.1.7

Permit native assistant `completedAt` and `contextSnapshot` bookkeeping to be filled after the ordinary dispatch. Responses Handoff source proof still compares every other field strictly and preserves the complete native input.

### 0.1.6

Report `navigation-unsettled` while an ordinary Responses context is observed during session navigation. Keep reference capture suspended until navigation settles.

### 0.1.5

Support independently enabled Responses Handoff by aligning the system prompt of a confirmed ordinary dispatch. Preserve instructions and leading developer expressions, history order, native none, reasoning, and configuration updates; validate and count Handoff separately from V2. Capture source from the same preparation dispatch rather than an Agent state that may not yet be synchronized.

### 0.1.4

Prevent late ordinary responses and identical retries from reviving invalid Handoff references or operations. Require a native construction baseline for the Handoff methods, preserve foreign wrappers, and project and count Handoff requests only at final transport. Freeze native tool schemas through the host's wire-schema conversion.

### 0.1.3

Treat the native hidden Eval state context as a prepared projection rather than a journal-history dependency. Full-source reuse remains available after that projection is rebuilt, in both modes. User-authored messages, other custom messages, and sessions with unconfirmed construction keep their source dependencies.

### 0.1.2

Restore remote references when automatic compaction advances the epoch inside an ordinary tool run. Fresh ordinary dispatches prove their own credential binding without replacing an older compaction operation's immutable reference or reviving that operation.

## License

MIT.
