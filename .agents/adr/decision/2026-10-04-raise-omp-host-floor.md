# ADR decision: Maintain host components against a shared OMP floor

Decision owner: Ruokee
Decision writer: OMP Claude Opus 5.5
Reverses: [Adapt first-party host components to host upgrades](../archived/2026-09-28-adapt-components-to-host-upgrades.md)

English | [中文](./2026-10-04-raise-omp-host-floor.zh.md)

## Motivation

Maintain every OMP-facing component against one shared maintenance lower bound, OMP 18.5.0, and keep the rules first-party host components follow across host upgrades.

First-party components load code into a host process and must keep working as that host upgrades. Maintenance responsibility, implementation selection, and verification evidence need distinct meanings rather than a single version range, so these components follow common rules: a component declares its maintenance lower bound in its own documentation, its host peer declarations keep naming the host packages without carrying that bound, an update preserves the results a maintained older host had, verification follows the actual behavioral change, and a bound is raised only through a decision. The rules require no common implementation.

The OMP-facing components are `omp-context-pin`, `omp-system-prompt`, `omp-qol`, `omp-status-bar`, `omp-codex-web-access`, and the OMP adapter of `tk`. Raising their bounds one component at a time, and only when a component could no longer serve both hosts, left them on bounds between 18.1.8 and 18.2.8 while development and real-host checks had moved to 18.4.x and 18.5.x. Each component kept code for the hosts at the bottom of that range, and two features had stopped working on current hosts: the default-block route of `omp-system-prompt` and the speculation band indicator of `omp-status-bar`. The OMP-facing components trade support for those older hosts for a smaller maintained surface and one baseline they are developed and verified against.

## Analysis

