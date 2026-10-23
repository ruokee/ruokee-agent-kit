# Remote alignment

## Goals

Align eligible native Remote V2 requests with the same session's confirmed ordinary request while preserving native compaction decisions and output.

## Out of scope

Codex requests, APIs other than non-Codex `openai-responses` V2, new compaction methods, explicit tool-choice invention, output-limit changes, retries, or guaranteed Provider cache benefit.

## Public surface

`compactionCacheEnabled` is boolean, default `false`; `compactionCacheProviderFilter` is a string, default `""`; `compactionCacheMode` defaults to `hooks` and accepts `standard` or `hooks`. OMP project settings override user settings, missing keys take defaults, and the effective activation snapshot changes only after restart. An empty filter reports `provider-filter-empty` and leaves alignment unavailable. `/smart-context` reports Remote separately from Handoff.

The current session model must support Remote, OMP must select Remote, and that model's Provider must exactly match the enabled repair's filter. Filtering changes no model, Provider, route, or compaction method. A mismatch leaves native compaction unchanged. Main sessions, native task children, and Eval children retain their existing coverage. Handoff has its own switch and protocol contract.

Preserve first, subsequent, and process-restored compaction through each session class's native manual, automatic, in-turn, and speculative entry points. Add no entry point when the host lacks one. Codex, V1, and unrecognized request shapes remain native.

## Invariants

The shared request-alignment requirements apply to this capability. Reuse only the same session's confirmed ordinary dispatch and retain its original reference throughout a native operation, including retries. Preserve ordinary and non-target requests, unknown fields, explicit policy differences, and native fallback. Model or tool mismatch, ambiguous identity, missing proof, cancellation, foreign ownership, and missing interfaces preserve the complete native Remote request without blocking, delaying, or dropping it.

### Source

Only a confirmed native session's hidden, agent-attributed `eval-state-context` may be excluded from canonical-source retention as display-derived content. The ordinary request and original raw messages remain unchanged. Complete canonical retention must otherwise hold. `standard` also requires recognized preparation to match the unfiltered source.

User messages with identical text, user-attributed custom content, other custom types, and unconfirmed construction retain all source dependencies. Recognition grants no local independence and restores no trimmed output.

### Reuse modes

Both modes align recognized native common content, including valid tool-schema preparation, reminders, replay semantics, and implicit tool-choice defaults. V2 retains its own output limit or its omission.

- `standard` accepts recognized native preparation differences.
- `hooks` additionally reuses proved completed handling results. A complete retained range permits lawful insertion, reordering, restoration, cross-range merging, images, and existing post-payload transformations. Stateful handlers run once.

Complete retained-source proof permits reuse even with duplicate source messages. A local match is insufficient when it contradicts that complete range. Partial reuse requires independently extractable already-sent units with every dependency and processing condition retained. Equal output, length, index, or provenance alone is insufficient.

Retain native tool-output rewriting, deleted dependencies, new ordinary/tool/image tails, opaque history, call/result pairing, and trigger boundaries. An indivisible result with changed dependencies leaves the whole request native with `projection-dependency-changed`; unknown provenance or unit boundaries use `projection-unconfirmed`. Both refusals are unaligned and remain in totals. Offer no frozen pure-projection protocol and never rerun a black-box handler.

### Native replacement

Replace the adaptation only after behavioral verification that a maintained native interface provides equivalent results, configuration semantics, isolation, and failure behavior across required paths. An upstream PR merge alone is insufficient.

## Acceptance criteria

- Each enabled mode aligns recognized native cases while off, empty-filter, mismatched-filter, unsupported-model, non-Remote selection, and out-of-scope API cases preserve native decisions and requests.
- The filter never changes actual model or routing, including successful native Remote with no repair.
- Complete retention and eligible local reuse preserve ordinary content without rerunning handlers or restoring trimmed data. Unproved dependencies refuse the complete rewrite with the applicable reason.
- Exact native Eval metadata can be excluded from canonical history without excluding look-alike user or custom messages.
- Actual final transport preserves unknown fields, native limits, new tails, opaque bytes, and independent Handoff behavior.
