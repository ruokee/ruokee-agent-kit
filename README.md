# Ruokee Agent Kit

[中文](./docs/zh/README.md)

I keep running into the same problems across Agent Harnesses. Sometimes the answer is a Skill. Other problems need an extension, Plugin, executable, or host package. This repository is where I maintain those capabilities in public.

Ruokee Agent Kit contains capabilities I wrote for my own work and am willing to maintain. Each one should have a clear job, readable documentation, and a real validation path. This is not a warehouse for everything I happened to install once.

## What Harness I use

I currently use my own fork of OMP with a small preset.

I want the interface to look good and common development features to work without extra setup. OMP includes many features out of the box. I think of it as Pi with a large set of features preinstalled. After disabling most of what I do not need, it works well for me. OMP still has limits, so I may move to a better-fitting Harness in the future.

I maintain a fork because OMP does not fully match my preferences, and extensions cannot change some of its behavior. Once I started changing the source, I began treating the fork as "My Harness".

I also use Pi, Claude Code, and Codex.

## What belongs here

- **Skills.** Self-contained Agent Skills I develop for my own work and maintain in public.
- **Plugins and executables.** Capabilities that need deterministic code or their own runtime.
- **Extensions.** Standalone extensions that add or adjust Agent Harness functionality.
- **Harness packages and adapters.** First-party installation and transport support for repository capabilities.
- **Optional variants.** Alternative versions of repository content or configuration for different languages, environments, or preferences.
- **Documentation.** Capability indexes, installation instructions, development conventions, and validation guidance.

## Repository layout

English Skills live under `./skills/<name>/`. Chinese variants live under `./variants/zh/skills/<name>/`, but install at the normal `skills/<name>/` host path. A pure Skill contains only the material needed to discover, understand, and use it.

Plugins, extensions, executables, and Harness packages keep the layout their Harness or build system expects. The repository adds a top-level area only when a real component needs it.

Durable repository decisions are recorded as bilingual [ADRs](./.agents/adr/README.md).

tk provides persistent project Tasks through one Rust runtime and self-contained components for Codex, Claude Code, Pi, and OMP. A Task is a temporary project effort worth preserving, not an execution commitment.

[tk user guide](./projects/tk/docs/guide.md)

[tk design index](./projects/tk/docs/design/README.md)

## Development

Markdown formatting requires Node.js 20 or newer. Install the locked dependencies:

```bash
pnpm install --frozen-lockfile
```

Format or check all Markdown files:

```bash
pnpm docs:format
pnpm docs:lint
```

Pass selected files directly to Prettier:

```bash
pnpm exec prettier --write --log-level warn README.md docs/zh/README.md
pnpm exec prettier --check --log-level warn README.md docs/zh/README.md
```

These commands and the Git hook use `--log-level warn` to show only Prettier warnings and errors. Unchanged files, successfully formatted files, and success summaries are not printed. Checks still report unformatted files and return a nonzero exit code on failure.

Run `pnpm install --frozen-lockfile` again if Prettier cannot load a plugin.

Install the Git hook:

```bash
pnpm hooks:install
```

Run all configured checks:

```bash
pnpm check
```

`pnpm check` runs the Markdown check, `cargo fmt --manifest-path projects/tk/Cargo.toml -- --check`, and `cargo test --manifest-path projects/tk/Cargo.toml`.

`main` is the only long-lived branch. Work happens on a short-lived branch created from current `main`, uses English Conventional Commit messages, and enters `main` through an authorized squash merge.

## License

Ruokee Agent Kit is licensed under the [MIT License](./LICENSE).
