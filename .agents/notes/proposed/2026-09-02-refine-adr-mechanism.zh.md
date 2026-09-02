# Agent Note: 完善 ADR 机制

Status: proposed
Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

[English](./2026-09-02-refine-adr-mechanism.md) | 中文

## 动机

现有 Agent Note 机制为长期决定提供了固定位置，但它的术语和生命周期已经不符合仓库现在的使用方式。

Agent 曾在新的决定应当经过提案和反转时，直接编辑 `implemented` 记录。Agent 还会为了填满必需章节而编造替代方案和风险，只在目录中有记录时保留生命周期目录，并生成比决定本身还难浏览的长文件名。

仓库还需要让提案先存在于 `main`，然后才能开始实现。一个提案可以产生多份决定，或反转多份历史决定。提案和决定是两类不同的文档，rejected 和 archived 分别描述这两类文档的终止状态。将四者都视为同一种 Note 的不同状态，反而掩盖了这个模型。

## 提议

### 术语和位置

使用 **ADR** 作为架构决策记录的主要术语。普通文本或工具约定需要时可以使用小写 `adr`，但它不是首选文档名称。

每个项目的 `AGENTS.md` 从 `docs/adr` 和 `.agents/adr` 中选择 ADR 根目录。本仓库选择 `.agents/adr`。实现本提案时，将现有记录和说明从 `.agents/notes` 迁移到该目录。

使用 `proposal` 和 `decision` 表示两类 ADR 文档。`proposal/` 保存活跃提案，`rejected/` 保存被拒绝的提案。`decision/` 保存当前决定，`archived/` 保存已归档的决定。目录同时表达文档类型和当前状态，因此 ADR 文件头不再包含 `Status` 字段。

使用 `proposal` 和 `decision` 作为英文文档类型名。使用 `Create decision`、`Update decision` 和 `Reverse decision` 作为英文动作短语。`Reverse decision` 是动词短语，不能替换成名词短语。中文对应使用 `提案`、`决定`、`创建决定`、`更新决定` 和 `反转决定`。新决定使用 `Reverses` 链接归档决定，归档决定使用 `Reversed by` 链回新决定。

在 ADR 根目录维护 `glossary.md` 和 `glossary.zh.md`，作为语义一致的双语文件对。两份文件相互链接，中英文 ADR 指南分别链接对应语言的术语表。

第一版术语表只包含以下已经确认的概念：

- ADR；
- `proposal` / `提案`；
- `decision` / `决定`；
- `Update decision` / `更新决定`；
- `Reverse decision` / `反转决定`。

每个条目只包含一个术语和一段符合本机制的简明定义。不要加入别名、相关词列表、用法示例、目录状态、章节名、元数据字段、关系链接标签、普通动作表述、可能使用的近义词或尚未明确确认的术语。`Create decision`、`Reverses` 和 `Reversed by` 仍是操作说明或链接标签，不是术语表条目。未来只有在维护者明确确定含义后，才向术语表增加新词。

### 需求接入与提案范围

接到新需求后，先检索已有 ADR，再规划实现。判断新需求是增加无关能力、扩展当前决定，还是与当前决定冲突。

新增能力可以先创建提案。除非维护者明确要求其他拆分方式，一项需求只创建一个提案。一个提案可以创建多份决定文件，可以反转多份决定，也可以同时执行两种操作。

暂时不要将 ADR 维护制作成 Skill。机制仍然变化得太快，不适合固化为独立分发的能力。

### 提案合入

实现开始前，将提案作为一次独立变更合入 `main`。本仓库使用 squash 工作流，因此实现应当从包含该提案的新 `main` 创建另一个分支。

实现完成后，在实现变更中创建新决定、更新没有冲突的决定、反转冲突决定，并删除已经被消耗的提案。Git 历史保留独立合入过的提案。被拒绝的提案不产生决定，而是移动到 `rejected/`。

### 更新和反转决定

