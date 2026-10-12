# ADR proposal: Restructure the smart-cache contract and add Handoff cache alignment

Draft owner: Ruokee
Draft writer: OMP

English | [中文](./2026-10-12-restructure-smart-cache-contract.zh.md)

## Motivation

Reverse the remote decision for `@ruokee/omp-smart-cache` so the top-level decision records the extension itself, give remote alignment and Handoff cache alignment one decision each, and move the project Spec to the same framework.

The package aims to avoid unexpected cache misses in OMP requests while the ordinary and native request paths stay unchanged, which is how the [component README](../../../projects/omp-smart-cache/README.md) describes it. The contract layer describes something narrower. The [remote decision](../decision/2026-10-10-use-smart-cache-remote.md) takes remote alignment as its subject, and the [project Spec](../../spec/omp-smart-cache.md) states in four places that Handoff is outside this contract.

Handoff writes the compaction summary or the handoff document from the live conversation. It sends that work as a side request that repeats the session's system prompt and tool definitions, although the ordinary main-loop dispatch already sent them. A Provider caches a request prefix, so a side request that rebuilds the system prompt differently, drops the online reasoning setting, or replaces the online tool choice pays full input price for content the conversation already paid for. A local trial extension aligned these side requests and, in one observed pair of real requests, reduced uncached input on the generation call from 14,388 to 470 tokens, a hit rate from 34.42% to 97.94%. That extension is a single-session experiment outside the repository: one reference per process, no settings, and no per-session isolation.

Carrying that capability makes the component an extension with two optimizations, each with its own switch and own state, which the current contract texts cannot record. Their subject is a single capability, and the ADR rules do not allow rewriting a current decision to express a conflicting choice. This proposal reverses that decision, drafts the three decisions that replace it, and states the Spec correction that follows.

## Analysis

### The clauses that conflict

The [remote decision](../decision/2026-10-10-use-smart-cache-remote.md) is scoped to remote alignment by its title and its opening sentence. Its motivation records that the migration neither approves Handoff integration nor replaces the installed Handoff prototype, and its closing section places Handoff protocol, support, status, benefit evidence, and installation in separate work.

The [project Spec](../../spec/omp-smart-cache.md) repeats the exclusion in four places: the goal states that Handoff is outside this contract, the non-goals exclude integrating Handoff, the public-surface section places Handoff placeholders out of this contract, and invariant 12 states that the package stays independent of the Handoff prototype.

Those statements were written as the scope of one change rather than as a permanent prohibition, which the remote decision itself records. Carrying a second capability does not contradict them by itself. What conflicts is the top-level question. With remote alignment as the subject of the current decision, the component-level clauses have no home, and a Handoff decision beside it would leave the Spec's framework, goal, and invariant 12 describing a component narrower than its current behavior.

### Why the conflict needs a reversal

An `## Changes` section records content that does not conflict with a current decision. It cannot change that decision's subject, and it cannot retire the clauses that place Handoff elsewhere, because a reader of the current decision would still find remote alignment as the decision and Handoff as work handled separately. The rules require a proposal that names each decision to reverse, the effective clause, the proposed choice, and why both cannot hold. This is that proposal, and the archived decision's still-effective clauses move into the three current decisions rather than disappearing.

### Inbound links to the moved decision

The remote decision pair moves to `archived/` under its existing filenames, so its inbound links need repair in the same change: the [archived model-prompt decision](../archived/2026-10-07-maintain-qol-model-prompts.md) names it in the `Reversed by` field, the [shared host floor decision](../decision/2026-10-04-raise-omp-host-floor.md) cites it for smart-cache's behavior and protocol boundaries, the [OMP experience decision](../decision/2026-10-10-maintain-omp-experience-extension.md) cites it for the remote cutover, and the [host compatibility Spec](../../spec/host-compatibility.md) lists it among related decisions. Each link and relationship field points to the current decision that owns the referenced contract, because current documentation must not cite an archived decision as current authority.

### Two host facts that shape the Handoff capability

A handoff side request is built by the host from the session's own history and a base system prompt. No public interface identifies a request as a handoff request, marks the ordinary dispatch that should serve as its reference, or exposes the prepared side request before sending. An extension can only observe the session's request-preparation and sending seams and reconstruct which call belongs to which operation from the signals those seams carry.

The remote capability already wraps the session's streaming entry point with an ownership check, so that it restores only the functions it still owns. A second independent wrapper on that method makes the first wrapper's ownership check fail, so remote alignment stops with a reported reason instead of ending without a signal. Handoff alignment therefore cannot ship as a second wrapper or as a separate extension beside remote. The two capabilities share one wrapper per native method and dispatch by capability.

