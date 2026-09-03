# ADR 决定：使用 Prettier 格式化 Markdown

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol, Ruokee

[English](./2026-09-02-format-markdown-with-prettier.md) | 中文

## 动机

Prettier 能够为段落、标题、列表、引用、链接、代码块和表格等 Markdown 结构产生确定的格式。如果仓库没有统一的格式化器，作者和编辑器可能产生不同的布局，基础空白检查也无法约束统一结果。

Prettier 通常会给表格单元格补空格，使源码中同一列的单元格等宽。这些填充会降低 Markdown 源文件的可读性，也会增加 Agent 需要处理的文本量。仓库还需要统一中文与拉丁字母或数字之间的空格。

## 决定

采用 Prettier 作为仓库的 Markdown 格式化器。

仓库的 Prettier 配置必须：

- 对普通 Markdown 产生确定的格式；
- 使用不做等宽填充的紧凑格式处理 Markdown 表格；
- 统一处理中文与拉丁字母或数字之间的空格；
- 保留文档语义和代码围栏中的内容；
- 对已经格式化的输入再次运行时不产生变更。

仓库提供命令，用于格式化全部受 Git 管理的 Markdown 文件或指定 Markdown 文件，也可以在不修改文件的情况下检查格式。Git hook 检查发生变更的 Markdown 文件。

任何有意保留的格式例外都必须明确，并针对具体仓库实例进行审查。

## 考虑过的替代方案

**继续手工维护 Markdown 格式。** 布局仍取决于每位作者和编辑器，仓库检查也没有统一的预期结果。

## 结果

受 Git 管理的 Markdown 文件采用统一且可重复的格式。Markdown 源文件中的表格保持紧凑，不按内容宽度补齐单元格；中文与拉丁字母或数字相邻时采用统一的空格规则。

即使文档语义不变，格式化也可能改写 Markdown 布局。机械格式变更应与人工内容修改分开，方便审查者识别意外改动。

贡献者和仓库检查需要 Node.js 及 lockfile 固定的开发依赖。
