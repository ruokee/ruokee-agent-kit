# ADR 提案：区分 `tk read` 返回限制与 WAL 完整检查

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

[English](./2026-09-05-separate-tk-read-wal-check.md) | 中文

## 动机

`tk read` 应返回足够的当前信息，帮助调用方理解一个 Task。现有视图对读取内容的划分与这个目标不一致。`summary` 将 Task 正文截断到 2000 个字符，并使用固定的 5 条、4096 字节 WAL 预算；它同时沿用 `detailed` 的 `WalEntry` 返回结构，因此仍包含 WAL 条目的 `body`。

`detailed` 允许最多返回 1000 个 WAL 条目，WAL 输出最多为 1048576 字节。共享 WAL 读取器还把实际扫描限制为 1024 个文件、1048576 输入字节和 1000 个解析条目。`tk check` 即使为两项预算传入 `usize::MAX`，也无法绕过这些限制。达到上限时会报告 `wal_truncated`，但不会继续检查剩余历史。当一个 Task 的 WAL 超过 1000 个条目时，`tk check` 只能校验其中一部分。

`tk read` 和 `tk check` 需要不同的资源规则。`tk read` 要限制每次返回的内容；`tk check` 要检查全部有效 WAL，无法完成时必须明确报告检查不完整。会按返回预算提前停止的读取器无法同时满足这两个合同。

## 提议

### 明确三种读取视图

保持 `summary` 为默认视图。支持的视图改为 `minimal`、`summary` 和 `detailed`。

`minimal` 返回 Task metadata 和受管路径，不读取 Task 正文或 WAL。

`summary` 返回 metadata、关系和完整的当前 Task 正文。最近的 WAL 条目包含 `timestamp`、`actor` 和 `message`，不包含 `body`。

`detailed` 在 `summary` 的 WAL 条目中增加 `body`，其他 Task 信息保持一致。

用 `minimal` 直接替换 `metadata`，不保留兼容别名。CLI 合同版本从 2 升到 3，使生成合同和 Harness 适配器拒绝不兼容的运行时。

### 限制单次 tk read 返回

为 `summary` 和 `detailed` 保留调用方可设置的 `wal_max_entries` 与 `wal_max_length`。两项参数的默认值同时也是上限，分别为 50 条和 16000 字节。取值范围分别是 0 到 50 和 0 到 16000。调用方可以调低任一限制，但不能调高。

读取器先按所选视图确定每个 WAL 条目的返回字段，再计算预算占用。每个完整条目按紧凑 JSON 的 UTF-8 字节数计入预算；`timestamp`、`actor` 和 `message` 始终计入，`body` 只在 `detailed` 中计入。读取器从最新条目开始，只选择同时满足两项限制的完整条目，最后按时间正序返回。未返回的历史继续通过现有截断状态表示。

本提案不为 `tk read` 增加分页、游标或完整历史模式。完整历史仍保存在普通的 `wal/YYYY-MM-DD.md` 文件中，需要时由 Agent 直接读取。

### 流式检查全部 WAL

为 `tk check` 提供独立的流式 WAL 检查器。它按确定顺序扫描每个普通的 `wal/YYYY-MM-DD.md` 文件，完整读取文件并校验其中所有条目。检查器不在内存中保存完整历史，也不对有效 WAL 设置固定的总文件数、总字节数或总条目数限制。

WAL 规模本身既不能产生 `wal_truncated`，也不能让部分扫描被当作成功。必要 I/O 失败时返回 `check_incomplete`，并指出失败路径。若因其他原因中断，也返回 `check_incomplete`。现有 WAL 格式诊断继续覆盖全部输入。

`tk read` 的有界读取路径可以在选出足够的新近条目后停止。它可以与完整检查器复用解析逻辑，但 `tk check` 不能通过这个有界接口检查 WAL。

### 同步公开合同与决定

在同一个实现变更中更新 CLI、生成的工具 schema、OMP 与 Pi 适配器、设计文档，以及英文和中文 Skill。WAL 指引必须区分 `tk read` 返回的新近 Task 上下文和从每日 WAL 文件读取的完整历史。

实现完成后，在[运行时与 CLI 决定](../decision/2026-08-28-define-tk-runtime-and-cli.zh.md)和 [Task 数据模型决定](../decision/2026-09-03-define-tk-task-data-model.zh.md)的中英文文件中更新 `Changes`，随后删除本提案。现有决定无需反转。

## 考虑过的替代方案

**提高共享 WAL 读取器的上限。** 更大的常量只能把问题延后。`tk check` 仍会受 `tk read` 返回限制影响，也仍会把本可逐条检查的历史全部读入内存。

**为 `tk read` 增加分页或完整历史模式。** 调用方可以借此通过命令遍历全部 WAL，但完整历史已经保存在普通的每日 Markdown 文件中。理解当前 Task 不需要再增加一套游标或分页合同。

## 验收标准

1. `tk read` 默认使用 `summary`，只接受 `minimal`、`summary` 或 `detailed`。
2. `minimal` 只返回 metadata 和受管路径，不读取 Task 正文或 WAL。
3. `summary` 返回完整的当前 Task 正文和不含 `body` 的最近 WAL 条目；`detailed` 返回相同的 Task 信息，并在存在时包含 WAL 条目的 `body`。
4. `summary` 和 `detailed` 接受 0 到 50 的 `wal_max_entries` 和 0 到 16000 的 `wal_max_length`，默认值分别是 50 和 16000。两种视图都先按各自的返回字段计算条目大小，再应用两项限制；只返回完整条目，从最新条目开始选择，最后按时间正序返回。
5. 截断状态报告因 `tk read` 限制而省略的历史。`tk read` 不提供分页、游标或完整历史模式，中英文指引要求需要完整历史的调用方读取每日 WAL 文件。
6. `tk check` 流式校验每个普通 WAL Markdown 文件和其中全部条目，不设置固定的总文件数、总字节数或总条目数限制。有效历史规模本身不会产生 `wal_truncated`。
7. 必要 I/O 失败时返回带失败路径的 `check_incomplete`。其他中断也返回 `check_incomplete`，不能返回成功的部分结果。
8. CLI 解析、JSON 输出、生成 schema、OMP 与 Pi 适配器、设计文档、Skill 和行为测试使用相同的视图名称、默认值、上限、WAL 返回字段和截断规则。CLI 合同版本为 3。
9. 行为测试证明 `summary` 省略 `body`，`detailed` 在两项限制内包含 `body`，超过任一最大值的输入会被拒绝，并且 `tk check` 扫描超过 1024 个文件、1048576 字节和 1000 个条目时不会截断。
10. 实现更新两项受影响双语决定的 `Changes`，删除本提案，并且不反转现有决定。

## 风险

完整 WAL 检查的耗时随存储历史增长，因此大型 Task 的 `tk check` 可能远慢于 `tk read`。流式处理可以避免同时保存所有有效条目，但无法省去读取成本。I/O 失败和扫描中断仍必须通过 `check_incomplete` 明确报告。

视图重命名和降低限制会使依赖 CLI 合同版本 2 的调用方不再兼容。将合同版本升到 3、重新生成全部 schema 和适配器，并在版本不匹配时拒绝加载，可以避免把旧调用方误判为兼容。
