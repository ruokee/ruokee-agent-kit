# Project setup

## Configuration

Project configuration is `.agents/tk_config.toml`. It is sparse relative to these defaults:

```toml
task_root = ".tk"
subtasks_dir = ""
git_policy = "none"
creation_policy = "strict"
metadata_mode = "split"
```

Use `tk init` to create configuration. Normal init refuses an initialized project. `tk init --force` rewrites configuration from explicit arguments and defaults even if the old configuration cannot be parsed. It does not inspect, migrate, move, or rewrite Task data.

## Discovery

Git projects use the Git root and project configuration. Non-Git exact Task and material paths locate their Task root through the `YYYY/MM/DD-NN--slug` topology and at most two additional ancestors. Ordinary cwd discovery is bounded.

A full absolute Task or material path can locate its own project even when cwd belongs to another project.

Pass explicit `cwd` when more than one project is plausible.

## Git policy

Git policy is checked only immediately before persistent writes:

- `track` requires managed Task files not to be ignored;
- `ignore` requires the Task root to be ignored;
- `none` does not invoke Git policy commands.

read, search, and pure diagnostics are not rejected by Git policy. tk never edits `.gitignore`, the index, Git configuration, commits, or history.

## Metadata modes

A project uses split or embed for every Task. Do not mix them manually. Use:

```sh
tk metadata switch --to split
tk metadata switch --to embed
```

Use `tk metadata migrate [--file <carrier>]... [--to <version>]` for released forward schema conversions. `--file` accepts canonical carriers, not directories, Task IDs, material paths, or globs.

Use the public CLI for switch and migrate. They are not accepted by `tk_exec`.