### Evidence boundary of the trial

The trial verified the three seams and the recognition set on real requests. In probe runs whose HTTP responses were local simulations, it also verified that a stateful context projection and a user-initiated thinking change are refused rather than overwritten; no model received those requests. It did not verify automatic or speculative compaction, cancellation and retry, model and tool switching, multimodal input, or subagents. Its benefit number comes from one pair of requests, and shared server-side caching prevents separating the contribution of each restored field. A correctly aligned request can still miss the Provider cache.

## Proposal

### The extension decision

Record `@ruokee/omp-smart-cache` as an extension that aims to avoid unexpected cache misses in OMP requests while ordinary and native request paths stay unchanged, with one `omp.extensions` entry and one native settings source. The decision carries the component-level clauses that remain valid: it imports no other component's runtime or settings reader, it holds first-party capabilities only, its OMP maintenance floor moves only through a shared decision for all OMP-facing components, and `/smart-cache` is the status command of the package.

It also records the capability model: each optimization has its own decision, switch, and state; the capabilities share the package, the process coordinator, and one wrapper per native method; they dispatch by capability and never share rules, payload shapes, reason codes, or benefit evidence; and a refusal or a missing interface in one capability leaves the other working.

The extension decision is `2026-10-12-maintain-smart-cache-extension` and carries `Reverses` pointing to the archived decision.

### The remote decision

The remote decision carries the archived decision's still-effective clauses: smart-cache owns remote alignment, with its Responses V2 protocol rules, its Provider requirement, its boundaries, its public promises, its alternatives, and its consequences. The meaning and the observable promises do not change. The decision records the choice rather than the component's implementation specification, and the component documentation keeps the settings and command reference.

The archived decision also reverses the [model-prompt decision](../archived/2026-10-07-maintain-qol-model-prompts.md), and that relationship moves with the clause it belongs to: the new remote decision carries `Reverses` pointing to the archived model-prompt decision, whose `Reversed by` field points back to it.

It is `2026-10-12-provide-remote-alignment`.

### The Handoff decision

Handoff cache alignment becomes the second capability of the same package, with the same `omp.extensions` entry and the same native settings source. It needs no separate installation, package, or settings reader.

Its public switch is one native setting, `handoffCacheEnabled`, boolean, default `false`. It enables this capability alone; remote keeps `compactionCacheEnabled`, `compactionCacheProvider`, and `compactionCacheMode` unchanged. A disabled or absent switch leaves every request native. No Provider whitelist, mode, or second configuration source is added, and the switch is read in the same activation snapshot as the remote settings and needs a restart.

Applicability follows the session's API rather than a Provider list: a session whose model API is `openai-completions` is a Handoff candidate, one whose API is `openai-responses` stays with remote, and any other API uses neither. At most one capability takes a given request.

The capability aligns a handoff side request with the ordinary request that was already sent: the online system segments, the online `reasoning_effort`, and the online `tool_choice` when the reference has no explicit choice. It applies only when the side request extends the reference's non-system history, the side system is a prefix of the reference system, and the reference still belongs to the same session, model, API, prompt, thinking state, and tool set. Within that boundary it replaces the request body once, after the host's own payload hooks, and leaves the side instruction, the new history, the cache keys, the cancellation signal, and every other option untouched. A projection that cannot be restored is skipped and counted instead of abandoning the request.

Only an ordinary main-loop dispatch supplies a reference, and only after its HTTP response confirms the send. The calls this capability aligns never become a reference, and a reference is immutable for the operation it belongs to, so newer online work, an authentication refresh, or a transport retry cannot move it. Each session keeps its own reference, and navigation, compaction commits, and session release clear it and invalidate that session's epoch.

Out of boundary, the request is sent unchanged with a fixed reason: an invalidated operation, an unconfirmed reference, a reference whose session, model, API, prompt, thinking state, or tool set changed, or a changed system prefix or history projection. `rejected` means this capability did not rewrite the request; it never means the request was blocked, delayed, or dropped.

The capability shares the package, the coordinator, the per-session registration, and the wrapper of each native method with remote, and shares nothing else. `/smart-cache` stays one command and reports both capabilities in their own sections, each with its own state, staged reasons, and counters; the remote section keeps its current wording and fields. The local trial extension stays installed only until this capability passes its own acceptance and an installation authorization follows, which replaces and disables it; while the trial extension is still auto-discovered, the package reports a conservative wrapper conflict instead of seizing a wrapper, and the cutover happens by restart.

