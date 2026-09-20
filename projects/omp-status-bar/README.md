# omp-status-bar

[中文](./README.zh.md)

A persistent OMP status bar: one `belowEditor` widget host plus six builtin providers for total, input, cache-read, and output tokens, cache hit rate, and context usage with a speculative-compaction band indicator.

Third-party extensions add providers through the public contract at `@ruokee/omp-status-bar/provider`.

## Documentation

- [Usage and configuration](./docs/usage.md)
- [Provider contract](./docs/provider-contract.md)
- [Provider development guide](./docs/provider-dev.md)

## Installation

The package has not been published. After cloning the GitHub repository, install its locked dependencies and link the package into the user-scoped OMP plugin directory:

```bash
git clone https://github.com/ruokee/ruokee-agent-kit.git
cd ruokee-agent-kit/projects/omp-status-bar
bun install
omp plugin link "$(pwd)" --scope user
```

Create `omp-status-bar.yml` in the active OMP agent directory as described in [Usage and configuration](./docs/usage.md), then start a new OMP session. The package does not hot-reload configuration changes.

### Updating

`omp plugin link` registers this checkout, so the installation keeps loading the package and its dependencies from that directory. Keep the directory in place, and update it from the repository root:

```bash
cd /path/to/ruokee-agent-kit
git pull
cd projects/omp-status-bar
bun install --frozen-lockfile
```

Restart OMP afterwards: a running process keeps the extension code it loaded at startup, and starting another session in the same process does not reload it.

## Development

```bash
bun install
bun run typecheck
bun test
```

Runtime imports are limited to three peer dependencies: `@oh-my-pi/pi-coding-agent`, `@oh-my-pi/pi-agent-core`, and `@oh-my-pi/pi-tui`.

## License

This component is licensed under the [MIT License](./LICENSE).
