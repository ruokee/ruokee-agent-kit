# ADR proposal: Add a native-replay adjustment to omp-qol

Draft owner: Ruokee
Draft writer: deepseek/deepseek-v4.1-flash

English | [中文](./2026-09-22-add-native-replay-adjustment.zh.md)

## Motivation

OMP 18.2.4 decides per request whether an `openai-responses` call replays the native provider items a session carries or re-encodes the conversation locally, from one flag on the provider session state. [`openai-responses.ts:1194`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/providers/openai-responses.ts#L1194) reads `providerSessionState?.nativeHistoryReplayWarmed ?? true`. The state is created with the flag false ([`openai-responses.ts:237`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/providers/openai-responses.ts#L237)) and turns it true only after a successful request that produced replayable items ([`openai-responses.ts:899`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/providers/openai-responses.ts#L899)). Those states live in a map owned by the session ([`agent-session.ts:881`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/agent-session.ts#L881)), so a new process starts with the flag false however warm the session file is.

A resumed session therefore sends its first request in the local re-encode form — reasoning items dropped, assistant items re-serialized — while the process that wrote that session ended with replayed native items. The two forms differ from the first re-encoded item onward, so a prompt cache holding the whole prompt cannot serve the resumed session's first request, and the second request pays a second time because it has switched to the replayed form that the first request did not write.

Measured on this machine, OMP 18.2.4, `pro-20x/gpt-5.6-luna`, one-turn non-interactive runs: a session of about 19k prompt tokens reported 2,387 uncached input tokens on its first request after resuming versus 362 in the same position when that request already carried the replayed form. The gap grows with the conversation: a recorded production session of about 98k tokens paid 84,490 uncached tokens on its first request, 76,522 on its second — reading only the 21,632 static prefix the two forms share — and 7,332 on its third.

The host offers no request-level replay policy, no setting, and no persisted warm mark: the flag is process-local state that only the host writes. A local adjustment can still decide the value the host reads when it creates that state.

## Proposal

### Capability and placement

Add a fourth module, `replay`, to the existing `omp-qol` component at `projects/omp-qol/src/native-replay.ts`, wired by `projects/omp-qol/src/extension.ts` and reported alongside the others. Its switch is `replayEnabled`, default true, under the component's master `enabled`. The component keeps the contract the current decision gives it: one package, one installation, one configuration entry, one set of checks, and per-module switch, availability status, and failure reporting.

### Where it attaches

The module installs one process-wide wrapper over `Map.prototype.set` while it is enabled. The wrapper recognizes the host's own state writes by the key the host uses for an `openai-responses` provider — `openai-responses:<provider>` ([`openai-responses.ts:168`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/providers/openai-responses.ts#L168), [`openai-responses.ts:256`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/providers/openai-responses.ts#L256)) — and by the flag field on the value it is handed. For those calls it sets the flag to true before the host stores the state; every other call, including invalid input, goes to the previous implementation unchanged.

The adjustment changes one field on one object as the host creates it. It does not change a model, a stream option, a request body, or any behavior of the provider call itself.

### Effect

The first request of a new process takes the path the previous process's requests already took, so its head matches the request the previous process ended with and only the items the new turn adds are uncached. The adjustment removes the transition between the two forms; it does not choose what a request contains beyond the item form the host already chooses on every later request.

### Ownership and lifecycle

One wrapper serves the process, and its effect does not depend on which session created the state, so every activation that asks for the module shares the one install.

- The first activation that runs with the module enabled installs the wrapper; a later activation with the same package version and the module enabled keeps it and reports the module as enabled rather than as a second owner, because no window, event, or session id decides what the wrapper rewrites.
- The wrapper stays installed when the installing activation's session ends. States it warmed belong to sessions that may still be running, and later states in the same process would otherwise return to the re-encode form.
- An activation whose effective settings keep the module off, or whose settings could not be read or were rejected, restores the previous `Map.prototype.set` and reports the reason. The component's existing rule that no module runs on values it could not read applies unchanged.
- The module refuses to install, with a reason reported through the log and `/qol`, when `Map.prototype.set` is missing or not writable.
- When the current `Map.prototype.set` is no longer this module's wrapper, the status reports `patch-overwritten` instead of enabled.
- The status also reports how many state writes the wrapper rewrote, so a host change in the key or the value shape shows up as no rewrites instead of as silent success.

### Diagnosis and documentation

`/qol` gains the module's line with its effective switch and rewrite count. `projects/omp-qol/docs/adjustments.md` and its Chinese counterpart gain the module's section with native behavior, why it is needed, where it attaches, settings, side effects and cancellation, applicability and limits, and version and verification. The README pair, the package description, and the settings schema name the fourth module in the same change. The component releases as `0.3.0`.

## Alternatives considered

- **A custom API that delegates to the Responses provider, registered through the extension provider seam.** Considered while looking for a supported way to reach the provider call. `pi.registerProvider` registers a custom API id with a `streamSimple` that can delegate to `streamOpenAIResponses` ([`openai-responses.ts:986`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/providers/openai-responses.ts#L986)), and the dispatcher prefers a registered custom API over its built-in branches ([`stream.ts:1695`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/stream.ts#L1695)). Reaching that delegate requires the session's models to carry the custom API id, which means re-declaring the provider's whole model list or rewriting the registry's model objects, and host code branches on `model.api === "openai-responses"` in several places — tool choice, the `textVerbosity` streaming setting, the image budget, the Responses-family message projection, and the provider-session cleanup after a model switch and after compaction. Those branches would take their other path while the payload still came from the Responses provider, and the cache prefix this adjustment exists to protect depends on exactly those payload fields. Rejected as a change with a wider and less observable blast radius than the field it replaces.
- **Hand the provider no session state, so the `?? true` default selects replay.** Considered together with the delegation route as a way to force the replayed form without touching the flag. It also discards the strict-tools state, the reasoning-effort fallback memory, and the stateful `previous_response_id` baselines the process keeps for a provider, trading the cache property for the transport behaviors those fields provide. Rejected.
- **A new standalone component instead of a module inside `omp-qol`.** Considered while choosing where the adjustment lives. The process-patch discipline a patch of this kind needs — a registry in a global symbol, refusal reasons, status reporting read from the process, settings activation, and the `/qol` line — already exists in `omp-qol`, so a second component would duplicate it and ask users to keep two installations in step. Rejected.
- **Rewriting the outbound prompt body at the transport layer so the first request repeats the previous process's items.** Considered while looking for an adjustment that needs no host state. It makes the extension responsible for provider-native items — encrypted reasoning, item order, response ids — that only the host maintains, and any mismatch sends a body no host code validated. Rejected.
- **Asking the host for a replay-policy switch.** Considered as the durable fix: a request-level or per-session switch would make this adjustment unnecessary. This repository does not modify the host, and the request stands separately as a report to the project. Not adopted here.

## Acceptance criteria

- With the master switch on and `replayEnabled` at its default on OMP 18.2.4, the module reports enabled, and the first request of a resumed process carries the replayed form: verified on a real OMP CLI by comparing the outbound request body with the previous process's last request — the leading items are identical and only the new turn's items follow.
- With `replayEnabled: false` or the master switch off, no wrapper is installed and `Map.prototype.set` is the function the process started with.
- Calls the wrapper does not recognize reach the previous implementation unchanged. Unit tests cover: the recognized key and value shape; other provider state keys (`openai-codex-responses`, `anthropic-messages`, `openai-completions:`) and non-string keys; values that are not provider states; a missing or non-writable `Map.prototype.set`; a wrapper another extension replaced afterwards reported as `patch-overwritten`; a second activation keeping the install and reporting the module as enabled; an activation whose settings disable the module restoring the previous function.
- Component checks pass, and the module's documentation, README, package description, and settings schema land in the same change in both languages. The component version is `0.3.0`.

## Risks

- The wrapper runs on every `Map.prototype.set` call in the process, including code unrelated to the provider. A costly implementation taxes the host everywhere it stores into a map. A two-million-call benchmark of the intended shape measured 150.2 ms with the native function and 154.1 ms with the wrapper for string keys, and no measurable difference for numeric keys; a regression in this path is a process-wide cost, not a provider-local one.
- The host shape the module reads can change without any compile error: another state key, another flag name, or a `Map` subclass with its own `set`. The module then rewrites nothing while still reporting that it is installed, and the user pays the re-encode cost believing the adjustment is active. The reported rewrite count is the only local signal, and it reaches the user only when `/qol` is read.
- Another extension that wraps `Map.prototype.set` after this module changes the function the host calls. Without a comparison before reporting, `/qol` shows an adjustment that no longer runs, and the cache cost stays while the tooling says otherwise.
- Warming the state on the first request makes that request replay items stored by an earlier process. If the endpoint rejects them — expired or account-bound reasoning — the first request pays a failure the re-encode form did not risk, and the module cannot distinguish that case from a healthy replay. The host's replay path falls back and resets its baselines, which bounds the cost to the failed request.
- Two sessions in one process share one wrapper. When a later activation disables the module, states created afterwards return to the re-encode form while states created earlier stay warm, so the process holds a mixed state until it restarts.
