# tk 接口

## 目标

通过公开 CLI、stdio MCP 和 Pi、OMP 原生工具提供相同的 tk 领域行为。定义精确输入、默认值、结果语义、错误和传输边界，不要求特定实现语言。

## 公共面

### 上下文

CLI 形式为 `tk [global-options] <command> [command-options]`。全局 `--cwd <path>` 选择项目发现起点，`--output <text|json>` 默认 `text`。`--actor` 只属于 update、log 和 rename，不是全局选项。

逻辑请求使用可选 `cwd`，依次选择显式请求值、Harness 会话目录、运行时进程目录。相对 cwd 从运行时进程目录解析。绝对任务或材料路径可以定位其所属项目。

精确 `task_ref` 是完整 canonical UUIDv7、绝对已发现任务目录、绝对受管载体，或当前项目相对的已发现任务路径。名称、basename、前缀、子串、正则表达式和材料路径不是精确引用。读取和修改必须精确解析到一个任务；模糊输入先搜索。

update、log 和 exec rename 接受可选 actor。直接 CLI 默认 `cli`，原生调用优先使用当前模型身份，不可用时使用 Harness 身份。actor 只是归属，不是用户确认的证明。直接 CLI 的 `user_confirmed` 默认 true，逻辑工具输入默认 false。调用方必须传入真实授权，不能利用通道默认值伪造确认。

### 逻辑操作

MCP namespace 为 `tk`，协议工具名不重复 namespace。

| 操作 | MCP 名称 | 原生名称 |
| --- | --- | --- |
| 搜索 | `search` | `tk_search` |
| 读取 | `read` | `tk_read` |
| 创建 | `create` | `tk_create` |
| 更新 | `update` | `tk_update` |
| 日志 | `log` | `tk_log` |
| 管理 | `exec` | `tk_exec` |

每个工具输入 schema 都声明 object 根并拒绝未知字段。create 保留带判别字段的 `oneOf`，宿主不能展开或改变其语义。下列请求字段除明确标为必需外均可选。

### 搜索

- 必需 `query`：非空字符串。
- `regex`：布尔值，默认 false。普通文本正则查询使用兼容 Rust 的正则表达式语法。
- `search_body`：布尔值，默认 false。只有 true 才在文本或正则匹配中包含正文；false 不读取正文。
- `status`：由 `planning`、`open`、`closed` 组成的数组，省略或空表示全部。
- `extra`：对象，默认空，顶层项按 AND 和完整值比较。
- `limit`：1 至 100 的整数，默认 20。
- `cwd`：项目上下文。

查询只分类一次，优先级依次为完整 UUID 或显式任务路径、作为材料路径的现存普通路径、启用后的正则、否则为名称文本及启用后的正文文本。分类后不回退。不含连字符且至少八位的十六进制 UUID 前缀只由 search 支持。

结果先按匹配类别，再按 `created_at` 降序、ID 升序排列。每项包含 `id`、`name`、`status`、`created_at`、`task_dir`、值为 `uuid`、`path`、`regex` 或 `string` 的字符串 `match`，以及 `closed_ancestors`。ID 和已发现路径提供精确引用。结果包含 `items` 和表示搜索结果受限的 `truncated` 标志。带标记但无效的载体不作为任务出现。必要发现失败使请求失败，不返回部分图。

### 读取

- 必需 `task_ref`：精确引用。
- `view`：`minimal`、`summary` 或 `detailed`，默认 `summary`。
- `wal_max_entries`：0 至 50 的整数。
- `wal_max_length`：0 至 16000 字节的整数。
- `cwd`：项目上下文。

结果中的 `task` 包含受管元数据及 `task_dir`。`minimal` 不读取或返回 `body` 和 `wal`。`summary` 在 `body` 返回完整任务正文，在 `wal.entries` 返回选定条目，每条包含 `timestamp`、`actor`、`message`。`detailed` 额外返回条目可用的 `body`。非空 `wal.warnings` 包含读取问题的 `code`、`message` 和 `path`，空警告列表省略。

| 视图 | 默认 WAL 条数 | 默认 WAL 字节 |
| --- | ---: | ---: |
| summary | 5 | 4000 |
| detailed | 50 | 16000 |

minimal 不使用 WAL 预算。其他视图先按视图投影，再计量每条记录的 compact JSON UTF-8 大小。在两个预算内从新到旧选择完整记录，再按时间正序返回。被省略的历史不产生 truncation 字段、警告或诊断。不提供分页或完整历史读取模式；完整持久 WAL 仍可作为普通文件读取。

### 创建

顶层分支要求 `type:"task"` 和非空 `name`。接受 `status` 为 `planning` 或 `open`，默认 open；可选 `created_at`；同根 UUID 数组 `depends_on`、`related_to`，默认空；`extra`，默认空对象；`user_confirmed`，默认 false；以及 `cwd`。

