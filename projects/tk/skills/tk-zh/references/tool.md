# 工具

需要精确工具名、请求字段、结果、取消、路由或 tools-mode 组件命令时读本篇。

## 逻辑工具

| 操作 | Pi 或 OMP 名称 | 主要输入 |
| --- | --- | --- |
| `search` | `tk_search` | `query`、`regex`、`search_body`、`status`、`extra`、`limit`、`cwd` |
| `read` | `tk_read` | `task_ref`、`view`、WAL 预算、`cwd` |
| `create` | `tk_create` | 顶层任务或 1..50 个子任务的 tagged union |
| `update` | `tk_update` | 关系增量、`extra`、至多一个生命周期动作 |
| `log` | `tk_log` | `task_ref`、单行 `message`、可选 `body` 和 `actor` |
| `exec` | `tk_exec` | `argv`、`cwd`，`rename` 时可有 `actor` |

MCP 使用相同逻辑名称并由服务命名空间区分。Harness 不能增加字段、改变默认值或复制领域校验。

`cwd` 选择顺序是请求显式值、Harness 会话目录、运行时进程目录。相对 `cwd` 基于运行时目录解析。`harness` 只用于诊断，不持久化。

## 高频请求

`search` 要求非空 `query`。`regex` 和 `search_body` 默认 `false`；`status` 默认全部；`extra` 顶层使用 `AND`；`limit` 默认 20，范围 `1..100`。

`read` 默认 `summary`。`minimal` 返回元数据和受管路径，不读取正文或 WAL。`summary` 返回完整 Task 正文和不含正文的最近 WAL 条目，默认最多 5 条、4000 字节。`detailed` 增加 WAL 正文，默认最多 50 条、16000 字节。显式预算可以在 0 到两种视图共用的上限 50 条、16000 字节之间取值。预算之外的条目会被静默省略。

`create` 使用 `type=task` 或 `type=subtasks`。工具入口的 `user_confirmed` 默认 `false`，必须反映当前授权。`update` 的 `close`、`reopen` 需要非空 `reason` 和当前确认，`force` 只用于 `close`。空更新或净结果无变化返回 `changed=false`。

`log` 只向非 `closed` 任务追加一条 WAL，不改元数据。

## 任务名称

用户没有明确要求时，选择能清楚表达用途的任务名称。建议使用短祈使句、短语或名词，禁止使用并列关系词，例如“和”“且”“与”“并”或 `and`。

## 受限入口

`exec` 不经过 shell，`argv` 首项只允许：

```text
--version
init
check
rename
```

它拒绝 `search`、`read`、`create`、`update`、`log`、`mcp`、`schema`、`metadata`、`gc`、`install`、`uninstall` 和其他首项。`actor` 只允许用于 `rename`。

有逻辑工具的高频操作必须走逻辑工具。迁移、表示切换、GC、`schema generate`、组件生命周期、`help` 和 MCP 启动使用公开 CLI。

逻辑工具缺失、拒绝或失败时不能改走 CLI 重试同一操作。不要修改 Harness 注册、适配器状态、组件清单或受管数据绕过。

## 结果

成功：

```json
{"ok":true,"data":{}}
```

预期失败：

```json
{"ok":false,"error":{"code":"...","category":"...","message":"...","details":{}}}
```

稳定字段是 `ok`、`data`、`warnings`、`error`、`code`、`category`、`message` 和 `details`。修改结果按需包含 `changed`、`committed`、`created`、`completed` 和 `uncompleted`。`message` 面向人类，机器读取 `code` 和 `details`。

`ok:true` 可以带 `warnings`。`wal_append_failed` 表示元数据可能已经提交。`panic`、进程被杀死、非法 `stdout` 或协议损坏属于传输失败，运行时不伪造领域结果。

## 取消

首次持久写入前取消不改变状态。单文件原子替换开始后完成当前替换；多目标操作在提交点之间响应取消。

提交后取消使用部分提交结果，列出 `completed` 和 `uncompleted`，不自动回滚。

## 组件

组件依赖固定运行时 `$HOME/.local/bin/tk`。安装只使用可执行文件内嵌载荷，不联网，也不接受本地归档。

```text
tk install --harness <codex|claude|pi|omp>
  [--mode <tools|cli>] [--language <en|zh>]
  [--dry-run] [--output <text|json>]

tk install --mode cli --skill-root <directory>
  [--language <en|zh>] [--dry-run] [--output <text|json>]

tk uninstall --harness <codex|claude|pi|omp>
  [--dry-run] [--output <text|json>]

tk uninstall --skill-root <directory>
  [--dry-run] [--output <text|json>]
```

必须且只能提供一个目标选项。Harness install 默认 `tools` 和 `en`。自定义根目录 install 必须显式使用 CLI 模式，并只管理所提供根目录下的 `tk-cli` 与 `tk-cli-zh`。uninstall 不接受模式或语言选择。陌生环境先 `dry-run`；部分提交后按 `completed` 和 `uncompleted` 检查当前状态。
