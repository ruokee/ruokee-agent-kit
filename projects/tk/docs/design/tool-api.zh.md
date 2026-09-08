# 工具 API

[English](./tool-api.md)

本文定义六个逻辑工具、MCP 和原生名称、请求字段、结果结构及稳定错误。CLI 拼写和退出码属于 [CLI 参考](./cli-reference.zh.md)。

## 工具名称

| 逻辑操作 | MCP 名称 | Pi 和 OMP 原生名称 |
| --- | --- | --- |
| 搜索 | `search` | `tk_search` |
| 读取 | `read` | `tk_read` |
| 创建 | `create` | `tk_create` |
| 更新 | `update` | `tk_update` |
| 记录 | `log` | `tk_log` |
| 执行管理命令 | `exec` | `tk_exec` |

MCP server 使用 `tk` 命名空间。协议内工具名称不重复命名空间。

Rust 从同一组请求类型生成 MCP 和 native schema。Harness 不能增加字段、修改默认值或复制领域验证。

## 公共上下文

以下字段按工具需要出现：

| 字段 | 类型 | 合同 |
| --- | --- | --- |
| `cwd` | 可选路径 | 项目发现起点；相对值基于运行时进程目录解析 |
| `harness` | 可选枚举 | 诊断上下文，不持久化 |
| 取消 | 传输信号 | 在首次写入前和多目标提交点之间响应 |

actor 不是公共上下文字段。它只出现在会追加 WAL 的 update、log 和 exec rename 请求中。

cwd 选择顺序是请求显式值、Harness 会话目录、运行时进程目录。完整绝对 Task 路径和绝对材料路径可以反向定位自己的项目。

## 精确 Task 引用

`task_ref` 只接受：

- 完整规范 UUIDv7；
- 绝对已发现 Task 目录；
- 绝对受管 `tk.toml` 或 `TASK.md` 载体；
- 当前项目中的相对已发现 Task 路径。

名称、目录基名、UUID 前缀、子字符串、正则表达式和材料路径不是精确引用。读取和修改必须解析为恰好一个 Task。

## 统一结果

成功：

```json
{"ok":true,"data":{}}
```

带警告的成功：

```json
{
  "ok": true,
  "data": {"changed": true, "committed": true},
  "warnings": [
    {
      "code": "wal_append_failed",
      "message": "元数据已提交，但 WAL 追加失败",
      "details": {"task_ref": "019..."}
    }
  ]
}
```

失败：

```json
{
  "ok": false,
  "error": {
    "code": "task_not_found",
    "category": "resolution",
    "message": "未找到 Task",
    "details": {"task_ref": "..."}
  }
}
```

稳定字段是 `ok`、`data`、`warnings`、`error`、`code`、`category`、`message` 和 `details`。空警告省略。`message` 面向人类，不是机器分支合同。

修改结果按需要包含：

- `changed`：规范结果是否变化；
- `committed`：请求要求的单项变更是否已经提交；
- `completed`：多目标操作已经完成的目标；
- `uncompleted`：多目标操作未完成的目标；
- 受影响的 Task 引用或路径。

运行时不会为 panic、传输中断、格式错误的 stdout 或进程被杀死伪造领域错误结果。

## 错误类别和稳定码

| 类别 | 典型错误码 |
| --- | --- |
| `request` | `invalid_request`、`invalid_regex` |
| `context` | `project_not_found`、`path_outside_project` |
| `environment` | `runtime_not_installed`、`runtime_not_executable`、`process_start_failed` |
| `configuration` | `invalid_configuration`、`project_not_initialized` |
| `policy` | `authorization_required`、`git_policy_refused` |
| `resolution` | `task_not_found`、`task_ref_ambiguous`、`duplicate_task_id` |
| `managed_file` | `invalid_managed_file`、`unsupported_schema`、`representation_mismatch` |
| `invariant` | `dependency_cycle`、`closed_task_read_only`、`active_descendant`、`active_dependency`、`closed_ancestor` |
| `conflict` | `target_exists`、`operation_in_progress` |
| `storage` | `check_incomplete`、`task_discovery_limit_exceeded`、`wal_append_failed`、`partial_commit` |
| `compatibility` | `runtime_incompatible`、`component_incompatible` |
| `internal` | `internal_error` |