子分支要求 `type:"subtasks"`、非空 `parent_ref` 和包含 1 至 50 个对象的 `subtasks`。每项要求 `name`，接受相同的状态、时间戳、关系和 extra 字段。分支接受默认 false 的 `user_confirmed` 及 `cwd`。两个分支和子项都不接受 `body`。

创建结果标识已创建任务和变更是否提交。部分完成的子任务操作标识已完成及剩余项。数据要求定义策略、生命周期、重试匹配、编号和初始正文。

### 更新

必需 `task_ref` 选择目标。可选字段为：

- `depends_on_add`、`depends_on_remove`、`related_to_add`、`related_to_remove`：非空精确关系引用数组。
- `extra_set`：对象；`extra_remove`：顶层键数组。
- `start`：布尔值，默认 false。
- `close`：非空理由字符串。
- `reopen`：非空理由字符串。
- `force`：布尔值，默认 false，只可与 close 使用。
- `user_confirmed`：布尔值，默认 false。
- `actor`：非空归属字符串。
- `cwd`：项目上下文。

最多请求一个生命周期动作。close 和 reopen 在自身字符串字段中携带理由，没有独立的 `reason` 字段。无变化返回 `changed:false`。元数据先提交，再自动追加 WAL；追加失败是警告，不回滚。

### 日志

要求 `task_ref` 和非空单行 `message`。接受可选 Markdown `body`、非空 `actor` 和 `cwd`。向非 closed 任务追加一条 WAL 事件，不修改元数据。

### 管理入口

要求非空字符串数组 `argv`，每项都非空。首项只能是 `--version`、`init`、`check`、`rename` 之一。可选上下文为 `cwd`，仅 rename 接受 `actor`。直接使用 argv 调用，不经 shell。拒绝其他首项，包括已有逻辑工具的领域操作及不支持的管理命令。

exec 返回原始 UTF-8 `stdout`、`stderr` 字符串及 `exit_code`，不将管理命令输出解码为领域信封。MCP 成功直接返回这三个字段。原生成功在文本内容和结构化 `details` 中返回 `{"ok":true,"data":{"exit_code":0,"stdout":...,"stderr":...}}`。

非零退出表示 Exec 调用失败。MCP 返回 `exec_command_failed`，错误 details 包含 `exit_code`、`stdout` 和 `stderr`，终止未提供退出码时 `exit_code` 为 null。原生 Exec 抛出携带 `code`、`stdout` 和 `stderr` 的异常。任一输出流超过 1,048,576 字节、进程失败或取消，都不能成为成功的原始结果。MCP 还拒绝非 UTF-8 输出。rename 与直接 CLI 使用相同的精确目标、修复、引用报告和断链规则。

### CLI 命令

以下形式定义公开选项，可重复项用 `...` 标明。普通项目命令接受全局选项，组件操作拒绝 `--cwd`。

```text
tk search <query> [--regex] [--search-body]
  [--status <planning|open|closed>]... [--extra <object-json>] [--limit <n>]
tk read <task_ref> [--view <minimal|summary|detailed>]
  [--wal-max-entries <n>] [--wal-max-length <bytes>]
tk create task <name> [--status <planning|open>] [--created-at <rfc3339>]
  [--depends-on <uuid>]... [--related-to <uuid>]... [--extra <object-json>]
  [--user-confirmed <true|false>]
tk create subtask <parent_ref> --item <object-json> [--item <object-json>]...
  [--user-confirmed <true|false>]
tk update <task_ref>
  [--depends-on-add <uuid>]... [--depends-on-remove <uuid>]...
  [--related-to-add <uuid>]... [--related-to-remove <uuid>]...
  [--extra-set <object-json>] [--extra-remove <key>]...
  [--start | --close <reason> | --reopen <reason>]
  [--force] [--user-confirmed <true|false>] [--actor <text>]
tk log <task_ref> --message <text> [--body <markdown>] [--actor <text>]
tk init [--task-root <path>] [--subtasks-dir <path>]
  [--git-policy <track|ignore|none>] [--creation-policy <strict|permissive>]
  [--metadata-mode <split|embed>] [--force]
tk check
tk rename <task_ref> <name> [--dry-run] [--ignore-brokenlinks] [--actor <text>]
tk gc [--dry-run]
tk metadata migrate [--file <path>]... [--to <schema-version>] [--dry-run]
tk metadata switch --to <split|embed> [--dry-run]
tk schema generate --type <mcp|native> [--harness <pi|omp>]
tk mcp
tk install --harness <codex|claude|pi|omp>
  [--mode <tools|cli>] [--language <en|zh>] [--dry-run] [--output <text|json>]
tk install --mode cli --skill-root <directory>
  [--language <en|zh>] [--dry-run] [--output <text|json>]
tk uninstall --harness <codex|claude|pi|omp> [--dry-run] [--output <text|json>]
tk uninstall --skill-root <directory> [--dry-run] [--output <text|json>]
tk [--output <text|json>] --version
tk --help
tk <command> --help
tk <command> <subcommand> --help
```

