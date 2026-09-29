# ADR proposal: Extend the omp-qol wait adjustment to the host's current wait tool

Draft owner: Ruokee
Draft writer: OMP DeepSeek V4.1 Flash

English | [中文](./2026-09-29-extend-qol-wait-to-host-wait-tool.zh.md)

## Motivation

This proposal asks the maintainer to approve the contract that binds the wait adjustment of `omp-qol` to the host's built-in `wait` tool.

The wait adjustment of [projects/omp-qol](../../../projects/omp-qol/README.md) gives one wait call a configured total deadline and keeps that call alive while the native window carries nothing new. It attaches to the built-in `hub` tool. Host releases in the current upgrade target no longer provide that tool, so the adjustment stays inactive there and users lose both the configured deadline and the empty-window merging, while the same extension keeps providing them on hosts that still have `hub`.

That host does provide a wait tool, but binding the adjustment to it needs a contract of its own: the new tool takes no arguments, does not offer the routes the component's settings describe, and exposes no configuration. The contract states which entry the wrapper binds to, what one added parameter means, and which configured behaviour applies there and which does not.

## Analysis

The target host's wait tool takes no arguments and caps one call at a fixed ceiling; a call ends when a watched job settles, a peer message arrives, the user steers or interrupts, or the ceiling is reached ([wait tool source](https://github.com/can1357/oh-my-pi/blob/v18.4.3/packages/coding-agent/src/tools/wait.ts)). A snapshot of the session's own running jobs carries them in a non-empty `details.jobs` collection, so a call that still watches such a job is distinguishable from the other outcomes.

The remaining outcomes share one shape. An empty `jobs` collection with the same marker covers both "nothing to wait for" and an exhausted message window, and a completed service and the ceiling report the same empty collection with different text. A job snapshot is therefore a usable continuation signal while a message or service frame is not, and separating the latter would need matching host text, which this component does not do.

