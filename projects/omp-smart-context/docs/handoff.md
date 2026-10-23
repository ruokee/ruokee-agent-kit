# Handoff alignment

[中文](./handoff.zh.md)

Handoff requests can omit system instructions added to ordinary requests and use different generation options. These differences can break the common prefix and cause cache misses despite resending the conversation. Handoff alignment restores eligible shared content and supported options from the same session's ordinary request.

## Support

Supported APIs are `openai-completions` and `openai-responses`. Other APIs remain native. The switch is independent of Remote alignment, its Provider filter, and its mode.

- Chat Completions can restore ordinary system instructions, reasoning effort, and implicit tool choice.
- Responses restores missing system content while keeping native reasoning and document-generation tool choice.

Both preserve the Handoff instruction, new history, cache key, separate session, and cancellation. Cache availability and savings remain Provider-dependent.

## Enable

Set `handoffCacheEnabled=true` through [native configuration](../README.md#configuration), then restart OMP. It defaults to `false`, with no separate Provider filter or mode.

Send an ordinary prompt before generating a Handoff so the extension has a confirmed request to compare. The ordinary request must include a tool set; a session that never sends tools stays native.

## Read the result

Run `/smart-context` and read Handoff separately from Remote.

- `awaiting-reference`: waiting for a usable confirmed ordinary request.
- `already-aligned` or `rewritten`: alignment succeeded, without or with a rewrite.
- `rejected`: the Handoff request was sent unchanged, not blocked or delayed.
- `unavailable`: a required interface or configuration is unavailable, or another extension owns a conflicting interface.

Switching sessions or branches, compaction, cancellation, and changes to the model, system instructions, reasoning, or tools can make an earlier request unusable. New ordinary work can restore eligibility for a later Handoff. See [Status](./status.md).

## Native behavior

OMP still generates and validates the document, applies manual focus, handles automatic entry, speculation, cancellation, retries and fallback, and commits or rejects the result. Alignment adds no command or document store and does not change manual compaction.

Insufficient shared content or changed request ownership leaves the complete request native. Later extension options remain in effect. In Chat Completions, restoring tool choice can let the model return a tool call instead of document text; OMP handles that as a native generation failure. Responses retains its native document-generation choice.

To stop alignment, set `handoffCacheEnabled=false` and restart. Disabling Remote does not disable Handoff, and disabling Handoff does not disable Remote.
