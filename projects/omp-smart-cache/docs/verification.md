# Verification

[中文](./verification.zh.md)

## Host interfaces

Imports use entries the compiled host exposes. Source encoding stays with `buildResponsesInput`, whose model-adapted, hoisted output reaches `buildOpenAiNativeHistory` without raw messages, so native V2 replay normalization applies. Opaque correspondence runs the same native encoder over a single compaction record, requires a unique match, and restores the original record before normalization. Local image eligibility reads the native `images.urls.enabled` handle against the current session's settings, including child overrides; a missing handle reports unavailability.

The relevant host source paths, inside the `@oh-my-pi/pi-agent-core`, `pi-ai`, and `pi-coding-agent` packages, are `src/sdk.ts`, `src/registry/agent-registry.ts`, `src/session/session-maintenance.ts`, `src/session/date-cwd-reminder.ts`, `src/session/messages.ts`, `src/compaction/compaction.ts`, and `src/providers/openai-shared.ts`.

## What was checked

Real native CLI runs on OMP `18.5.0` and on a maintained host above it cover complete-range reuse, tool-output trimming with local reuse, main/task/Eval attribution, parallel child isolation, child revive and cancellation, and switch/branch/tree recovery. The same runs cover the host imports, opaque identity, required local reuse, and false/true image-setting overrides in native task and Eval children.

Controlled synthetic HTTP exercises the native serializer, scheduler, and maintenance. Synthetic usage exercises the mechanism only; real Provider behavior and runtime verification come from the native CLI runs. A context or provider-request handler without an independent-unit contract prevents local proof, while complete-range reuse stays available. Cache savings come from the separately authorized real Provider runs.

## Replacement

Replace this adaptation when a maintained native interface preserves equivalent configuration, isolation, reuse safety, and failure behavior across the required paths, after behavioral verification.
