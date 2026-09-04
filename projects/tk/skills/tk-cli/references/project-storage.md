# Project storage

Read this file when initializing a project, explaining project discovery or Git policy, migrating a schema, or switching metadata modes. See [Task concepts](./task-concept.md) for Task fields and carriers.

## Project markers

tk searches upward from `--cwd` or the current working directory. A directory is a candidate project root when either marker exists:

- `.agents/tk_config.toml`;
- the default Task root `.tk/`.

Outside Git, discovery checks only a limited number of nearby ancestors. Inside a Git worktree, it may continue to the Git root. After finding a project, tk reads its configuration and validates the effective Task root.

A complete absolute Task or material path can locate its owning project first, so a caller may read that Task from another project's working directory.

## Configuration file

Project configuration lives at `.agents/tk_config.toml`. It is sparse TOML and stores only values that differ from defaults. Omitted fields use current defaults. Unknown fields are rejected.

The default configuration is equivalent to:

```toml
task_root = ".tk"
subtasks_dir = ""
git_policy = "none"
creation_policy = "strict"
metadata_mode = "split"
```

A project using every default normally has no configuration file. The `.tk/` directory is the project marker.

## `task_root`

`task_root` selects the Task storage directory below the project root. Its default is `.tk`.

The value must be a non-empty project-relative path. Absolute paths, `.`, `..`, or paths containing those special components are rejected. The Task root and existing ancestors cannot pass through symbolic links or resolve outside the project.

Example:

```toml
task_root = "tasks"
```

A custom Task root requires the configuration file. Creating `tasks/` alone does not tell discovery that it is the Task root.

## `subtasks_dir`

`subtasks_dir` selects the default relative directory used to create subtasks below each parent. Its default is the empty path, which creates subtasks directly below the parent directory.

Example:

```toml
subtasks_dir = "children"
```

New subtasks then default to `<parent>/children/`. This setting controls creation placement, not discovery range. Existing valid Tasks elsewhere below the parent remain discoverable.

An empty value is valid. A non-empty value must be a safe relative path without an absolute path or `.` or `..` components.

## `git_policy`

`git_policy` controls checks before writes:

| Value | Behavior |
| --- | --- |
| `track` | Requires a Git worktree. The Task root and any existing project configuration must not be ignored. Use when Task data belongs in version control. |
| `ignore` | Requires a Git worktree and requires the Task root to be ignored. Use for local Task data. |
| `none` | Does not require Git or inspect ignore state. This is the default. |

Read operations do not run write-policy checks. Create, update, log, and other writes check the policy before the first persistent write.

`track` verifies only that paths are not ignored. It does not run `git add` or commit. `ignore` does not edit `.gitignore`.

## `creation_policy`

`creation_policy` controls the authorization an Agent needs to create a top-level Task:

| Value | Behavior |
| --- | --- |
| `strict` | Default. An Agent may create a Task only when the user explicitly requests or confirms creation. |
| `permissive` | An Agent may create an open Task for work that clearly needs durable state across steps or sessions. A user's planning intent alone is still not authorization to create. |

The policy does not restrict a terminal user who invokes the CLI directly and does not let a caller fabricate `user_confirmed`. Subtask creation still follows the current parent and invocation-entry authorization rules.

## `metadata_mode`

`metadata_mode` selects the Task metadata carrier for the whole project:

| Value | Behavior |
| --- | --- |
| `split` | Default. Managed metadata is stored in `tk.toml`; the body is stored in `TASK.md`. |
| `embed` | Managed metadata is stored in YAML frontmatter in `TASK.md`, followed by the body. |

A project uses one mode. Do not switch by editing the configuration value manually. Use `tk metadata switch` so the runtime converts every Task carrier before it updates configuration.

## Default initialization

```text
tk init
```

Default initialization proceeds in this order:

1. Resolve `--cwd` or the current working directory as the project root.
2. Assemble default configuration and validate paths.
3. Check whether the project already exists and whether Git policy passes.
4. Create `.tk/`.
5. Detect that every field equals its default, so do not create `.agents/tk_config.toml`.

The command initializes only the project. It does not create a Task.

## Initialization with custom configuration

```text
tk init \
  --task-root tasks \
  --subtasks-dir children \
  --git-policy track \
  --creation-policy permissive \
  --metadata-mode embed
```

When at least one effective value differs from its default, `init` creates `.agents/tk_config.toml` and writes only non-default fields. Explicit presence does not determine whether a field is stored. For example, explicitly passing `--git-policy none` still equals the default and does not create a configuration file by itself.

`--cwd` and `--output` are invocation options, not project configuration, and are never written to the file.

## Existing projects

Without `--force`, initialization returns `project_already_initialized` and writes nothing when either object already exists:

- `.agents/tk_config.toml`;
- the Task root selected by this invocation.

This rule also applies to a default project that has only an empty Task root and no configuration file.

## Forced initialization

```text
tk init --force [configuration options]
```

`--force` recalculates project configuration from this invocation's values and defaults. It can recover from an unreadable old configuration and can create the Task root named by the current invocation.

Forced initialization does not read, migrate, move, delete, or rewrite existing Tasks. It does not preserve non-default values from the old configuration unless they are supplied again. Omitted fields return to defaults.

If the effective configuration uses only defaults, `--force` removes an existing `.agents/tk_config.toml` and ensures the default `.tk/` exists. Data in a former custom Task root is not moved or deleted, but the new configuration no longer points to it.

## Initialization failure boundary

Paths, modes, policies, and Git conditions are validated before the first persistent write. Initialization fails before creating the Task root or writing configuration when:

- the working directory is missing or is not a directory;
- `task_root` or `subtasks_dir` is not a safe relative path;
- the Task root passes through a symbolic link, leaves the project, or has an existing non-directory component;
- `track` or `ignore` cannot find a Git worktree;
- the Task root's ignore state violates Git policy;
- the configuration file or target Task root already exists without `--force`.

## Schema migration

Schema migration processes only valid metadata carriers in the current project and applies published forward conversions one version at a time. Without `--file`, it selects every valid carrier in the project. Each explicit `--file` must identify a valid `tk.toml` or embedded `TASK.md` in the current project.

Migration does not change metadata mode, Task ID, status, timestamps, relationships, body, directory, or WAL. A carrier already at the target schema version is skipped. Downgrades, skipped versions, and unknown conversions are rejected.

## Metadata mode switching

A mode switch applies to the whole project and cannot target only some Tasks:

- `split` to `embed` writes metadata to `TASK.md` frontmatter, then removes the corresponding `tk.toml`;
- `embed` to `split` writes `tk.toml` and preserves the body after the frontmatter.

Switching does not change field values, directories, body meaning, WAL, or relationships. Commit starts only after every Task passes preflight, and project configuration is updated last.

Schema migration upgrades formats within the current metadata mode. Mode switching converts carriers and updates project configuration. They are independent operations.

## Multi-target failures

Migration and mode switching complete full preflight before committing in deterministic order. `--dry-run` uses the same planning and validation as execution.

A commit-stage failure distinguishes `completed`, `uncompleted`, and the original error. Run `tk check` to establish current state, resolve the blocker, and rerun the complete command. The runtime does not roll back automatically or continue after the process exits.
