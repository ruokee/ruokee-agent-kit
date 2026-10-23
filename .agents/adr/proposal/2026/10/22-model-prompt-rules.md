# Model prompt rules

Draft owner: Ruokee
Draft writer: OMP gpt-6-astra

English | [中文](./22-model-prompt-rules.zh.md)

## Motivation

Move model prompt rules into smart-context while preserving their files and turn-level behavior.

The [current decision](../../../decision/2026/09/14-model-prompt-rules.md) assigns rules to QoL and requires both its master switch and the module switch. The new owner needs an independent switch without changing the user's rule data or adding injection paths.

## Proposal

Continue the `14-model-prompt-rules` identity. Replace QoL ownership and master-switch dependence with smart-context ownership and independent `modelPromptsEnabled`, still defaulting to `false`. Read the switch once at activation. When off, register no injection handler, read no rule directory, and diagnose no unused rule files. Invalid module settings disable this module without disabling others. Report state through `/smart-context` without a model turn, rule bodies, or model identifiers.

Preserve the current profile's user agent directory and the project's `.omp/model-prompts`. Read only direct, non-hidden, lowercase `.md` regular files. Keep case-sensitive `exact`, `model`, `contains`, and `regex` matching, OR semantics within a file, and one append per matching file. Keep frontmatter validation and removal, leading BOM removal, and byte-exact bodies including line endings.

Every covered `before_agent_start` turn rereads its rules and effective model. Preserve incoming blocks, append user files before project files and filename order within each directory, and keep one block per matched file without wrappers. Ordinary children use their own models. Consecutive turns must not accumulate appended bodies. With no model, rule, or match, retain the input.

Preserve per-file and per-directory failure isolation, fixed relative-source diagnostics deduplicated by the event's session, and unexpected-handler recovery that retains earlier handlers' results. No new route serves Handoff, plan-mode children, title generation, classification, mid-turn fallback, or individual Provider requests. Keep direct host dependencies inside the new component and the existing native replacement recheck.

Project rule files become system instructions. Preserve the existing absence of a project-trust gate, security isolation, regular-expression sandbox or timeout, and body-size limit. Public documentation must name the directories and their injection effect. A project carrying matching rules can therefore change the system instructions of sessions opened in it.

Remove the QoL implementation and `modelPromptsEnabled` setting. Migration preserves the former effective `enabled && modelPromptsEnabled` result, handles user and project overrides separately, and clears the removed key from both QoL scopes. Keep rule files unchanged and perform no automatic configuration migration.

Repository checks and controlled runs through actual prompt assembly and serialization establish integration acceptance. Replace mandatory real-model or full CLI/TUI coverage with this bounded gate, without presenting handler return values alone as Provider-facing evidence or relabeling historical runs.

## Alternatives considered

None

## Acceptance criteria

- Default-off rules cause no file reads, injection, or unused-file diagnostics, independently of Pin and compression settings.
- Existing files preserve matching, ordering, body fidelity, next-turn refresh, and failure isolation.
- Controlled final requests contain matched bodies once, without frontmatter or lost native blocks.
- QoL no longer injects rules, and migrated effective enablement preserves user intent.

## Risks

Rules still consume prompt space and synchronous turn preparation waits for directory reads. Broad text matching can affect unintended models. Moving the switch without folding in QoL's old master state could activate rules the user had disabled.
