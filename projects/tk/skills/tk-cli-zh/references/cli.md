# CLI

CLI 适合终端交互和脚本。命令通过标准输出返回结果，通过标准错误返回诊断。

## 调用规则

普通命令使用统一入口：

```text
tk [--cwd <path>] [--output <text|json>] <command> ...
```

- `--cwd`：从指定目录开始发现项目。省略时使用运行时进程目录。
- `--output text|json`：选择人类可读文本或结构化 JSON。默认值是 `text`。
- `--actor` 不是全局参数，只属于 `update`、`log` 和 `rename`。

终端用户通常使用 `text`。程序和 Agent 应使用 `json`，并依据稳定错误字段处理失败。

## 输出

普通成功和预期失败在 `--output json` 下使用统一结果：

```json
{
  "ok": true,
  "data": {}
}
```

```json
{
  "ok": false,
  "error": {
    "code": "invalid_args",
    "category": "request",
    "message": "...",
    "details": {}
  }
}
```

文本输出表达相同事实，但排版不是机器接口。程序应读取 `error.code`、`error.category` 和 `details`，不要解析人类可读的 `message`。

`--version` 输出自己的版本载荷，不使用普通结果结构。诊断写入标准错误，非终端输出不含颜色。

## 退出状态

| 状态 | 含义 |
| ---: | --- |
| `0` | 成功，包括无变化和带非致命警告的成功 |
| `2` | CLI 语法、选项、JSON、范围或请求字段无效 |
| `3` | 上下文、配置、策略、解析、受管文件、不变量、冲突或兼容性拒绝 |
| `4` | 存储失败、部分提交、协议启动失败或内部失败 |
| `5` | 必需的外部可执行文件缺失、不可执行或无法启动 |
| `130` | 首次持久化写入前取消 |

退出状态只表达错误大类。自动化仍应读取 JSON 中的稳定错误字段。

## `tk search`

搜索任务：

```text
tk search <query>
  [--regex] [--search-body]
  [--status <planning|open|closed>]...
  [--extra <object-json>] [--limit <n>]
  [--cwd <path>] [--output <text|json>]
```

| 参数 | 默认值 | 行为 |
| --- | --- | --- |
| `<query>` | 必填 | UUID、任务路径、材料路径、名称或文本 |
| `--regex` | `false` | 把普通文本明确解释为 Rust 正则表达式 |
| `--search-body` | `false` | 文本或正则匹配时同时搜索任务正文 |
| `--status` | 全部状态 | 可重复；非空集合用于缩小结果 |
| `--extra` | `{}` | JSON 对象，顶层条件使用 `AND` |
| `--limit` | `20` | 范围是 `1..100` |

搜索先确定查询类型，不在一种解释失败后自动改用另一种解释。结果可能为零个、一个或多个候选。需要修改任务时，应先选择唯一目标。

## `tk read`

读取一个任务：

```text
tk read <task_ref>
  [--view <metadata|summary|detailed>]
  [--wal-max-entries <n>] [--wal-max-length <bytes>]
  [--cwd <path>] [--output <text|json>]
```

默认视图是 `summary`：

- `metadata`：返回受管元数据；
- `summary`：返回常用状态和正文摘要；
- `detailed`：返回更完整的上下文，并按预算附带 WAL。

`--wal-max-entries` 和 `--wal-max-length` 只对 `detailed` 有效，分别限制 WAL 条目数和字节数。

`task_ref` 应是完整 UUIDv7 或精确路径。模糊名称先交给 `tk search`。

## `tk create task`

创建顶层任务：

```text
tk create task <name>
  [--status <planning|open>]
  [--created-at <rfc3339>]
  [--depends-on <uuid>]... [--related-to <uuid>]...
  [--extra <object-json>]
  [--user-confirmed <true|false>]
  [--cwd <path>] [--output <text|json>]
```

- `<name>` 是必填任务名称。
- `--status` 只接受 `planning` 或 `open`，默认是 `open`。
- `--created-at` 只用于保留可靠的历史创建时间。普通创建应省略。
- `--depends-on` 和 `--related-to` 可重复传入，值是同一任务根内已存在任务的完整 UUID。
- `--extra` 接受 JSON 对象。
- CLI 直接创建代表当前用户请求，因此 `--user-confirmed` 默认是 `true`。其他调用入口不得借用这个默认值伪造确认。

tk 运行时在创建 Task 时自动生成 `# <规范化名称>` 作为初始 `TASK.md` 正文。任务需要持久内容时，只在创建完成后单独写入 `TASK.md`。

