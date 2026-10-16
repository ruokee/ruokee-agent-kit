# omp-status-bar

[中文](./README.zh.md)

A persistent OMP status bar: one `belowEditor` widget host plus builtin providers for total, input, cache-read, and output tokens, cache hit rate, context usage, and the number of model requests the session has answered.

Third-party extensions add providers through the public contract at `@ruokee/omp-status-bar/provider`.

## Documentation

- [Usage and configuration](./docs/usage.md)
- [Provider contract](./docs/provider-contract.md)
- [Provider development guide](./docs/provider-dev.md)

## Compatibility

The minimum maintained OMP version is `18.5.0`, with no upper maintenance bound. This section states the maintenance commitment; it is not an installation or runtime requirement. An earlier host may still run the package without gaining a maintenance commitment. The declaration does not promise that later releases keep working, and it does not mean every version at or above the minimum was verified.

The package declares `@oh-my-pi/pi-coding-agent`, `@oh-my-pi/pi-agent-core`, and `@oh-my-pi/pi-tui` as unrestricted host peers (`*`). The declarations are not a maintenance range or a claim about every host version.

Automated checks and real TUI validation, the versions they cover, and what they do not cover are recorded in [Usage and configuration](./docs/usage.md).

## Installation

The package has not been published. [Usage and configuration](./docs/usage.md) holds the install commands, the configuration file, and when a configuration change takes effect.

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

Runtime imports are limited to two host packages: `@oh-my-pi/pi-coding-agent` and `@oh-my-pi/pi-tui`.

## License

This component is licensed under the [MIT License](./LICENSE).
