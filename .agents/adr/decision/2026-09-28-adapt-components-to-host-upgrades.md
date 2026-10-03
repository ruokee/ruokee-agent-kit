# ADR decision: Adapt first-party host components to host upgrades

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash

English | [中文](./2026-09-28-adapt-components-to-host-upgrades.zh.md)

## Motivation

Separate host maintenance responsibility from version gates and record the rules first-party host components follow across host upgrades.

First-party components load code into a host process and must keep working as that host upgrades while they also keep the behavior older maintained hosts need. Maintenance responsibility, implementation selection, and verification evidence need distinct meanings rather than a single version range, so these components follow common rules: a component declares its maintenance lower bound in its own documentation, its host peer declarations keep naming the host packages without carrying that bound, an update preserves the results a maintained older host had, verification follows the actual behavioral change, and a bound is raised only through its own decision. The rules require no common implementation.

## Analysis

Peer ranges participate in dependency resolution; they are not just maintenance notes. For example, npm installs peer dependencies by default, and unresolved conflicts can cause installation to fail ([npm package.json documentation](https://github.com/npm/cli/blob/latest/docs/lib/content/configuring-npm/package-json.md)). Putting a maintenance lower bound in a peer range can prevent installation on a host that could run the component. The actual result depends on the installation path; npm's behavior is not an observed result for every host.

## Decision

### Scope

This decision applies to all repository components that load code into a host process. Material distributed only as instructions or configuration, without executing code in that process, is not a compatibility object. Different hosts use their own version lines, and each component declares its own maintenance lower bound.

Independent protocols a component depends on retain their own contracts. A host maintenance lower bound does not replace protocol compatibility requirements or safety checks.

A capability that is unrelated to an upgrade is decided in its own requirement. This decision does not ask a component to adopt a new host API, and compatibility work is judged by the result a user sees rather than by which host API produced it.

### Declare the maintenance lower bound in the component README

Each component states its maintenance lower bound in the compatibility section of its own `README.md` and `README.zh.md`, and that section is the authoritative statement of the bound. A component declares a lower bound and no maintenance upper bound, and the repository keeps no supported-version whitelist or public support matrix.

The bound states maintenance responsibility. It does not promise that later host releases keep working, it does not claim that every release at or above it was verified, and it adds no maintenance promise below it. A host below the bound is not blocked: a component that can work there may work there, without a maintenance commitment.

The lower bound follows the delivered component's load conditions, required capabilities, and behavior. Records of when an API first appeared and existing verification can provide evidence, but neither alone proves the whole component's compatibility range. Development dependency versions and the latest tested version cannot simply become the lower bound. The maintainer must confirm a first declaration; when evidence is insufficient, record the gap rather than publish a guess.

### Keep host peers out of the maintenance range

Host peer declarations keep naming the host packages a component uses, and their ranges do not narrow by the maintenance lower bound or add a maintenance upper bound. Installation conditions, custom metadata fields, and runtime version checks do not carry the maintenance limit either. A component whose declaration already names the host package without a version restriction keeps that form.

Ordinary dependencies that evolve on their own keep their real constraints. Development dependencies stay locked for reproducible checks and do not become the declaration. A capability or a semantic difference a component actually needs is handled by its adapters and its own checks, not by restoring a numeric range on a host peer. A repository checker, a compatibility manager, or a supported-version table is not added for this decision, and production code never reads component documentation to decide how to run.

### Keep the behavior older maintained hosts need

Inside the bound, an update keeps the results older hosts had. One implementation is reused when it covers both, and a real difference keeps the implementations the hosts need together with the documented condition that selects between them. When a host release provides a native capability, the user-visible result, the configuration, and the failure behavior are compared first; an equivalent native path may replace a wrapper, and the wrapper another maintained host still needs stays.

Behavior a still-maintained host needs is kept, and an implementation that carries it may be refactored, merged, or replaced as long as the behavior remains and the change is verified. Code that only serves hosts outside the maintenance range and carries no other behavior can be cleaned up without waiting for another bound raise. A component's independent new features decide their own availability and may be documented as available on some hosts; this decision does not require every host to have the same feature set.

### Isolate host implementation from component behavior

Business rules depend on the operations and data the component needs rather than on the shape of a host API. The adapter owns the host API, the data conversion, and the binding of the entry to the actual host, and the interface follows the component's needs instead of restating the host's full API. An existing boundary is reused as it is; a new one appears when a real difference or conversion needs it, and a plain function, parameter, or object is enough. Forwarding that only mirrors a call is not worth a boundary.

Host coupling is organized as a change touches it. A difference has one owner, so two call sites do not decide the same thing separately, and the component documentation states the reason, the location, the selection condition, the failure behavior, and the verification basis of each difference. Components stay self-contained: no cross-component compatibility library is created, and a component does not link to another component or to repository-level material.

### Select an implementation by capability, and by version only with evidence

Where actual capabilities or input structure distinguish the behavior, they decide it. A version range is used only where the shape cannot distinguish the cases and a semantic difference is documented, and even then it is a local decision inside an adapter rather than a general gate on the component. The presence of a function does not prove that event order, field meaning, delivery, or persistence is unchanged.

Stable interfaces may be selected when the entry binds to the host. Dynamic input, settings, session state, and the ownership of a process-wide patch are read and checked under their own lifecycle. A component does not freeze everything into an activation-time snapshot, and it does not re-resolve an unchangeable assumption on every call.

### Keep loading and failure boundaries local

Compatibility analysis covers the production entry and its transitive imports, because a runtime probe cannot repair a module resolution that fails before the factory runs. Modules that are known to exist can stay statically imported. A module with a real cross-version difference, whose absence a component must tolerate, moves the load failure inside that adapter's boundary; moving an unchanged static import elsewhere does not count as handling it.

Failure is handled at the smallest functional unit that can be isolated, so independent features keep working. Required preconditions run before side effects where the host allows it. A registration or install that fails halfway stops the remaining work and releases what the component owns, without promising an atomic registration or a full rollback the host does not provide. Where no equivalent implementation exists, the affected feature keeps the host's native behavior or reports itself unavailable through the existing diagnostic channel with a bounded, locatable reason and without claiming success. A safe disable is a failure response rather than compatibility, and it does not by itself end maintenance responsibility.

### Match verification to the change

Verification strength follows actual behavioral impact, without line-count or ratio thresholds. Code category alone is not a verification threshold either. A small change passes after proportionate checks without a blanket requirement to rerun an older host. A major behavioral change must be verified in the relevant real host scenario, even if it changes only a few lines. Each component's existing release contract keeps its strength.

The repository sets no fixed combination of host versions to verify. Checks may use the lower bound, the target version, or representative environments for distinct adaptation paths, as long as the evidence supports the conclusion.

Verification records state the evidence type, versions, scenarios, and uncovered areas. Simulated interfaces test only the component's logic, branches, and failure handling; they cannot replace loading in a real host. Observations from real host packages, templates, and CLIs must also be distinguished. For events, tool visibility, UI, message delivery, persistence, or process patches, check the user-visible result rather than only a handler's return value.

A test environment that cannot run because it depends on newer host internals does not establish that the production entry is incompatible. Existing verification results retain their original versions and scenarios rather than becoming maintenance promises. Existing repository checks still apply.

### Raise a lower bound through its own decision

The default is to keep a lower bound. A raise becomes possible when the component genuinely cannot serve both host versions, or when serving both would need a large rewrite while a substantially smaller change raises the bound; a proposal then names the component, the current and proposed bounds, the conflict or the rewrite with its comparison, the realistic alternatives, the evidence, and the host support users lose. Maintenance effort is the work the maintenance promise already implies, so it is not an additional cost and never a risk.

Each raise is its own ADR that the maintainer decides, and it updates the declaration, the implementation, the tests, and any migration note in the same change. One component's raise does not move another component's bound, and an approval recorded outside the decisions does not replace the ADR. Raising a bound does not restore a capability a host release removed.

### The current decisions this rule changes

Two clauses in the current decisions cannot hold together with this rule, and complete successor decisions reverse them while keeping the rest of each contract:

**The status bar's numeric host declaration.** [The status bar decision](../archived/2026-09-24-use-omp-status-bar-widget.md) declared the direct host imports as peer dependencies with the range `>=18.1.8 <19`, named OMP 18.x as the target, and drew the consequence that the package is coupled to that range. A range that states maintenance responsibility would keep deciding installation for hosts the package can serve, so the two cannot hold at once. [The successor decision](./2026-10-02-scope-token-metrics-to-conversation.md) keeps the rest of that contract as it stands, including the widget, the provider contract, the builtin inventory, the speculation estimate and its limits, and the real TUI check before each release tag, and states the maintenance bound in the component README instead.

**The quality-of-life deadline mechanism.** [The quality-of-life decision](../archived/2026-09-22-recover-interrupted-turns.md) required the component to use a supported request-level timeout interface and retire its process-wide mechanism once the host provides one, and it kept no condition for a still-maintained host that lacks that interface. An unconditional retirement and this rule, which keeps the behavior a maintained older host needs, cannot hold at once. [The current QoL decision](./2026-10-04-align-remote-compaction-cache.md) selects the deadline implementation by the host at hand, keeping this decision's principle, and keeps that decision's other rules.

The remaining current decisions are checked and kept:

- [The system prompt decision](./2026-09-30-render-system-prompt-from-host-template.md) already declares an unrestricted peer, forbids reading the host version to decide eligibility, activation, transformation, diagnostics, or fallback, and keeps structural checks and the evidence boundary. Adding a documented maintenance bound does not change any of that.
- [The model prompt rules decision](./2026-09-14-add-model-prompt-rules.md) keeps the peer contract it inherits from that decision. A documented bound is a declaration and not a transition back to a version condition.
- [The context pin decision](./2026-09-15-add-omp-context-pin.md) records no version gate. Its activation reads the host's public API, which stays as it is, and the declaration follows this decision.
- [The tk integration decision](./2026-09-02-integrate-tk-tools-with-harnesses.md) keeps the independent runtime protocol and its `runtime_compat`, CLI and driver contracts, component format, preflight validation, the zero-registration outcome of a failed preflight, and the single bounded diagnostic of a later `registerTool` failure. A host maintenance bound is not a runtime protocol change.
- [The self-contained component decision](./2026-08-24-keep-components-self-contained.md) keeps every component's documentation and material with the component, so the bound is stated there and not in a repository-level table.
- [The current QoL decision](./2026-10-04-align-remote-compaction-cache.md) keeps its per-adjustment verification separation and its obligation to re-read the cited source on an upgrade and update the affected sections; editing the declared bound does not replace those steps.

## Alternatives considered

### Keep numeric installation and activation gates

The maintenance lower bound could have remained in peer dependencies or become an activation condition. This rejects out-of-range hosts early, but also rejects hosts that have the required capabilities and could run the component. It does not meet the requirement that the maintenance lower bound must not obstruct use.

### Always verify the lower-bound and target hosts

A fixed pair standardizes verification steps, but imposes the same requirement on small changes whose behavior is unaffected. It also leaves distinct adaptation paths outside that pair uncovered. Verification therefore follows actual impact while preserving existing component release requirements.

### Approve lower-bound raises only in implementation records

This retains maintainer approval but leaves no separate public rationale for each reduction in host support. Each raise therefore still requires its own ADR.

## Consequences

- Removing numeric gates lets previously rejected hosts reach loading and execution. If capability and behavior checks miss a real incompatibility, the component fails during use rather than at installation.
- A maintenance lower bound states responsibility, not verification. A host at or above the bound can still hold an unverified difference, so the evidence records and the per-change verification carry that weight instead of the number.
- Multiple implementations kept for different maintained hosts may evolve separately during later maintenance, causing configuration meanings or failure behavior on older maintained hosts to diverge from the same feature's contract.
- Keeping a lower bound delays the smaller code a raise could buy, and every raise needs its own decision and review; a component may carry compatibility work for a host version it could otherwise drop.
- The decision adds no checker, compatibility manager, or supported-version table, so nothing mechanically enforces the declaration; review and the component documentation keep it accurate.
