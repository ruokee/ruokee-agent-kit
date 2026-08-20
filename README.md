# Ruokee Agent Kit

[中文](./docs/zh/README.md)

I write Agent Skills because I keep running into the same problems. A useful instruction becomes a prompt, the prompt grows teeth, and eventually I want it available in every Agent Harness I use. This repository is where those Skills get a proper home.

Ruokee Agent Kit contains the Skills I wrote for my own work and am willing to maintain in public. I want each one to have a clear job, readable instructions, and a way to prove it still works. I do not want this to become a warehouse for everything I happened to install once.

## What Harness I use

I currently use my own fork of OMP with a small preset.

I want the interface to look good and common development features to work without extra setup. OMP includes many features out of the box. I think of it as Pi with a large set of features preinstalled. After disabling most of what I do not need, it works well for me. OMP still has limits, so I may move to a better-fitting Harness in the future.

I maintain a fork because OMP does not fully match my preferences, and extensions cannot change some of its behavior. Once I started changing the source, I began treating the fork as "My Harness".

I also use Pi, Claude Code, and Codex.

## What belongs here

- **Skills.** Agent Skills I develop for my own work and maintain in public.
- **Extensions.** Standalone extensions that add or adjust Agent Harness functionality.
- **Optional variants.** Alternative versions of repository content or configuration for different languages, environments, or preferences.
- **Documentation.** Skill indexes, installation instructions, development conventions, and validation guidance.

## Development

Install the Git hook:

```bash
uvx pre-commit install
```

Run all configured checks:

```bash
uvx pre-commit run --all-files
```

## License

Ruokee Agent Kit is licensed under the [MIT License](./LICENSE).
