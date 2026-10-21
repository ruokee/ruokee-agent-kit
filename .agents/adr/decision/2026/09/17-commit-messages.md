# Commit messages

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash

English | [中文](./17-commit-messages.zh.md)

## Motivation

Fix the allowed commit scopes and enforce the message format through the repository's Git hooks.

Git commit scopes in this repository were inconsistent when left to author memory: `skill` and `skills` for the same area, component names, and one-off labels such as `package`, `ai`, and `system-prompt`, with the same kind of change carrying different scopes in different commits. A scope list and an enforcement mechanism are needed together. A list alone stops working as soon as a new label looks reasonable, and enforcement alone rejects messages without telling the author which values are acceptable.

Repository guidance requires English Conventional Commits messages, and the type, the scope, and the shape of the header are checked mechanically rather than left to memory. The pre-commit hook formats staged files through Prettier, and the `commit-msg` stage reads the message file itself.

## Decision

Types keep the Conventional Commits set that `config-conventional` accepts, and the repository does not narrow it; choosing a type that fits the change is a judgment call. Scopes are optional: when a message carries one it must be exactly one of `skills`, `extensions`, `adr`, or `repo`, and a change that spans two areas carries none.

The [repository specification](../../../../spec/repository.md) states the scope set and the commit-msg check, `commitlint.config.mjs` records the local rule and the constraints the preset inherits, and [README.md](../../../../../README.md), [README.zh.md](../../../../../README.zh.md), `AGENTS.md`, and the [Git rules](../../../../rule/git.md) state the message requirements.

## Alternatives considered

- Migrate to the Python `pre-commit` framework. It runs message checks and general file checks through one hook manager, but it adds a Python toolchain to a repository that runs pnpm, Rust, and Bun, and the existing Prettier hook would either move into a local hook or run beside a second hook manager.
- Check messages with a script maintained in the repository. It avoids adding packages, but it reimplements the message shapes that existing tooling already handles: `fixup!`, `revert`, and merge commits, plus breaking-change markers such as `feat!:` and multi-line bodies.

## Consequences

- A squash merge performed on the hosting service never passes through the check, and the repository runs no CI job, so a message the rules reject can still enter the history. The scopes recorded there stay unreliable for searching history.
- Scopes describe areas of the repository rather than a single component. The check reads the message alone and cannot tell whether the chosen scope matches the files in the commit, so different authors may still classify the same two-area change differently.
- The check adds no dependency outside the root pnpm project, and `pnpm check` is unaffected.
