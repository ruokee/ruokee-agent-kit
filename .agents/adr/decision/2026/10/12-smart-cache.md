# Smart context

Decision owner: Ruokee
Decision writer: OMP
Reverses: [smart-cache](../../../archived/2026/10/12-r1-smart-cache.md)

English | [中文](./12-smart-cache.zh.md)

## Motivation

Maintain existing context capabilities in the self-contained `@ruokee/omp-smart-context` extension.

Their installation, native settings, and maintenance belong together. Their state owners and failure boundaries differ. A package contract must preserve those boundaries without turning the delivered capability inventory into a permanent architecture constraint.

## Decision

### Extension self containment

Maintain `@ruokee/omp-smart-context` at `projects/omp-smart-context`, with one native `omp.extensions` entry, component-local dependencies and checks, and English and Chinese documentation. Follow the [first-party boundary](../08/20-first-party-capabilities.md) and [self-contained component contract](../08/24-component-self-containment.md). Keep only first-party capabilities. Do not import runtime code, settings readers, or documents from another component or a local prototype.

### Capability ownership

Each capability owns its behavior, native switch, defaults, runtime state, reasons, counters where applicable, and acceptance in its own decision. The [main Spec](../../../../spec/omp-smart-context/README.md) owns the capability inventory and common requirements; its topic Specs own detailed contracts and acceptance. The [README](../../../../../projects/omp-smart-context/README.md) provides the user entry. Adding or removing a capability without changing a common invariant does not reverse this package decision. Do not ship placeholder settings, modes, or interfaces, or introduce a general module framework.

The shared coordinator belongs only to [request alignment](./22-request-alignment.md). Journals, usage accounting, and model-rule state keep their own owners. Shared packaging does not merge protocol rules, payload shapes, reason codes, or benefit evidence. A module-local failure or unavailable interface leaves unrelated valid capabilities working.

### Native configuration

OMP owns user values, project overrides, and parsing. Read and validate one effective activation snapshot from the new package's native settings. Changes require restarting OMP; creating or navigating sessions does not refresh an existing snapshot. Repeated activation does not duplicate registration. There is no package-wide master switch; each capability keeps its specified default.

Unknown keys, a non-object settings root, or a settings-reader failure reject the component configuration. An invalid module key disables only that module. Diagnostics name fixed rules and reasons, never setting values, bodies, opaque content, credentials, raw endpoints, private paths, or dynamic private keys.

### Status

`/smart-context` is the package's read-only status command. It starts no model turn and reports each delivered capability independently, including its state, reasons, and applicable bounded counters. Capability-owned commands retain their own contracts.

Component documentation explains settings, commands, applicability, side effects, and native-off behavior in both languages. Specs own requirements and native replacement conditions. Maintenance evidence owns fixed source baselines and versions actually exercised, distinguishing source inspection, controlled integration, real CLI coverage, client alignment, native adoption, and Provider measurements.

### Host maintenance

Apply the [shared OMP maintenance floor](../09/28-host-maintenance.md), currently `18.5.0`. The component README pair owns its declaration, with no upper bound or version whitelist. Lock host development dependencies to the shared floor. Keep host peers unrestricted and add no installation or activation version gate. Only the shared maintenance decision changes the floor for OMP-facing components.

### Acceptance

Use repository checks and local controlled runs of the actual extension and locked host libraries. Preserve capability-specific positive cases, refusal behavior, and independent switches, and verify their combination. Real-model calls, measured cache savings, and a complete CLI/TUI matrix are not integration gates. Provider benefit claims still require actual comparable measurements. Preserve historical evidence with its original candidate, conditions, and limits.

### Cutover

Remove the old package rather than retaining an alias, adapter, or cross-component dependency. Users move settings explicitly at both user and project scope, preserving effective enablement and unrelated settings. Runtime code neither reads old namespaces as a fallback nor edits user configuration or installations. Follow the component's [migration instructions](../../../../../projects/omp-smart-context/docs/migration.md) and restart affected processes. Do not hot-transfer owners or references or take over foreign wrappers. Trial-extension installation changes still require authorization.

The successor keeps the package decision's canonical identity. It replaces the archived package name, `/smart-cache`, universal opt-in requirement, and universal coordinator ownership. The extracted request-alignment decision preserves that mechanism's obligations; capability decisions preserve their own behavior.

## Alternatives considered

None

## Consequences

A shared release and entry can ship regressions in several capabilities together. Independent state and failure boundaries limit interference, while shared changes still require combined controlled verification.

A trial or old extension can own the same native methods. Coexistence may disable alignment or repeat a rewrite if ownership is mishandled. Conservative conflict reporting and restart-based cutover preserve the ownership boundary without automatically changing an installation.
