# Remote alignment

Draft owner: Ruokee
Draft writer: OMP gpt-6-astra

English | [中文](./22-remote-alignment.zh.md)

## Motivation

Move remote alignment into smart-context without changing its request proof or native execution boundary.

The [current decision](../../../decision/2026/10/10-remote-alignment.md) assigns this capability to smart-cache and makes comparable real Provider benefit measurements a release criterion. Package integration changes ownership, not the alignment algorithm, and its behavior can be checked with deterministic host inputs without claiming Provider savings.

## Proposal

Continue the `10-remote-alignment` identity. Replace smart-cache ownership and `/smart-cache` status with smart-context and `/smart-context`. Replace the required real-benefit release gate with repository checks and controlled runs of the changed paths. Preserve actual historical evidence, and require real measurements for any future claim about Provider cache benefit.

Retain the complete remote contract: the independent default-off switch, exact Provider selection, default `hooks` mode and closed `standard`/`hooks` modes; non-Codex Responses native V2 applicability; main, native task, and Eval session scope; native entry points; and activation-snapshot configuration. Transfer existing settings to the new namespace without runtime fallback or automatic configuration changes.

Preserve final transport-confirmed ordinary references, complete-range and independently reusable local proofs, immutable operation binding, source dependency checks, atomic candidate validation, staged reasons, and bounded counters. Keep native output limits, explicit policy, routing, tool pairing, opaque history, and all unprojected fields. Ordinary and non-target requests remain unchanged. Insufficient proof preserves the entire native request; positive cases remain required, rather than treating blanket refusal as success.

Apply [request alignment](./22-request-alignment.md) for shared observation and wrapper ownership. Do not rerun handlers, inspect Pin private state, rebuild output from current model rules, add credential requests or retries, or replace OMP triggering, trimming, speculation, adoption, history, or continuation. Retain invalidation and ownership-conditional release across navigation, cancellation, model and tool changes, and compaction commits.

The successor keeps still-effective remote rules and native replacement conditions from the current decision. Historical QoL cutover clauses remain historical; no old namespace is revived. Capability-specific reasons and protocol rules do not become package-wide constraints.

## Alternatives considered

None

## Acceptance criteria

- Both modes preserve their existing positive and rejection behavior at the new entry, including session isolation and retry binding.
- Common content aligns only with sufficient proof; ordinary requests, non-target requests, and rejected candidates stay native.
- Status remains read-only and separates proof, rewriting, native adoption, and Provider benefit.
- Controlled evidence identifies its candidate, actual host library, inputs, and coverage without requiring a full real-model or CLI/TUI matrix.

## Risks

A namespace change can leave a previously enabled repair disabled until its settings move. Migration instructions must preserve user and project overrides independently. Correct client alignment can still miss Provider cache, so controlled alignment evidence cannot establish savings.
