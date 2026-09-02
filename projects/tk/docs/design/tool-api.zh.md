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
- 绝对 Task 目录；
- 绝对规范 `tk.toml`；
- 绝对规范 `TASK.md`；
- 当前项目中的相对 Task 路径。

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
| `storage` | `check_incomplete`、`wal_append_failed`、`partial_commit` |
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

结果先按匹配类别排序，同一类别按 `created_at` 降序、ID 升序排列。每项包括 Task 摘要、`match`、`closed_ancestors` 和规范 Task 引用。`match` 至少为 `uuid`、`path`、`regex` 或 `string`。

运行时只保留生成前 100 项所需的有界候选集。无效和相似普通文件直接忽略，不返回伪造 Task。

## 读取

请求：

| 字段 | 默认值 | 合同 |
| --- | --- | --- |
| `task_ref` | 必填 | 精确引用 |
| `view` | `summary` | `metadata`、`summary` 或 `detailed` |
| `wal_max_entries` | 20 | 0 到 1000；只用于 detailed |
| `wal_max_length` | 16384 | 0 到 1048576 字节；只用于 detailed |
| `cwd` | 公共默认 | 项目解析 |

metadata 返回元数据和规范路径。summary 增加正文摘要、关系摘要和最近 WAL 摘要。detailed 返回完整正文及受预算限制的 WAL。

## 创建

create 使用 `oneOf` 区分顶层 Task 和子 Task 批次。

顶层分支：

| 字段 | 默认值 | 合同 |
| --- | --- | --- |
| `type` | 必填 | `task` |
| `name` | 必填 | 可规范化名称 |
| `body` | 生成标题 | UTF-8 Markdown |
| `status` | `open` | `planning` 或 `open` |
| `created_at` | 当前时间 | 只在已知原始时间时显式提供 |
| `depends_on` | 空 | 同根 UUID 集合 |
| `related_to` | 空 | 同根 UUID 集合 |
| `extra` | 空 | 结构化附加值 |
| `user_confirmed` | `false` | 当前对话是否明确授权顶层创建 |
| `cwd` | 公共默认 | 项目解析 |

strict 项目要求 `user_confirmed=true`。permissive 项目允许值得持久保存的工作在 `false` 时创建，调用 Agent 负责根据语境选择 planning 或 open 并报告创建结果。

子 Task 分支：

| 字段 | 合同 |
| --- | --- |
| `type` | `subtasks` |
| `parent_ref` | 精确、非 closed 父 Task |
| `subtasks` | 1 到 50 项，每项使用顶层分支的 Task 内容字段 |
| `user_confirmed` | 当前对话是否明确授权创建 planning 子 Task，默认 `false` |
| `cwd` | 项目解析 |

创建 open 子 Task 不需要新的顶层授权。批次只要包含 planning 子 Task，就要求 `user_confirmed=true`。首次写入前完成全部校验。部分创建失败时返回已创建和未创建项。重试会跳过已经存在且内容匹配的子 Task。

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

## 传输

MCP initialize 后公开六个协议工具。stdout 只承载 JSON-RPC，日志写 stderr。取消映射到运行时取消信号。

Pi 和 OMP 使用生成的 native schema。适配器对每次调用启动公开 `tk` 进程，解码统一结果，并把传输故障与领域失败分开。
