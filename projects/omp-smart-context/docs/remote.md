# Remote compaction alignment

[中文](./remote.zh.md)

OMP prepares Remote compaction from history differently from ordinary requests. Differences in system instructions, tool definitions, reminders, or history can break their common prefix and cause cache misses. This capability aligns eligible shared content with an ordinary request already sent by the same session.

## Enable

Set `compactionCacheEnabled=true`, set `compactionCacheProviderFilter` to the current model's exact Provider name, and restart OMP. Commands and defaults are in [Configuration](../README.md#configuration).

The current model must support Remote, and OMP must choose Remote. The filter only determines whether to repair that request. It does not change the model, Provider, route, or compaction method. A mismatch leaves native compaction working without alignment.

Coverage is non-Codex `openai-responses` V2 in main sessions and native task and Eval children. [Handoff](./handoff.md) uses a separate switch.

## Modes

`compactionCacheMode` accepts:

- `standard`: align recognized differences introduced by native request preparation.
- `hooks`: also reuse completed extension handling when the shared content can be verified. This is the default.

Neither mode reruns context handlers, restores trimmed tool output, changes native output limits, or enables Remote on its own. When extensions transform content in ways that cannot be safely reused, alignment may be refused in either mode.

## Read the result

Run `/smart-context` and read the Remote section. After enabling it, send an ordinary prompt so a usable request is available for comparison.

- `awaiting-reference`: waiting for a confirmed eligible ordinary request.
- `already-aligned`: no rewrite was needed.
- `rewritten`: the request was aligned.
- `rejected`: the request stayed native because alignment could not be verified. It was not blocked.
- `unavailable`: configuration, a required host interface, or another extension's conflicting ownership prevents use.

Navigation, model or tool changes, cancellation, and compaction can make the previous ordinary request unusable. Fresh ordinary work can make future alignment available again. See [Status](./status.md) for fields and counters.

## Limits

OMP still controls triggering, preparation, trimming, credentials, retries, fallback, adoption, history commits, and continuation. Ordinary and out-of-scope requests remain unchanged. Unrecognized request differences, ambiguous session identity, or insufficient shared content leave the entire compaction request native.

Alignment makes the shared request prefix eligible for cache reuse; the Provider determines cache availability and billing. A successful rewrite is not a fixed hit-rate or savings promise.

To stop alignment, set `compactionCacheEnabled=false` and restart, or remove the package and restart. Existing in-flight work belongs to the running process.
