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
- **Harness Package 和适配器。** 为仓库能力提供的第一方安装与传输支持。
- **可选变体。** 仓库内容或配置面向不同语言、环境和使用偏好的可选版本。
- **相关文档。** 能力索引、安装方式、开发约定和验证说明。

## 仓库布局

英文 Skill 位于 `skills/<name>/`，中文 variant 位于 `variants/zh/skills/<name>/`，但安装后仍使用宿主的正常路径 `skills/<name>/`。纯 Skill 只包含发现、理解和使用该 Skill 所需的材料。

Plugin、Extension、可执行程序和 Harness Package 使用对应 Harness 或构建系统预期的布局。只有真实组件需要时，仓库才增加新的顶层区域。

长期仓库决定通过双语 [ADRs](../../.agents/adr/README.zh.md) 记录。

tk 通过一个 Rust 运行时和面向 Codex、Claude Code、Pi、OMP 的自包含组件保存项目持久 Task。Task 是值得持久保存的项目内临时性努力，创建不代表已经承诺执行。

[tk 用户指南](../../projects/tk/docs/guide.zh.md)

[tk 设计索引](../../projects/tk/docs/design/README.zh.md)

## 开发

Markdown 格式化需要 Node.js 20 或更高版本。安装锁定版本的依赖：

```bash
pnpm install --frozen-lockfile
```

格式化或检查全部 Markdown 文件：

```bash
pnpm docs:format
pnpm docs:lint
```

将指定文件直接传给 Prettier：

```bash
pnpm exec prettier --write README.md docs/zh/README.md
pnpm exec prettier --check README.md docs/zh/README.md
```

如果 Prettier 无法加载 Plugin，请重新运行 `pnpm install --frozen-lockfile`。

安装 Git hook：

```bash
pnpm hooks:install
```

运行全部检查：

```bash
pnpm check
```

`pnpm check` 会运行 Markdown 检查、`cargo fmt --manifest-path projects/tk/Cargo.toml -- --check` 和 `cargo test --manifest-path projects/tk/Cargo.toml`。

`main` 是唯一长期分支。所有工作都从当前 `main` 创建短期分支，使用英文 Conventional Commit 消息，并在明确授权后通过 squash merge 进入 `main`。

## 许可证

Ruokee Agent Kit 使用 [MIT License](../../LICENSE)。
