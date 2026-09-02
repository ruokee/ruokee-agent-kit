# 创建 Task 和子 Task

## 选择状态和授权

严格项目要求在创建顶层 Task 前，获得用户当前的明确确认。

宽松项目允许为值得保留的工作创建 Task，而不将创建视为执行承诺：

- 仅当用户明确希望保留仍在形成中的想法、调查或计划时，使用 `planning`；
- 正在处理的工作使用 `open`。

在同一回复中报告所创建 Task 的名称、状态和路径。`user_confirmed` 必须反映当前对话中的实际情况，不得设置为你希望得到的结果。

## 名称和正文

使用简短名称描述整个工作。日期、文件名、Harness 名称、实现细节和验收步骤应放在 `TASK.md` 或普通材料中。

如果省略正文，运行时会创建一个标题。仅当历史工作的原始时间戳已知且包含时区信息时，才提供 `created_at`。

关系使用同一 Task 根目录中的 UUID。`extra` 必须能够在 JSON 和 TOML 中无损表示。

## 子 Task

只能在状态非 `closed` 的父 Task 下创建子 Task。不得隐式重新打开父 Task。

一个批次可在同一父 Task 下包含 1 到 50 个相互独立的实际工作单元。首次写入前，必须验证名称、状态、关系、路径和冲突。运行时按输入顺序提交。

如果在创建部分子 Task 后发生错误或取消，请检查 `completed` 和 `uncompleted`。运行时不会回滚，也不会提供续跑令牌。再次发出完全相同的请求时，可能会跳过已经存在且内容匹配的子 Task。

## CLI 形式

```sh
tk create task <name> [--status planning|open]
tk create subtask <parent_ref> --item '<json>' [--item '<json>']... [--user-confirmed true|false]
```

直接通过 CLI 创建时，`--user-confirmed` 默认为 true，因为运行该命令本身就是用户的明确操作。MCP 和 native 调用方必须传入实际的授权状态。
