# OMP QoL

Decision owner: Ruokee
Decision writer: OMP
Reverses: [OMP QoL](../../../archived/2026/09/20-r8-omp-qol.md)
Archived: 2026-10-22
Reversed by: [OMP QoL](./20-r10-omp-qol.md)

English | [中文](./20-r9-omp-qol.zh.md)

## Motivation

Maintain `@ruokee/omp-qol` with its independently switchable adjustments. Remote cache alignment belongs to the independent smart-cache component; wait continues to serve the standalone `wait` entry only.

The original four adjustments are: a `wait` that keeps waiting to a total deadline, a bounded continuation after an eligible model error, an opt-in extension of the remote compaction deadline, and a process-wide wrapper that keeps a resumed process's first request in the provider's native history form. A native `wait` returns when its window ends while the background work it watches is still running, so the model must ask again and each such return costs a turn. A turn that ends with an upstream error stays settled even when the error is transient, because the native retry budget was exhausted or the error fell outside it. A remote compaction request is cut off at a fixed request deadline, and the compaction falls back instead of finishing. A resumed process otherwise re-encodes the history it replays, and the wrapper keeps that first request in the native replay form. Each adjustment selects the implementation a given host needs.

The wait module used to serve two builtin entries: the `hub` tool and the standalone `wait` tool. Under [maintaining host components against a shared OMP floor](../../../decision/2026/09/28-host-maintenance.md), the OMP-facing components share the maintenance lower bound OMP 18.5.0, so no maintained host still offers `hub`, and the `hub` path is removed.

## Analysis

The extensions that can act on these cases sit in a different place from the behavior they adjust. In OMP 18.5.0, one native [`wait`](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/tools/wait.ts) call returns when its window ends, capped at 30 minutes, and no setting reaches that window. No setting continues a turn after an error, and the compaction watchdog is a constant inside the remote compaction and V2 streaming paths. The host does expose the seams an extension can use: re-registering a native tool and delegating through the tool context, the session-stop continuation request, the public error classifier, and the compaction lifecycle events. Source inspection establishes those seams and the missing configuration; it does not establish that an adjustment built on them behaves correctly in a real session.

A process-wide compaction patch adds a question about ownership: what happens when another session starts inside a process that already installed one. OMP binds the loaded extensions for every session it creates and calls their factory again, either on the module path or on a prepared factory rebound to the new session, so a subagent session reaches the compaction module's conflict path in a running process. The clause that stops the adjustment whenever an owner is already registered was written for owners that differ in what the patch should do, such as a window from another session or a settings snapshot that no longer applies. A second activation that carries the same package version and the same effective settings does not differ in that way. Under the clause as written, the first subagent session stopped the process patch for the rest of the process's life: settings and status said the experiment was on while the process kept the native five-minute deadline, and no configuration had changed. The same clause left no settled state after the installing session ended, so a later session could not tell a released patch from an installed one it may not drive.

The recovery case also covers failures the marks miss. A transport interruption that ends a turn while a tool call is still streaming is recorded by the host as `stopDetails.type: "stream_interrupted_after_content"` instead of a classified error, and one observed relay response ended a turn with `1012: websocket closed before terminal event (code 1012)`, which the installed `@oh-my-pi/pi-ai` classified as `0`. The host's own salvage branches for a stream that closed early, stalled, or reset all require a retriable id, so that error stays outside them as well.

This decision defines the first-party `omp-qol` component, the responsibility split it keeps with the host, and the limits its users accept by enabling each adjustment.

## Decision

One package, `@ruokee/omp-qol`, carries independently switchable modules under the [first-party capability boundary](../../../decision/2026/08/20-first-party-capabilities.md) and the [self-contained component contract](../../../decision/2026/08/24-component-self-containment.md): one installation, one configuration entry, and one set of checks, while each module keeps its own switch, availability status, and failure reporting. Configuration stays in OMP plugin settings, with OMP owning values, project overrides, and parsing.

Continuing waits, conservative error recovery, and native history replay are on by default; the compaction deadline and model prompt adjustments are opt-in, and a fault in one module does not disable the others. The component stays limited to these behavior adjustments, and installation and migration remain with the user.

