# CLI 参考

[English](./cli-reference.md)

本文说明公开 CLI 拼写、默认值、选项、结果和退出状态。详细数据语义见[数据模型](./data-model.zh.md)。

## 调用规则

```text
tk [global-options] <command> [command-options]
```

全局选项：

- `--cwd <path>` 默认为进程目录，指定项目发现起点。
- `--output <text|json>` 默认为 `text`，选择普通命令的结果编码。

`--actor` 不是全局选项，只属于 update、log 和 rename。

JSON 参数必须是对象根，任意深度的重复键都会被拒绝。结构化子任务 item 拒绝未知字段。Agent 必须传入真实授权，可以把可用的模型或 Harness 身份写入 `--actor`，归因不构成授权证明。

## 精确任务引用

`task_ref` 接受完整规范 UUIDv7、已发现任务目录的绝对路径、受管 `tk.toml` 或 `TASK.md` 载体的绝对路径，或相对当前项目的已发现任务路径。名称、basename、UUID 前缀、子串、正则表达式和材料路径是搜索输入，不是精确引用。读写必须解析为恰好一个任务。完整绝对任务路径或材料路径可以定位自己的项目。

## 命令树

```text
tk search
tk read
tk create task
tk create subtask
tk update
tk log
tk init
tk check
tk rename
tk gc
tk metadata migrate
tk metadata switch
tk install
tk uninstall
tk --version
```

## 输出

普通 JSON 成功结果为 `{"ok":true,"data":...}`。预期失败为 `{"ok":false,"error":{"code":...,"category":...,"message":...,"details":...}}`。非空 `warnings` 包含 `code`、`message` 和可选 `details`，空警告省略。人类可读消息不是机器分支合同。

修改结果报告 `changed`、`committed`、受影响的任务引用或路径，多目标操作还报告 `completed` 和 `uncompleted`。`partial_commit` 详情包含已完成目标、未完成目标和原始 I/O 错误，不提供回滚或续跑令牌。panic、进程被杀和输出损坏不会被伪造为领域失败。

文本和 JSON 表达相同事实。除已规定的 rename 标签外，文本布局不是机器合同。version 直接写自身 JSON 载荷，不套普通结果结构。诊断写 stderr，非终端输出不含颜色。

## 退出状态

沿用当前映射：

- `0`：成功，包括无变化和带非致命警告的成功。
- `2`：CLI 语法、选项、JSON、范围或请求字段错误。
- `3`：上下文、配置、策略、解析、受管文件、不变量、冲突或兼容性拒绝。
- `4`：存储失败、部分提交或内部失败。
- `5`：必需的外部可执行文件缺失、不可执行或无法启动。
- `130`：首次持久写入前取消。

自动化需要读取 JSON 的 `error.code` 和 `error.category` 区分具体原因，不能把数字退出码当成细分错误合同。

## 错误码

| 类别 | 典型错误码 |
| --- | --- |
| `request` | `invalid_request`, `invalid_search_regex` |
| `context` | `project_not_found`, `path_outside_project` |
| `environment` | `runtime_not_installed`, `runtime_not_executable`, `process_start_failed` |
| `configuration` | `invalid_configuration`, `project_not_initialized` |
| `policy` | `authorization_required`, `git_policy_refused` |
| `resolution` | `task_not_found`, `task_ref_ambiguous`, `duplicate_task_id` |
| `managed_file` | `invalid_managed_file`, `unsupported_schema`, `representation_mismatch` |
| `invariant` | `dependency_cycle`, `closed_task_read_only`, `active_descendant`, `active_dependency`, `closed_ancestor` |
| `conflict` | `target_exists`, `operation_in_progress`, `broken_reference_conflict` |
| `storage` | `check_incomplete`, `task_discovery_limit_exceeded`, `reference_scan_limit_exceeded`, `wal_append_failed`, `partial_commit` |
| `compatibility` | `runtime_incompatible`, `component_incompatible` |
| `internal` | `internal_error` |

## `tk search`

```text
tk search <query>
  [--regex] [--search-body]
  [--status <planning|open|closed>]...
  [--extra <object-json>] [--limit <n>]
  [global-options]
```

- `<query>`：必填。UUID、任务路径、材料路径、名称或文本。
- `--regex`：默认 `false`。显式把普通文本解释为 Rust 正则表达式。
- `--search-body`：默认 `false`。文本或正则匹配时包含任务正文。
- `--status`：默认全部状态。可重复；非空集合缩小结果。
- `--extra`：默认 `{}`。JSON 对象，顶层条目以 AND 组合。
- `--limit`：默认 `20`。取值 1 到 100。

查询按以下顺序只分类一次：完整 UUID 或明确任务路径；把已存在的普通路径作为材料路径；已启用时作为正则表达式；否则匹配名称文本及已启用的正文文本。分类后不回退。无连字符且至少八位的十六进制 UUID 前缀只用于搜索。