如果新增内容与当前决定没有冲突，将内容追加到 `## Changes` 或 `## 变更`。新增内容本身值得成为 ADR 时，可以在变更章节链接到新的决定。

不得通过重写当前决定来表达冲突的新选择。先创建提案，并明确列出需要反转的决定。实现完成后，将每份冲突决定中仍然生效的部分与提案的新内容整合成一份完整的新决定。添加新决定、归档被替换的决定，并在同一变更中更新链接。

实现本提案时，需要反转当前的 Agent Note 机制决定。需要创建、更新和反转的决定如下。

### 提案与决定格式

中英文 ADR 指南分别定义提案和决定模板，不再让一套模板根据 `Status` 改变结构。
提案格式先说明 `proposal/` 中的活跃提案，再说明 `rejected/` 中的被拒绝提案。决定格式先说明 `decision/` 中的当前决定，再说明 `archived/` 中的归档决定。

英文提案使用 `# ADR proposal: <title>`，中文提案使用 `# ADR 提案：<标题>`。文件保留 `Decision owner`、`Draft writer` 和语言链接，然后依次包含 `Motivation`、`Proposal`、`Alternatives considered`、`Acceptance criteria` 和 `Risks`。被拒绝的提案保留该格式，增加 `Rejection reason` 后冻结。

英文决定使用 `# ADR decision: <title>`，中文决定使用 `# ADR 决定：<标题>`。文件保留相同的负责人和语言元数据，然后依次包含 `Motivation`、`Decision`、`Alternatives considered` 和 `Consequences`。后续没有冲突的新增内容写入 `Changes`。归档决定保留决定格式，并成为冻结历史。

两种模板都不包含 `Status`。所在目录用于识别提案是活跃还是被拒绝，也用于识别决定是当前决定还是归档决定。

### 编写规则

每个 ADR 文件名不得超过 60 个字符。日期、语言后缀和扩展名都计入长度。

`## Alternatives considered` 和 `## 考虑过的替代方案` 只能记录 ADR 编写前真实存在，或在会话中实际考虑过的方案。没有替代方案时写 `None` 或 `无`。

`## Risks` 和 `## 风险` 只能记录提案或决定中的选择可能造成的不良结果，或遗漏某项内容可能造成的不良结果。事实、要求和不变量不是风险。没有风险时写 `None` 或 `无`。

使用 `.gitkeep` 将 `proposal/`、`decision/`、`rejected/` 和 `archived/` 保持在 Git 中，即使目录内没有 ADR 文件。

### 所需决策变更

本提案定义一项原子的仓库流程变更，最终由一份新决定表示。在本提案仍位于 `.agents/notes/proposed/` 期间，`.agents/notes/implemented/` 中的所有当前决定继续具有权威性。

反转决定：[添加 Agent Note 机制](../implemented/2026-08-22-add-agent-notes.zh.md)

创建决定：`.agents/adr/decision/2026-09-02-establish-adr-mechanism.zh.md`

更新决定：[使用动机作为起始章节](../implemented/2026-08-22-use-motivation-heading-in-agent-notes.zh.md)

更新决定：[维护中英文公开文档](../implemented/2026-08-20-maintain-bilingual-public-documentation.zh.md)

更新决定：[使用短期分支并 squash 合入 main](../implemented/2026-08-20-use-trunk-based-squash-workflow.zh.md)

更新决定：[维护 tk 文档](../implemented/2026-08-29-maintain-tk-documentation.zh.md)

“反转决定”下的决定所选择的主要术语、根目录、单一文档状态模型和提案到决定的生命周期都与本提案冲突。“更新决定”下的决定继续有效，不能只因为路径和术语需要迁移就将它们列入“反转决定”。

目标仓库状态包含以下 ADR 变更：

