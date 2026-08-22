# Agent Notes

[English](./README.md) | 中文

**Agent Note** 是本仓库对架构决策记录的唯一正式称呼。仓库路径、标题、说明和交叉引用统一使用 `Agent Note`。只有在向熟悉通用概念的读者解释时，才使用 `ADR` 一词。

Agent Note 保存一项长期决定为何存在、哪些替代方案落选，以及如何判断决定成功或失败。它不是进度日志、尚未选定方向的实施计划、发布记录或日常变更总结。

## 什么时候需要 Agent Note

一项决定存在真实替代方案，并改变以下长期边界之一时，创建或更新 Agent Note：

- 架构或包的职责归属；
- 公开合同、宿主合同、存储合同或分发合同；
- 持久化格式或兼容规则；
- 仓库级开发、验证或发布流程。

局部缺陷修复、机械重构、普通文档更新、状态报告和临时计划不需要 Agent Note，除非它们同时改变上述边界。

创建前先搜索活跃 Note。已有 Note 拥有该决定时，更新原 Note。新决定反转或取代旧决定时，创建新 Note 并让双方互链，不能直接改写历史。

## 位置与生命周期

路径编码生命周期状态：

```text
.agents/notes/proposed/yyyy-mm-dd-topic-title.md
.agents/notes/implemented/yyyy-mm-dd-topic-title.md
.agents/notes/rejected/yyyy-mm-dd-topic-title.md
.agents/notes/archived/yyyy-mm-dd-topic-title.md
```

- `proposed` 记录维护者尚未接受的决定。
- `implemented` 记录仓库已经采用、实现并仍视为当前事实的决定。
- `rejected` 仅在理由仍能防止潜在错误时保留被拒绝的提议。
- `archived` 保存已经不再是当前事实，或不再值得活跃维护的已实施决定。

文件名日期是主题首次提出的日期，生命周期迁移时不改变。文件名 slug 使用简短英文。在活跃目录变得难以检索之前，不增加分类子目录或中央索引。

维护者拥有生命周期决策权。Agent 可以在已授权的变更中起草 `proposed` Note。移动到 `implemented`、`rejected` 或 `archived` 必须取得维护者的明确同意。

## 双语文件

每项 Agent Note 由同目录文件对组成：

```text
yyyy-mm-dd-topic-title.md
yyyy-mm-dd-topic-title.zh.md
```

无后缀文件使用英文，是公开链接的默认目标。`.zh.md` 是中文审计副本。中英文版本在语义上具有同等权威；任何一侧都不能省略另一侧已有的理由、替代方案、验收标准、风险或结果。

作者可以从任一语言开始，但两份文件必须在同一变更中补齐并完成审查。外部贡献者可以先提供英文，合入前仍需补齐中文。出现语义冲突时暂停变更，由维护者确认后再同步修正。

在元数据块正下方放置相互指向的语言切换链接。状态值、路径、命令、API 名称和代码标识符保留原始英文。

## 固定格式

每份 Note 根据文档语言使用对应的元数据块。

新 Note 的正文以 `## Motivation`（中文 `## 动机`）开始。它记录为什么考虑这项决定，内容可以说明已经观察到的问题、需求、希望获得的能力或其他具体变更理由。名称变得中性，不代表可以含糊地说明理由。

英文文件：

```markdown
# Agent Note: <title>

Status: <proposed|implemented|rejected|archived>
Decision owner: <name>
Draft writer: <writer>

English | [中文](./<filename>.zh.md)
```

中文文件：

```markdown
# Agent Note: <标题>

Status: <proposed|implemented|rejected|archived>
Decision owner: <name>
Draft writer: <writer>

[English](./<文件名>.md) | 中文
```

`Decision owner` 记录对该决定负责的维护者。`Draft writer` 记录最初起草者，后续编辑者维护 Note 时不改变该字段。起草者通常是某个具体 Agent；已知具体 Agent 标识时使用该标识，而非笼统的 `Agent`。

中文文件翻译标题和语言链接文字，但 `# Agent Note:`、`Status:`、状态值、`Decision owner`、`Draft writer` 及两个字段的值保持不变。

### Proposed

英文正文：

```markdown
## Motivation
## Proposal
## Alternatives considered
## Acceptance criteria
## Risks
```

中文正文：

```markdown
## 动机
## 提议
## 考虑过的替代方案
## 验收标准
## 风险
```

### Implemented

英文正文：

```markdown
## Motivation
## Decision
## Alternatives considered
## Consequences
```

中文正文：

```markdown
## 动机
## 决定
## 考虑过的替代方案
## 结果
```

implemented 决定后续发生实质调整时，在英文文件的 `## Consequences` 或中文文件的 `## 结果` 之后，将 `## Changes` 或 `## 变更` 作为最后一个章节。每项调整使用带日期的三级标题记录：

英文变更：

```markdown
## Changes

### YYYY-MM-DD: <summary>
```

中文变更：

```markdown
## 变更

### YYYY-MM-DD：<摘要>
```

### Rejected

保留 proposed 结构。

英文文件增加：

```markdown
## Rejection reason
```

中文文件增加：

```markdown
## 拒绝原因
```

结论形成并修复事实链接后，冻结 rejected Note。

### Archived

只有 implemented Note 可以归档。将状态改为 `archived`，在 owner 行下增加 `Archived: YYYY-MM-DD`，然后冻结两份文件。活跃文档不能把 archived Note 引用为当前权威。

## 额外标题

必需章节内容较多时，使用描述性的三级标题整理。例如，较长的 `## 提议` 可以包含 `### 位置`、`### 生命周期` 和 `### 格式`。

三级标题仍属于对应的上级章节。不能在 `## 动机` 前插入标题，不能替换必需的二级标题，也不能用子章节记录进度历史或复制实现清单。

## 维护规则

事实路径、名称或验证入口变化时，同步更新拥有该决定的 implemented Note。不能借事实维护反转决定。决定发生反转时创建新 Note，明确取代旧 Note，并让旧 Note 链回新 Note。

每次生命周期迁移都要同时移动两种语言，并在同一变更中修复入站链接。只有在 rejected Note 的理由不再能防止潜在错误时，才删除它，并同时删除两种语言。

第一版依靠审查和 Git 历史，不增加专用 Skill、分类体系、hash sidecar、归档 manifest 或自定义检查器。重复出现维护动作或发生真实漂移后，再增加能约束该问题的最小机械检查。
