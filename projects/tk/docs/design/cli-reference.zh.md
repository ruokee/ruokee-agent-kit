# CLI 参考

[English](./cli-reference.md)

本文是公开 CLI 拼写、默认值、选项和退出状态的唯一归属文档。深层数据语义见[数据模型与持久化](./data-model.zh.md)，逻辑 JSON 请求见[工具 API](./tool-api.zh.md)。

## 调用规则

```text
tk [global-options] <command> [command-options]
```

全局选项：

| 选项 | 默认值 | 合同 |
| --- | --- | --- |
| `--cwd <path>` | 进程目录 | 项目发现起点 |
| `--output <text|json>` | `text` | 普通命令结果编码 |

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
  [--view <metadata|summary|detailed>]
  [--wal-max-entries <n>] [--wal-max-length <bytes>]
  [global-options]
```

默认 view 是 summary。WAL 预算只对 detailed 有效。精确引用规则见[工具 API](./tool-api.zh.md#精确-task-引用)。

## `tk create task`

```text
tk create task <name>
  [--body <markdown>] [--status <planning|open>]
  [--created-at <rfc3339>]
  [--depends-on <uuid>]... [--related-to <uuid>]...
  [--extra <object-json>]
  [--user-confirmed <true|false>]
  [global-options]
```

默认状态是 open。CLI 直接创建表示用户当前明确请求，因此 `--user-confirmed` 默认为 true。调用方不得用该默认值伪造其他传输中的用户确认。

## `tk create subtask`

```text
tk create subtask <parent_ref>
  --item <object-json> [--item <object-json>]...
  [--user-confirmed <true|false>]
  [global-options]
```

每个 item 包含 `name` 及可选的 `body`、`status`、`created_at`、关系和 `extra`。一次接受 1 到 50 项。批次全部预检后按输入顺序创建。直接通过 CLI 创建时，`--user-confirmed` 默认为 true。其他传输必须传入当前授权状态，创建 planning 子 Task 需要确认。

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
  [--dry-run] [--actor <text>]
  [global-options]
```

rename 只修改 Task 本身。dry-run 和执行都返回找到的 Markdown 引用列表，不自动改写。重复执行且名称和路径已经正确时返回无变化。actor 默认为 `cli`。

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

未指定 file 时选择当前项目全部规范载体。指定值必须是当前项目中的规范 `tk.toml` 或 embed `TASK.md`，不接受目录、Task ID、材料路径或 glob。

迁移只向前执行正式发布的逐级转换。全部目标预检后按确定顺序提交。失败结果列出完成和未完成文件，不提供降级、回滚或续跑状态。

## `tk metadata switch`

```text
tk metadata switch --to <split|embed>
  [--dry-run] [global-options]
```

切换整个项目。全部 Task 预检后按确定顺序提交，最后更新项目配置。失败结果列出完成和未完成 Task。

## `tk mcp`

```text
tk mcp
```

启动单连接 stdio MCP server。该命令不接受 cwd、actor 或 output，因为 cwd 由每次工具请求提供，stdout 只承载 JSON-RPC。

## `tk install`

```text
tk install --harness <codex|claude|pi|omp>
  [--dry-run] [--output <text|json>]
```

install 只使用当前可执行文件内嵌组件。现有 tk 组件版本不同或内容需要替换时执行更新。

结果 action 为 `would_install`、`installed`、`updated` 或 `no_change`，并列出计划或实际变更。失败时遵循跨文件操作的完成和未完成项合同。

## `tk uninstall`

```text
tk uninstall --harness <codex|claude|pi|omp>
  [--dry-run] [--output <text|json>]
```

uninstall 移除所有 tk 专用写入和注册，使 Harness 恢复为从未安装过 tk，同时保留无关内容。

结果 action 为 `would_uninstall`、`uninstalled` 或 `no_change`，并列出计划或实际变更。

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
  "runtime_version": "0.1.1",
  "cli_contract_version": 1,
  "task_schema_version": 1,
  "component_format_version": 1
}
```

version 不要求项目，成功退出 0。help 输出当前层级的用法、参数、默认值和子命令。