`partial_commit` 的 `details` 必须包含 `completed`、`uncompleted` 和原始 I/O 错误。它不提供回滚或续跑令牌。

## 搜索

请求：

| 字段 | 类型 | 默认值 | 合同 |
| --- | --- | --- | --- |
| `query` | 非空字符串 | 必填 | UUID、Task 路径、材料路径、名称或文本 |
| `regex` | 布尔值 | `false` | 显式把普通文本解释为 Rust 正则表达式 |
| `search_body` | 布尔值 | `false` | 字符串或正则匹配时包含 Task 正文 |
| `status` | 状态数组 | 全部状态 | 非空数组缩小到指定状态 |
| `extra` | 对象 | 空 | 顶层值以 AND 组合并按完整值比较 |
| `limit` | 整数 | 20 | 1 到 100 |
| `cwd` | 路径 | 公共默认 | 项目发现起点 |

查询类型按以下顺序一次确定：

1. 完整 UUID 或明确 Task 路径；
2. 现有普通路径，按材料路径；
3. `regex=true`，按正则表达式；
4. 其余按名称，以及 `search_body=true` 时的正文文本。

确定类型后不回退。去掉连字符的 UUID 十六进制前缀最少 8 位，只用于搜索。

结果先按匹配类别排序，同一类别按 `created_at` 降序、ID 升序排列。每项包括 Task 摘要、`match`、`closed_ancestors` 和精确 Task 引用。`match` 至少为 `uuid`、`path`、`regex` 或 `string`。

发现任务图可以包含项目中的全部有效 Task。search 最多保留前 100 个结果项。无效标记载体和相似普通文件不会作为 Task 返回。必要发现 I/O 失败或资源上限错误会使搜索失败，不返回部分任务图。

## 读取

请求：

| 字段 | 默认值 | 合同 |
| --- | --- | --- |
| `task_ref` | 必填 | 精确引用 |
| `view` | `summary` | `minimal`、`summary` 或 `detailed` |
| `wal_max_entries` | summary 为 5；detailed 为 50 | 0 到 50；minimal 不使用 |
| `wal_max_length` | summary 为 4000；detailed 为 16000 | 0 到 16000 字节；minimal 不使用 |
| `cwd` | 公共默认 | 项目解析 |

`minimal` 返回元数据和受管路径，不读取 Task 正文或 WAL。`summary` 返回完整的当前正文，以及包含 `timestamp`、`actor` 和 `message` 的最近 WAL 条目。`detailed` 返回相同的 Task 信息，并增加存在的 WAL `body`。

运行时先按所选视图确定条目的返回字段，再按紧凑 JSON 的 UTF-8 字节数计量。它从最新条目开始，在两项预算内选择完整条目，最后按时间正序返回。预算之外的条目会被静默省略，不返回截断字段、警告或诊断。`tk read` 不提供分页或完整历史模式；需要完整历史时直接读取 `wal/YYYY-MM-DD.md`。

## 创建

create 使用 `oneOf` 区分顶层 Task 和子 Task 批次。

与其他工具输入 schema 一样，create union 在根节点声明 `type: "object"`。每个 `oneOf` 分支仍分别定义允许字段和必填判别字段。

顶层分支：

| 字段 | 默认值 | 合同 |
| --- | --- | --- |
| `type` | 必填 | `task` |
| `name` | 必填 | 可规范化名称 |
| `status` | `open` | `planning` 或 `open` |
| `created_at` | 当前时间 | 只在已知原始时间时显式提供 |
| `depends_on` | 空 | 同根 UUID 集合 |
| `related_to` | 空 | 同根 UUID 集合 |
| `extra` | 空 | 结构化附加值 |
| `user_confirmed` | `false` | 当前对话是否明确授权顶层创建 |
| `cwd` | 公共默认 | 项目解析 |

