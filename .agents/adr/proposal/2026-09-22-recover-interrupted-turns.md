# ADR proposal: Extend the recovery module to interrupted turns

Draft owner: Ruokee
Draft writer: deepseek/deepseek-v4.1-flash

English | [中文](./2026-09-22-recover-interrupted-turns.zh.md)

## Motivation

The recovery module in `projects/omp-qol` continues a main-agent turn that ended with an eligible model error: it registers a `session_stop` handler, classifies the final assistant error with the host classifier, and requests one continuation turn when the configured scope accepts that error. Its default scope, `knownTransient`, accepts the `Transient` and `Timeout` marks the host sets.

A transport interruption of the class the module exists for carries neither mark. On 2026-09-22 a session on the `pro-20x` relay ended a turn with `1012: websocket closed before terminal event (code 1012)`. The host recorded `errorId: 0`, no `errorStatus`, and `stopDetails: { type: "stream_interrupted_after_content" }`. Measured against the installed `@oh-my-pi/pi-ai` 18.2.4, that text classifies as `0`: the classifier's stream-drop vocabulary lists several phrasings and no websocket closure, and the websocket retry vocabulary lives inside the provider and is not exported. The same condition keeps the host's own layers away from the failure: `AIError.retriable(0)` is false, and the `prematureClose`, `streamStall`, and `transportReset` branches of turn recovery all require a retriable id. The turn stays stopped until a person writes another message.

`stopDetails.type: "stream_interrupted_after_content"` is the host's own mark for this class. The agent loop drops a tool call that never reached `toolcall_end` when the provider stream fails, and labels the message with the mark. Recorded sessions show the mark on a small minority of assistant errors, so it identifies an interruption rather than every error.

Two structural signals are therefore available and unused: the host's interruption mark, and an error that carries neither an HTTP status nor any classifier verdict. Both keep the module's existing rule that the host owns error wording and the extension matches no error text.

## Proposal

### Added eligibility

In the default `knownTransient` scope, after the fixed safety exclusions and the terminal-client-status rule, accept an error when either condition holds:

- `stream-interrupted`: the final assistant error carries `stopDetails.type === "stream_interrupted_after_content"`.
- `statusless-unclassified`: the error carries no HTTP status, meaning `errorStatus` is absent and the classifier parses no status from the message, and no classification, meaning the classifier returns `0` or a value outside the class mask.

The fixed exclusions keep precedence, so a refusal, a quota outcome, a cancellation, or another excluded kind stays native even when it also carries the interruption mark. The terminal-client-status rule keeps a 4xx without transient wording native, including a 4xx that interrupted a tool call.

The `unclassified` scope keeps its current, wider acceptance: every error with no classification, with or without a status. The two cases extend the default scope and change neither scope's definition.

The module reports the accepted case with a bounded reason code and continues to carry no provider text: `stream-interrupted` and `statusless-unclassified` join the existing codes, and `recoveryNotify` prints its usual attempt and delay line.

### Settings and behavior

No new setting. `recoveryEnabled`, `recoveryMode`, the attempt and backoff keys, and the fixed continuation body keep their current meaning, and the chain rules are unchanged: an event with `stop_hook_active === false` starts a fresh chain, a repeated event for the same turn inside one agent run is ignored, and the module and the host each keep their own cap.

### Documentation and version evidence

State the two cases, their exact conditions, the reason codes, the source baseline, and the fact that the module reads no error text in `docs/adjustments.md`, `docs/adjustments.zh.md`, and the recovery row of both READMEs. Keep the real-session item documented as unverified.

Move the package version from `0.2.0` to `0.3.0`: new eligibility is a capability change.

Record the decision. The current decision [Add configurable OMP quality-of-life adjustments](../decision/2026-09-21-reuse-a-matching-compaction-patch.md) states in its consequences that the adjustments depend on host details with no compatibility promise, naming `stopReason: "error"` together with the public classifier, and its recovery paragraph fixes the exclusions, the bounded continuation, and the fixed body. The added bases extend that stated dependency, so implementation replaces the decision with a complete new decision that carries its still-effective rules and reverses it, as the earlier omp-qol change did.

### Verification plan

- Extend the classification matrix in `test/recovery.test.ts` using the installed classifier: the interruption mark alone, the statusless unclassified case, the mark combined with an excluded flag, the mark combined with a terminal 4xx, a status-carrying unclassified error that must stay native in the default scope, unchanged acceptance in `unclassified`, an unmutated message object, and the reported reason codes.
- Run `bun test` and `tsc --noEmit` in the component, and the root `pnpm check` before review.
- Leave the real-session item unverified as it is today. The interruption comes from a relay restart and cannot be produced on demand, and a unit test that calls the handler is not evidence that a real turn recovers.

## Alternatives considered

1. Accept only the host interruption mark. It is the most precise signal, and it leaves the statusless interruption uncovered whenever no tool call was in flight when the stream died.
2. Accept only the statusless unclassified case. It covers the whole class without depending on the mark, and it leaves the mark unused, so an interruption that also carries a status, such as a 500 while a tool call streams, stays native.
3. Match the interruption wording in the extension. Rejected: it puts provider phrasing into the component, contradicts the rule that the classifier owns error wording, and needs maintenance for every relay that words a closed socket differently.
4. Ship configuration only, by telling users to set `recoveryMode` to `unclassified`. Rejected as the deliverable: that scope also accepts errors carrying an HTTP status and no verdict, so it widens further than the interruption class and turns a deliberate default into a per-user workaround.
5. Extend the host's own stream-drop vocabulary upstream. Considered and left out: the host is another project, a fix would wait for a release, and a statusless error offers no phrasing to match.

## Acceptance criteria

- In the default scope, an error carrying `stopDetails.type === "stream_interrupted_after_content"` is accepted with the reason `stream-interrupted`, and an error with no status and no classification is accepted with the reason `statusless-unclassified`.
- Fixed exclusions and the terminal-client-status rule still win for an error that carries a new signal as well.
- An unclassified error that carries an HTTP status stays native in the default scope, and `unclassified` keeps its current acceptance.
- The module reads no error text: both new conditions come from the host message structure and the host classifier, and the classified copy leaves the host message untouched.
- `docs/adjustments.md`, `docs/adjustments.zh.md`, and both READMEs state the new cases and conditions, and the component version is `0.3.0`.
- The component checks and the root `pnpm check` pass, and the real-session item remains documented as unverified.

## Risks

- A statusless, unclassified error can be a deterministic client-side failure the classifier does not recognize. Continuing then spends another turn and can repeat a tool call whose side effects already happened.
- A provider fault that repeats on every turn now runs up to the bounded continuation count instead of stopping at the first failure, which delays the user seeing that the provider is broken.
- Both new conditions are host details without a compatibility promise. A host release that stops writing `stopDetails.type` silently narrows the scope back, and one that writes the mark for benign failures widens it, and the component reports neither change.
- The default scope widens for existing installations without a settings change, so a session that previously stopped after such an interruption now spends extra turns and quota.