Peer ranges participate in dependency resolution; they are not just maintenance notes. For example, npm installs peer dependencies by default, and unresolved conflicts can cause installation to fail ([npm package.json documentation](https://github.com/npm/cli/blob/latest/docs/lib/content/configuring-npm/package-json.md)). Putting a maintenance lower bound in a peer range can prevent installation on a host that could run the component. The actual result depends on the installation path; npm's behavior is not an observed result for every host.

The choice of 18.5.0 rests on the published OMP sources at the release tags named below:

- The [18.5.0 system prompt](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/prompts/system/system-prompt.md) opens with `RFC 2119 keywords:` and contains the identity line `You are omp's trusted coding assistant.` under `§ Role`. That identity line first appears in 18.3.0. The identity lines the `omp-system-prompt` default-block route recognized come from earlier releases.
- The 18.5.0 [`Settings`](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/config/settings.ts) class has no `getGroup` method. The method exists through 18.3.x and is gone from 18.4.0, and the status bar has no other public way to read the host's compaction settings.
- The builtin [`hub` tool](https://github.com/can1357/oh-my-pi/tree/v18.2.11/packages/coding-agent/src/tools/hub) is present at the 18.1.20 and 18.2.11 tags and absent from 18.3.0, where the standalone [`wait` tool](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/tools/wait.ts) takes its place.
- From 18.4.1 the host renders the project footer as a `<project-context>` block, and 18.5.0 adds a subagent branch to the critical tail that follows it.
- The host members `omp-context-pin` checked before activation, the members behind its `getEntries` probe, and the required `timestamp` field on user messages all exist in 18.1.8, so those checks guarded only hosts below its earlier bound.

Nothing in this evidence depends on a host later than 18.5.0.

## Decision

### Scope

This decision applies to all repository components that load code into a host process. Material distributed only as instructions or configuration, without executing code in that process, is not a compatibility object. Different hosts use their own version lines, and each component declares its own maintenance lower bound.

Independent protocols a component depends on retain their own contracts. A host maintenance lower bound does not replace protocol compatibility requirements or safety checks.

A capability that is unrelated to an upgrade is decided in its own requirement. This decision does not ask a component to adopt a new host API, and compatibility work is judged by the result a user sees rather than by which host API produced it.

### Declare the maintenance lower bound in the component README

Each component states its maintenance lower bound in the compatibility section of its own `README.md` and `README.zh.md`, and that section is the authoritative statement of the bound. A component declares a lower bound and no maintenance upper bound, and the repository keeps no supported-version whitelist or public support matrix.

The bound states maintenance responsibility. It does not promise that later host releases keep working, it does not claim that every release at or above it was verified, and it adds no maintenance promise below it. A host below the bound is not blocked: a component that can work there may work there, without a maintenance commitment, and it may lose behavior that code removed for older hosts provided.

### One shared lower bound for OMP-facing components

Every OMP-facing component declares OMP 18.5.0 as its maintenance lower bound. For `tk`, the bound covers the host-side code of the OMP adapter in `tools` mode; the `cli` mode component and the Pi adapter keep their own statements.

The OMP bound is a shared maintenance baseline: the OMP release the components are developed and verified against. It is chosen for all OMP-facing components together rather than derived for each component from the oldest host it could still serve. Where a component has development dependencies on `@oh-my-pi/*`, they use that release, and test fixtures and real-host checks use its host behavior as their baseline.

Code paths, probes, fixtures, tests, and documentation sections that exist only for OMP hosts below the shared bound are removed. Host behavior introduced at or below the bound, such as the 18.5.0 subagent footer tail, stays supported.

### Derive other host bounds from the delivered component

A component for any other host derives its bound from the delivered component's load conditions, required capabilities, and behavior. Records of when an API first appeared and existing verification can provide evidence, but neither alone proves the whole component's compatibility range. Development dependency versions and the latest tested version cannot simply become such a bound. The maintainer must confirm a first declaration; when evidence is insufficient, record the gap rather than publish a guess.

### Keep host peers out of the maintenance range

Host peer declarations keep naming the host packages a component uses, and their ranges do not narrow by the maintenance lower bound or add a maintenance upper bound. Installation conditions, custom metadata fields, and runtime version checks do not carry the maintenance limit either. A component whose declaration already names the host package without a version restriction keeps that form.

Ordinary dependencies that evolve on their own keep their real constraints. Development dependencies stay locked for reproducible checks and do not become the declaration. A capability or a semantic difference a component actually needs is handled by its adapters and its own checks, not by restoring a numeric range on a host peer. A repository checker, a compatibility manager, or a supported-version table is not added for this decision, and production code never reads component documentation to decide how to run.

### Keep the behavior maintained hosts need

Inside the bound, an update keeps the results older maintained hosts had. One implementation is reused when it covers both, and a real difference keeps the implementations the hosts need together with the documented condition that selects between them. When a host release provides a native capability, the user-visible result, the configuration, and the failure behavior are compared first; an equivalent native path may replace a wrapper, and the wrapper another maintained host still needs stays.

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

### Raise a lower bound through a decision

The shared OMP bound moves for every OMP-facing component together, and each raise is its own decision. A proposal names the current and proposed bound, the evidence, the realistic alternatives, and the host support users lose, and the change updates every OMP-facing component's declaration, implementation, tests, and any migration note.

A component for another host keeps its bound by default. A raise becomes possible when the component genuinely cannot serve both host versions, or when serving both would need a large rewrite while a substantially smaller change raises the bound; a proposal then names the component, the current and proposed bounds, the conflict or the rewrite with its comparison, the realistic alternatives, the evidence, and the host support users lose. One such component's raise does not move another component's bound.

Maintenance effort is the work the maintenance promise already implies, so it is not an additional cost and never a risk. The maintainer decides each raise, and an approval recorded outside the decisions does not replace the ADR. Raising a bound does not restore a capability a host release removed.

### Component decisions under the shared OMP bound

Raising the OMP-facing components to 18.5.0 removes three behaviors that still worked on some hosts below it, and complete successor decisions record each affected component contract:

- [Render the system prompt strategy only from the component template](../archived/2026-10-04-use-system-prompt-template-only.md) removes the default-block route that served hosts before 18.3.0.
- [Maintain the OMP status bar with a static context glyph](./2026-10-04-show-static-context-glyph.md) replaces the speculation band estimate that needs `Settings.getGroup`, which hosts before 18.4.0 provide.
- [Maintain OMP quality-of-life adjustments on the standalone wait entry](../archived/2026-10-04-use-standalone-qol-wait.md) removes the `hub` wait path that served hosts before 18.3.0.

`omp-context-pin`, `omp-codex-web-access`, and the `tk` OMP adapter remove no behavior that a host from their earlier bound up to 18.5.0 used. [The context pin decision](./2026-09-15-add-omp-context-pin.md), [the model prompt rules decision](../archived/2026-09-14-add-model-prompt-rules.md), [the tk integration decision](./2026-09-02-integrate-tk-tools-with-harnesses.md), and [the self-contained component decision](./2026-08-24-keep-components-self-contained.md) record the bound or the inherited contract under their changes. [Use native plugin settings for Codex web access](./2026-09-10-use-codex-web-plugin-settings.md) records no bound and needs no change.

## Alternatives considered

### Keep numeric installation and activation gates

The maintenance lower bound could have remained in peer dependencies or become an activation condition. This rejects out-of-range hosts early, but also rejects hosts that have the required capabilities and could run the component. It does not meet the requirement that the maintenance lower bound must not obstruct use.

### Always verify the lower-bound and target hosts

A fixed pair standardizes verification steps, but imposes the same requirement on small changes whose behavior is unaffected. It also leaves distinct adaptation paths outside that pair uncovered. Verification therefore follows actual impact while preserving existing component release requirements.

### Approve lower-bound raises only in implementation records

This retains maintainer approval but leaves no separate public rationale for each reduction in host support. Each raise therefore still requires its own ADR.

### Raise each OMP-facing component's bound only when it cannot serve both hosts

This was the rule before this decision. It keeps hosts down to each component's earlier bound wherever the code still serves them, but it leaves the six components on different bounds below the development host, and the components keep maintaining the default-block route and the speculation band estimate, which work only on older hosts.

### Keep the bound value in a component specification

This was suggested while analyzing why the bounds drifted. It removes the decision step from each raise, but it depends on a specification layer the repository does not have, so raises stay decisions.

## Consequences

- Removing numeric gates lets previously rejected hosts reach loading and execution. If capability and behavior checks miss a real incompatibility, the component fails during use rather than at installation.
- A maintenance lower bound states responsibility, not verification. A host at or above the bound can still hold an unverified difference, so the evidence records and the per-change verification carry that weight instead of the number.
- Multiple implementations kept for different maintained hosts may evolve separately during later maintenance, causing configuration meanings or failure behavior on older maintained hosts to diverge from the same feature's contract.
- A user who keeps an OMP release below 18.5.0 and updates a component loses the removed behavior without a warning: the system prompt strategy stops applying on a host before 18.3.0 unless the user selects the template, the total-deadline wait stops applying on a `hub` host, and the speculation band indicator becomes a static glyph on a host before 18.4.0.
- The shared OMP bound moves only through a decision for all OMP-facing components, so a component that could drop an older host earlier waits for the next shared raise, and every raise needs a decision and review that covers all six components.
- The decision adds no checker, compatibility manager, or supported-version table, so nothing mechanically enforces the declaration; review and the component documentation keep it accurate.
