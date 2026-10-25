# Ruokee Agent Kit

English | [中文](./README.zh.md)

I use these Agent Skills and extensions every day for real engineering work, personal note management, and more.

I keep running into the same problems across Agent Harnesses. Some are a good fit for a Skill; others need a more complex extension.

Ruokee Agent Kit contains only capabilities I developed for my own work and am willing to maintain in public. Each capability should have a clear purpose, readable documentation, and a real validation path.

## What Harness I use

I currently mainly use OMP, Oh My Pi, with a small configuration. I want a Harness that can use model services from most providers rather than being limited to particular models. I also want strong extensibility, a good-looking interface, and common development features within reach. OMP includes many features out of the box. I think of it as Pi with a large set of features preinstalled. After disabling most of what I do not need, it works well for me. OMP still has limits, so I may switch if a better-fitting Harness becomes available.

I also use Pi, Claude Code, and Codex.

## Capabilities

### Skills

These are the Skills I use in my daily work.

**User-invoked**

- **[grill-me](./skills/grill-me/SKILL.md)** turns an incomplete idea or existing plan into shared understanding and an action-ready specification through evidence-first question rounds. It maintains a durable record and global question numbering while checking requirements, preferences, and assumptions. Invoke it explicitly with `/skill:grill-me`; ordinary planning and review requests do not activate it. [Chinese variant](./variants/zh/skills/grill-me/SKILL.md)
- **[workloop](./projects/workloop/README.md)** guides new tk Tasks through goal clarification, planning, execution, independent verification, and project-defined delivery. Install one complete `workloop` or `workloop-zh` Skill for natural-language use across Harnesses; OMP also accepts five matching language-specific `/wl-*` Prompt templates through direct file installation.

**Agent-invoked**

