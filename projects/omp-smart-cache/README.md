# omp-smart-cache

[中文](./README.zh.md)

`@ruokee/omp-smart-cache` reuses confirmed ordinary-request results in the selected Provider's native non-Codex Responses V2 remote compaction. It serves main sessions and native task and Eval children. Version: `0.0.2`.

It changes only a proved target request at the final sending boundary. OMP still owns triggering, preparation, trimming, credentials, retries, fallback, speculative adoption, history commits, and continuation. Ordinary requests remain unchanged. Alignment does not prove a Provider cache hit or savings.

## Install

From this component directory:

```bash
omp install . --scope user
```

## Configuration

Install this package through OMP's native plugin manager. Its manifest declares the extension and settings; no separate extension entry or settings file is needed.

```bash
omp plugin config list @ruokee/omp-smart-cache
omp plugin config set @ruokee/omp-smart-cache compactionCacheProvider example-provider
omp plugin config set @ruokee/omp-smart-cache compactionCacheEnabled true
```

| Key | Default | Accepted | Effect |
| --- | --- | --- | --- |
| `compactionCacheEnabled` | `false` | boolean | Enable remote alignment. |
| `compactionCacheProvider` | `""` | string | Exact configured Provider name. Empty keeps alignment unavailable. |
| `compactionCacheMode` | `"hooks"` | `standard`, `hooks` | Select the reuse contract. Does not enable alignment. |

OMP merges project overrides over user settings. Settings are read and validated once for each activation. Restart OMP after changing them. Navigation does not refresh the snapshot; a child uses its own actual model, tools, prompt, and session identities. A missing key takes its default. Explicit `null`, a wrong type, an unknown key, or an unsupported mode makes this capability unavailable. Diagnostics use fixed reasons without printing the rejected value.

### Modes

Both modes align recognized native common content, including valid tool schema preparation, reminders, replay semantics, and implicit tool-choice defaults. V2 keeps its own output limit or omission.

- `standard` accepts only recognized native preparation differences. It does not infer generic handler projection.
- `hooks` additionally reuses proved already-sent handling results. Complete retained ranges support lawful insertion, reordering, restoration, cross-range merging, images, and existing post-payload transformations. Stateful handlers are not called again.

A complete source range is proved before local matching. Repeated source messages do not invalidate an otherwise proved complete result. With partial retention, only independently reusable sent units whose dependencies remain unchanged can be reused. Native rewritten tool output stays rewritten; deleted dependencies are not restored. New ordinary, tool, and image tails, opaque history, pairing, and the trigger keep their native boundaries.

An indivisible result whose dependencies were changed is left entirely native with `projection-dependency-changed`. Unknown provenance or unit boundaries report `projection-unconfirmed`. These refusals count as unaligned, not as successful alignment. No frozen pure-projection protocol or black-box handler re-execution is provided.

## Eligibility and failure behavior

An ordinary main-loop dispatch becomes a reference only after its source, completed preparation, existing callbacks, and actual outgoing payload are confirmed as one dispatch. Side requests such as title, warming, advisor, or Handoff cannot become references. Each native operation freezes its initial reference, including a missing reference, across later online work and authentication or transport retries.

The implementation observes native CLI/SDK publication before `session_start` and checks the original agent, runner, and stream identities continuously. This observation is not an authentication API for arbitrary constructed Agent instances. An unobserved or changed chain can retain complete-range proof but cannot gain local native independence from matching lengths or outputs. History-dependent image preparation and later date/cwd reminders also require complete-range proof when local dependencies are not established.

Unknown fields, explicit policy differences, model/tool mismatch, identity ambiguity, missing reference, cancelled operations, foreign wrappers, or unavailable interfaces leave the whole request native. Codex, V1, other APIs, and other Providers are untouched. No credential data is read and no extra reference or authentication request is issued.

Before switch, branch, or tree navigation, the old epoch is revoked. After native transition settlement, a new ordinary send restores eligibility after success, cancellation, or failure. A child's finish or replacement releases only its own registration. Cleanup restores only wrappers still owned by this package; it never takes over a competing wrapper. Shared resources are released after the last registration. Retention is limited to current references and snapshots reachable through live native operations.

Disable the switch or remove this package and restart OMP to use the native request path. Existing processes do not transfer in-flight references during an update. This package does not install a compaction veto or override other extensions' vetoes. It does not change Handoff behavior.

## Status

`/smart-cache` starts no model turn. It reports the current session's state:

| State | Meaning |
| --- | --- |
| `disabled` | Explicit switch is off. |
| `unavailable` | Configuration, interface, identity, or wrapper ownership is unusable. |
| `awaiting-reference` | No confirmed ordinary reference is ready for a new operation. |
| `already-aligned` | The valid candidate is identical to the native body. No reserialization. |
| `rewritten` | A complete validated candidate was delegated. |
| `rejected` | The target was delegated unchanged because its proof failed. |

Separate fields show online confirmation, operation binding, candidate validation, and sending. Local dispatch/operation/reference numbers are not persistent session identifiers. Logical operations, physical sends, retries, aligned operations, rewrites, and refusals are counted separately with bounded counters. Rejected operations remain in the total. A later native commit does not turn a delegated rewrite into a Provider-hit claim.

Status contains no message body, opaque bytes, credential, raw endpoint, or private path. The package has no sampling log, experimental environment variable, or special sampling command.

## Host compatibility and source baseline

**Maintained OMP floor: `18.5.0`.** There is no upper bound or activation version whitelist. Host development dependencies are locked to this floor; peers are unrestricted. Missing interfaces fail conservatively.

Source baselines are the published `@oh-my-pi/pi-agent-core`, `pi-ai`, and `pi-coding-agent` packages at `18.5.0`, with maintained-host checks at `18.8.3`. Relevant source paths are `src/sdk.ts`, `src/registry/agent-registry.ts`, `src/session/session-maintenance.ts`, `src/session/date-cwd-reminder.ts`, `src/session/messages.ts`, `src/compaction/compaction.ts`, and `src/providers/openai-shared.ts` in their owning host packages.

Imports use entries exposed by the compiled host. Source encoding stays with `buildResponsesInput`. Its model-adapted, hoisted output passes through `buildOpenAiNativeHistory` with no raw messages for native V2 replay normalization. Opaque correspondence uses the same native encoder on a single compaction record, requires a unique match, and restores the original record before normalization. Local image eligibility reads the native `images.urls.enabled` handle against the current session's settings, including child overrides. A missing handle does not count as disabled.

Actual native CLI coverage on both versions includes complete-range reuse, tool-output trimming with local reuse, main/task/Eval attribution, parallel child isolation, child revive/cancellation, and switch/branch/tree recovery. Controlled synthetic HTTP exercises the native serializer, scheduler, and maintenance. Synthetic usage is not real Provider measurement. Source inspection alone is not runtime verification.

Compiled `18.8.3` checks also cover those imports, opaque identity, required local reuse, and false/true image-setting overrides in native task and Eval children. Context or provider-request handlers without an independent-unit contract prevent local proof; complete-range reuse remains available. These controlled checks do not establish cache savings.

Replace this adaptation when a maintained native interface preserves equivalent configuration, isolation, reuse safety, and failure behavior across the required paths, after behavioral verification.

## Development

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
```

## License

MIT.
