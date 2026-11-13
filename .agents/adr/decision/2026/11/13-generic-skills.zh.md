# Generic Skills

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash

[English](./13-generic-skills.md) | 中文

## 动机

把通用 Skill 留在 rstack，并移除本仓库的四个副本。

`architect`、`code-quality`、`deep-research` 和 `well-said` 属于通用能力，并不属于本仓库的组件。rstack 现已维护这些日常使用的领域，本地副本需要分别更新，还可能与实际安装的版本产生差异。

## 决定

本仓库不再分发这四个 Skill 及其中文变体。`skills/` 与 `variants/zh/skills/` 保留与本仓库自身工作一起使用的 Skill，包括 `grill-me`、`python-engineering` 和 `msgspec`。

通用 Skill 由 [rstack](https://github.com/ruokee/rstack) 维护，仓库 README 指引读者前往该仓库。文档清理规则改用 rstack 的 `wellsaid` Skill，替代已移除的 `well-said`。

`architect`、`deep-research` 和 `well-said` 的既有组件决定由各自后继反转。`code-quality` 没有单独决定，本次移除由本记录覆盖。

## 考虑过的替代方案

保留四个 Skill 的本地副本。这样能得到一份自包含的检出，但同一套指导需要在两个仓库维护，实际安装的副本还可能因来源不同而出现差异。

只移除其中部分 Skill。这样无法为哪些通用能力属于本仓库建立稳定标准，两个来源仍然需要核对。

## 结果

需要架构、代码审查、调研或写作指导的读者从 rstack 安装。本仓库的能力索引、安装示例和 Skill 检查只覆盖剩余 Skill。

这四项能力退出本仓库的发布与验证范围，相关修复在 rstack 完成，并通过该仓库的发布到达用户。
