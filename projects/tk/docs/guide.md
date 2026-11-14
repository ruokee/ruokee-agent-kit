# tk user guide

[简体中文](./guide.zh.md)

tk stores persistent project Tasks in ordinary files and provides their operations through the CLI.

## Install the runtime

Install the `tk` executable at the fixed user-level path:

```text
$HOME/.local/bin/tk
```

The file must be a regular executable. Skill installation commands do not install, update, or remove the runtime.

This is the source-build path for the runtime. Build the executable from a local clone and put it at that path:

```sh
cd /path/to/ruokee-agent-kit
cargo build --release --manifest-path projects/tk/Cargo.toml
mkdir -p "$HOME/.local/bin"
install -m 755 projects/tk/target/release/tk "$HOME/.local/bin/tk"
```

Each Skill installed by `tk install` comes from the payloads embedded in the executable running that command. Changing a checkout or replacing the runtime does not change already installed Skill files.

Confirm the runtime contract:

```sh
$HOME/.local/bin/tk --output json --version
```

## Install Skills

Install one language into a supported Harness's ordinary Skill root:

```sh
tk install --harness codex
tk install --harness claude --language zh
tk install --harness pi --language en
tk install --harness omp --language zh
```

The [CLI reference](./design/cli-reference.md#tk-install) holds the accepted values, defaults, and resolved Skill names.

Installation writes `tk-cli` or `tk-cli-zh` to the selected root and removes the other language variant. It manages only these two direct children and preserves all other content.

Install a self-contained CLI Skill into another Skill root:

```sh
tk install --skill-root .agents/skills
tk install --skill-root /srv/project/skills --language zh
```

`--skill-root` names the parent directory. tk creates `<skill-root>/tk-cli` for English or `<skill-root>/tk-cli-zh` for Chinese and may create missing parent directories. A relative root resolves from the process working directory. Exactly one of `--harness` and `--skill-root` is required.

Neither target type requires a Harness executable or reads Harness configuration. `--harness` only selects a known ordinary Skill root.

`tk install` uses only payloads embedded in the current executable. It does not download a component or accept a local archive. A matching installation returns `no_change`.

Use `--dry-run` to validate the runtime, embedded selection, and exact target boundary without writing.

```sh
tk install --skill-root .agents/skills --language zh --dry-run --output json
```

See [Installation](./design/installation.md) for root mappings, lifecycle, and removal behavior.

## Initialize a project

Run init from the project directory:

```sh
tk init
```

Defaults use `.tk` as the Task root, monthly directories, strict top-level creation, split metadata, and no Git policy. Supply only values that differ:

```sh
tk init --creation-policy permissive --metadata-mode embed
```

`init --force` rewrites project configuration from explicit values and defaults even when the previous configuration cannot be parsed. It does not inspect or modify Task data.

Use `tk init --task-layout daily` for `YYYY/MM/DD/NN-slug` top-level directories. The default monthly shape is `YYYY/MM/DD-NN--slug`. Ordinary commands manage only the configured layout.

## Create a Task

Create a top-level Task:

```sh
tk create task "Investigate startup latency"
```

Direct CLI creation defaults to confirmed authorization. An Agent must pass `--user-confirmed` with the actual current authorization state rather than relying on that default.

The create command accepts no body input; the [creation body](./design/data-model.md#creation-body) rules cover the generated heading.

## Find Tasks

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
tk read <task_ref> --view detailed --wal-max-entries 50 --wal-max-length 16000
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
tk migrate metadata --dry-run
tk migrate metadata
```

Switch the whole project between split and embed representations:

```sh
tk switch metadata --to embed --dry-run
tk switch metadata --to embed
```

Preview a Task rename and inspect its saved report:

```sh
tk rename <task_ref> "New name" --dry-run
tk rename <task_ref> "New name"
```

Saved names may contain formatting spaces while a generated directory keeps its space-free suffix. Reads and checks preserve that valid spelling; see [Task names](./design/data-model.md#task-names). Explicit rename normalizes the requested name and may move the directory even when the source formatting is already valid.

rename preserves reference content by default. Add `--update-references` to rewrite known paths. Repeated `--extend-scan <path>` includes Markdown files or directories outside the default scan, including project-external absolute paths. Every call saves a report and prints its path. Dry-run adds only that report.

The same command repairs eligible old string names and recognizable generated suffix mismatches in split and embed. Use a full UUID, exact Task directory, or exact managed carrier; other managed-data validation remains strict. Closed Tasks can be renamed or repaired and keep their status.

Change all top-level directories or adapt explicitly imported Tasks:

```sh
tk switch layout --to daily --dry-run --update-references
tk switch layout --to daily --update-references
tk migrate layout --task tasks/2026/11/14-01--example --update-references
```

switch moves source directories and saves configuration last. migrate adapts selected canonical directories inside the current Task root to its configured layout and preserves configuration. Both preserve dates, numbering, slugs, metadata, subtrees, and WAL. Conflicts fail preflight. Their [scan reports](./design/data-model.md#scan-reports) retain full mappings and references, including dry-run and no-change requests.

Clean temporary content left by ended tk processes:

```sh
tk gc --dry-run
tk gc
```

The [GC](./design/data-model.md#gc) rules state what gc removes.

A failed multi-target command reports completed and uncompleted items. Read or check the current state before issuing a new complete command. tk does not keep a continuation token or automatic rollback state.

## Uninstall Skills

```sh
tk uninstall --harness codex
tk uninstall --harness claude
tk uninstall --harness pi
tk uninstall --harness omp

tk uninstall --skill-root .agents/skills
```

Uninstall removes `tk-cli` and `tk-cli-zh` below the selected root, including modified and extra content inside them. It preserves the root and every other child.

## Agent use

tk ships two independently discoverable Skills: [tk-cli](../skills/tk-cli/SKILL.md) and [tk-cli-zh](../skills/tk-cli-zh/SKILL.md). Each carries its complete references and uses the public CLI for all Task operations.

The [design index](./design/README.md) links the runtime, data, CLI, installation, Skill, and validation contracts.