- **[architect](./skills/architect/SKILL.md)** covers system-level architecture analysis, design, review, technology selection, and evolution. Use it for system decisions that cross module or service boundaries and need explicit tradeoffs. It provides architecture judgment criteria, common tradeoffs, and examples. [Chinese variant](./variants/zh/skills/architect/SKILL.md)
- **[code-quality](./skills/code-quality/SKILL.md)** covers code and test quality, design tradeoffs, and refactoring opportunities, with quick reviews, full reviews, and exploratory analysis. [Chinese variant](./variants/zh/skills/code-quality/SKILL.md)
- **[python-engineering](./skills/python-engineering/SKILL.md)** covers Python project structure, version and dependency policy, typing, testing, standard-library choices, tooling, and Python-specific code review. [Chinese variant](./variants/zh/skills/python-engineering/SKILL.md)
- **[msgspec](./skills/msgspec/SKILL.md)** covers struct definitions, type validation, serialization, and deserialization with `msgspec`. [Chinese variant](./variants/zh/skills/msgspec/SKILL.md)
- **[deep-research](./skills/deep-research/SKILL.md)** guides structured, evidence-first research through broad exploration, targeted research, source verification, and synthesis. It includes source collection, claim classification, unresolved-question records, and parallel sub-agent research, producing a report and supporting documents by default. [Chinese variant](./variants/zh/skills/deep-research/SKILL.md)
- **[well-said](./skills/well-said/SKILL.md)** applies when outputting anything, including replies, documentation, code comments, and agent communication. It covers style patterns, defensive phrasing, writing-session residue, article writing, and author voice. Defensive-phrasing guidance distinguishes wording problems from work that needs completing or redoing. Inspired by [unslop](https://github.com/cursor/plugins/blob/main/pstack/skills/unslop/SKILL.md) by [Lauren Tan](https://github.com/poteto). [Chinese variant](./variants/zh/skills/well-said/SKILL.md)

### Extensions

Standalone plugins and extensions that add or adjust Harness functionality.

**General**

- **[tk](./projects/tk/README.md)** is a persistent task management CLI for temporary project efforts worth preserving. English and Chinese Skills guide Agents using the public `tk` commands. `tk` preserves task progress and shared understanding across context compaction, sessions, and Agents.

**OMP**

- **[omp-status-bar](./projects/omp-status-bar/README.md)** adds an OMP status bar with extra context information, including current session context usage as a number rather than the native percentage, total tokens, input tokens, cached tokens, output tokens, cache-hit rate, and the number of model requests the session has answered.
- **[omp-qol](./projects/omp-qol/README.md)** provides independently switchable wait deadlines, bounded model-error recovery, experimental compaction deadlines, native history replay, task argument cleanup, and copying the last reply.
- **[omp-smart-context](./projects/omp-smart-context/README.md)** provides remote and Handoff request alignment, compaction usage accounting, opt-in model prompt rules, and opt-in Pin, with independent switches and state.

## Install

Skill installation is separate from the development setup below. Follow [Installing Skills](./docs/installation.md) for ordinary Skills.

Follow each project component's README for its build and installation requirements. Install the tk runtime separately from its CLI Skill.

## Contribute

See the [contribution guide](./CONTRIBUTING.md) to report a problem, suggest a change, or contribute documentation or code.

## Development

### Documentation layers

Durable repository decisions are recorded as bilingual [ADRs](./.agents/adr/README.md). Bilingual [specifications](./.agents/spec/README.md) completely state each component's or repository area's required target and observable results, independently of its implementation and explanatory documents. Their index provides language, topic, and decision navigation; spec bodies contain no repository-file links. The bilingual [rule layer](./.agents/rule/README.md) states how work is done here: what a contributor or an Agent must do, in what order, with which permission, and what is forbidden. Shared terms for that work are defined in the bilingual [dictionary](./docs/dictionary/README.md).

The internal [maintain-spec](./.agents/skills/maintain-spec/SKILL.md) and [maintain-adr](./.agents/skills/maintain-adr/SKILL.md) Skills own the main maintenance methods. Load the applicable Skill before maintaining or reviewing those documents, including feature work that affects a long-lived target or durable choice. Their layer READMEs hold project supplements and navigation.

The [development rules](./.agents/rule/development.md) cover planning a change, preparing environments, running checks, and the merge gate.

### Git

The project follows [Trunk-Based Development](https://trunkbaseddevelopment.com/). `main` is the only long-lived branch. Work uses a short-lived branch from current `main`, or a verified predecessor for authorized dependent development. Integration uses separate squash merges after explicit authorization. Commit messages are English Conventional Commits. The [Git rules](./.agents/rule/git.md) cover branches, working directories, commits, and the authorization each action needs.

Before development, install the Git hooks:

```bash
pnpm install --frozen-lockfile
pnpm hooks:install
```

The hooks format staged files before each commit and check the commit message. A message that breaks the type or scope rules stops the commit and prints the violated rule.

### Repository layout

Public English Skills live under `skills/<name>/`, and their Chinese variants under `variants/zh/skills/<name>/`. Internal English maintenance Skills live under `.agents/skills/` and are not public installation sources. Plugins, extensions, executables, and Harness packages keep the layout their Harness or build system expects.

The [repository specification](./.agents/spec/repository.md) owns repository conventions, documentation pairs, and internal maintenance Skills. The [Skill specification](./.agents/spec/skills.md) covers publicly distributed ordinary Skills.

### Component host maintenance

Components that load code into a host process state a maintenance lower bound in their own README compatibility section, keep their host peer declarations to package names, and raise a bound only through its own decision. OMP-facing components share one lower bound. The [host maintenance decision](./.agents/adr/decision/2026/09/28-host-maintenance.md) records the complete rules.

### Check prerequisites

Use the pnpm version declared in [package.json](./package.json), its supported Node.js runtime, and Git. Prepare root locked dependencies and hooks as above. During development, prepare only the environments selected by the [check selection rules](./.agents/rule/development.md#checks), including document consumers; multiple scopes use their union.

For components with their own development environments, follow the exact locked preparation and check commands in the READMEs linked from [Capabilities](#capabilities) or their linked validation guides. Complete validation or complete fallback requires every environment registered by the [selector](./scripts/check-changed.mjs), not just the edited component.

Repository-owned Skill lifecycle checks need a non-root POSIX shell environment, Git, `diff`, and the system file tools used by [the lifecycle script](./scripts/tests/skills.sh). Shared Markdown and selector checks use the root tools. Dependency installation remains separate from checks.

### Complete merge validation

Merge requires the complete `pnpm check` on the clean, committed final candidate, which must contain target `main`, and the result is recorded. The [merge gate rules](./.agents/rule/development.md#merge-gate) state what that record contains and what invalidates it, and an authorized squash merge uses the unchanged target and the validated tree.

The complete command runs `node scripts/check-changed.mjs --complete` without collecting changed paths. The [selector](./scripts/check-changed.mjs) owns the ordered complete check list and explicit consumer mapping. It verifies all selected tools and local inputs before the first command, stops on the first failure, and returns a nonzero status. Checks do not install dependencies or rewrite sources.

The [repository check decision](./.agents/adr/decision/2026/09/12-repository-checks.md) defines the complete contract.

### Common commands

```bash
# Run affected checks for development and review
pnpm check:changed
pnpm check:changed --base <ref>

# Run complete automated checks from the repository root
pnpm check

# Run only the Markdown and Rust baseline
pnpm check:base

# Run only affected-selector regression tests
pnpm check:selector

# Run only the Skill lifecycle tests
pnpm check:skills

# Format or check all Markdown files
pnpm docs:format
pnpm docs:lint

# Pass selected files directly to Prettier
pnpm exec prettier --write [files]
pnpm exec prettier --check [files]
```

## License

Ruokee Agent Kit is licensed under the [MIT License](./LICENSE).
