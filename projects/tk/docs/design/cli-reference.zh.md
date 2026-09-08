# CLI 参考

[English](./cli-reference.md)

本文是公开 CLI 拼写、默认值、选项和退出状态的唯一归属文档。深层数据语义见[数据模型与持久化](./data-model.zh.md)，逻辑 JSON 请求见[工具 API](./tool-api.zh.md)。

## 调用规则

```text
tk [global-options] <command> [command-options]
```

全局选项：

|选项|默认值|合同|
|-|-|-|
|`--cwd <path>`|进程目录|项目发现起点|
|`--output <text|json>`|`text`|普通命令结果编码|

`--actor` 不是全局选项，只属于 update、log 和 rename。

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
tk schema generate
tk metadata migrate
tk metadata switch
tk mcp
tk install
tk uninstall
tk --version
```

## 输出

`--output json` 在普通成功或预期失败时向 stdout 写入一个[统一结果](./tool-api.zh.md#统一结果)。文本输出表达相同事实，但布局不是机器合同。

schema generate、MCP 和 version 的 stdout 是命令自身载荷，不套普通结果结构。诊断写 stderr。非终端输出不包含颜色。

## 退出状态

沿用当前映射：

| 状态 | 含义 |
| ---: | --- |
| 0 | 成功，包括无变化和带非致命警告的成功 |
| 2 | CLI 语法、选项、JSON、范围或请求字段错误 |
| 3 | 上下文、配置、策略、解析、受管文件、不变量、冲突或兼容性拒绝 |
| 4 | 存储失败、部分提交、协议启动失败或内部失败 |
| 5 | 必需的外部可执行文件缺失、不可执行或无法启动 |
| 130 | 首次持久写入前取消 |

自动化需要读取 JSON 的 `error.code` 和 `error.category` 区分具体原因，不能把数字退出码当成细分错误合同。

## `tk search`

```text
tk search <query>
  [--regex] [--search-body]
  [--status <planning|open|closed>]...
  [--extra <object-json>] [--limit <n>]
  [global-options]
```

| 参数 | 默认值 | 合同 |
| --- | --- | --- |
| `<query>` | 必填 | UUID、Task 路径、材料路径、名称或文本 |
| `--regex` | false | 显式把普通文本解释为 Rust 正则表达式 |
| `--search-body` | false | 文本或正则匹配时包含 Task 正文 |
| `--status` | 全部状态 | 可重复；非空集合缩小结果 |
| `--extra` | `{}` | JSON 对象，顶层条目以 AND 组合 |
| `--limit` | 20 | 1 到 100 |

查询解释、UUID 前缀、排序和 `match` 字段见[工具 API 搜索](./tool-api.zh.md#搜索)。

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

默认视图是 `summary`。`minimal` 返回元数据和受管路径，不读取 Task 正文或 WAL。`summary` 返回完整 Task 正文和不含正文的最近 WAL 条目。`detailed` 增加 WAL 条目正文。

WAL 预算适用于 `summary` 和 `detailed`。未提供参数时，`summary` 使用 5 条和 4000 字节，`detailed` 使用 50 条和 16000 字节。调用方可以调低任一预算，也可以把 summary 请求调高到两种视图共用的上限 50 条和 16000 字节。返回结果静默省略所选预算之外的更早条目。精确引用与预算规则见[工具 API](./tool-api.zh.md#精确-task-引用)。

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

默认状态是 open。CLI 直接创建表示用户当前明确请求，因此 `--user-confirmed` 默认为 true。调用方不得用该默认值伪造其他传输中的用户确认。

运行时在创建 Task 时自动生成 `# <规范化名称>` 作为初始 `TASK.md` 正文。create 不接受正文输入；任务需要持久内容时，在创建完成后单独写入 `TASK.md`。

## `tk create subtask`

```text
tk create subtask <parent_ref>
  --item <object-json> [--item <object-json>]...
  [--user-confirmed <true|false>]
  [global-options]
```

每个 item 包含 `name` 及可选的 `status`、`created_at`、关系和 `extra`。item 不接受正文；每个创建的 Task 都以生成的规范化名称标题开头。一次接受 1 到 50 项。批次全部预检后按输入顺序创建。直接通过 CLI 创建时，`--user-confirmed` 默认为 true。其他传输必须传入当前授权状态，创建 planning 子 Task 需要确认。

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

message 是非空单行文本。actor 默认为 `cli`。closed Task 拒绝日志写入。

## `tk init`

```text
tk init
  [--task-root <path>] [--subtasks-dir <path>]
  [--git-policy <track|ignore|none>]
  [--creation-policy <strict|permissive>]
  [--metadata-mode <split|embed>]
  [--force] [global-options]
```

普通 init 拒绝已初始化项目。`--force` 使用显式值和默认值重写稀疏项目配置，即使原配置无法解析。它不读取或修改 Task 数据。

## `tk check`

```text
tk check [global-options]
```

无问题时退出 0。完整读取后发现阻塞诊断时返回 `check_failed` 并退出 3。必要 I/O 失败时立即返回 `check_incomplete` 并退出 4，不继续扫描。

check 不修复文件。损坏的 `tk.toml` 只有在 tk 无法表达修复、Agent 已说明具体编辑且用户当前明确授权后，才允许人工修复。修复后再次运行 check，并在 Task 可用时记录 WAL。

## `tk rename`

```text
tk rename <task_ref> <name>
  [--dry-run] [--ignore-brokenlinks] [--actor <text>]
  [global-options]
```

