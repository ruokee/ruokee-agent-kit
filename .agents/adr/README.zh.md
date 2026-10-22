# 架构决策记录

[English](./README.md) | 中文 | [词典](../../docs/dictionary/adr.zh.md)

创建、修复、更新、反转、拒绝、归档、审查 ADR，或在项目工作中改变持久选择前，先加载 [maintain-adr](../skills/maintain-adr/SKILL.md)。Skill 持有主要结构、生命周期、编写规则和维护操作，本页保存仓库补充与导航。

## 项目补充

以 `.agents/adr/` 为 ADR 根目录，使用 Skill 的 `proposal`、`decision`、`rejected`、`archived` 布局。本 README 文件对留在根目录。四个生命周期目录始终使用 `.gitkeep` 保存在 Git 中，即使已有记录。

共享术语见[词典 ADR 页](../../docs/dictionary/adr.zh.md)。命名和链接遵循[文档规则](../rule/documentation.zh.md)，检查遵循[开发规则](../rule/development.zh.md)。长期目标位于 [.agents/spec/](../spec/README.zh.md)，变化影响目标时加载 [maintain-spec](../skills/maintain-spec/SKILL.md)。

## 语言

每项 ADR 是同目录的英文和中文文件对，分别为 `DD-name.md` 和 `DD-name.zh.md`。归档使用 `DD-rN-name.md` 和 `DD-rN-name.zh.md`，身份日期与修订号一致。

无后缀英文文件是默认公开链接，中文文件是审计对应版本。两者语义同等权威，并一起移动。可以先起草任一语言，但两份文件必须在同一变更中补齐。语义冲突阻止合并，直到维护者解决。完整元数据块后紧接双向语言链接，负责人和起草者字段一致，标识符保留仓库原拼写。

主题标题翻译为中文。`Draft owner`、`Draft writer`、`Decision owner`、`Decision writer` 等元数据键保持仓库原拼写。

Skill 章节的中文对应名称如下：

- `Motivation`：`动机`。
- `Analysis`：`分析`。
- `Proposal`：`提议`。
- `Decision`：`决定`。
- `Alternatives considered`：`考虑过的替代方案`。
- `Acceptance criteria`：`验收标准`。
- `Risks`：`风险`。
- `Consequences`：`结果`。
- `Changes`：`变更`。
- `Rejection reason`：`拒绝原因`。

替代方案或风险章节为空时，英文只写 `None`，中文只写 `无`。

## 权限

维护者负责批准、拒绝和决定归档。Agent 可以在授权工作中起草和实现，但这些生命周期决定需要明确授权。已有有效批准时直接复用，不重复要求。

确认新需求是否需要提案。不改变持久选择的小修改或快速处理不需要提案。除非维护者要求其他拆分方式，一项需求对应一份提案。

## 集成

提案和实现分别审查、提交。集成时通过独立的压缩合并，让获准提案先于实现进入 `main`。worktree、本地提交和独立合并权限遵循 [Git 规则](../rule/git.zh.md)。

继续开发获准时，实现单元可以从已验证提案候选，或包含所需依赖的已验证前置候选创建新分支，不必等待它们合并。冻结前置候选，保留各单元相对自身基线的可审查范围。这本身不批准提案，不授予归档或集成权限。

实现后，在同一实现变更中形成所需决定和完整后继、更新无冲突决定，并删除已消费提案。独立提交的提案及其后续主线提交保留理由。

## 相关 ADR

- [ADR 机制](./decision/2026/08/22-adr-mechanism.zh.md)
