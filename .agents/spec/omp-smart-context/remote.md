# Remote alignment

English | [中文](./remote.zh.md)

## Goals

Align eligible native Remote V2 requests with the same session's confirmed ordinary request while preserving native compaction decisions and output.

## Out of scope

Codex requests, APIs other than non-Codex `openai-responses` V2, new compaction methods, explicit tool-choice invention, output-limit changes, retries, or guaranteed Provider cache benefit.

## Public surface

`compactionCacheEnabled` defaults to `false`; `compactionCacheProviderFilter` defaults to an empty string; `compactionCacheMode` defaults to `hooks` and accepts `standard` or `hooks`. Settings use the [package activation contract](./README.md#configuration). An empty filter reports `provider-filter-empty` and leaves alignment unavailable.

The current session model must support Remote, OMP must select Remote, and that model's Provider must exactly match the enabled repair's filter. Filtering changes no model, Provider, route, or compaction method. A mismatch leaves native compaction unchanged. Main sessions, native task children, and Eval children retain their existing coverage. Handoff has its own switch and protocol contract.

Preserve first, subsequent, and process-restored compaction through each session class's native manual, automatic, in-turn, and speculative entry points. Add no entry point when the host lacks one. Codex, V1, and unrecognized request shapes remain native.

## Invariants

Apply [shared reference and ownership requirements](./request-alignment.md). Preserve ordinary and non-target requests, unknown fields, explicit policy differences, and native fallback. Model or tool mismatch, ambiguous identity, missing proof, cancellation, foreign wrappers, and missing interfaces preserve the complete native Remote request.

### Source

Native compaction rebuilds journal history. Only an observed native session may recognize hidden, agent-attributed `eval-state-context` as a display-derived projection outside the canonical source. Keep the ordinary request and captured raw messages unchanged. Exclude only that exact projection before checking complete canonical retention. `standard` also checks recognized preparation against the unfiltered source.

User messages with identical text, user-attributed custom content, other custom types, and unconfirmed construction retain all source dependencies. Recognition grants no local independence and restores no trimmed output.

### Reuse modes

Both modes align recognized native common content, including valid tool-schema preparation, reminders, replay semantics, and implicit tool-choice defaults. V2 retains its own output limit or its omission.

- `standard` accepts recognized native preparation differences.
- `hooks` additionally reuses proved completed handling results. A complete retained range permits lawful insertion, reordering, restoration, cross-range merging, images, and existing post-payload transformations. Stateful handlers run once.

Complete retained-source proof precedes local matching and remains possible with duplicate source messages. Partial reuse requires independently extractable already-sent units with every dependency and processing condition retained. Equal output, length, index, or provenance alone is insufficient.

Retain native tool-output rewriting, deleted dependencies, new ordinary/tool/image tails, opaque history, call/result pairing, and trigger boundaries. An indivisible result with changed dependencies leaves the whole request native with `projection-dependency-changed`; unknown provenance or unit boundaries use `projection-unconfirmed`. Both refusals are unaligned and remain in totals. Offer no frozen pure-projection protocol and never rerun a black-box handler.

### Native replacement

Replace the adaptation only after behavioral verification that a maintained native interface provides equivalent results, configuration semantics, isolation, and failure behavior across required paths. An upstream PR merge alone is insufficient.

## Acceptance criteria

- Each enabled mode aligns recognized native cases while off, empty-filter, mismatched-filter, unsupported-model, non-Remote selection, and out-of-scope API cases preserve native decisions and requests.
- The filter never changes actual model or routing, including successful native Remote with no repair.
- Complete retention and eligible local reuse preserve ordinary content without rerunning handlers or restoring trimmed data. Unproved dependencies refuse the complete rewrite with the applicable reason.
- Exact native Eval metadata can be excluded from canonical history without excluding look-alike user or custom messages.
- Actual final transport preserves unknown fields, native limits, new tails, opaque bytes, and independent Handoff behavior.

## Related ADRs

- [Remote alignment](../../adr/decision/2026/10/10-remote-alignment.md)
- [Request alignment](../../adr/decision/2026/10/22-request-alignment.md)