1. 将“反转决定”下的文件对移动到 `.agents/adr/archived/2026-08-22-add-agent-notes.md` 及其中文文件；
2. 添加“创建决定”下的文件对，作为完整的当前 ADR 机制决定；
3. 在新决定中使用 `Reverses` 链接归档决定，在归档决定中使用 `Reversed by` 链回新决定，然后冻结归档文件对；
4. 在新决定中保留旧决定仍然有效的双语、负责人、`Motivation`、固定章节、生命周期权限和可检索历史规则，再加入本提案定义的术语、目录、文档类型、提案合入、`Create decision`、`Update decision`、`Reverse decision`、文件名、术语表、替代方案、风险和 `.gitkeep` 规则；
5. 在“更新决定”下的决定中添加带日期的 `Changes`：保持两种模板都以 `Motivation` 开头，将双语文档指向 ADR 文件对格式，在 trunk 工作流中记录提案与实现分开合入，并在 tk 文档维护决定中替换旧状态模型；
6. 将其他所有当前决定文件对从 `.agents/notes/implemented/` 迁移到 `.agents/adr/decision/`，将文件头转换成不含 `Status` 的决定格式，并修复当前术语、路径和链接，不改变决定含义，也不将它们列入“反转决定”；
7. 新增 `.agents/adr/glossary.md` 和 `.agents/adr/glossary.zh.md`，只记录上文五个已确认概念，保留双向语言链接，并由对应语言的 ADR 指南链接；
8. 删除本提案文件对，并在 `proposal/`、`decision/`、`rejected/` 和 `archived/` 中保留 `.gitkeep`。

## 考虑过的替代方案

**保留 Agent Note 作为主要术语，只完善编写规则。** 这样可以保留现有路径和大部分文本，但会继续使用维护者已经决定替换的术语，也会继续把提案和决定建模为同一种文档的四种状态。

**沿用此前将 ADR 维护制作成 Skill 的提案。** 该提案处理的机制在实际使用中仍然持续变化。沿用它会把不稳定规则固化为可分发组件，因此本提案继续使用仓库说明和文档维护该机制。

## 验收标准

- 实现开始前，本提案作为独立变更合入 `main`。
- 根目录 `AGENTS.md` 选择 `.agents/adr`，要求接到需求后先检索 ADR，并禁止直接以冲突内容改写决定。
- ADR 根目录包含 `proposal/`、`decision/`、`rejected/` 和 `archived/`，每个目录分别表达一种文档类型和状态。
- 中英文 ADR 指南分别定义不含 `Status` 字段的提案和决定格式，并用语义一致的内容规定提案合入、`Create decision`、`Update decision`、`Reverse decision`、文件名、术语表维护、替代方案、风险和 `.gitkeep`。
- ADR 根目录包含语义一致的 `glossary.md` 和 `glossary.zh.md` 文件对，只记录 ADR、提案、决定、更新决定和反转决定，不包含尚未确认的术语。
- 目标状态只归档 Agent Note 机制决定文件对，并只在 `decision/` 下新增一份完整的 ADR 机制决定文件对。
- 归档的机制决定包含 `Reversed by`，新的机制决定包含 `Reverses`。新决定完整保留旧决定仍然有效的规则，并包含本提案获得接受的全部规则。
- “更新决定”下的决定继续有效，并获得上文列出的带日期更新。
- 其他当前决定保持原有含义，只迁移文件外壳、位置、术语、路径和链接。
- 目标状态删除本提案文件对，并使用 `.gitkeep` 保持全部四个 ADR 目录。
- 迁移完成后，仓库验证通过。

## 风险

迁移目录和术语会修改现有记录及其入站链接。遗漏引用会造成导航失效，或让仓库看起来存在两套当前 ADR 规则。

反转时可能遗漏历史决定中仍然生效的规则。归档旧决定前，必须按一份完整的当前合同审查新决定。

术语表过大会让普通用词看起来像固定合同，还会制造没有必要的近义词争议。评审必须拒绝维护者尚未明确确认的条目。
