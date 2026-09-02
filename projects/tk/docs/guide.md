# tk user guide

[简体中文](./guide.zh.md)

tk stores persistent project Tasks in ordinary files and exposes the same rules through its CLI, MCP server, and native Pi and OMP tools.

A Task is a temporary project effort worth preserving. Creating one does not imply a commitment to execute or complete it.

## Install the runtime

Install the `tk` executable at the fixed user-level path:

```text
$HOME/.local/bin/tk
```

The file must be a regular executable. Harness component commands do not install, update, or remove the runtime.

Confirm the runtime contract:

```sh
$HOME/.local/bin/tk --output json --version
```

## Install a Harness component

Install one selection for a supported Harness:

```sh
tk install --harness codex
tk install --harness claude --mode tools --language zh
tk install --harness pi --mode cli --language en
tk install --harness omp --mode cli --language zh
```

`--mode` accepts `tools` or `cli` and defaults to `tools`. `--language` accepts `en` or `zh` and defaults to `en`. The resolved Skill is `tk`, `tk-zh`, `tk-cli`, or `tk-cli-zh`.

Tools mode installs the Harness integration and its selected Skill. CLI mode installs only the selected CLI Skill within the Harness component. Running install again with another selection updates the component directly and removes known superseded Skill targets.

`tk install` uses only the component embedded in the current executable. It does not download a component or accept a local archive. A matching installation returns `no_change`.

Use `--dry-run` to validate the runtime, embedded selection, Harness command, fixed targets, and shared configuration without writing.

```sh
tk install --harness omp --mode cli --language zh --dry-run --output json
```

See [Installation](./design/installation.md) for lifecycle and clean-uninstall behavior. See [Harness integration](./design/harnesses.md) for each component's contents.

## Initialize a project

Run init from the project directory:

```sh
tk init
```

Defaults use `.tk` as the Task root, strict top-level creation, split metadata, and no Git policy. Supply only values that differ:

```sh
tk init --creation-policy permissive --metadata-mode embed
```

`init --force` rewrites project configuration from explicit values and defaults even when the previous configuration cannot be parsed. It does not inspect or modify Task data.

## Create and find Tasks

Create a top-level Task:

```sh
tk create task "Investigate startup latency"
```

CLI creation is an explicit user action, so strict projects treat it as confirmed. Agents using MCP or native tools must pass the actual current authorization state.

Search includes planning, open, and closed Tasks by default:

```sh
tk search latency
tk search 0192aabb --status closed
tk search ./notes/benchmark.md
tk search 'startup|cold' --regex --search-body --output json
```

Read a unique Task reference:

```sh
tk read <task_ref>
tk read <task_ref> --view detailed --wal-max-entries 50 --wal-max-length 65536
```

Names, UUID prefixes, text, and material paths are search inputs, not exact references. Use the full reference returned by search for reads and updates.

## Work with a Task

Create child work items under one parent:

```sh
tk create subtask <parent_ref> \
  --item '{"name":"Measure baseline"}' \
  --item '{"name":"Test cache behavior","status":"planning"}'
```

Update relationships, extra data, or one lifecycle action:

```sh
tk update <task_ref> --start
tk update <task_ref> --depends-on-add <uuid>
tk update <task_ref> --extra-set '{"owner":"runtime"}'
tk update <task_ref> --close "Investigation concluded"
```

Append a durable event:

```sh
tk log <task_ref> --message "Benchmark reproduced" --body "See ./records/baseline.md"
```

Use `planning` for an idea, investigation, or plan that the user explicitly wants to preserve while it is still forming. Use `open` for work being handled. `closed` means the effort ended, whether completed, abandoned, infeasible, or superseded.

## Maintain project data

Check the project without modifying it:

```sh
tk check
```

Migrate released schema versions forward:

```sh
tk metadata migrate --dry-run
tk metadata migrate
```

Switch the whole project between split and embed representations:

```sh
tk metadata switch --to embed --dry-run
tk metadata switch --to embed
```

Rename a Task and inspect references without rewriting them:

```sh
tk rename <task_ref> "New name" --dry-run
tk rename <task_ref> "New name"
```

Clean temporary content left by ended tk processes:

```sh
tk gc --dry-run
tk gc
```

GC removes only registered tk temporary paths. It does not continue, roll back, or repair a Task, migration, rename, or component operation.

A failed multi-target command reports completed and uncompleted items. Read or check the current state before issuing a new complete command. tk does not keep a continuation token or automatic rollback state.

## Uninstall a Harness component

```sh
tk uninstall --harness codex
tk uninstall --harness claude
tk uninstall --harness pi
tk uninstall --harness omp
```

Uninstall removes the entire fixed tk-dedicated target, including modified or extra content inside it, and removes only tk's entry from shared configuration. For Codex it also removes all known tk Skill variant targets. Unrelated Harness content remains unchanged.

## Agent use

tk ships four independently discoverable Skills: [tk](../skills/tk/SKILL.md), [tk-zh](../skills/tk-zh/SKILL.md), [tk-cli](../skills/tk-cli/SKILL.md), and [tk-cli-zh](../skills/tk-cli-zh/SKILL.md). Each is self-contained. The selected installation mode and language determine which one the Harness loads.

The [design index](./design/README.md) links every current runtime, data, tool, Harness, installation, Skill, and validation contract.
