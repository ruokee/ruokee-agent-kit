# Ruokee Agent Kit

[English](../../README.md)

我在不同 Agent Harness 中反复遇到同一类问题。有些问题适合写成 Skill，有些则需要 Extension、Plugin、可执行程序或宿主 Package。这个仓库用来公开维护这些能力。

Ruokee Agent Kit 只收录我为自己开发、也愿意公开维护的能力。每项能力都应该有明确的用途、读得懂的文档，以及真实的验证路径。这里不会记录我曾经顺手安装过的所有东西。

## 我使用什么 Harness

我目前主要使用自己 Fork 的 OMP，并配了一套很精简的预设。

我希望界面足够美观，也希望日常开发中常用的功能随手可用。OMP 自带很多开箱即用的功能，可以理解为预装了大量功能的 Pi。关掉大量不需要的功能后，它已经挺好用。不过 OMP 也有自己的限制，未来我应该还会迁移到更合适的 Harness。

我维护自己的 Fork，是因为 OMP 并不完全符合我的要求，其中一些行为也无法通过 extension 修改。一旦开始 Fork 并修改源码，这个 Fork 也就逐渐变成了 "My Harness"。

我也会使用 Pi、Claude Code 和 Codex。

## 这里会有什么

- **Skills。** 我为自己的工作开发并公开维护的自包含 Agent Skills。
- **Plugin 和可执行程序。** 需要确定性代码或独立 runtime 的能力。
- **扩展。** 为 Agent Harness 增加或调整功能的独立扩展。
- **宿主 Package 和 adapter。** 为仓库能力提供的第一方安装与传输支持。
- **可选变体。** 仓库内容或配置面向不同语言、环境和使用偏好的可选版本。
- **相关文档。** 能力索引、安装方式、开发约定和验证说明。

## 仓库布局

英文 Skill 位于 `skills/<name>/`，中文 variant 位于 `variants/zh/skills/<name>/`，但安装后仍使用宿主的正常路径 `skills/<name>/`。纯 Skill 只包含发现、理解和使用该 Skill 所需的材料。

Plugin、Extension、可执行程序和宿主 Package 使用对应宿主或构建系统预期的布局。只有真实组件需要时，仓库才增加新的顶层区域。

长期仓库决定通过双语 [Agent Notes](../../.agents/notes/README.zh.md) 记录。

## 开发

安装 Git hook：

```bash
uvx pre-commit install --install-hooks
```

运行全部检查：

```bash
uvx pre-commit run --all-files
```

`main` 是唯一长期分支。所有工作都从当前 `main` 创建短期分支，使用英文 Conventional Commit 消息，并在明确授权后通过 squash merge 进入 `main`。

## 许可证

Ruokee Agent Kit 使用 [MIT License](LICENSE)。
