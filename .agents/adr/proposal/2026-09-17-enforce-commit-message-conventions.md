# ADR proposal: Enforce commit message conventions

Decision owner: Ruokee
Draft writer: deepseek/deepseek-v4.1-flash

English | [中文](./2026-09-17-enforce-commit-message-conventions.zh.md)

## Motivation

Repository guidance requires English Conventional Commits messages, and nothing checks them. The pre-commit hook only formats staged files through Prettier, so the type, the scope, and the shape of the header rest on the author's memory.

The current history shows what that costs. Scope values include both `skill` and `skills`, several component names, and one-off labels such as `package`, `ai`, and `system-prompt`. The same kind of change carries different scopes in different commits, and there is no list to check a new message against.

A scope list and an enforcement mechanism are needed together. A list alone stops working as soon as a new label looks reasonable, and enforcement alone rejects messages without telling the author which values are acceptable.

## Proposal

### Enforcement point

Add a `commit-msg` entry to the existing `simple-git-hooks` configuration. It runs commitlint against the message file. Root `devDependencies` add `@commitlint/cli` and `@commitlint/config-conventional`, and the rules live in a root `commitlint.config.mjs`. `pnpm hooks:install` stays the single installation step, and an existing checkout runs it once to pick up the new hook stage.

A violation at error level stops the commit. Commitlint prints the violated rules, and the hook command adds the command that opens the message file for editing. A warning prints and lets the commit through; the default preset classifies a missing blank line before the body or the footer as a warning, and this proposal keeps that level.

When a commit is blocked, the message file keeps its content, and the author repeats the original operation, so a blocked `git commit --amend` is retried as an amend rather than as a new commit. The command takes the path from Git, since a linked worktree keeps its message file under the main repository's `.git/worktrees/` directory.

Commitlint skips the messages matched by its default ignore patterns, which cover version messages such as `v1.2.3`, subjects prefixed with `fixup!` or `squash!`, and Git-style `Revert "..."` and `Merge ...` subjects. A Conventional Commits message such as `revert(unknown): undo the change` is not ignored and still has to satisfy the scope rule.

### Message rules

Types keep the Conventional Commits set that `config-conventional` accepts: `build`, `chore`, `ci`, `docs`, `feat`, `fix`, `perf`, `refactor`, `revert`, `style`, and `test`. The repository does not narrow this list; choosing a type that fits the change is a judgment call, not a format rule.

Scopes are optional. When a message carries one, it must be exactly one of the four values below. A change that spans two areas carries no scope.

| scope | covers |
| --- | --- |
| `skills` | Skill content under `skills/` and `variants/zh/skills/` |
| `extensions` | components under `projects/` |
| `adr` | proposals and decisions under `.agents/adr/` |
| `repo` | root configuration, hooks, dependencies, repository entry pages, and process text such as `AGENTS.md` |

The set is enforced by one local rule registered in `commitlint.config.mjs` that compares the parsed scope against the list. The built-in `scope-enum` rule cannot carry this policy alone: it splits the scope on `/`, `\`, and `,`, so `feat(skills/adr)`, `feat(skills,adr)`, and `feat(skills\adr)` all pass it, and the built-in rules hold no pattern rule for scope naming. The local rule rejects unknown values, upper-case letters, hyphens, underscores, and multi-area scopes in one place, and it passes a message without a scope, which commitlint parses as a `null` scope.

The remaining rules keep their `config-conventional` defaults. That choice carries constraints beyond the type and scope policy: a subject that opens with a capital letter or ends with a full stop is rejected, and body and footer lines are limited to 100 characters. Three of the 128 commits on `main` exceed that limit and would fail the check.

### Documentation

The Git sections of [AGENTS.md](../../../AGENTS.md), [README.md](../../../README.md), and [README.zh.md](../../../README.zh.md) name the scope set and the commit-msg check, beside the existing Conventional Commits requirement, and the hook installation step covers both hook stages. The ADR process and the change workflow are unchanged.

## Alternatives considered

- Migrate to the Python `pre-commit` framework. This was considered when choosing the hook mechanism. It runs message checks and general file checks through one hook manager, but it adds a Python toolchain to a repository that runs pnpm, Rust, and Bun, and the existing Prettier hook would either move into a local hook or run beside a second hook manager.
- Check messages with a script maintained in the repository. This was considered when comparing dependencies. It avoids adding packages, but it reimplements the message shapes that existing tooling already handles: `fixup!`, `revert`, and merge commits, plus breaking-change markers such as `feat!:` and multi-line bodies.
- Give every Skill and component its own scope. This was considered when defining the scope set. It names the changed unit precisely, but every new Skill and component requires a list edit, and a forgotten edit blocks commits until someone updates the configuration.
- Keep the requirement human-enforced. This was considered when deciding whether to add a check at all. It leaves the toolchain untouched, and it leaves inconsistent scope use in place.

## Acceptance criteria

The fixed messages below are checked through the installed hook in each environment during implementation, and the results are recorded with the implementation change.

1. After `pnpm hooks:install`, the hook is exercised in a regular checkout and in a linked worktree: an error-level violation blocks `git commit`, prints the violated rules and the command that opens the message file, and a retry through the original operation, including `git commit --amend`, goes through once the message is fixed. A warning prints and the commit goes through.
2. Messages that use `skills`, `extensions`, `adr`, or `repo`, and messages with no scope, commit normally.
3. A check over fixed messages covers both outcomes: `feat(skills): add guidance`, `docs(repo): document the check`, and `feat(repo)!: drop the legacy flag` pass, while `feat(skill): add guidance`, `feat(Skills): add guidance`, `feat(skill-name): add guidance`, `feat(skills/adr): update both areas`, `chore(package): update tooling`, and `docs(ai): update guidance` are rejected.
4. The default ignore patterns hold: `fixup! feat(skills): add guidance`, `Revert "previous change"`, `Merge branch 'main'`, and `v1.2.3` skip the check entirely.
5. The Git sections of [AGENTS.md](../../../AGENTS.md), [README.md](../../../README.md), and [README.zh.md](../../../README.zh.md) name the scope set, the commit-msg check, and both hook stages in the installation step.
6. `pnpm check` still passes, and the hook adds no dependency outside the root pnpm project.

## Risks

A squash merge performed on the hosting service never passes through the check, and the repository has no CI job, so a message the rules reject can still enter the history. The scopes recorded there stay unreliable for searching history.

Scopes describe areas of the repository, not a single component. The check reads the message alone and cannot tell whether the chosen scope matches the files in the commit, so different authors may still classify the same two-area change differently, which reproduces the inconsistency the rules aim to remove.

An author who finds no scope that fits can select an unrelated one, leaving a message that passes the check while naming the wrong area. Bypassing the hook removes the rule's effect for that author entirely.