create 拒绝 `--body`。未知命令和选项是错误。help 报告当前层级的用法、参数、默认值和子命令。

metadata migrate 省略 `--file` 时选择当前项目全部已发现载体。显式值必须是该项目受管 `tk.toml` 或 embed `TASK.md` 载体，不能是目录、ID、材料路径或 glob。默认目标是当前支持的 schema。switch 选择整个项目。

schema generate 直接输出六工具合同。类型 `mcp` 拒绝 Harness，`native` 要求 pi 或 omp。MCP 启动单连接 stdio 服务，不接受 cwd、actor 或 output 选项，支持初始化、工具列表、调用、取消和干净退出。

MCP stdio 接受 Unix 管道和流式 socket。客户端保持输入流打开时，取消仍可结束空闲连接。工具列举响应包含 `ttlMs: 0` 和 `cacheScope: "private"`，提供 MCP 2026-07-28 要求的缓存元数据，不授予缓存有效期或共享缓存的许可。

rename 结果包含原始旧名称、存在时的父任务路径、旧路径、规范化新名称、绝对目标路径和每条旧路径 Markdown 引用及行号。dry-run 文本显示 `Old path:`、`New name:`、`Target path:`。每次执行结果显示目标路径，无变化文本显示 `No changes` 和 `Target path:`。非空引用追加 `References to the old path:` 及每个 `path:line`，没有引用时不出现该节。

### 结果

普通 JSON 成功为 `{"ok":true,"data":...}`。预期失败为 `{"ok":false,"error":{"code":...,"category":...,"message":...,"details":...}}`。可选非空 `warnings` 数组包含 `code`、`message` 和可选 `details`，空警告省略。供人阅读的 message 措辞不是机器分支合同。

修改结果按需报告 `changed`、`committed`、受影响引用或路径，以及多目标 `completed` 和 `uncompleted`。`partial_commit` details 包含已完成目标、未完成目标和原始 I/O 错误，不含回滚或续做 token。panic、进程被杀、输出错误和传输中断不被伪造成领域失败。

text 表达与 JSON 相同的事实，但除前述 rename 标签外，布局不是机器合同。诊断使用 stderr，非终端输出不带颜色。schema generate、MCP 和 version 使用各自 stdout 载荷，不使用普通结果信封。

| 退出值 | 类别 |
| --- | --- |
| 0 | 成功、无变化或带警告成功 |
| 2 | 请求或语法 |
| 3 | 上下文、配置、策略、解析、受管数据、不变量、冲突、兼容性 |
| 4 | 存储、部分提交、协议启动、内部 |
| 5 | 必需外部可执行文件 |
| 130 | 首次持久写入前取消 |

稳定错误类别及代表性代码为：

| 类别 | 代码 |
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

### 版本

version 无需项目，成功退出 0。JSON 的 `runtime_version` 报告当前可执行文件的发布版本，另有以下独立契约版本：

| 字段 | 版本 |
| --- | ---: |
| `cli_contract_version` | 3 |
| `task_schema_version` | 1 |
| `component_format_version` | 4 |

native contract 版本为 `3`，component-driver contract 版本为 `1`。native/component 运行时兼容范围为 `>=0.1,<0.2`。运行时发布版本与这些契约维度、宿主维护下限相互独立。

## 不变量

MCP stdout 只包含 JSON-RPC，日志使用 stderr。每个 MCP JSON 载荷和每条子进程 stdout 或 stderr 流的上限为 1,048,576 字节。超出传输上限是传输失败，不能把残帧作为有效结果发送。

原生操作直接调用固定公开运行时，不经 shell，并响应取消。普通原生成功和有效领域失败信封在文本内容及结构化 `details` 中原样返回。领域失败的非零退出值不使其变为异常。错误信封、意外退出、进程失败和适配器取消仍是传输异常。

## 验收标准

- 六个工具保留名称、字段、默认值、object 根 schema、create 联合语义和 Harness 专属字段。未知请求字段和不支持的 CLI 选项失败，不能被静默丢弃。
- 搜索分类不回退，默认包含全部状态，结果排序稳定且数量有界，`search_body=false` 不读取正文。
- summary 和 detailed 返回完整正文，minimal 不读取正文或 WAL，WAL 在指定预算内返回完整投影记录，不虚构历史诊断。
- 直接 CLI 和逻辑工具保留不同确认默认值，同时应用相同领域规则。actor 只出现在支持的 WAL 写入操作。
- 原生领域错误保持为可检查结果。进程、输出超限、取消和协议失败分别处理。MCP stdout 保持纯协议内容，并可干净退出。
- CLI 输出、退出类别、版本维度、rename 标签、dry-run 行为和组件选择默认值符合公开合同。
