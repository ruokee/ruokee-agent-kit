# ADR proposal: Share tk Skill reference sources

Draft owner: Ruokee
Draft writer: OMP Claude Opus 5.5

English | [中文](./2026-10-04-share-tk-skill-reference-sources.zh.md)

## Motivation

Keep each tk Skill reference that is identical across the tools and CLI Skills of one language in one source file, and have the build copy it into every Skill of that language.

The tools Skill and the CLI Skill of each language carry six reference files with byte-identical content: `catchup.md`, `patterns.md`, `project-storage.md`, `subtask.md`, `task-concept.md`, and `wal.md`. The four Skill source directories therefore hold 24 file copies of 12 distinct texts, six English and six Chinese. An edit has to be repeated in both Skill trees of a language, and a change that reaches only one tree leaves the tools and CLI Skills telling the Agent different rules.

The [tk usage pattern decision](../decision/2026-09-11-align-tk-usage-patterns.md) requires each of the four Skill source directories to keep its own complete pattern reference, so this change needs a reversal of that clause.

## Proposal

### Source layout

The six shared references live once per language under `projects/tk/skills/shared/en/` and `projects/tk/skills/shared/zh/`. The four Skill directories `projects/tk/skills/tk/`, `tk-zh/`, `tk-cli/`, and `tk-cli-zh/` keep `SKILL.md`, their mode-specific references, and any Agent metadata. The tk build copies each shared reference of a language into the `references/` directory of every Skill in that language when it assembles the distributed payloads. A shared file and a Skill-specific file at the same assembled path stop the build.

`SKILL.md` keeps linking to `./references/<file>.md`, the installed path. These links resolve in the assembled payload and in every installed Skill, and the build already rejects a payload Markdown link whose target is missing. In the source tree, a link to a shared reference does not resolve inside the Skill directory.

### What stays unchanged

Each installed Skill stays self-contained under the [self-contained component decision](../decision/2026-08-24-keep-components-self-contained.md): its files reference only files inside the installed Skill, and its content, including every shared reference, is byte-for-byte what the four separate source copies produced. The sources stay inside the tk component directory `projects/tk/`. Tools and CLI references in the same language keep identical content, and English and Chinese keep equivalent meaning. The pattern contract, its owning pages, and the rule that contracts and Skill references change together are unchanged.

### Decision to reverse

**[Align tk usage patterns](../decision/2026-09-11-align-tk-usage-patterns.md).** Effective clauses: in "Skill and contract ownership", "The four authoritative Skill trees are tk, tk-zh, tk-cli, and tk-cli-zh. Each is self-contained and keeps its own complete pattern reference"; and in the consequences, "Four self-contained Skill references … Keeping them aligned requires maintaining four Skill trees". Proposed choice: the four Skill source directories plus `projects/tk/skills/shared/<language>/` are the authoritative sources, a shared reference has one source per language, and self-containment applies to the assembled and installed Skills. Both cannot hold: the decision requires each source directory to keep a complete pattern reference, and this proposal removes the per-directory copies. The successor keeps every other rule of that decision, including the four pattern definitions, adoption and maintenance rules, contract ownership, the public documentation set, and the bilingual rules.

## Alternatives considered

**Keep a complete copy of every shared reference in each Skill source directory.** This is the current rule. Each source directory then resolves its own links, but every shared edit stays duplicated across two trees per language, and drift between the tools and CLI Skills is caught only by review.

## Acceptance criteria

1. The six shared references exist once per language under `projects/tk/skills/shared/`, and no Skill source directory contains a copy.
2. Every assembled tools and CLI payload contains the six references of its language in each Skill's `references/` directory, byte-identical to the shared source, and every Markdown link in the payload resolves.
3. Installing any of the four Skills produces the same files and content as before the change.
4. The tk Skill design pages describe the shared source directory and the self-contained installed Skills in both languages.
5. The usage pattern decision is archived with a complete successor linked by `Reverses` and `Reversed by`, and this proposal is removed.

## Risks

A reader or Agent browsing a Skill source directory follows a `./references/` link to a shared file and finds nothing, because the file exists only after assembly. Someone who edits the source tree without reading the Skill design may then recreate a local copy and reintroduce duplicate sources; the build stops on the path collision, but only after the copy is written.
