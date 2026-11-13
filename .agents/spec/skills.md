# Skills

This specification covers ordinary public Skills and their installation lifecycle. tk's Skills and workloop are independent project components; internal maintenance Skills are repository maintenance capabilities rather than public installation sources.

## Goals

Distribute independently understandable, host-discoverable instruction components in English and Chinese. Preserve each Skill's activation boundary, required behavior, evidence standards, and permissions. Install a selected complete language directory at `<skill root>/<name>/` without a source-only language prefix.

## Out of scope

- Third-party capabilities, forks, or upstream mirrors. First-party Skills may cite, quote, or adapt third-party material with the necessary permission and attribution.
- Plugin manifests, marketplace metadata, package changelogs, package README files, license or notice files, and host-specific Agent definitions inside a pure Skill tree. The explicit invocation policy for `grill-me` is retained.
- Structure for hypothetical Skills, a global installation registry, network access by the ordinary installer, implicit installation of every Skill, or management of project components and Harness configuration.

## Public surface

### Identity

English sources use `skills/<name>/`; Chinese sources use `variants/zh/skills/<name>/`. Each directory includes `SKILL.md` with a name, applicability description, and declared version where maintained, plus its required local references, workflows, examples, or glossary. Both variants retain the same Skill identity, file set, scope, and observable instructions. One installed name has one language per Skill root.

`grill-me` is user-invoked. `python-engineering` and `msgspec` support Agent invocation from matching work and explicit invocation. The bilingual capability index identifies the same names and invocation modes and provides both language destinations.

### grill-me

`grill-me`, displayed as `Grill Me`, turns an incomplete idea or existing plan into shared understanding and an action-ready specification. Only explicit invocation through the host Skill mechanism activates it; ordinary planning, review, deep discussion, or mentioning the Skill does not. Both variants declare `disable-model-invocation: true` and `policy.allow_implicit_invocation: false` in their supported invocation metadata.

For an idea, establish requirements before approaches; for a plan, confirm its requirement basis first. Distinguish the problem or opportunity, desired outcome, candidate intervention, preference, evidence, inference, decision, uncertainty, and risk. Split only independently decidable branches. Check factual premises and whether a candidate serves its outcome without demanding proof for a personal preference. Preserve supported parts, revise misaligned candidates for user choice, and narrow or defer unsupported parts rather than silently discarding the goal.

Establish users, situations, scope, non-goals, constraints, authorization, artifacts, preferences, acceptance, and stopping conditions. Maintain a dependency-aware review map and work only on questions whose prerequisites are settled. Research checkable facts before asking; evidence priority is current explicit user statements, named artifacts and project decisions, direct local evidence, authoritative upstream sources, other sources, then model inference. Read relevant named artifacts. Ask for user-only meaning, experience, priorities, authorization, or material choices that evidence cannot settle or safely defer. Adopt low-risk reversible operational defaults; confirm defaults that choose direction or risk posture.

Each round has at most three independent substantive questions, with no fixed round limit. Use globally increasing `Q` numbers across rounds and recovery; clarification retains its number and a new topic gets a new number. Display the number with every substantive question. Record location, interaction mode, and finish confirmation are unnumbered coordination. Offer prose throughout or structured questions where suitable before the first substantive round; prose remains the default until the user chooses the latter. Open-ended questions always use prose. Structured questions need bounded choices and independently answerable options. Discovery questions explain relevance without assuming the answer; decision questions give facts, a recommendation, consequences, and real alternatives without forcing a coded response.

Use an established authorized record, otherwise recommend and confirm a concrete location with default name `grill.md`. A reference artifact is not automatically the record output. The record is append-oriented, preserving baseline, map, sources, exact numbered questions, answers, requirement contract, preferences, decisions, defaults, deferrals, corrections, and effects. Persist each question's exact text and number before presenting it. If recording is prohibited or unavailable, retain the same state in context, preserve numbering, and state the storage limitation. Do not claim a saved record. Correct earlier conclusions by appending their replacement and effect rather than erasing history.