It is `2026-10-12-provide-handoff-alignment`.

### Archived decision and inbound links

The remote decision pair moves to `archived/` with its filenames unchanged and gains `Archived` and `Reversed by` pointing to the extension decision. The same change repairs every link the move touches: inbound links and relationship fields elsewhere in the repository, the moved pair's own links to current decisions, which become `../decision/...`, and this proposal's two links per language to the moved decision, which point at its archived path. Its language-pair link, its links to the Spec, and its links under `archived/` keep their form.

### Project Spec correction

The [project Spec](../../spec/omp-smart-cache.md) pair adopts the same framework. Its goal agrees with the component README, the four Handoff exclusions are removed, remote's clauses survive, the Spec's own invariants 1 and 11 stay, the ADR list names the three current decisions, and the self-contained meaning stays: the package imports no other component's runtime or settings reader. Only the Handoff exclusion inside invariant 12 is dropped.

The Spec states no Handoff behavior before the implementation change delivers it. That change corrects the Spec, creates the Handoff decision, updates the paired component documentation, and increments the component version by one patch level.

### Sequencing

The proposal merges to `main` on its own. The contract change that follows creates the extension and remote decisions, moves the current decision pair to `archived/`, and repairs the links and relationship fields the move touches, including this proposal's own; it links no decision that does not exist yet, and it touches neither the Spec nor the component. The implementation change that delivers the capability creates the Handoff decision, corrects the Spec, updates the documentation, and removes this consumed proposal. Git history preserves the proposal as the merged rationale.

## Alternatives considered

- **Ship Handoff alignment as a separate package or a second extension.** Considered while choosing the home. It keeps the remote package untouched, but the host exposes one method per seam and the remote capability's ownership check rejects a foreign wrapper, so a separate wrapper stops remote alignment and reports a wrapper conflict instead. It also duplicates the registration, lifecycle handling, and diagnostics the package already has.
- **Keep only the local trial extension.** Considered as the status quo. It already aligns manual handoff on this machine, but it stays outside the repository and has no settings, no per-session isolation, no accepted evidence for the uncovered paths, and no release process.
- **Append a Handoff decision under `## Changes` and keep the remote decision current.** Considered while choosing the contract form. Adding the capability does not contradict the effective remote rules, so this form is available. It was rejected because the current decision keeps remote alignment as its subject and keeps the clauses that place Handoff elsewhere, no archived relationship would exist, and the Spec's framework, goal, and invariant 12 would keep describing a component narrower than its current behavior.
- **Fold Handoff alignment into remote's V2 reuse rules.** Considered while choosing the capability boundary. Handoff and remote align requests of different shapes under different protocol rules, and the current remote decision already excludes applying its V2 rules to Handoff. One rule set would either drop remote's Provider-specific checks or apply them to requests they were not written for.
- **Gate rewriting on full request equality.** Considered while choosing what the capability refuses. Requiring the side request to match the reference in every field, as later trial versions did, abandons the whole rewrite on any unrelated field difference and hides which projection failed. The chosen form keeps the safety and ownership checks, restores axis by axis, and counts the differences it cannot project.
- **Require an exact Provider name, as remote does.** Considered while defining the switch. Remote needs a Provider name because V2 opaque data, trimming, and routing semantics vary by Provider. Handoff depends only on the chat-completions shape and binds a reference to the same session, model, prompt, and tool set, so a Provider key would add configuration surface and a second Provider inventory without adding protection. Component documentation declares the verified matrix and its gaps instead.

## Acceptance criteria

