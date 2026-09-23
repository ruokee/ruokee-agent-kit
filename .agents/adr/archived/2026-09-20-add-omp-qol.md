# ADR decision: Add configurable OMP quality-of-life adjustments

Decision owner: Ruokee
Decision writer: OMP GPT-6 Astra
Archived: 2026-09-21
Reversed by: [Add configurable OMP quality-of-life adjustments](../archived/2026-09-21-reuse-a-matching-compaction-patch.md)

English | [中文](./2026-09-20-add-omp-qol.zh.md)

## Motivation

The first-party `omp-qol` component provides independently configurable adjustments that reduce repeated empty waits, recover eligible failed turns within limits, and optionally extend the compaction deadline. A hub `wait` returns an empty window while the background work it watches is still running, so the model must ask again and each empty return costs a turn. A turn that ends with an upstream error stays settled even when the error is transient, because the native retry budget was exhausted or the error fell outside it. A remote compaction request is cut off at a fixed request deadline, and the compaction falls back instead of finishing.

This decision defines the first-party `omp-qol` component, the responsibility split it keeps with the host, and the limits its users accept by enabling each adjustment.

## Analysis

The extensions that can act on these cases sit in a different place from the behavior they adjust. In OMP 18.2.4 at [`1c0303b1f2ec515cbf4b44a9a49d68a029531aac`](https://github.com/can1357/oh-my-pi/tree/1c0303b1f2ec515cbf4b44a9a49d68a029531aac), the wait window comes from a compile-time ladder in the [job manager](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/async/job-manager.ts#L51) that no setting reaches; there is no setting that continues a turn after an error; and the compaction watchdog is a constant inside the [remote compaction](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/agent/src/compaction/openai.ts#L239) and [V2 streaming](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/agent/src/compaction/compaction-v2-streaming.ts#L252) paths. The host does expose the seams an extension can use: re-registering a native tool and delegating through the tool context, the session-stop continuation request, the public error classifier, and the compaction lifecycle events. Source inspection establishes those seams and the missing configuration; it does not establish that an adjustment built on them behaves correctly in a real session.

## Decision

### Component and scope

Add `projects/omp-qol/`, named `@ruokee/omp-qol`, under the [first-party capability boundary](../decision/2026-08-20-establish-first-party-capability-kit.md) and the [self-contained component contract](../decision/2026-08-24-keep-components-self-contained.md). One package carries three independently switchable modules: continuing hub waits, continuation after an eligible model error, and the experimental compaction deadline extension. One installation, one configuration entry, and one set of checks cover all three, while each module keeps its own switch, availability status, and failure reporting.

Configure the component through OMP plugin settings only, following the [native settings decision](../decision/2026-09-10-use-codex-web-plugin-settings.md), with OMP owning values, project overrides, and parsing. Waiting and conservative error recovery are enabled by default; the compaction extension is explicitly opt-in. A module reports its effective state and the reason it is inactive, and a fault in one module does not disable the others. A rejected setting is named by key and rule without echoing its value.

Keep the component limited to these behavior adjustments. External tool guards, including Herdr guards, and unrelated host behavior stay outside it. Installation and migration remain with the user: the component does not modify existing extensions, user configuration, or installed host files.

### Host responsibilities

Job and process ownership, message consumption, result delivery, approval classes, conversation history, and the compaction protocol stay with OMP.

The wait module re-registers the native tool, delegates every call to it, and repeats a call only while the returned result is certain to carry nothing new. A deadline ends the wait and nothing else: background jobs and processes keep running, a delivered message or settled job result is returned as it is, and a user cancellation keeps its own reason. The module adds no operation to the tool, forwards the native approval class and the interruptibility the native tool declares, and claims no ownership of results it did not receive.

The recovery module uses the native session-stop continuation request. Fixed safety exclusions take precedence over configuration, so no setting turns them into a continuation. They cover cancellations, refusals, authentication and quota outcomes, context overflow, and deterministic failures. Continuations are bounded both by the module and by the host's own cap, each requested continuation is reported with its attempt and delay, and the module does not claim that a re-run is idempotent or that a completed tool call is not repeated. The continuation body is fixed text that carries no provider error body.

### Compaction experiment and its replacement

Offer the compaction deadline extension as a default-off experiment: a bounded, process-wide timeout adjustment installed through a global registry, preserving the native compaction protocol, history replacement, retries, and fallback.

Enabling it accepts its boundary. Within a compaction window, a matching timeout call made by unrelated work in the same process is lengthened as well, so the mechanism provides neither request isolation nor strict project isolation. It can only lengthen a deadline and never shorten one. Ambiguous ownership stops the adjustment for that process and reports why, instead of sharing or overriding. It covers an overlapping window, a window from another session, an event order that cannot be interpreted, and an owner already registered in the process. Disabling it restores the native function when the current value is still this component's, and reports when it is not.

When OMP provides a supported request-level timeout setting or hook, use that interface and retire the global mechanism. Two owners of the same deadline policy are not kept.

### Documentation and version evidence

Document each adjustment in the component's own `docs/` in English and Chinese, linked from both README files: the native behavior and what happens with the extension off, why the adjustment is needed and which native configuration or hook was checked, where it attaches and how configuration changes it, its side effects, cancellation, and failure behavior, the upstream change that would make it unnecessary, the source baseline with the OMP version and commit, the versions actually verified for automated checks and for real OMP CLI runs, and the applicability limits.

Verified claims stay separate per adjustment. A package-wide peer range is metadata about the host API and is not verification of any adjustment, and reading the source is not a run. Items without a real-session run are documented as unverified.

## Alternatives considered

- **Separate extension packages per adjustment.** Considered while assessing packaging. Independent releases and independent failures are the gain; configuration, compatibility, migration, and checks spread across three installations are the cost, and the three adjustments share one host baseline. One package keeps those entry points together.
- **A dedicated configuration file with its own parser.** Considered while choosing a configuration source. The required settings fit OMP plugin settings, so a separate parser, precedence rule, and update path would add maintenance without a capability the adjustment needs.
- **Replacement of the native compaction flow.** Considered while judging how much control the deadline needs. It gives direct control over the request options, but transfers the compaction protocol, history replacement, retry, and fallback paths to this component, including the paths that produce the summaries the session depends on.
- **Deferral of the compaction adjustment until OMP exposes a request-level interface.** Considered while assessing isolation. It avoids process-wide effects and keeps maintenance small, but leaves the fixed deadline in place; the decision instead makes the bounded global mechanism an explicit, disabled experiment with the replacement condition above.
- **Only documenting the three limitations without an extension.** Considered before proposing a component. It adds no code and no compatibility surface, but leaves each case to repeated user or model intervention, which is what the adjustments exist to reduce.

## Consequences

- One component shares a release, a lockfile, and one check entry point across three adjustments. A host change that breaks one module also stops the component from being installed as a whole, and a single dependency upgrade affects all three.
- Automated checks cannot establish host behavior. Each adjustment needs its own real-session evidence, and the compaction experiment's benefit stays unproven until a remote compaction longer than the native deadline completes with usable model requests afterwards.
- The adjustments depend on host details that carry no compatibility promise: the builtin tool description and the shape of an empty window, `stopReason: "error"` together with the public classifier, the identity of `AbortSignal.timeout`, and the order of compaction lifecycle events. Each module is written to stay inactive and say why rather than to guess, so a host upgrade can disable an adjustment without breaking the session, and the adjustment is trusted again only after a re-check.
- Continuations re-send the conversation and spend provider quota, and a re-run turn can repeat a side effect from the failed turn. Bounded attempts, the fixed exclusion list, and the host cap reduce exposure without promising exactly-once behavior.
- A wait deadline leaves work running that the model may no longer be watching. The result states that the deadline passed, and checking again is the model's next step.
- The compaction experiment lengthens matching deadlines of unrelated work in the same process while a window is open, and the window's opening events do not name the request that will be timed. Cleanup cannot shorten a deadline that already exists, and one process hosts one wrapper.
- Documentation is maintained against a fixed host baseline, so a host upgrade requires re-reading the cited source and updating the affected sections rather than widening the declared peer range.