strict 项目要求 `user_confirmed=true`。permissive 项目允许值得持久保存的工作在 `false` 时创建，调用 Agent 负责根据语境选择 planning 或 open 并报告创建结果。

运行时在创建 Task 时自动生成 `# <规范化名称>` 作为初始 `TASK.md` 正文，并且不接受任何 create 请求中的正文输入。调用方在创建完成后用普通文件操作写入 `TASK.md`。

子 Task 分支：

| 字段 | 合同 |
| --- | --- |
| `type` | `subtasks` |
| `parent_ref` | 精确、非 closed 父 Task |
| `subtasks` | 1 到 50 项，每项携带 `name`、可选 `status`（默认 `open`）、可选 `created_at`、`depends_on`、`related_to` 和 `extra`；item 不接受正文字段 |
| `user_confirmed` | 当前对话是否明确授权创建 planning 子 Task，默认 `false` |
| `cwd` | 项目解析 |

创建 open 子 Task 不需要新的顶层授权。批次只要包含 planning 子 Task，就要求 `user_confirmed=true`。首次写入前完成全部校验。新子 Task 在配置的创建目录下使用 `NN--slug`。编号统计所有叶子目录使用生成式名称的已发现直接子 Task，取最大序号且不填补空洞，最大为 `99`。部分创建失败时返回已创建和未创建项。重试只把已发现直接子 Task 与 create 拥有的请求字段（`name`、`status`、显式提供的 `created_at`、`depends_on`、`related_to`、`extra`）匹配；正文不参与匹配。

## 更新

update 修改关系、`extra` 和至多一个生命周期动作：

| 字段组 | 合同 |
| --- | --- |
| 目标 | `task_ref`、`cwd` |
| 关系 | `depends_on_add/remove`、`related_to_add/remove` |
| extra | `extra_set`、`extra_remove`，只处理顶层键 |
| 生命周期 | `start`、`close` 或 `reopen` 至多一个 |
| 生命周期参数 | close/reopen 需要非空 `reason` 和 `user_confirmed=true`；close 可用 `force` |
| WAL | 可选 `actor`，默认为调用通道的 actor |

空请求或净结果无变化返回 `changed:false`。元数据提交后自动追加 WAL，追加失败以警告返回。

## 日志

log 请求包含 `task_ref`、非空单行 `message`、可选 Markdown `body`、可选 `actor` 和 `cwd`。它只向非 closed Task 追加一条 WAL 事件，不修改元数据。

## 执行

exec 是低频管理入口：

| 字段 | 合同 |
| --- | --- |
| `argv` | 非空字符串数组，首项只能是 `--version`、`init`、`check` 或 `rename` |
| `cwd` | 命令上下文 |
| `actor` | 只在首项为 `rename` 时允许 |

exec 直接从 argv 调用公开命令解析器，不经过 shell。它拒绝 search、read、create、update、log、mcp、schema、metadata、gc、install、uninstall 和其他首项。

rename 结果包含原始旧名称、存在时的已解析父 Task 路径、旧路径、规范化后的新名称、目标路径，以及每个 Markdown 引用及其行号。完整 UUID、精确 Task 目录和精确受管载体可以定位旧字符串名称或可识别生成式后缀需要修复的候选；其他校验保持严格。非生成式子 Task 目录保持不变；生成式子 Task 和顶层路径保留序号并更新 slug。

exec 的 rename 与 CLI 采用相同的断链处理。执行会移动 Task 路径且存在旧路径引用时，在首次写入前以 conflict 错误停止。在 argv 中传入 `--ignore-brokenlinks` 可以继续移动；引用文件保持原样，结果中仍会报告它们。dry-run 在生成合法计划后始终成功。

## 传输

MCP initialize 后公开六个协议工具。stdout 只承载 JSON-RPC，日志写 stderr。取消映射到运行时取消信号。

Pi 和 OMP 使用生成的 native schema。适配器对每次调用启动公开 `tk` 进程，解码统一结果，并把传输故障与领域失败分开。
