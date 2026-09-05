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

## Install components

Install one selection for a supported Harness:

```sh
tk install --harness codex
tk install --harness claude --mode tools --language zh
tk install --harness pi --mode cli --language en
tk install --harness omp --mode cli --language zh
```

`--mode` accepts `tools` or `cli` and defaults to `tools`. `--language` accepts `en` or `zh` and defaults to `en`. The resolved Skill is `tk`, `tk-zh`, `tk-cli`, or `tk-cli-zh`.

Tools mode installs the Harness integration and its selected Skill. CLI mode installs only the selected CLI Skill within the Harness component. Running install again with another selection updates the component directly and removes known superseded Skill targets.

Install a self-contained CLI Skill into another Skill root:

```sh
tk install --mode cli --skill-root .agents/skills
tk install --mode cli --skill-root /srv/project/skills --language zh
```

`--skill-root` names the parent directory. tk creates `<skill-root>/tk-cli` for English or `<skill-root>/tk-cli-zh` for Chinese and may create missing parent directories. A relative root resolves from the process working directory. Exactly one of `--harness` and `--skill-root` is required, and custom-root install requires explicit CLI mode.

Custom-root install does not require a Harness executable or modify Harness configuration and registration. It manages only `tk-cli` and `tk-cli-zh` immediately below the supplied root. Use `--harness` for supported user-level Harness integrations that need full registration and clean removal.

`tk install` uses only payloads embedded in the current executable. It does not download a component or accept a local archive. A matching installation returns `no_change`.

Use `--dry-run` to validate the runtime, embedded selection, and exact target boundary without writing.

```sh
tk install --mode cli --skill-root .agents/skills --language zh --dry-run --output json
```

See [Installation](./design/installation.md) for lifecycle and clean-uninstall behavior. See [Harness integration](./design/harnesses.md) for each supported Harness component's contents.

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

When tk creates a Task, the runtime automatically writes `# <normalized-name>` as the initial `TASK.md` body. Use ordinary file tools to extend it after creation; the create command and create tool accept no body input.

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

A rename that moves the Task path stops with exit status 3 when references to the old path exist. Update the reported references and run the rename again. To proceed while accepting broken links, add `--ignore-brokenlinks`.

Clean temporary content left by ended tk processes:

```sh
tk gc --dry-run
tk gc
```

GC removes only registered tk temporary paths. It does not continue, roll back, or repair a Task, migration, rename, or component operation.

A failed multi-target command reports completed and uncompleted items. Read or check the current state before issuing a new complete command. tk does not keep a continuation token or automatic rollback state.

## Uninstall components

```sh
tk uninstall --harness codex
tk uninstall --harness claude
tk uninstall --harness pi
tk uninstall --harness omp

tk uninstall --skill-root .agents/skills
```

Harness uninstall removes the entire fixed tk-dedicated target, including modified or extra content inside it, and removes only tk's entry from shared configuration. For Codex it also removes all known tk Skill variant targets. Unrelated Harness content remains unchanged.

Custom-root uninstall removes both `tk-cli` and `tk-cli-zh` below the supplied root. It preserves the root, `tk`, `tk-zh`, and every unrelated child.

## Agent use

tk ships four independently discoverable Skills: [tk](../skills/tk/SKILL.md), [tk-zh](../skills/tk-zh/SKILL.md), [tk-cli](../skills/tk-cli/SKILL.md), and [tk-cli-zh](../skills/tk-cli-zh/SKILL.md). Each is self-contained. Harness mode and language select one for a supported integration. A custom root can receive either CLI-only Skill directly.

The [design index](./design/README.md) links every current runtime, data, tool, Harness, installation, Skill, and validation contract.
