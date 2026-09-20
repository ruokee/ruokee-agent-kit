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

### Extensions

Standalone plugins and extensions that add or adjust Harness functionality.

**General**

- **[tk](./projects/tk/README.md)** is a persistent task management tool for temporary project efforts worth preserving. It provides access through the `tk` CLI, MCP, Pi Packages, and other integrations. `tk` preserves task progress and shared understanding across context compaction, sessions, and Agents.

**OMP**

- **[omp-status-bar](./projects/omp-status-bar/README.md)** adds an OMP status bar with extra context information, including current session context usage as a number rather than the native percentage, total tokens, input tokens, cached tokens, output tokens, cache-hit rate, and speculative-compaction indicators.
- **[omp-codex-web-access](./projects/omp-codex-web-access/README.md)** lets OMP use a Codex subscription through a forwarding Provider for web search and page extraction.
- **[omp-system-prompt](./projects/omp-system-prompt/README.md)** replaces the fixed policy text of OMP's default system prompt with a maintained English text while keeping dynamic runtime segments, falling back to the host prompt unchanged when recognition fails.
- **[omp-context-pin](./projects/omp-context-pin/README.md)** keeps a small set of pinned text entries present word for word in every ordinary model request on the current session branch, and restores them after each committed compaction.

## Development

### Git

The project follows [Trunk-Based Development](https://trunkbaseddevelopment.com/). `main` is the only long-lived branch. Start work on a short-lived branch from current `main`, use English Conventional Commit messages, and merge into `main` through squash merge after explicit authorization.

Commit messages use the Conventional Commits types, and scope is optional. A message that carries a scope uses one of `skills`, `extensions`, `adr`, or `repo`; a change that spans two areas carries no scope.

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

Durable repository decisions are recorded as bilingual [ADRs](./.agents/adr/README.md).

### Check prerequisites

Use the pnpm version declared in [package.json](./package.json), a Rust toolchain with `rustfmt` and the [tk build prerequisites](./projects/tk/README.md), and Bun compatible with the component lockfiles. After the root dependency and hook setup above, install locked dependencies in each OMP component directory:

```bash
(cd projects/omp-status-bar && bun install --frozen-lockfile)
(cd projects/omp-system-prompt && bun install --frozen-lockfile)
(cd projects/omp-codex-web-access && bun install --frozen-lockfile)
(cd projects/omp-context-pin && bun install --frozen-lockfile)
```

### Check coverage

Run `pnpm check` from the repository root before requesting review. It executes these checks sequentially:

1. Markdown formatting, tk Rust formatting, and Rust tests through `pnpm check:base`.
2. TypeScript checks and tests for [omp-status-bar](./projects/omp-status-bar/package.json).
3. TypeScript checks and tests for [omp-system-prompt](./projects/omp-system-prompt/package.json).
4. TypeScript checks and tests for [omp-codex-web-access](./projects/omp-codex-web-access/package.json).
5. TypeScript checks and tests for [omp-context-pin](./projects/omp-context-pin/package.json).
6. tk native adapter tests with `bun test projects/tk/adapter-tests`.

The first failed command stops the sequence and returns a nonzero exit status. Missing executables or dependencies also fail the check. Commands and component output identify the failing step. Checks do not install dependencies or format source files; builds and tests can create their normal generated and temporary files.

`pnpm check:base` covers only Markdown and Rust for targeted work. Component checks can also run independently through their existing scripts. Automated success does not establish real-model behavior or interactive UI correctness; follow the relevant component's scenario and release validation requirements as well. The [repository check decision](./.agents/adr/decision/2026-09-12-unify-repository-checks.md) defines the complete contract.

### Common commands

```bash
# Run complete automated checks from the repository root
pnpm check

# Run only the Markdown and Rust baseline
pnpm check:base

# Format or check all Markdown files
pnpm docs:format
pnpm docs:lint

# Pass selected files directly to Prettier
pnpm exec prettier --write [files]
pnpm exec prettier --check [files]
```

## License

Ruokee Agent Kit is licensed under the [MIT License](./LICENSE).
