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

**Agent-invoked**

- **[architect](./skills/architect/SKILL.md)** covers system-level architecture analysis, design, review, technology selection, and evolution. Use it for system decisions that cross module or service boundaries and need explicit tradeoffs. It provides architecture judgment criteria, common tradeoffs, and examples. [Chinese variant](./variants/zh/skills/architect/SKILL.md)
- **[code-quality](./skills/code-quality/SKILL.md)** covers code and test quality, design tradeoffs, and refactoring opportunities, with quick reviews, full reviews, and exploratory analysis. [Chinese variant](./variants/zh/skills/code-quality/SKILL.md)
- **[python-engineering](./skills/python-engineering/SKILL.md)** covers Python project structure, version and dependency policy, typing, testing, standard-library choices, tooling, and Python-specific code review. [Chinese variant](./variants/zh/skills/python-engineering/SKILL.md)
- **[msgspec](./skills/msgspec/SKILL.md)** covers struct definitions, type validation, serialization, and deserialization with `msgspec`. [Chinese variant](./variants/zh/skills/msgspec/SKILL.md)
- **[deep-research](./skills/deep-research/SKILL.md)** guides structured, evidence-first research through broad exploration, targeted research, source verification, and synthesis. It includes source collection, claim classification, unresolved-question records, and parallel sub-agent research, producing a report and supporting documents by default. [Chinese variant](./variants/zh/skills/deep-research/SKILL.md)
- **[well-said](./skills/well-said/SKILL.md)** applies while writing, editing, or reviewing user-visible prose, including delegation, handoff, and review messages between agents. It combines style cleanup, visible writing-session cleanup, and reducing unnecessary self-justification while preserving meaning, author voice, and literal material. Explicit invocation is also supported. [Chinese variant](./variants/zh/skills/well-said/SKILL.md)

### Extensions

Standalone plugins and extensions that add or adjust Harness functionality.

**General**

- **[tk](./projects/tk/README.md)** is a persistent task management tool for temporary project efforts worth preserving. It provides access through the `tk` CLI, MCP, Pi Packages, and other integrations. `tk` preserves task progress and shared understanding across context compaction, sessions, and Agents.

**OMP**

- **[omp-status-bar](./projects/omp-status-bar/README.md)** adds an OMP status bar with extra context information, including current session context usage as a number rather than the native percentage, total tokens, input tokens, cached tokens, output tokens, cache-hit rate, and the number of model requests the session has answered.
- **[omp-codex-web-access](./projects/omp-codex-web-access/README.md)** lets OMP use a Codex subscription through a forwarding Provider for web search and page extraction.
- **[omp-system-prompt](./projects/omp-system-prompt/README.md)** applies a maintained English strategy to OMP's system prompt through a host template the user selects; any other system prompt stays as the host built it. It is approaching deprecation while its template, Delivery, footer, and current maintenance remain.
- **[omp-context-pin](./projects/omp-context-pin/README.md)** keeps a small set of pinned text entries present word for word in every ordinary model request on the current session branch, and restores them after each committed compaction.
- **[omp-qol](./projects/omp-qol/README.md)** provides independently switchable wait deadlines, bounded model-error recovery, experimental compaction deadlines, native history replay, opt-in remote compaction cache alignment, and opt-in model prompt rules.

## Install

Skill installation is separate from the development setup below and needs neither the development dependencies nor a build. Extensions and the tk runtime are built and installed from their own directories, as their READMEs describe.

### Choose a capability

| What you need | Component |
| --- | --- |
| Code and test quality analysis | [code-quality](./skills/code-quality/SKILL.md) |
| Python engineering practice | [python-engineering](./skills/python-engineering/SKILL.md) |
| `msgspec` structs, validation, and serialization | [msgspec](./skills/msgspec/SKILL.md) |
| Architecture judgment across system boundaries | [architect](./skills/architect/SKILL.md) |
| Research with collected and verified sources | [deep-research](./skills/deep-research/SKILL.md) |
| Requirements clarified through question rounds | [grill-me](./skills/grill-me/SKILL.md), explicit invocation |
| Task state across sessions and Agents | [tk](./projects/tk/README.md), with its own runtime |
| Changes to an OMP interface or behavior | the OMP extensions below |

### Ordinary Skills

