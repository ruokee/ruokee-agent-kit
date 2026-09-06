# ADR proposal: Add the user-invoked grill-me Skill

Decision owner: Ruokee
Draft writer: OMP GPT-6 Astra

English | [中文](./2026-09-06-add-grill-me-skill.zh.md)

## Motivation

Ruokee needs a questioning capability that turns an incomplete idea or an existing plan into shared understanding and an action-ready specification. `grill-me` discovers requirements and preferences, resolves checkable facts, and clarifies the choices needed before action.

Sustained questioning is a deliberate interaction mode. Ordinary discussion, planning, and review must not activate it automatically. Its invocation contract follows the [architect decision](../decision/2026-08-22-add-manual-architect-skill.md).

## Proposal

### Ownership and distribution

`grill-me` is authored and independently maintained by Ruokee, consistent with the [first-party repository boundary](../decision/2026-08-20-establish-first-party-capability-kit.md). The original concept comes from Matt Pocock's [skills repository](https://github.com/mattpocock/skills).

Preserve the concept attribution and the applicable MIT copyright and license notice for retained third-party material. First-party maintenance does not remove attribution obligations.

Distribute a self-contained English Skill under `skills/grill-me/` and a complete Chinese counterpart under `variants/zh/skills/grill-me/`. Each contains `SKILL.md`, `agents/openai.yaml`, and the applicable `LICENSE.txt`. Each language component is complete and usable on its own.

Use the repository's pure-Skill layout, without Plugin packaging or a separate runtime. The English and Chinese Skill indexes describe its purpose and explicit invocation condition.

Use `grill-me` consistently in discovery metadata, invocation examples, and default prompts, and `Grill Me` as the display name. Use the established record location. If none exists, recommend a concrete path with `grill.md` as the default filename and confirm the location with the user before writing.

### User invocation

Both language variants set:

```yaml
# SKILL.md frontmatter
name: grill-me
disable-model-invocation: true
```

```yaml
# agents/openai.yaml
policy:
  allow_implicit_invocation: false
```

The user must explicitly invoke the Skill through the host's Skill invocation mechanism. Discussing the Skill itself is not an invocation. A natural-language request to examine a plan deeply or ask questions does not authorize automatic activation.

The description states applicability and coverage. Invocation policy belongs in configuration, following architect's convention.

### Behavior

The Skill uses evidence and focused question rounds to establish shared understanding:

- Support both incomplete ideas and existing plans. Discover requirements before selecting approaches; establish the requirement basis before examining an existing plan.
- Distinguish problems or opportunities, desired outcomes, candidate requirements, user preferences, and evidence. Check whether a proposed intervention serves its outcome without demanding that users justify personal preferences.
- Research checkable facts before asking the user. Ask for information only the user can supply and for consequential choices that cannot safely be defaulted or deferred.
- Ask at most three independent substantive questions per round, with no fixed round limit. Preserve global `Q` numbering across rounds and recovery. Before the first substantive question, offer prose throughout or structured questions where suitable. Until the user chooses the latter, use prose for substantive questions. Structured questions require clear boundaries, options covering the main choices, and answers that can be submitted independently. Open-ended questions always use prose.
- Maintain an append-oriented record, requirement contract, preference ledger, dependency-aware review map, and answer-processing sequence. When recording is prohibited or no authorized writable location exists, retain the review state in the conversation and explain the storage limitation.
- Reopen affected branches when upstream answers change. Report qualitative global readiness rather than a percentage computed from item counts.
- Check assumptions, failure paths, conflicts, and directional defaults before the shared-understanding summary. Finish only when consequential matters are settled or safely deferred and the user confirms the summary, or report remaining uncertainty when the user ends early.
- Do not implement the reviewed subject before final confirmation unless the user explicitly asks to decide and act in parallel. Research and authorized record maintenance remain allowed.

The component provides these rules without depending on another component or hard-coding project-specific recording conventions.

## Alternatives considered

Distribute the capability as a Plugin. A Plugin would package the same Skill content and descriptive metadata without adding runtime behavior. The pure-Skill layout is sufficient and avoids a separate package contract.

## Acceptance criteria

1. Both self-contained language components use the `grill-me` identifier and `Grill Me` display name, preserve applicable attribution and licensing, and contain no dependency on another component.
2. Both set `disable-model-invocation: true` and `policy.allow_implicit_invocation: false`. Descriptions do not permit automatic activation for deep-review requests.
3. The two variants implement the behavior listed above and agree semantically. Skill indexes describe the same role and manual invocation condition.
4. For each host covered by validation, verify that ordinary planning, a deep-review request without explicit invocation, and discussion of the Skill itself do not load it. Verify that explicit invocation does load it.
5. Exercise both an incomplete idea and an existing plan after explicit invocation. Check research-before-questioning, question limits and numbering, record continuity, correction of an upstream answer, early termination, and the prohibition on unauthorized implementation. Record the hosts and scenarios tested, results, and limitations.
6. Run the repository checks.

## Risks

- A host that ignores invocation metadata can still activate the Skill unintentionally and divert ordinary work into sustained questioning. Verify the intended host behavior and document unsupported enforcement rather than relying on descriptive prose.
- `grill-me` can collide with another installed Skill of the same name. Installation guidance must identify this repository as the source and require the user to resolve a detected collision rather than silently overwriting another component.
- A language component missing its license or other required files would be incomplete. Validate each language directory independently.
