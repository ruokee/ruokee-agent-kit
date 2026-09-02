---
name: tk
description: 当用户提及 tk 或已有 Task，提供 Task ID、路径、分支或材料路径，请求 catchup 或 Task 操作，或 permissive 项目中的工作明显需要跨步骤或跨会话持久状态时使用。
---

# tk

使用 tk 管理项目本地的持久 Task。Task 是值得持久保存的项目内临时性努力。创建 Task 不代表已经承诺执行或完成。

运行时负责 Task 身份、元数据、关系、生命周期、路径、Git 策略、持久化、迁移和清理规则。你负责判断是否适用 tk、如实报告授权、维护有用的 Task 材料，并且只在用户当前确认后关闭工作。

## 判断是否适用 tk

用户出现以下情况时使用 tk：

- 提及 `tk`、catchup、Task 操作或 Task 管理；
- 提供 Task ID、Task 名称、Task 路径、分支、`TASK.md`、`tk.toml` 或材料路径；
- 要求查找、创建、读取、继续、记录、更新、关闭、重开、重命名、迁移或检查 Task。

在 permissive 项目中，明显需要跨多个步骤或会话保存状态的工作也可以创建 Task。快速问答、临时清单、普通单次修改和随口想法不需要 Task。

加载本 Skill 不会把会话绑定到 Task。每次操作都要解析 Task。连续对话中可以保留已经解析的引用，但不能把会话绑定写入 Task 状态。

## 按需读取参考资料

只读取当前操作需要的参考：

- [Task 概念](./references/concepts.md)：Task 范围、身份、元数据和 `TASK.md`；
- [项目设置](./references/project-setup.md)：发现、`init`、配置、元数据模式和 Git 策略；
- [创建 Task 和子 Task](./references/create-and-subtasks.md)：授权、状态选择、命名和批量创建；
- [恢复 Task 上下文](./references/catchup.md)：只读重建上下文；
- [关系和生命周期](./references/relations-and-lifecycle.md)：关系修改、关闭、强制关闭和重开；
- [工作活动日志](./references/wal.md)：持久事件边界和 WAL 故障；
- [维护](./references/maintenance.md)：`check`、rename、迁移、表示切换和 GC；
- [工具和 CLI 使用](./references/tool-use.md)：请求上下文、结果、取消和 CLI 回退；
- [材料模式](./references/patterns.md)：可选的普通文件组织方式；
- [术语表](./GLOSSARY.md)：产品术语。

## 选择入口

优先使用 Harness 的 `tk_search`、`tk_read`、`tk_create`、`tk_update`、`tk_log` 和 `tk_exec` 工具。MCP Harness 可能显示带服务器前缀的名称。

`tk_exec` 只接受 `--version`、`init`、`check` 和 `rename`。`metadata migrate`、`metadata switch`、`gc`、组件生命周期命令以及其他没有逻辑工具的支持命令，应使用公开 CLI。

Harness 工具不可用时使用 `tk` CLI。不要调用隐藏命令，也不要手工编辑受管元数据、清理清单或 Harness 配置来绕过运行时拒绝。

目标项目有歧义时传入 `cwd`。完整绝对 Task 路径或材料路径可以定位自己的项目。actor 只适用于 update、log 和 exec rename。CLI 的 `--actor` 只适用于 update、log 和 rename。Harness 能提供具体模型或 Harness 信息时省略 actor。

## 解析 Task

精确操作接受完整 UUIDv7、绝对 Task 目录、绝对规范 `tk.toml` 或 `TASK.md`，以及项目相对 Task 路径。

名称、目录基名、UUID 前缀、文本、正则和材料路径属于 search 输入。先搜索，再使用返回的规范引用。多个候选仍然都可能符合时，列出相关候选并请用户选择。

search 默认包含 planning、open 和 closed，只有非空 status 过滤器才缩小范围。

## 创建 Task

strict 项目的顶层 Task 只有在用户当前明确要求或确认时才能创建。