rename 只修改 Task 本身。它也修复已有字符串名称不规范、为空、规范化后为空或过宽的问题，以及与元数据不一致但结构可识别的生成式后缀。普通发现因旧名称拒绝目标时，完整 UUID、精确 Task 目录和精确受管载体仍可定位符合条件的修复对象。其他元数据、身份、路径、生命周期、策略和冲突校验保持严格。生成式子 Task 和顶层 Task 的 slug 改变时移动目录，非生成式子 Task 保持目录不变。dry-run 和执行都返回原始旧名称、解析出的父级和 Markdown 引用，不改写引用。名称及其适用路径已经匹配时，重复请求返回无变化。actor 默认为 `cli`。

dry-run 文本显示 `Old path:`、规范化名称 `New name:` 和绝对目标路径 `Target path:`。每个执行结果都显示目标路径，无变化的结果先输出 `No changes` 再输出 `Target path:`。存在旧路径引用时，文本追加 `References to the old path:` 列表，每个引用以 `path:line` 表示；没有引用时不输出该列表。dry-run 在生成合法计划后始终成功。执行会移动 Task 路径且存在旧路径引用时，在首次写入前以稳定错误码 `broken_reference_conflict`（`conflict` 类别、退出码 3）停止；错误显示目标路径和每个引用及其行号。`--ignore-brokenlinks` 允许此次移动继续进行。引用文件保持原样，结果中仍会报告它们。

## `tk gc`

```text
tk gc [--dry-run] [global-options]
```

GC 清理操作进程退出后留下的 tk 临时路径和活动操作标记。它不继续、回滚或完成 Task、迁移、rename 或组件操作。遇到删除 I/O 错误时停止并列出已删除和未删除路径。

## `tk schema generate`

```text
tk schema generate --type <mcp|native>
  [--harness <pi|omp>]
```

`mcp` 不接受 Harness。`native` 必须选择 pi 或 omp。命令把生成的六工具合同直接写入 stdout。

## `tk metadata migrate`

```text
tk metadata migrate
  [--file <path>]...
  [--to <schema-version>] [--dry-run]
  [global-options]
```

未指定 file 时选择当前项目全部已发现载体。指定值必须是当前项目中属于已发现 Task 的受管 `tk.toml` 或 embed `TASK.md`，不接受目录、Task ID、材料路径或 glob。

迁移只向前执行正式发布的逐级转换。全部目标预检后按确定顺序提交。失败结果列出完成和未完成文件，不提供降级、回滚或续跑状态。

## `tk metadata switch`

```text
tk metadata switch --to <split|embed>
  [--dry-run] [global-options]
```

命令切换项目中的全部已发现 Task。全部 Task 预检后按确定顺序提交，最后更新项目配置。失败结果列出完成和未完成 Task。

## `tk mcp`

```text
tk mcp
```

启动单连接 stdio MCP server。该命令不接受 cwd、actor 或 output，因为 cwd 由每次工具请求提供，stdout 只承载 JSON-RPC。

## `tk install`

```text
tk install --harness <codex|claude|pi|omp>
  [--mode <tools|cli>] [--language <en|zh>]
  [--dry-run] [--output <text|json>]

tk install --mode cli --skill-root <directory>
  [--language <en|zh>] [--dry-run] [--output <text|json>]
```

`--harness` 与 `--skill-root` 必须且只能提供一个。Harness install 的 `--mode` 默认 `tools`。自定义根目录 install 必须显式传入 `--mode cli`，并拒绝 tools 模式。两种目标的 `--language` 都默认 `en`。四个最终 Skill 分别为 `tk`、`tk-zh`、`tk-cli` 和 `tk-cli-zh`。

Harness install 会在固定目标、注册、模式、语言或所选 Skill 与当前状态不一致时更新。自定义根目录 install 把 `tk-cli` 或 `tk-cli-zh` 放在所提供的父目录下，删除另一个 CLI Skill 目标，并保留 `tk`、`tk-zh` 和其他全部子项。相对根目录按进程当前工作目录解析。组件操作拒绝全局 `--cwd`。

install 只使用当前可执行文件内嵌载荷，不访问网络，也不接受本地归档。

结果 action 为 `would_install`、`installed`、`updated` 或 `no_change`。text 和 JSON 结果必须且只能包含一个目标字段，即 `harness` 或绝对路径 `skill_root`，并包含最终 `mode`、`language`、`skill` 和计划或实际变更。失败时遵循跨文件操作的完成和未完成项合同。

## `tk uninstall`

```text
tk uninstall --harness <codex|claude|pi|omp>
  [--dry-run] [--output <text|json>]

tk uninstall --skill-root <directory>
  [--dry-run] [--output <text|json>]
```

必须且只能提供一个目标选项。uninstall 不接受模式或语言选择。Harness uninstall 移除当前组件、该 Harness 已知的全部残留 tk Skill variant 和 tk 注册。自定义根目录 uninstall 删除所提供根目录下的 `tk-cli` 和 `tk-cli-zh`，并保留根目录及其他全部子项。

结果 action 为 `would_uninstall`、`uninstalled` 或 `no_change`。结果必须且只能包含一个目标字段，并列出计划或实际变更。自定义根目录结果报告 `mode: cli`，但省略 `language` 和 `skill`，因为两个 CLI Skill 身份都会被删除。

## 版本和帮助

```text
tk [--output <text|json>] --version
tk --help
tk <command> --help
tk <command> <subcommand> --help
```

版本 JSON 为：

```json
{
  "runtime_version": "0.1.2",
  "cli_contract_version": 3,
  "task_schema_version": 1,
  "component_format_version": 3
}
```

version 不要求项目，成功退出 0。help 输出当前层级的用法、参数、默认值和子命令。