The target host exposes process control through internal URLs, including status, stdin, mode, and kill, but no named-process wait operation ([proc protocol](https://github.com/can1357/oh-my-pi/blob/v18.4.3/packages/coding-agent/src/internal-urls/proc-protocol.ts)). The configured named-process deadline has no entry on that host.

## Proposal

### Selecting the entry by capability

The module keeps re-registering the host's wait tool under that tool's own name and delegating every call through the extension API. It selects the entry from what the session exposes, never from a host version: a session that exposes a built-in `hub` takes the existing path unchanged, and a session that exposes no `hub` and a built-in `wait` takes the new path. Where neither exists, or the candidate entry was already replaced by another extension, or its parameter shape does not match the checked contract, the module leaves the host's behaviour in place, reports one bounded reason through its existing diagnostic channel, and does not claim the adjustment.

### One added parameter on the new path

On the new path the tool keeps its name and gains one optional numeric `timeout` in seconds, meaning the total deadline of that call. Its accepted range is the one the component already documents for its deadline settings: a finite number greater than 0 and at most 3600. No operation, selector, or non-existent argument is added. A delegated call carries only the arguments the native schema declares; the outer parameter is never forwarded.

### Deadline source and configuration applicability

`waitJobsSeconds` is the default deadline of a job or mixed wait on both paths, and an explicit `timeout` overrides it. `waitMessagesSeconds` and `waitProcessSeconds` keep their meaning on the `hub` path and have no equivalent on the new path, because that entry offers neither a message-route selector nor a named-process wait. `waitEnabled` and `waitContinueEmptyWindows` keep their meaning on both paths, and switching the adjustment off leaves the host's own behaviour in both cases.

The component states this per entry in `/qol` and in its own documentation, instead of showing a configured value that nothing reads.

### Continuing a call, and ending one

A call is repeated only while the returned frame is certain to carry nothing new: a set of watched jobs that are all still running, with no result, message, error, cancellation, or interrupt in the frame. Such a snapshot is not an outcome: it enters the next native window while the total deadline still allows one, including a window that ended at the host's own ceiling.

What the host itself delivers keeps the host's semantics. A real result, a delivered message, an error, and a user interrupt or caller cancellation return with their own reason, and a cancellation is never reported as the component's deadline.

Only the component's own total deadline is the component's to report. When it arrives, the wrapper stops the in-flight native window and returns a bounded deadline result of its own: the last certain window when it saw one, plus a note naming the elapsed deadline and a route that exists on the host in use, or that note alone when it saw none. A result the stopped window still delivers is returned unchanged, so the deadline never replaces information the host produced. The deadline ends that call and nothing else: background jobs and processes keep running.

### Capability the new path does not provide

Continuing a message-only window inside one call, routing `waitMessagesSeconds`, filling `waitProcessSeconds` for a named-process wait, and merging a service-only wait across the native ceiling stay unsupported on the new path. Each is reported as unsupported rather than as an enabled or inactive adjustment, and none is emulated by a status-polling loop or by host-text classification.

### Compatibility boundary

The compatibility object is the extension, not the host. The component does not ask the host to grow a configurable ceiling or a route selector, does not carry the new tool or its parameters back to hosts that lack it, and raises no maintenance bound. Older hosts keep the existing implementation and its full configuration.

### Relationship to the current decisions

No clause of [Maintain the OMP quality-of-life adjustments across OMP host upgrades](../decision/2026-09-28-maintain-omp-qol.md) conflicts with this contract. That decision states that the wait module re-registers the native tool, delegates every call, repeats a call only while the result is certain to carry nothing new, adds no operation, forwards the host's approval class and interruptibility, and claims no ownership of results it did not receive. None of that changes here: a parameter is not an operation, and the entry that carries the adjustment is chosen from the session rather than fixed by the decision. The only text in that decision that names the older entry is descriptive, in its motivation and in the module's name within the scope sentence; the durable clauses are entry-agnostic.

An accepted proposal is therefore recorded as new content in that decision under `## Changes`, together with the component's README, its adjustment documentation, its status output, and its checks. [Adapt first-party host components to host upgrades](../decision/2026-09-28-adapt-components-to-host-upgrades.md) governs the adaptation and needs no change.

## Alternatives considered

**Leave the ceiling to the host.** Considered while deciding whether to reach a total deadline above the host's per-call ceiling. Delegating every call without an outer deadline, or retiring the adjustment and letting the model re-issue the native call, needs no added parameter and no continuation rule, but the configured deadline and the empty-window merging stay unavailable on that host, and every ceiling costs another model call to continue.

**Copy or rebuild the host's wait tool, or reach its job and message channels directly.** Considered while judging how much of the wait the component may own. It would cover the message and service routes, but it transfers job, message, and result ownership to the component, which the current decision keeps with the host.

**Judge continuation by the generic empty-frame marker the host writes.** Considered while looking for a continuation signal. The marker also covers a message window, a call with nothing to wait for, and some interrupts, so a wrapper using it would consume a collaboration prompt or a completed service wait instead of returning it.

**Select the entry by comparing host versions.** Considered while choosing how to pick the entry. A version comparison rejects hosts that expose the required capability, and it needs maintenance for every release; the governing upgrade decision already keeps version ranges out of eligibility.

## Acceptance criteria

1. A session that exposes the built-in `hub` entry behaves as it does today: same settings, same routing, same continuation, same deadline result.
2. A session that exposes the built-in `wait` entry and no `hub` gets the wait tool registered by the extension, its model-visible definition carries the optional `timeout` in seconds, and a delegated call carries only the arguments the native schema declares.
3. A call with no `timeout` uses the `waitJobsSeconds` default, a call with a `timeout` inside the accepted range uses that value, and a value outside the range is a parameter error rather than a silent clamp.
4. A real result, a delivered message, an error, and a user interrupt or caller cancellation keep the host's own reason and are never reported as the component's deadline; a snapshot of jobs that are all still running enters the next native window while the total deadline allows one, including a window that ended at the host's own ceiling.
5. A reached total deadline returns the wrapper's own bounded deadline result, carrying the last certain window when one was seen and the deadline note alone otherwise, naming the elapsed deadline and a route that exists on that host; it ends only that call, and a result the stopped window still delivers is returned unchanged.
6. `/qol` and the component documentation name the entry in use and state which configured keys do not apply to it; an unsupported sub-feature reads as unsupported and never as enabled.
7. The entry is selected from what the session exposes. No host version is read to decide eligibility, activation, behaviour, or diagnostics, and a foreign or unrecognized entry leaves the host's behaviour in place with one bounded reason.
8. In a real host session, the delivered tool definitions carry the added parameter, a job that outlives one native call returns through a single outer call, a cancellation is distinguishable from a reached deadline, and a host result delivered around the deadline is returned unchanged.
9. The component version, the bilingual documentation, and the checks move with the accepted change.

## Risks

- The continuation rule stays narrower than what the host reports. A host release that changes the job detail shape, or reports a case this component does not recognize, ends calls early: the user keeps seeing wait calls that the configured deadline should have merged, while the tool still registers and the adjustment still reads as enabled.
- Two entries kept in one module can drift. A later change to the continuation rule, the deadline result, or the approval forwarding applied on one path and not the other gives two maintained hosts different behaviour with no error.