permissive 项目允许为值得持久保存的工作创建 Task，不把创建视为执行承诺：

- 用户明确希望保存仍在形成的想法、调查或计划时使用 `planning`；
- 已经开始实际处理时使用 `open`；
- 在同一回复中报告新 Task 的名称、状态和路径。

工具调用中的 `user_confirmed` 必须如实反映当前对话。schema 接受该字段不代表已经获得授权。

只为 open 父 Task 下的真实工作单元创建子 Task。不能在 closed 父 Task 下创建，也不能隐式重开。一个批次包含同一父 Task 下 1 至 50 个相互独立的子 Task，不用于导入积压事项。只有原始带时区时间戳已知时才传入历史 `created_at`。

## Catchup

Catchup 是只读的上下文重建：

1. 完整 ID 或精确路径直接读取 summary。名称、前缀、文本、分支或材料路径先 search。
2. 从 `TASK.md` 提取目标、当前约束、仍有效的决定、阻塞和材料入口。
3. 只有 summary 和有界 WAL 不足时才读取 detailed。
4. 检查状态、closed 祖先、依赖和警告。
5. 报告现状、未决问题和下一项具体动作。
6. 只有用户同时要求继续时才继续工作。

不要递归枚举普通材料。按需跟随 `TASK.md` 或目录 README 中的链接。

## 维护 `TASK.md`

`TASK.md` 保持紧凑并只陈述当前事实，应包含：

- 目标；
- 范围和约束；
- 仍然适用的稳定决定；
- 重要材料链接；
- 仍然存在的阻塞。

命令流水、单次测试、聊天历史、完整研究、详细设计和容易变化的下一步写入普通材料。被替代的事实直接改成当前事实。embed 项目必须保留受管 frontmatter。

你可以编辑 `TASK.md` 正文和普通材料。受管元数据必须通过 tk 操作修改。

## 记录持久事件

事实一旦成为持久决定、纠正、已验证结论、可恢复里程碑、验证结果、已验证协作结果或阻塞，就立即调用 log，再开始另一条工作分支。

message 使用非空单行文本，细节写入 Markdown body。actor 只表示归因，不表示身份或授权。

不要记录例行读取、工具流水、临时计划、进度百分比、未核实猜测或运行时已经记录的生命周期事件。

元数据已经提交但自动追加 WAL 失败时，先读取 Task，再只补充缺失事件。closed Task 拒绝新的 WAL 条目。

## 更新、关闭和重开

修改关系、extra 或生命周期前先读取当前 Task。

关闭前确认工作确实已经结束，后代和依赖满足普通规则，`TASK.md` 已经写明当前结果，并且应保留的证据已经记录。然后说明准确的非空原因，取得用户当前明确确认。

强制关闭只绕过后代和依赖检查。只有用户明确要求绕过这两项检查时才能使用。

closed Task 默认只读。新工作通常创建相关 open Task。只有用户确认新工作仍属于原 Task 并提供非空原因时才重开。不能在 closed 祖先下重开。

## 处理错误和人工修复

读取稳定错误码、类别、详情以及已完成项和未完成项。多目标操作失败后，先 read 或 check 当前规范状态，再发起新的完整命令。不能假定运行时会自动回滚或提供续跑令牌。

日常修改必须使用 tk 公开操作。只有 `tk.toml` 已损坏且 tk 无法表达修复时，才可以人工修复：

1. 说明要修改的准确字段和最终内容；
2. 取得当前对话中的明确授权；
3. 只做已经说明的编辑；
4. 运行 `tk check`；
5. Task 恢复可读后记录 WAL。

## 组织普通材料

只有真实 Task 需要持久文件结构时，才读取[材料模式](./references/patterns.md)。这些模式只是建议，不属于运行时状态，项目规则优先。

临时记事区用于不作为最终交付的短期笔记。只有内容确实需要时，才使用研究材料包、设计修订、评审记录或验证证据。不要为一次性工作预建目录。