Process every response before the next round: distinguish acceptance, modification, challenge, deferral, skip, and open matters; preserve the answer and its effects; update requirements and preferences; reopen affected branches; research new facts. Pause the queue for a challenge or deeper discussion. Reuse confirmed preferences and resolve conflicting answers by applicability. Surface consequential unstated assumptions rather than treating exploration as agreement.

Report one rough global readiness percentage, based on overall decision readiness rather than item counts. Before the first substantive answer it is at most about 20%; unclear goals or success normally cap it near 30%; consequential assumptions near 60%; largely complete requirements with named blockers near 80%; final blockers or audit near 90%; 100% requires the audit and finish condition. Use coarse tens or fives with an approximation marker. Report stage, rationale, completed and remaining important branches, dependencies, unknowns, and deferrals after the initial map, about every five completed rounds, on major scope changes, on request, and before finishing, without interrupting an unresolved question.

Before finishing, audit assumptions, failure paths, reversibility, support, acceptance, conflicts, and hidden directional defaults. Present a correctable summary of the problem, outcomes, scenarios, boundaries, preferences, chosen direction, evidence, risks, defaults, and unresolved matters. Finish when consequential matters are settled or safely deferred, the user confirms shared understanding, and the finish condition holds. Early termination reports readiness and remaining uncertainty. Do not implement the subject before final confirmation unless the user explicitly requests deciding and acting in parallel; research and authorized records remain allowed.

### python-engineering

Use for Python project structure, version and dependency policy, typing, tests, docstrings and API documentation, custom lint, language features, standard-library choices, and tooling. Ground judgments in the actual project version, dependency declarations, configuration, code, callers, and tests. Cover scripts, packages, applications and workspaces; annotations and type boundaries; context managers, exception groups, decorators and pattern matching; resource lifetime; and coherent use of uv, Ruff, ty, mypy, basedpyright, pytest, coverage, pre-commit, and custom lint where relevant.

Fast review is default, bounded to a concrete target, with zero to five findings containing severity, location, fact, impact, and smallest recommendation. Check version-compatible syntax, declared dependency groups, layout, public typing, resource cleanup, data models, and unnecessary complexity. Full review requires an explicit full, complete, systematic, or architecture-review request. It uses staged reading and a broader engineering matrix, self-verifies severe findings, and adds confidence, evidence, judgment, and verification to grouped findings. Neither mode invents findings or repeats formatter, linter, or type-checker results.

Analysis reads the actual mechanism and constraints, presents two or three genuine alternatives where they exist, leads with a contextual recommendation, names its cost, and leaves consequential user-only tradeoffs to the user. It produces prose rather than a review score. No mode silently grants edits. Read-only and analysis requests do not run commands that create environments or caches, alter lockfiles, install dependencies, or modify source. Unsafe fixes, bulk edits, cross-file refactors, dependency changes, and behavior changes need their applicable explicit permission. Preserve separate permission to save reports.

### msgspec

Support Struct definitions, fields, defaults, renaming, inheritance, options, supported annotations, validation constraints, tagged unions, typed conversion, custom hooks, and serialization through JSON, MessagePack, YAML, TOML, and JSONL. Include applicable comparisons with Pydantic and dataclasses, troubleshooting, and runnable examples for basic use, tagged unions, and custom conversion. Load only the needed guidance.

Distinguish direct Struct construction from typed decoding or conversion: type and `Meta` constraints apply during decoding and conversion; direct construction runs `__post_init__` without those checks. Preserve the difference between omitted `UNSET` and encoded null `None`. Use hooks only for unsupported native types, check optional YAML/TOML dependencies, and reuse configured encoders and decoders for repeated operations. Performance comparisons name the official method and workload rather than unqualified speed ratios.

### Installation

The public lifecycle command is `sh scripts/skills.sh <check|install|uninstall> [names] --target <skill-root>`. `check` and `install` accept `--language en|zh`, default `en`; `uninstall` has no language selection. The target is the parent of installed Skills, not a selected Skill directory. The tool requires a POSIX shell and common file-comparison tools, not repository development dependencies, Node, Bun, Python, jq, Rust, a build, or a network connection. Git is optional; a Git checkout can report the compared HEAD and source changes.