命名、授权和任务字段规则见[任务概念](./task-concept.md)与[项目和存储](./project-storage.md)。

## `tk create subtask`

在一个父任务下批量创建子任务：

```text
tk create subtask <parent_ref>
  --item <object-json> [--item <object-json>]...
  [--user-confirmed <true|false>]
  [--cwd <path>] [--output <text|json>]
```

每个 `--item` 是一个 JSON 对象，包含必填 `name`，以及可选 `status`、`created_at`、关系和 `extra`。item 不接受正文；每个创建的子任务都以生成的规范化名称标题开头。一次请求接受 1 到 50 个条目。

运行时先预检整个批次，再按输入顺序创建。CLI 的 `--user-confirmed` 默认是 `true`；其他调用入口必须传递真实授权状态。创建 `planning` 子任务需要确认。

创建位置、编号、发现和重试规则见[子任务](./subtask.md)。

## `tk update`

更新关系、扩展字段或生命周期：

```text
tk update <task_ref>
  [--depends-on-add <uuid>]... [--depends-on-remove <uuid>]...
  [--related-to-add <uuid>]... [--related-to-remove <uuid>]...
  [--extra-set <object-json>] [--extra-remove <key>]...
  [--start | --close <reason> | --reopen <reason>]
  [--force] [--user-confirmed <true|false>]
  [--actor <text>]
  [--cwd <path>] [--output <text|json>]
```

- 关系选项使用增量添加或移除，不重写整个集合。
- `--extra-set` 按顶层键合并 JSON 对象；`--extra-remove` 可重复移除顶层键。
- 一次调用最多选择 `--start`、`--close` 或 `--reopen` 中的一项。
- `--close` 和 `--reopen` 的参数就是非空原因。
- `--force` 只允许与 `--close` 同用，并且只跳过后代和依赖未关闭检查。
- 关闭和重开的 `--user-confirmed` 在 CLI 中默认是 `true`。
- `--actor` 默认是 `cli`。

空更新或最终没有变化时，结果返回无变化，不写入重复内容。

## `tk log`

向任务 WAL 追加记录：

```text
tk log <task_ref> --message <text>
  [--body <markdown>] [--actor <text>]
  [--cwd <path>] [--output <text|json>]
```

`--message` 必须是非空单行文本。`--body` 保存较长补充内容，`--actor` 默认是 `cli`。

`log` 不修改受管元数据。`closed` 任务拒绝追加 WAL；需要继续工作时先重开。WAL 的职责边界见[任务概念](./task-concept.md)。

## `tk init`

初始化项目：

```text
tk init
  [--task-root <path>] [--subtasks-dir <path>]
  [--git-policy <track|ignore|none>]
  [--creation-policy <strict|permissive>]
  [--metadata-mode <split|embed>]
  [--force]
  [--cwd <path>] [--output <text|json>]
```

普通初始化拒绝已经初始化的项目。没有非默认配置时，只创建默认 `.tk/`，不创建多余配置文件。

`--force` 使用本次显式值和默认值重写稀疏项目配置，即使旧配置无法解析。它不读取、迁移、移动、删除或改写任务数据。完整参数和初始化场景见[项目和存储](./project-storage.md)。

## `tk check`

检查项目中的受管数据：

```text
tk check [--cwd <path>] [--output <text|json>]
```

检查成功且没有问题时退出 `0`。完整读取发现阻塞诊断时返回 `check_failed` 并退出 `3`。必要 I/O 失败时立即停止，返回 `check_incomplete` 并退出 `4`。

`check` 不修复文件。只有 tk 无法表达所需修复、Agent 已说明精确编辑，并且用户在当前上下文明确授权时，才可手工修复损坏的 `tk.toml`。修复后再次运行 `check`，并在任务可用时记录 WAL。

## `tk rename`

重命名任务：

```text
tk rename <task_ref> <name>
  [--dry-run] [--ignore-brokenlinks] [--actor <text>]
  [--cwd <path>] [--output <text|json>]
```

`--dry-run` 返回计划，不写入文件，发现引用时也照常成功。执行只修改目标任务，仅在路径属于生成式路径时移动目录，并报告解析出的父级和 Markdown 引用，不改写引用内容。名称及其适用路径已经匹配时返回无变化。`--actor` 默认是 `cli`。

路径移动会留下旧路径引用时，执行在写入任何内容前以退出码 3 停止。错误会列出每个引用的文件路径和行号。传入 `--ignore-brokenlinks` 可以继续移动；引用文件保持原样，结果中仍会报告它们。

