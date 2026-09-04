# ADR 提案：分离 Task 创建与正文编写

Decision owner: Ruokee
Draft writer: Mind (OMP GPT-5.6 Sol)

[English](./2026-09-03-separate-task-body-authoring.md) | 中文

## 动机

[tk Task 数据模型](../decision/2026-09-03-define-tk-task-data-model.zh.md)把 `TASK.md` 定义为由用户和 Agent 维护的普通内容。Task 创建目前仍允许 CLI 和逻辑 create 工具传入正文，因此运行时可以在一次请求中同时创建受管状态和编写普通内容。

Agent 已经能从创建结果取得 `task_dir`，也具备文件写入工具。分开写入正文后，运行时只负责创建有效 Task，正文的结构和详细程度由 Agent 处理。每次工具调用也只有一个明确目标：创建出错时只需重试 create，正文写错时只需重新写入文件。Agent 不必在一条 shell 命令中同时重新组织 Task 创建参数和 Markdown 引号。

## 提议

### 创建合同

从 `tk create task` 删除 `--body`。从逻辑 create 请求中删除顶层 Task 和子 Task item 的 `body` 字段。继续传入已删除参数或字段的调用按无效请求处理。`tk log --body` 写入的是 WAL 记录，不属于 Task 正文，因此保持不变。

运行时始终根据规范化后的名称创建初始正文：

```markdown
# <normalized-name>
```

split 模式的 `TASK.md` 只包含该标题。embed 模式的 `TASK.md` 包含必需的受管 frontmatter，随后是同一标题。创建完成后，该标题属于普通正文；后续元数据变更（包括 rename）不会将其作为受管内容处理，也不会改写它。

### Agent 行为

创建结果继续返回绝对 `task_dir`。请求需要持久保存目标、约束、决定或材料链接时，Agent 在创建完成后通过单独的文件操作写入 `TASK.md`。tk 不增加正文更新命令、通过 stdin 传入正文的方式或其他创建期正文字段。

`tk`、`tk-zh`、`tk-cli` 和 `tk-cli-zh` 四项 Skill 都必须说明先创建 Task、再单独写文件的步骤。Pi 和 OMP 适配器停止把 create 正文映射为 CLI 参数。生成的 MCP 和原生 schema 必须拒绝已经删除的字段。

### 合同版本

本次为直接切换，不为 create 正文输入保留别名、兼容字段，也不提供弃用过渡路径。实现时提升 CLI contract 版本。持久元数据和组件归档格式都没有变化，因此 Task schema 与 component format 版本保持不变。

## 考虑过的替代方案

**只删除 CLI 参数。** 逻辑工具和子 Task item 仍可接受正文。这样会使 CLI 与工具调用采用不同的创建行为，也会继续把普通内容放在运行时请求合同中。

**创建完全没有标题的正文。** split 模式的 `TASK.md` 将是零字节文件，embed 模式只含 frontmatter。保留现有的自动标题可以直接辨认刚创建的 Task，也不需要新增配置或输入。

## 验收标准

1. `tk create task --help` 不再列出 `--body`，显式传入时返回 request 错误和退出码 2。
2. 顶层逻辑 create 请求和子 Task item 都不再包含 `body` 字段，生成的 schema 将其作为未知字段拒绝。
3. split 模式创建 `tk.toml`，并创建只含规范化名称标题的 `TASK.md`。
4. embed 模式创建合法受管 frontmatter，正文部分只含规范化名称标题。
5. Pi 和 OMP 适配器不再映射 create 正文，合同与参数映射测试覆盖字段删除。
6. `tk`、`tk-zh`、`tk-cli` 和 `tk-cli-zh` 四项 Skill 都要求 Agent 先创建 Task，再在需要正文时单独写入 `TASK.md`。
7. `tk log --body`、Task 正文读取、元数据修改时的正文保留和表示切换保持当前行为。
8. 实现提升 CLI contract 版本，不修改 Task schema 和 component format 版本。
9. 中英文 CLI reference 和 tool API 文档删除 create 正文输入，并说明运行时始终生成规范化名称标题。

## 风险

使用旧合同的调用方升级后继续发送 create 正文数据时会失败。合同版本检查和重新生成的 Harness 组件必须在暴露不兼容工具前拒绝版本不匹配。