The compaction deadline is a default-off experiment with a bounded, process-wide timeout adjustment. Enabling it accepts its boundary: a matching timeout call from unrelated work in the same process is lengthened as well, so it provides neither request isolation nor strict project isolation. The component README compatibility section declares the maintenance lower bound as that bound's authoritative statement, with no maintenance upper bound, and [smart-cache owns remote alignment](../10/10-r2-remote-alignment.md).

The module mechanics, setting keys, defaults, ranges, status reporting, eligibility rules, ownership and release rules, and per-adjustment evidence live in the [component README](../../../../../projects/omp-qol/README.md), the [component specification](../../../../spec/omp-qol.md), and the component's own `docs/`.

Each adjustment needs its own real-session evidence. Validation of the compaction experiment requires a remote compaction longer than the native deadline to complete with usable model requests afterwards. On host upgrades, re-read the cited source and update the affected documentation; changing the declared maintenance bound does not replace those steps.

## Alternatives considered

- **Separate extension packages per adjustment.** Independent releases and independent failures are the gain; configuration, compatibility, migration, and checks spread across one installation per adjustment are the cost, and the adjustments share one host baseline. One package keeps those entry points together.
- **Replacement of the native compaction flow.** It gives direct control over the request options, but transfers the compaction protocol, history replacement, retry, and fallback paths to this component, including the paths that produce the summaries the session depends on.
- **Deferral of the compaction adjustment until OMP exposes a request-level interface.** It avoids process-wide effects and keeps maintenance small, but leaves the fixed deadline in place; this decision instead keeps the bounded global mechanism as an explicit, disabled experiment and compares a native interface against it when a host provides one.
- **Let the next matching activation install a patch after the owner exits.** The process would regain the adjustment without a restart, and the new patch would be owned by an activation that is still alive. It would also make whether the process currently has the adjustment depend on whether another activation shows up later, and the status would have no settled state to report after the owner exits.

## Consequences

- Process-wide wrappers can interact with another extension's wrappers. Identity checks and ownership-conditional restoration avoid overwriting another extension but can leave this adjustment inactive until restart.

- One component shares a release, a lockfile, and one check entry point across its adjustments. A host change that breaks one module also stops the component from being installed as a whole, and a single dependency upgrade affects all of them.
- The adjustments depend on host details that carry no compatibility promise: the builtin tool description and the shape of an empty window, `stopReason: "error"` together with the public classifier and the `stopDetails.type` mark it writes for an interrupted turn, the identity of `AbortSignal.timeout`, and the order of compaction lifecycle events. The mark is compared by value and the statusless condition reads an absent field, so a host release that stops writing the mark, or starts carrying a status, silently narrows the accepted set instead of failing. Each module is written to stay inactive and say why rather than to guess, so a host upgrade can disable an adjustment without breaking the session, and the adjustment is trusted again only after a re-check.
- Continuations re-send the conversation and spend provider quota, and a re-run turn can repeat a side effect from the failed turn. Bounded attempts, the fixed exclusion list, and the host cap reduce exposure without promising exactly-once behavior.
- The widened default applies without a settings change, so a session that previously stopped after a statusless interruption now spends up to the bounded continuation count on it. A client-side failure the classifier does not recognize is continued under that same condition, and a provider fault that repeats every turn reaches the user later than before, once the continuation count is spent.
- A wait deadline leaves work running that the model may no longer be watching. The result states that the deadline passed, and checking again is the model's next step.
- The compaction experiment lengthens matching deadlines of unrelated work in the same process while a window is open, and the window's opening events do not name the request that will be timed. Cleanup cannot shorten a deadline that already exists, and one process hosts one wrapper.
- A session that keeps the patch does not drive the window and gains no guarantee that its own compaction is extended. The status line and the documentation are the only places that say so, so a missing or cached status would read as a fully served session.
- The effective settings snapshot is the only gate between an installed patch and a session that did not install it. A field added to the effective configuration without being added to that comparison widens reuse silently, and a session can be kept under a configuration it never chose.
- After the installing activation exits, the process extends no compaction deadline until it restarts, and the status keeps reporting the released patch. That is the chosen terminal state: releasing the patch without letting a later activation install one costs the adjustment for the rest of that process's life.
- On a host that still offers the builtin `hub` tool, which is below the maintenance lower bound, the total-deadline wait no longer applies. The module finds no standalone `wait` entry there and leaves native behavior in place with its bounded reason.