## `tk gc`

清理 tk 遗留的临时数据：

```text
tk gc [--dry-run]
  [--cwd <path>] [--output <text|json>]
```

GC 只删除已退出操作进程留下的 tk 临时路径和活动操作标记。它不会继续、回滚或完成任务、迁移、重命名或组件操作。

`--dry-run` 列出可清理项但不删除。删除过程中遇到 I/O 错误时立即停止，并列出已经删除和尚未删除的路径。

## `tk metadata migrate`

迁移任务 schema：

```text
tk metadata migrate
  [--file <path>]...
  [--to <schema-version>] [--dry-run]
  [--cwd <path>] [--output <text|json>]
```

- 省略 `--file` 时，选择当前项目中全部有效受管载体。
- `--file` 可重复传入，但每个值必须是当前项目中的有效 `tk.toml` 或 embed `TASK.md`。目录、任务 ID、普通材料路径和 glob 都不接受。
- `--to` 指定目标 schema 版本。
- `--dry-run` 只生成计划。

迁移只执行正式发布的逐级前向转换。全量预检通过后按确定顺序提交。失败结果列出已完成和未完成文件，不提供降级、自动回滚或续跑状态。

## `tk metadata switch`

切换项目元数据模式：

```text
tk metadata switch --to <split|embed>
  [--dry-run]
  [--cwd <path>] [--output <text|json>]
```

该命令作用于整个项目，不支持只切换部分任务。它先预检全部任务，再按确定顺序提交，最后更新项目配置。失败结果列出已完成和未完成任务。

模式切换不会替代 schema 迁移。载体规则和操作顺序见[项目和存储](./project-storage.md)。

## `tk install`

安装已支持 Harness 组件或独立 CLI Skill：

```text
tk install --harness <codex|claude|pi|omp>
  [--mode <tools|cli>] [--language <en|zh>]
  [--dry-run] [--output <text|json>]

tk install --mode cli --skill-root <directory>
  [--language <en|zh>] [--dry-run] [--output <text|json>]
```

- `--harness` 与 `--skill-root` 必须且只能提供一个。
- Harness 模式默认是 `tools`。
- 自定义根目录模式必须显式使用 `cli`。
- `--language` 默认是 `en`。
- `--dry-run` 返回计划，不写入。

安装只使用当前可执行文件中的内嵌载荷，不联网，也不接受本地归档。Harness install 收敛所选组件和注册。自定义根目录 install 在所提供父目录下创建 `tk-cli` 或 `tk-cli-zh`，删除另一个 CLI 目标，并保留其他全部子项。

结果动作是 `would_install`、`installed`、`updated` 或 `no_change`。结果必须且只能包含 `harness` 或绝对路径 `skill_root` 中的一个目标字段，并包含最终模式、语言、Skill 和变更。跨文件失败遵循已完成项和未完成项合同。

## `tk uninstall`

```text
tk uninstall --harness <codex|claude|pi|omp>
  [--dry-run] [--output <text|json>]

tk uninstall --skill-root <directory>
  [--dry-run] [--output <text|json>]
```

uninstall 不接受模式或语言选项。Harness uninstall 删除当前组件、该 Harness 下所有已知残留的 tk Skill variant 和 tk 注册，同时保留无关内容。自定义根目录 uninstall 删除 `tk-cli` 和 `tk-cli-zh`，并保留根目录和其他全部子项。

结果动作是 `would_uninstall`、`uninstalled` 或 `no_change`，并列出计划或实际变更。自定义根目录结果报告 CLI 模式，但省略语言和 Skill。

## `tk --version`

输出当前版本：

```text
tk [--output <text|json>] --version
tk -V
```

JSON 结果包含：

```json
{
  "runtime_version": "0.1.2",
  "cli_contract_version": 2,
  "task_schema_version": 1,
  "component_format_version": 3
}
```

示例中的版本值会随发布变化。该命令不要求项目，成功时退出 `0`。

## `tk --help`

输出当前层级的用法、参数、默认值和子命令：

```text
tk --help
tk -h
tk <command> --help
tk <command> <subcommand> --help
```

帮助文本面向人类阅读，不是稳定机器接口。

## 多目标失败

批量创建、迁移、模式切换和组件操作可能在提交阶段只完成部分目标。出现这种情况时：

- 已成功目标保持已提交状态；
- 失败结果列出 `completed`、`uncompleted` 和原始错误；
- 运行时不自动回滚，也不生成续跑令牌；
- 调用方应重新读取当前状态，再发起新的完整命令。
