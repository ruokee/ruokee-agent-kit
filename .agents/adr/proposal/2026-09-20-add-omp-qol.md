# ADR proposal: Add configurable OMP quality-of-life adjustments

Draft owner: Ruokee
Draft writer: OMP GPT-6 Astra

English | [中文](./2026-09-20-add-omp-qol.zh.md)

## Motivation

OMP can return an empty hub wait window while background work continues, stop after a model error that native recovery does not resolve, or interrupt a slow remote compaction at its request deadline. These cases require repeated user or model intervention.

OMP 18.2.4 provides public extension interfaces for delegating to native tools and requesting session continuation. Its [hub implementation](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/tools/hub/index.ts#L365-L515) owns job visibility and result delivery, while its [public compaction hooks](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/extensibility/shared-events.ts#L375-L403) provide no request-timeout override. This supports small extensions to waiting and recovery, but leaves a tradeoff between retaining the compaction deadline and accepting process-wide effects.

## Proposal

### Component and configuration

Add one independently distributable OMP extension, `@ruokee/omp-qol`, at `projects/omp-qol`. Group hub waiting, main-session error recovery, and experimental compaction deadline adjustment in this component. A shared package provides one installation and configuration entry while keeping each module independently controlled. Follow the [self-contained component decision](../decision/2026-08-24-keep-components-self-contained.md).

Use OMP native plugin settings as the only configuration source, following the [native settings decision](../decision/2026-09-10-use-codex-web-plugin-settings.md). OMP owns user values, project overrides, and configuration parsing. Enable waiting and conservative recovery by default. Keep compaction adjustment explicitly opt-in. Expose effective settings and module availability, and keep a module's failure from disabling unrelated modules where possible.

Limit the component to these behavior adjustments. External-tool guards, including Herdr guards, and unrelated host behavior remain outside its scope.

### Host responsibilities

Use public OMP extension interfaces for waiting and recovery. Keep job ownership, message consumption, result delivery, permission checks, conversation history, and the native compaction protocol under OMP's control. This avoids maintaining a second implementation of those mechanisms.

Waiting may continue across empty native windows within a bounded total wait. Ending that wait must not cancel background work or hide delivered results. Recovery may request bounded continuation after eligible model errors, while respecting user cancellation, fixed safety exclusions, and native continuation limits. It must not directly replay completed tools or promise that model continuation cannot repeat side effects.

Keep installation and migration under user control. Do not automatically modify existing extensions or private configuration. Overlapping implementations require explicit migration because their effects cannot always be detected or safely combined.

### Compaction experiment and replacement condition

Offer compaction deadline adjustment as a default-off experiment using a bounded, process-wide timeout adjustment. This preserves OMP's compaction protocol, history replacement, retries, and fallback without taking ownership of the entire compaction flow.

The mechanism can also extend matching timeouts for unrelated work in the same process. Enabling it selects this limitation; it provides neither request isolation nor strict project isolation. Conflicts or uncertain ownership must stop the adjustment rather than silently sharing settings. Disabling it cannot shorten deadlines already created.

When OMP provides a supported request-level timeout setting or hook, use that interface and retire the global mechanism. Do not retain two owners for the same deadline policy.

### Documentation and version evidence

Document each adjustment's OMP source baseline, versions actually verified, and known applicability. Provide English and Chinese explanations in the component's `docs/`, linked from its README files, covering native behavior, why the adjustment is needed, how it works, its limits, and when it becomes unnecessary.

Support claims about hardcoded behavior, missing configuration, or regressions with version-specific source or change evidence. Distinguish observed constraints from upstream authors' stated rationale. Maintain this evidence alongside behavior and host-compatibility changes; a package-wide compatibility range does not establish verification of each adjustment.

## Alternatives considered

- Separate extension packages. Considered during packaging analysis. They preserve independent releases but leave configuration, compatibility, and migration spread across installations. One package keeps those entry points together.
- A dedicated YAML configuration file. Considered during configuration analysis. The required settings fit OMP's native settings, so a separate parser and precedence system add maintenance without a needed capability.
- Replacement of the native compaction flow. Considered during timeout analysis. It provides direct control over request options but transfers protocol, history, retry, and fallback responsibilities to this component.
- Deferral of compaction adjustment until OMP exposes a request-level interface. Considered when assessing isolation. It avoids global effects but retains the existing deadline. The proposal instead makes the process-wide mechanism an explicit, disabled experiment.

## Acceptance criteria

1. The component is independently distributable and uses native settings. Users can control each module and understand its effective state and compatibility limits from complete English and Chinese documentation. Every adjustment has version evidence and a linked mechanism explanation.
2. Waiting and recovery reduce repeated intervention while preserving native permissions, cancellation, result delivery, and continuation limits. Failures remain observable and do not silently transfer host responsibilities to the extension.
3. Compaction evidence demonstrates successful remote work beyond the native deadline and usable model requests afterward. Evaluation exposes effects on unrelated work, cancellation, and conflicts. Timeout-rewrite notices alone do not establish success or isolation.
4. Verification combines the [repository's automated checks](../decision/2026-09-12-unify-repository-checks.md) with real OMP CLI behavior. Report tested host versions, unavailable scenarios, and failed modules explicitly; declared compatibility and unit tests do not substitute for runtime evidence.

## Risks

A process-wide compaction adjustment can prolong unrelated requests. Ambiguous lifecycle events can widen its effect, and cleanup cannot shorten deadlines already created. Default-off activation and a bounded scope reduce exposure without providing isolation.

Automatic continuation can repeat side effects and increase cost after native retries. Conservative eligibility and bounded attempts limit exposure but cannot guarantee exactly-once model behavior.

Host changes or overlapping extensions can cause lost wait results, duplicate recovery, or conflicting timeout ownership. Compatibility checks and conflict handling reduce these risks but cannot establish support for every host version or extension combination.
