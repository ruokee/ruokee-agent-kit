# Remove the ADR glossary

Draft owner: Ruokee
Draft writer: OMP DeepSeek V4.1 Flash

English | [中文](./17-remove-adr-glossary.zh.md)

## Motivation

Remove the ADR glossary and keep the repository dictionary as the only non-component term source.

The [ADR glossary](../../../glossary.md) repeats five terms that the proposed dictionary defines: ADR, proposal, decision, update decision, and reverse decision. Both copies define the same repository concepts. The dictionary proposed in the [repository dictionary proposal](./17-repository-dictionary.md) carries the same meanings and adds the mechanism, examples, an avoid note, and the archived version. The glossary adds no unique term.

Keeping two copies creates a second authority. Each change to an ADR term must update both places, and the copies can drift. The ADR guide, the repository specification, the repository dictionary proposal, and two current decisions currently require or point to the glossary, so its removal changes those bindings as well as the files.

## Proposal

Delete `.agents/adr/glossary.md` and `.agents/adr/glossary.zh.md`. The dictionary's ADR page, created by the [repository dictionary proposal](./17-repository-dictionary.md), and its Chinese page become the definition source for ADR terms.

Update the current bindings:

- The [ADR guide](../../../README.md) and its Chinese page remove the glossary link, the glossary reading instruction, the root-directory requirement, and the glossary-entry rule. They point to the dictionary's ADR page instead.
- The terminology rule (`.agents/rule/terminology.md` and `.agents/rule/terminology.zh.md`) introduced by that change removes the requirement to keep ADR-local terms in the ADR glossary and states that only distributable component glossaries keep local copies; the rest of the repository uses the dictionary.
- The [repository specification](../../../../spec/repository.md) and its Chinese page remove the glossary from the public surface and the contract statement.
- The [specifications decision](../../../decision/2026/10/04-specifications.md) and the [repository rules decision](../../../decision/2026/10/12-repository-rules.md), with their Chinese pages, remove their statements that the ADR glossary stays unchanged. These are factual corrections, not reversals.

The merged [repository dictionary proposal](./17-repository-dictionary.md) retains the ADR glossary and requires wiring it in its acceptance criteria. This proposal supersedes those glossary clauses and acceptance criteria; the dictionary implementation change removes the consumed proposal and does not wire or update the ADR glossary.

Reverse the [ADR mechanism decision](../../../decision/2026/08/22-adr-mechanism.md). Its `Terminology` subsection requires maintaining the glossary, its `Paths` subsection names the glossary root location, its `Maintenance` subsection names the paired glossary, and its `Consequences` section limits the glossary's size. Those clauses conflict with deletion and cannot be added under `Changes`. The successor keeps every other clause, including the ADR term and root, decision identity, the proposal workflow, record format, authoring rules, the decision lifecycle, the remaining path rules, and the maintenance rule against dedicated ADR tooling. The replaced decision moves to its next archive revision.

Keep archived ADRs' historical choices, body meaning, and glossary records unchanged. Necessary relationship and factual link repairs remain allowed and required, including moving the replaced decision's `Reversed by` link as the ADR rules require. Their glossary mentions remain historical records, not current requirements.

## Alternatives considered

**Keep the glossary as a five-term quick reference.** It is shorter than the dictionary page and familiar to ADR authors. It duplicates the dictionary, creates a second authority, and requires synchronized updates. Rejected.

**Keep the glossary and add a consistency check.** A check would detect drift but would not remove the duplicate authority, and this work does not add terminology checks. Rejected.

## Acceptance criteria

- `.agents/adr/` contains no `glossary*` file.
- ADR, proposal, decision, update decision, and reverse decision are defined in the dictionary index and its ADR page pair.
- The ADR guide and its Chinese page contain no glossary link, glossary reading instruction, glossary maintenance requirement, or glossary-entry rule; they point to the dictionary's ADR page.
- The terminology rule and its Chinese page no longer require ADR-local terms in a separate glossary, and state that only component glossaries keep local copies.
- The repository specification and its Chinese page list the ADR guide and the dictionary, not the glossary.
- The merged repository dictionary proposal's glossary retention clauses and its glossary acceptance criteria are superseded; the implementation does not wire or update the ADR glossary.
- The current ADR mechanism decision is replaced by a successor that removes the glossary clauses and preserves the other rules. The replaced version is archived with its actual archival date and next revision number.
- No current document references the ADR glossary, by link or by name; current references that discuss terms resolve to the dictionary's ADR page; archived ADRs keep their historical choices and body meaning, with necessary relationship and factual link repairs only.
- `pnpm docs:lint` and the complete `pnpm check` pass on the clean, committed candidate.

## Risks

- ADR authors lose the five-entry quick reference and must open the dictionary's ADR page. If that page becomes incomplete, the glossary's practical lookup path disappears.
- The reversal must reconstruct the ADR mechanism decision without dropping still-effective rules. An incomplete successor could weaken the identity, proposal, or lifecycle rules.
- Updating the guide, rule, specification, and dictionary decision in both languages can leave a stale reference or an inconsistent pair. Paired review of the English and Chinese files covers semantic consistency; link checks cover only resolution.