`check` is read-only and creates no target, backup, or state. With names it compares exactly those Skills, including absent targets; without names it compares installed Skills and counts the remainder. It reports source, target, declared version or `unknown`, and `identical`, `differs`, `cannot compare`, `not installed`, or a broken link. Compare the complete directory, including changed, added, and deleted support files. Equal versions do not imply equal content; unreadable content is a failure, never a match. A top-level symlink compares its resolved contents; a broken link is not installed content.

`install` handles one selected Skill at a time. A missing target receives the complete directory; identical content produces `no change` without writes; different content is untouched unless `--replace` explicitly authorizes replacement. Replacement backs up the prior target and replaces the entire directory, removing target-only files rather than merging. An unreadable target is untouched. Failure retains the previous content or a complete backup, identifies unfinished work, exits nonzero, and never labels a partial copy installed.

`uninstall` first reports the exact target without changing it. `--yes` authorizes only that target. An ordinary directory is backed up before removal; a symlink is unlinked without changing its destination. Preserve neighboring Skills, the root, and source checkout. Hand-copied installations require no registration or migration. A same-name directory is a comparison candidate, not proof of origin or overwrite authority.

Each replacement or removal reports its unique per-operation backup below `${XDG_STATE_HOME:-$HOME/.local/state}/ruokee-agent-kit/skill-backups/`, outside discovery roots and repository Skill sources. Backups contain the whole former directory, or `link-target.txt` for a link; they are copies, not an installation registry. Restoration preserves any currently installed content in a fresh holding directory before restoring the backup, so repeated restoration does not nest directories or discard later changes.

A write that reaches either language's repository Skill sources is rejected before creating anything, including a target root equal to, inside, or containing a source tree, and a backup under a source tree. Replacing a top-level link never writes through it. A missing path portion containing `.` or `..` is rejected rather than normalized differently from filesystem resolution.

Exit statuses are `0` for a consistent comparison or completed/unchanged lifecycle operation; `1` for a differing or absent named target or required `--replace`/`--yes` without changes; `2` for usage, name, path, read, comparison, or file-operation failure. The tool reads the checkout containing the script, does not pull Git or edit Harness configuration, and cannot establish host discovery or reload. Manual complete-directory copies and supported top-level links are valid installations; linked contents follow their source. Host-specific reload remains the user's responsibility.

## Invariants

- Every distributed language component references only its own files. Naming another component, tool, or Skill requires no dependency declaration by itself. Actual prerequisites are explicit and may be used by name or through their public interfaces; linking to, importing, or reading another repository component's files or package, or repository support files, is not permitted.
- Both language variants have the same file set and complete semantic coverage. File links are relative to the containing document, resolve inside that component, and remain usable after installation without source-only layout prefixes.
- Each Skill owns its internal guidance organization while preserving complete capability, reference navigation, terminology, and its invocation contract. `SKILL.md` remains the discoverable entry. Internal directories and file counts do not replace these behavioral requirements.
- Source authorship, applicable licenses, and required attribution remain accurate at repository level or in an appropriate component README or decision. Skill content does not become a third-party mirror merely through cited material.
- Review and analysis remain read-only for their subjects; separate report permission is preserved. No Skill silently converts analysis into implementation.
- Skills load instructions rather than host-process code, so they have no host maintenance lower bound.

## Acceptance criteria

- Each language directory is independently discoverable and complete, with no escaping file reference. Matching and nonmatching requests preserve activation boundaries, especially explicit-only `grill-me`.
- Review scenarios can legitimately return zero findings, respect mode limits, preserve read-only scope, and separate evidence from recommendations.
- Grill preserves exact global question numbering and recoverable question text, processes answers before dependent questions, and does not report completion before its finish conditions. Missing recording permission changes storage, not the questioning contract.
- Install, check, replacement, restoration, and removal preserve complete content, explicit overwrite authority, source protection, neighboring installations, and the specified failure and exit behavior. Matching files do not establish a loaded host revision.
- Capability indexes, language contents, invocation metadata, and versions agree. When a Skill's accepted contract requires real-host or real-model validation, including `grill-me` invocation behavior, behavior changes retain that validation obligation. File checks and scenario inspection remain distinct evidence.
