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
- **Host packages and adapters.** First-party installation and transport support for repository capabilities.
- **Optional variants.** Alternative versions of repository content or configuration for different languages, environments, or preferences.
- **Documentation.** Capability indexes, installation instructions, development conventions, and validation guidance.

## Repository layout

English Skills live under `./skills/<name>/`. Chinese variants live under `./variants/zh/skills/<name>/`, but install at the normal `skills/<name>/` host path. A pure Skill contains only the material needed to discover, understand, and use it.

Plugins, extensions, executables, and host packages keep the layout their host or build system expects. The repository adds a top-level area only when a real component needs it.

Durable repository decisions are recorded as bilingual [Agent Notes](./.agents/notes/README.md).

## Development

Install the Git hook:

```bash
uvx pre-commit install --install-hooks
```

Run all configured checks:

```bash
uvx pre-commit run --all-files
```

`main` is the only long-lived branch. Work happens on a short-lived branch created from current `main`, uses English Conventional Commit messages, and enters `main` through an authorized squash merge.

## License

Ruokee Agent Kit is licensed under the [MIT License](./LICENSE).
