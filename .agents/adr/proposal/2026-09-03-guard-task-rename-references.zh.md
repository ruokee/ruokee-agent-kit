# ADR 提案：防止 Task rename 留下断链引用

Decision owner: Ruokee
Draft writer: Mind (OMP GPT-5.6 Sol)

[English](./2026-09-03-guard-task-rename-references.md) | 中文

## 动机

顶层 Task 或生成式子 Task 的规范化 slug 发生变化时，rename 会改变目录路径。非生成式子 Task 只修改元数据，目录保持不变。对于会移动路径的 rename，移动一旦提交，已有 Markdown 引用就可能断开。因此，tk 应在修改文件系统之前提供规范化后的目标路径和所有已知旧路径引用。Agent 可以在 rename plan 仍保留源路径时修复这些引用。

[tk Task 数据模型](../decision/2026-09-03-define-tk-task-data-model.zh.md)已经要求 rename 扫描并报告 Markdown 引用，但不自动改写文件。运行时会在 dry-run 和实际执行时扫描，CLI 的文本输出却没有显示引用列表，存在引用时也会继续执行。路径移动完成后，Task 当前状态只包含新路径；根据该状态再次扫描时，无法准确恢复 rename 前的旧路径引用列表。

## 提议

### 引用计划与输出

保留当前扫描边界：

- `git_policy=track` 扫描项目中每个由 Git 跟踪的 `*.md` 路径；
- `git_policy=ignore` 和 `none` 递归扫描 `task_root` 下的常规 Markdown，并跳过 `wal`、`.tk-tmp` 和 symlink；
- split Task 正文参与扫描；
- 已发现 embed Task 的正文参与扫描，但其受管 frontmatter 不参与。

扫描继续查找旧 Task 的项目相对路径在文件中的出现位置。tk 不解析或改写 Markdown 链接。

dry-run 和实际执行保留现有结构化计划字段，包括 `old_path` 和可选的 `parent_task`，并返回规范化后的 `new_name`、绝对 `target_path`，以及每处引用的文件路径和行号。文本输出打印目标路径和引用列表，JSON 继续返回结构化 rename plan。没有引用时不打印空的引用区块。

### 默认防止断链

会移动 Task 路径的非 dry-run rename 在写入任何持久状态前发现引用时停止操作。新增 `--ignore-brokenlinks`，允许在不修改引用的情况下继续移动路径。该参数不会关闭扫描或隐藏输出，对 dry-run 以及 `target_path` 与 `old_path` 相同的 rename 都没有影响。

门禁阻止 rename 时，返回稳定的结构化错误，类别为 conflict，退出码为 3。错误详情至少包含 `old_path`、规范化后的 `new_name`、`target_path`，以及引用文件路径和行号列表。文本错误也显示同一目标路径和引用，并明确提示可使用 `--ignore-brokenlinks` 覆盖门禁。

dry-run 在生成合法计划后始终成功，包括发现引用的情况。`target_path` 与 `old_path` 相同的 rename 也不应用防断链门禁，包括只修改非生成式子 Task 元数据的 rename 和无变化请求。

### 执行一致性

保留现有的提交前计划重建。如果提交前 Task 状态、目标路径或引用列表发生变化，返回现有的计划过期冲突，并且不写入文件。断链检查应位于共享 Rust rename 操作中，使直接 CLI 和 `tk_exec rename` 使用同一规则。

实现时提升 CLI contract 版本。Task schema 和 component format 版本保持不变。

## 考虑过的替代方案

**报告引用但默认继续。** 只增加文本输出可以让当前扫描结果可见，但会移动路径的实际执行仍可能留下断链，除非每个调用方自行发现并中止操作。

**自动改写引用。** 当前数据模型决定已经拒绝该方案，因为匹配文本可能属于无关内容、历史记录或有意保留的文字。rename 不应取得普通 Markdown 文件的修改权。

**对 dry-run 应用防断链门禁。** 预览命令没有写入，却仍需要覆盖参数。让 dry-run 成功返回，可以在调用方决定是否继续之前给出规范化目标和完整修复列表。

## 验收标准

1. dry-run 打印并返回规范化名称、绝对目标路径，以及全部引用文件路径和行号，且不修改文件。结构化结果保留旧路径；如果能解析出父级，也一并返回。
2. 不移动 Task 路径，或移动路径但没有引用时，实际执行仍按现有的 rename、元数据和 WAL 行为完成。
3. 会移动路径的实际执行存在引用且未传 `--ignore-brokenlinks` 时，在首次持久写入前阻止路径变更，并返回 conflict 错误和退出码 3。
4. 被门禁阻止时，文本和 JSON 详情都包含目标路径及全部引用。
5. 会移动路径的实际执行传入 `--ignore-brokenlinks` 时完成 rename，不修改引用文件，并继续报告引用列表。
6. `git_policy=track`、`ignore`、`none` 以及 split、embed 正文保持当前扫描边界。
7. 会移动路径的 rename 不解析 Markdown 结构、不改写文件、不创建别名，也不在旧位置保留兼容路径。
8. 顶层 Task 或生成式子 Task 的输入名称包含空白、分隔符或会被丢弃的标点时，输出使用规范化名称计算出的目标路径。
9. 非生成式子 Task rename 保持目录不变，也不会因该路径的引用受到门禁阻止。对已经完成的同名 rename 再次执行时，按同一规则返回无变化。
10. CLI、`tk_exec`、公开设计文档、测试，以及 `tk`、`tk-zh`、`tk-cli`、`tk-cli-zh` 这四个 Skill，都使用同一门禁规则和参数拼写。
11. 实现提升 CLI contract 版本，不修改 Task schema 和 component format 版本。

## 风险

扫描器匹配路径文本，不判断 Markdown 语法。代码示例、历史记录或其他有意保留的文本也可能阻止会移动路径的 rename，即使它不是可跳转链接。调用方可以使用 `--ignore-brokenlinks` 明确覆盖，同时保留扫描证据。

引用列表较大时，文本和结构化输出都会增长。现有进程与协议输出上限继续生效，因此匹配数量足够多的项目可能返回现有的输出超限错误，而不是截断 rename plan。