1. Three current bilingual decisions exist: `2026-10-12-maintain-smart-cache-extension` and `2026-10-12-provide-remote-alignment` after the contract change, and `2026-10-12-provide-handoff-alignment` after the implementation change. Each pair meets the decision format, the extension decision carries `Reverses` pointing to the archived remote decision, and neither decision of the contract change links a decision that does not exist at that point. (both changes)
2. The archived remote decision pair keeps its filenames and carries `Archived` and `Reversed by` pointing to the extension decision. The new remote decision carries `Reverses` pointing to the archived model-prompt decision, whose `Reversed by` field points back to it in place of the entry for the archived pair and keeps the field's other entries, so every reversal recorded before the move is still recorded by a current decision. (contract change)
3. Every still-effective clause of the archived decision appears in the extension decision, the remote decision, or the Handoff decision with unchanged meaning and observable promise. The Handoff-facing clauses (the statement that the remote V2 rules are not reused for Handoff, and the trial extension's replacement condition) land with the Handoff decision in the implementation change; the contract change's two decisions may restate them, but the Handoff decision is where they are required to land. No clause is lost, and none is reproduced as an implementation specification. (both changes)
4. No tracked repository file links to a path the move vacated, and the moved pair's own links resolve from `archived/`. Ignored task materials under `.tk/` keep their own references and are maintained by the tasks that own them. That covers this proposal's own links to the moved decision, which the same change repoints to the archived path. The archived model-prompt decision's `Reversed by` field, the host floor, and OMP experience documents point to the decision that now owns the referenced contract; the host compatibility Spec's related list names the extension decision and keeps its other entries. (contract change)
5. The project Spec pair adopts the framework: its goal agrees with the component README, the four exclusions are gone, remote's clauses survive, the Spec's invariants 1 and 11 stay, only invariant 12's Handoff exclusion is dropped, the ADR list names the three current decisions and keeps the model-prompt, shared-floor, and self-contained entries, the host compatibility Spec's related list also names the three current decisions, and the Spec claims no Handoff behavior beyond what the same change delivers. (implementation change)
6. Remote's rules, observable promises, status output, and benefit evidence are unchanged by this restructure. (contract change)
7. The Handoff decision records the capability's ownership, its `handoffCacheEnabled` switch with the `false` default, its independence from remote, the statement that the remote V2 rules are not reused for Handoff, and the trial extension's replacement condition. (implementation change)
8. The capability's own acceptance stays what handoff alignment requires: with the switch off every outgoing request is identical to the native request; on an actual outgoing handoff request the wire body carries the three restored projections; unrelated field differences do not abandon the rewrite; out-of-boundary requests are sent unchanged with a fixed reason; no request is blocked, delayed, or dropped; two consecutive handoffs do not reuse the previous side request body; `/smart-cache` reports the capability's own state; separately authorized comparable real Provider runs show a repeated reduction of uncached input while the generated document and post-compaction continuation stay correct; the trial extension is removed and the maintained capability loads after a restart. (implementation change)
9. The proposal is merged on its own before any implementation. The extension and remote decisions and the archive move land in the contract change; the Handoff decision, the Spec correction, the component documentation, and the removal of the consumed proposal land in the implementation change. (flow)
10. The final candidate is clean, committed, contains the target `main`, and passes the complete repository check. (merge candidate)

## Risks

- A clause can lose its meaning while moving between decisions, so a boundary or a promise that still holds reads weaker, or a relationship field points at a decision that no longer carries the reversing choice. Clause-by-clause review against the archived text and acceptance criterion 3 are the guard.
- An overlooked inbound link keeps presenting the archived decision as current authority, so a reader or an agent follows a superseded scope. A repository search, the link check, and acceptance criterion 4 are the guard.
- Splitting the contract change from the implementation change makes an early Spec correction available: a Spec that claims Handoff as part of the component while the component does not carry it describes behavior that does not exist. The sequencing and acceptance criterion 5 keep the correction in the implementation change.
- The trial extension and the maintained capability can wrap the same session methods. If the switch is enabled before the trial extension is removed, one wrapper can drop the other, so alignment stops with a reported wrapper conflict, or a wrapper loop repeats the same rewrite. The conservative conflict report and the restart-based cutover bound this, but a user can still install both.
- The host builds the handoff side request from its own snapshot. A host change to that path can leave the reference unmatched, and the capability then either refuses and loses the benefit while reporting the fixed reason, or, if the boundary checks are too loose, restores a system prompt or tool choice the host no longer intends for that request, producing a wrong or truncated handoff document. Probing the host path before implementation and keeping strict prefix and ownership checks are the guard.
- Aligning a request does not guarantee a Provider cache hit, and the observed benefit comes from one pair of requests. The capability can add maintenance without repeating its benefit, so its own authorized measurement is the release criterion rather than the trial's numbers.
- Two capabilities in one coordinator can interfere. A change made for handoff can alter the shared wrapper, the per-session lifecycle, or remote's diagnostics, and a remote regression then ships with a handoff improvement. Moving remote rules unchanged and re-running remote acceptance before release are the guard.
- Restoring the online system prompt and tool choice into a request the host builds for document generation can make the model call a tool instead of producing text, and the host's document extraction then fails. This capability executes no tool and adds no retry, so the failure surfaces as the host's own empty-document error.