An ordinary Skill is a directory that holds `SKILL.md` and, when it needs them, its own references and workflows. Installing copies that complete directory into the Skill root your Harness loads, for example `$HOME/.omp/agent/skills` for user-level OMP Skills.

Follow [Installing Skills](./docs/installation.md) for the language choice, the Skill root, and the check, install, update, and uninstall commands. Chinese variants of the same Skills live under `variants/zh/skills/`.

### Extensions

Extensions have their own installation and update instructions. Follow the linked component README. Install the tk runtime separately from its Harness components.

## Development

### Git

The project follows [Trunk-Based Development](https://trunkbaseddevelopment.com/). `main` is the only long-lived branch. Start work on a short-lived branch from current `main`, use English Conventional Commit messages, and merge into `main` through squash merge after explicit authorization.

Commit messages use the Conventional Commits types, and scope is optional. A message that carries a scope uses one of `skills`, `extensions`, `adr`, or `repo`; a change that spans two areas carries no scope.

Use an independent worktree under `.worktrees/` for code, configuration, scripts, parallel tasks, and any task whose exclusive use of the main working directory cannot be confirmed. A serial explanatory Markdown or ADR task may use the main working directory only when it is clean, no parallel work is active, and exclusive use is confirmed. Create and switch to a short-lived branch before editing; never edit or commit directly on `main`.

Documentation read by a test can still qualify for this directory exception, but must run its consumer checks. Runtime templates are source inputs, not explanatory documentation. If the task expands beyond explanatory Markdown or loses exclusive use, stop editing in the shared directory and preserve the work in an independent worktree before continuing.

Before development, install the Git hooks:

```bash
pnpm install --frozen-lockfile
pnpm hooks:install
```

The hooks format staged files before each commit and check the commit message. A message that breaks the type or scope rules stops the commit and prints the violated rule.

### Repository layout

English Skills live under `skills/<name>/`. Chinese variants live under `variants/zh/skills/<name>/`, but install at the normal `skills/<name>/` host path. A pure Skill contains only the material needed to discover, understand, and use it.

Plugins, extensions, executables, and Harness packages keep the layout their Harness or build system expects. The repository adds a top-level area only when a real component needs it.

Ordinary public documentation uses same-directory `name.md` and `name.zh.md` pairs. Repository and component entry pages use `README.md` and `README.zh.md`.

Durable repository decisions are recorded as bilingual [ADRs](./.agents/adr/README.md). Bilingual [specifications](./.agents/spec/README.md) state the current target of each component and repository area, linking to the decisions and documents that own the details.

### Component host maintenance

Components that load code into a host process state a maintenance lower bound in their own README compatibility section, keep their host peer declarations to package names, and raise a bound only through its own decision. OMP-facing components share one lower bound. The [host maintenance decision](./.agents/adr/decision/2026-10-04-raise-omp-host-floor.md) records the complete rules.

### Check prerequisites

Use the pnpm version declared in [package.json](./package.json), its supported Node.js runtime, and Git. Prepare only the environments selected by affected checks during development:

| Selected scope | Environment to prepare |
| --- | --- |
| Explanatory Markdown or ADR formatting | Root locked dependencies and Git hooks as above |
| One OMP component | Root tools, Bun compatible with its lockfile, and `bun install --frozen-lockfile` in that component directory |
| tk | Root tools, Rust with `rustfmt` and the [tk build prerequisites](./projects/tk/README.md), locked crate dependencies, Bun, and native adapter test system tools |
| Skill lifecycle | Root tools, Git, a non-root POSIX shell environment, `diff`, and the test script's common system file tools |
| Complete checks or complete fallback | All of the above, including every OMP component's locked dependency tree |

Known document consumers add their required environment; multiple scopes use the union. This does not change the working-directory rule. Keep independent writable dependency and build directories for each branch. Package-manager content caches may be reused within the same trust boundary; reprepare a selected environment when its manifest or lockfile changes.

For complete validation, install each OMP component's locked dependencies:

```bash
(cd projects/omp-status-bar && bun install --frozen-lockfile)
(cd projects/omp-system-prompt && bun install --frozen-lockfile)
(cd projects/omp-codex-web-access && bun install --frozen-lockfile)
(cd projects/omp-context-pin && bun install --frozen-lockfile)
(cd projects/omp-qol && bun install --frozen-lockfile)
```

### Affected checks

Run `pnpm check:changed` from the repository root during development and before requesting review. Before review, commit task changes and leave the working tree clean.

The default baseline is the branch's merge base with local `main`. Selection includes committed, staged, unstaged, and non-ignored untracked paths, deleted paths, and both sides of renames. Use `pnpm check:changed --base <ref>` for another ref's merge base with `HEAD`, not a comparison of branch tips. The command does not fetch history.

The [selector](./scripts/check-changed.mjs) maintains an explicit mapping:

| Changed scope | Selected checks |
| --- | --- |
| Known explanatory Markdown, including ADRs, specifications, root READMEs, Skills, and component documentation | Prettier for changed files that still exist, using the repository configuration and ignore rules |
| Registered OMP component non-Markdown files, or Markdown under its `src/` or `test/` | That component's `typecheck` and `test`, plus changed Markdown formatting |
| tk non-Markdown files, or Markdown in its `skills/`, `claude/`, `pi/`, or `omp/` packaging trees | Rust formatting and tests, native adapter tests, and changed Markdown formatting |
| [docs/installation.md](./docs/installation.md), its Chinese counterpart, or the Skill installation and lifecycle scripts | Skill lifecycle tests, plus changed Markdown formatting |
| Multiple known scopes | Their check union, without duplicate execution |
| Shared toolchain or check inputs, selector changes, unknown paths, or an unreliable baseline or classification | One complete `pnpm check`, without first running partial checks |

Consumer rules take priority over the ordinary Markdown rule. Unknown components, including their Markdown files, are not treated as formatting-only. New components, required checks, and document consumers must update the complete check list and explicit mapping in the selector and the [selection tests](./scripts/tests/check-changed.test.mjs) together.

Output lists the baseline and merge base, path sources, selected scopes and commands, fallback reason, and failing step.

Missing tools or selected local dependencies fail without installation or substitution with global TypeScript. Git absence, an invalid checkout, and unresolved index conflicts fail directly. Insufficient history or unreliable path collection triggers complete fallback.

Deleted explanatory Markdown may need no formatter. An empty affected result is not complete merge validation.

### Complete merge validation

After all review changes, validate the final candidate before merging:

1. Commit all changes, leave the working tree clean, and ensure the candidate contains target `main`.
2. Run `pnpm check` and record the candidate commit and tree, target `main` commit, command, and result.
3. Before an authorized squash merge, confirm the target is unchanged and the merged tree equals the validated tree.

Further tracked changes, pending changes, a changed candidate, or target `main` advancing invalidate success. Form a new final candidate and repeat complete validation.

The complete command runs the selector's complete check list, `node scripts/check-changed.mjs --complete`, without collecting changed paths. It retains these checks in order:

1. Markdown formatting, tk Rust formatting, and Rust tests, the sequence `pnpm check:base` runs.
2. TypeScript checks and tests for [omp-status-bar](./projects/omp-status-bar/package.json).
3. TypeScript checks and tests for [omp-system-prompt](./projects/omp-system-prompt/package.json).
4. TypeScript checks and tests for [omp-codex-web-access](./projects/omp-codex-web-access/package.json).
5. TypeScript checks and tests for [omp-context-pin](./projects/omp-context-pin/package.json).
6. TypeScript checks and tests for [omp-qol](./projects/omp-qol/package.json).
7. tk native adapter tests with `bun test projects/tk/adapter-tests`.
8. Skill lifecycle tests with `sh scripts/tests/skills.sh` through `pnpm check:skills`.
9. Affected-selector regression tests through `pnpm check:selector`.

Before the first command, the complete entry point verifies every listed tool and local input. The first failed command stops the sequence and returns a nonzero exit status. Missing executables or dependencies also fail the check. Commands and component output identify the failing step. Checks do not install dependencies or format source files; builds and tests can create their normal generated and temporary files. The complete entry point never selects affected checks, so fallback cannot recurse.

`pnpm check:base` covers only Markdown and Rust for targeted work. Component checks can also run independently through their existing scripts. Automated success does not establish real-model behavior or interactive UI correctness; follow the relevant component's scenario and release validation requirements as well. The [repository check decision](./.agents/adr/decision/2026-09-30-scope-aware-repository-checks.md) defines the complete contract.

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