结果先按匹配类别，再按 `created_at` 降序和 ID 升序排列。每项包含 `id`、`name`、`status`、`created_at`、`task_dir`、值为 `uuid`、`path`、`regex` 或 `string` 的字符串 `match`，以及 `closed_ancestors`。结果包含 `items` 和 `truncated` 标记。无效标记载体不会成为任务，必要的发现失败会使搜索失败，不返回部分任务图。extra 筛选对顶层完整值做 AND 比较。

```text
tk search architecture
tk search 0192aabb --status closed
tk search /work/project/.tk/2026/08/27-01--tk-architecture/notes.md
tk search 'api|cli' --regex --search-body --output json
```

## `tk read`

```text
tk read <task_ref>
  [--view <minimal|summary|detailed>]
  [--wal-max-entries <n>] [--wal-max-length <bytes>]
  [global-options]
```

默认视图是 `summary`。`minimal` 返回元数据和受管路径，不读取任务正文或 WAL。`summary` 返回完整任务正文和不含正文的最近 WAL 条目。`detailed` 增加 WAL 条目正文。

WAL 预算适用于 `summary` 和 `detailed`。summary 默认 5 条、4000 字节，detailed 默认 50 条、16000 字节。显式范围为 0 至 50 条、0 至 16000 字节。先按视图投影，再测量每条紧凑 JSON 的 UTF-8 字节数；从新到旧选择同时满足两个预算的完整条目，最后按时间顺序返回。省略条目不会产生截断字段、警告或诊断。不提供分页或全历史模式，完整历史仍在普通每日 WAL 文件中。可接受引用见[精确任务引用](#精确任务引用)。

## `tk create task`

```text
tk create task <name>
  [--status <planning|open>]
  [--created-at <rfc3339>]
  [--depends-on <uuid>]... [--related-to <uuid>]...
  [--extra <object-json>]
  [--user-confirmed <true|false>]
  [global-options]
```

默认状态是 open，`--user-confirmed` 默认为 true。Agent 必须传入真实授权状态，不能依赖该默认值。结果在 `data.created` 中列出新建任务引用。

create 不接受正文输入；生成标题的规则见[创建正文](./data-model.zh.md#创建正文)。

## `tk create subtask`

```text
tk create subtask <parent_ref>
  --item <object-json> [--item <object-json>]...
  [--user-confirmed <true|false>]
  [global-options]
```

每个 item 包含 `name` 及可选的 `status`、`created_at`、关系和 `extra`。item 不接受正文。一次接受 1 到 50 项。批次全部预检后按输入顺序创建。通过 CLI 创建时，`--user-confirmed` 默认为 true。Agent 必须传入真实授权状态，不能依赖该默认值。创建 planning 子任务需要确认。

## `tk update`

```text
tk update <task_ref>
  [--depends-on-add <uuid>]... [--depends-on-remove <uuid>]...
  [--related-to-add <uuid>]... [--related-to-remove <uuid>]...
  [--extra-set <object-json>] [--extra-remove <key>]...
  [--start | --close <reason> | --reopen <reason>]
  [--force] [--user-confirmed <true|false>]
  [--actor <text>]
  [global-options]
```

close 和 reopen 要求当前确认，CLI 默认为 true。`--force` 只与 close 一起有效。actor 默认为 `cli`。

## `tk log`

```text
tk log <task_ref> --message <text>
  [--body <markdown>] [--actor <text>]
  [global-options]
```

message 是非空单行文本。actor 默认为 `cli`。closed 任务拒绝日志写入。

## `tk init`

```text
tk init
  [--task-root <path>] [--subtasks-dir <path>]
  [--git-policy <track|ignore|none>]
  [--creation-policy <strict|permissive>]
  [--metadata-mode <split|embed>]
  [--force] [global-options]
```

普通 init 拒绝已初始化项目。`--force` 使用显式值和默认值重写稀疏项目配置，即使原配置无法解析。它不读取或修改任务数据。

## `tk check`

```text
tk check [global-options]
```

无问题时退出 0。完整读取后发现阻塞诊断时返回 `check_failed` 并退出 3。必要 I/O 失败时立即返回 `check_incomplete` 并退出 4，不继续扫描。

check 不修复文件；人工修复损坏 `tk.toml` 的条件见[人工修复任务元数据](./skill.zh.md#人工修复任务元数据)。

## `tk rename`

```text
tk rename <task_ref> <name>
  [--dry-run] [--ignore-brokenlinks] [--actor <text>]
  [global-options]
```

rename 只修改任务本身，closed 任务同样适用且保持其状态。它也修复无效、为空或实际过宽的字符串名称，以及结构可识别但不符合[任务名称规则](./data-model.zh.md#任务名称)的生成式后缀。普通发现因旧名称拒绝目标时，完整 UUID、精确任务目录和精确受管载体仍可定位符合条件的修复对象。其他元数据、身份、路径、生命周期、策略和冲突校验保持严格。生成式子任务和顶层任务的 slug 改变时移动目录，非生成式子任务保持目录不变。dry-run 和执行都返回原始旧名称、解析出的父级和 Markdown 引用，不改写引用。只有保存名称和适用路径都精确匹配规范化目标时才返回无变化。actor 默认为 `cli`。

排版对应不表示显式 rename 已完成。例如，保存名称为 `AI 学习`、后缀为 `AI学习` 时，rename 为 `AI 学习` 的目标名称和后缀都是 `AI-学习`。[rename 合同](./data-model.zh.md#rename)也保留精确提交前复检和部分失败重试行为。

dry-run 文本显示 `Old path:`、规范化名称 `New name:` 和绝对目标路径 `Target path:`。每个执行结果都显示目标路径，无变化的结果先输出 `No changes` 再输出 `Target path:`。存在旧路径引用时，文本追加 `References to the old path:` 列表，每个引用以 `path:line` 表示；没有引用时不输出该列表。dry-run 在生成合法计划后始终成功。执行会移动任务路径且存在旧路径引用时，在首次写入前以稳定错误码 `broken_reference_conflict`（`conflict` 类别、退出码 3）停止；错误显示目标路径和每个引用及其行号。`--ignore-brokenlinks` 允许此次移动继续进行。引用文件保持原样，结果中仍会报告它们。

## `tk gc`

```text
tk gc [--dry-run] [global-options]
```

GC 清理操作进程退出后留下的 tk 临时路径和活动操作标记。它不继续、回滚或完成任务、迁移、rename 或组件操作。遇到删除 I/O 错误时停止并列出已删除和未删除路径。

## `tk metadata migrate`

```text
tk metadata migrate
  [--file <path>]...
  [--to <schema-version>] [--dry-run]
  [global-options]
```

未指定 file 时选择当前项目全部已发现载体。指定值必须是当前项目中属于已发现任务的受管 `tk.toml` 或 embed `TASK.md`，不接受目录、任务 ID、材料路径或 glob。

迁移只向前执行正式发布的逐级转换。全部目标预检后按确定顺序提交。失败结果列出完成和未完成文件，不提供降级、回滚或续跑状态。

## `tk metadata switch`

```text
tk metadata switch --to <split|embed>
  [--dry-run] [global-options]
```

命令切换项目中的全部已发现任务。全部任务预检后按确定顺序提交，最后更新项目配置。失败结果列出完成和未完成任务。

## `tk install`

```text
tk install --harness <codex|claude|pi|omp>
  [--language <en|zh>]
  [--dry-run] [--output <text|json>]

tk install --skill-root <directory>
  [--language <en|zh>] [--dry-run] [--output <text|json>]
```

`--harness` 与 `--skill-root` 必须且只能提供一个。`--language` 默认 `en`，选择 `tk-cli`；`zh` 选择 `tk-cli-zh`。

Harness 选择映射到普通 Skill 根目录：Codex 使用 `$CODEX_HOME/skills`，默认为 `~/.codex/skills`；Claude Code 使用 `~/.claude/skills`；Pi 使用 `~/.pi/agent/skills`；OMP 使用 `~/.omp/agent/skills`。自定义根目录按进程 cwd 解析。安装写入所选 Skill 并删除另一种语言。两种目标都只管理这两个直接子项，保留其他内容，不读取 Harness 配置或调用 Harness 命令。组件操作拒绝全局 `--cwd`。

install 只使用当前可执行文件内嵌载荷，不访问网络，也不接受本地归档。

结果 action 为 `would_install`、`installed`、`updated` 或 `no_change`。text 和 JSON 结果必须且只能包含 `harness` 或绝对路径 `skill_root` 中的一个目标字段，并包含 `language`、`skill` 和计划或实际变更。失败遵循多目标完成和未完成项合同。

## `tk uninstall`

```text
tk uninstall --harness <codex|claude|pi|omp>
  [--dry-run] [--output <text|json>]

tk uninstall --skill-root <directory>
  [--dry-run] [--output <text|json>]
```

必须且只能提供一个目标选项。uninstall 不接受语言选择。它删除所选根目录下的 `tk-cli` 和 `tk-cli-zh`，包括目标内修改或额外的内容，根目录和其他全部子项保持不变。

结果 action 为 `would_uninstall`、`uninstalled` 或 `no_change`。结果必须且只能包含一个目标字段，并列出计划或实际变更。两个身份都会被删除，因此省略 `language` 和 `skill`。

## 运行时信息

```text
tk [--output <text|json>] --version
tk --help
tk <command> --help
tk <command> <subcommand> --help
```

版本 JSON 为：

```json
{
  "runtime_version": "0.1.16",
  "cli_contract_version": 4,
  "task_schema_version": 1,
  "component_format_version": 5
}
```

`runtime_version` 是运行中可执行文件的包版本，随发行变化；其余取值是[运行时架构](./runtime.zh.md#版本维度)定义的版本维度。

version 不要求项目，成功退出 0。help 输出当前层级的用法、参数、默认值和子命令。
