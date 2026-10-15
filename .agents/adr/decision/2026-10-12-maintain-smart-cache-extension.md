# Maintain the smart-cache extension

Decision owner: Ruokee
Decision writer: OMP
Reverses: [Use smart-cache for remote alignment](../archived/2026-10-10-use-smart-cache-remote.md)

English | [中文](./2026-10-12-maintain-smart-cache-extension.zh.md)

## Motivation

Maintain `@ruokee/omp-smart-cache` as one extension that aims to avoid unexpected cache misses in OMP requests while the ordinary and native request paths stay unchanged.

The [component README](../../../projects/omp-smart-cache/README.md) describes the package that way and gives each optimization its own section. The [archived decision](../archived/2026-10-10-use-smart-cache-remote.md) recorded the package as the home of one optimization, remote alignment, and it carried the component-level rules inside a decision that took that capability as its subject. Handoff cache alignment belongs to the same package, so the component needs a decision that records the extension itself, its capability model, and its shared maintenance floor, with every optimization left to its own decision. Without one, the only current text describing the component would be scoped to a single capability, and a second capability would either extend that decision's subject or leave the component-level clauses without a current home.

Two optimizations in one package also need a boundary that keeps them independent. Remote alignment and Handoff alignment rewrite different requests under different protocol rules and carry their own evidence, so a shared implementation must not become a shared contract.

## Decision

### Extension self containment

Maintain the self-contained package `@ruokee/omp-smart-cache` at `projects/omp-smart-cache`, with its own native `omp.extensions` entry, settings, checks, and English and Chinese documentation. Follow the [first-party boundary](./2026-08-20-establish-first-party-capability-kit.md) and [self-contained component contract](./2026-08-24-keep-components-self-contained.md). Do not import runtime code, settings readers, or documents from QoL or a local prototype.

The package holds first-party capabilities only, and every capability it carries reads the same native settings source.

### Capability model

Each optimization the package carries has its own decision, its own native switch, its own runtime state and staged reasons, its own counters, and its own acceptance. [Remote alignment](./2026-10-12-provide-remote-alignment.md) and [Handoff alignment](./2026-10-12-provide-handoff-alignment.md) are the two capabilities it carries, each recorded by its own decision.

The capabilities share the package, the process coordinator, the per-session registration, and one wrapper per native method. They dispatch by capability and share no protocol rules, payload shapes, reason codes, or benefit evidence. A capability that refuses a request, or that finds its interface unavailable, leaves the other capability working. Every capability is opt-in, and no capability ships a placeholder switch, mode, or interface before it is delivered.

Recording the capability model delivers no capability. This decision neither integrates Handoff alignment nor replaces an installed Handoff trial extension; [Handoff alignment](./2026-10-12-provide-handoff-alignment.md) records that capability and its authorized cutover.

### Status command

`/smart-cache` is the status command of the package and stays one command. It starts no model turn and reports each capability in its own section, with that capability's states, staged reasons, and bounded counters.

Component documentation owns the detailed settings and command reference, applicability, side effects, native-off behavior, fixed source baselines, versions actually exercised, and native replacement conditions, in both languages. Source inspection, real CLI coverage, client alignment, native adoption, and Provider measurements are labeled separately.

### Host maintenance floor

Apply the [shared OMP maintenance floor](./2026-10-04-raise-omp-host-floor.md), currently `18.5.0`. The component README pair owns its declaration, with no upper bound or version whitelist. Lock host development dependencies to the shared floor; do not narrow host peers or add an installation or activation version gate. The floor moves only through that shared decision, which governs every OMP-facing component.

### Decision reversal

This decision reverses [Use smart-cache for remote alignment](../archived/2026-10-10-use-smart-cache-remote.md). That decision took one capability as the subject of the component, and the ADR rules do not allow rewriting a current decision to express a conflicting choice. The conflicting clauses are:

| Effective clause in that decision | Replacement choice and conflict |
| --- | --- |
| Component subject: one decision records the component together with remote alignment | This decision records the extension, and each capability gets its own decision. One decision cannot be both the component's contract and one capability's contract. |
| Component and public configuration: the package, its entry, its checks, its documentation, and its settings source sit inside the remote decision | Those clauses move here, where an extension-level clause belongs; the remote settings stay with remote alignment. |
| Handoff: the migration neither approves Handoff integration nor replaces the installed Handoff prototype, and remote V2 rules are not reused for Handoff | Carrying a Handoff capability is this package's subject, and [Handoff alignment](./2026-10-12-provide-handoff-alignment.md) records its switch, its boundary, and the trial extension's replacement condition. The rule that remote V2 rules are not reused for Handoff stays with [remote alignment](./2026-10-12-provide-remote-alignment.md), and no placeholder Handoff interface is added. |

All non-conflicting rules of the archived decision remain binding, and they now live in this decision and in [remote alignment's decision](./2026-10-12-provide-remote-alignment.md). The reversal of [Maintain QoL model prompts](../archived/2026-10-07-maintain-qol-model-prompts.md) moves with the clause it belongs to and is carried by the remote decision.

## Alternatives considered

- **Ship Handoff alignment as a separate package or a second extension entry.** Considered while choosing the home of the second capability. It keeps this package untouched, but the host exposes one method per seam and the existing capability's ownership check rejects a foreign wrapper, so remote alignment stops with a reported conflict instead of continuing. It also duplicates the registration, lifecycle handling, and diagnostics the package already has.
- **Append the Handoff capability under `## Changes` and keep the remote decision current.** Considered while choosing the contract form. Adding a capability does not contradict the effective remote rules, so that form was available. It was rejected because the current decision keeps remote alignment as its subject and keeps the clauses that place Handoff elsewhere, so no archived relationship would record the scope change.

## Consequences

- Two capabilities in one coordinator can interfere. A change made for one capability can alter the shared wrapper, the per-session lifecycle, or the other capability's diagnostics, so a regression in one can ship together with an improvement in the other. Moving the existing capability's rules unchanged and re-running its acceptance before release are the guard.
- A local trial extension and a maintained capability can wrap the same session methods. If a capability's switch is enabled while the trial extension is still discovered, one wrapper can drop the other and alignment stops with a reported conflict, or a wrapper loop repeats the same rewrite. The conservative conflict report and the restart-based cutover bound this, but a user can still install both.
- Splitting one package into per-capability decisions can drift. A clause that belongs to one capability can be read as if it covered the other, so a boundary or a promise ends up weaker than the contract requires. Keeping the capability model explicit and reviewing each clause against the archived text at every reversal are the guard.
