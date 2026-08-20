# Ruokee Agent Kit

[English](README.md)

我写 Agent Skill，通常是因为同一个问题已经撞上不止一次。一段有用的指令慢慢长成提示词，再长成真正能做事的 Skill，最后我希望常用的每个 Agent Harness 都能用上它。这个仓库就是它们的新家。

Ruokee Agent Kit 只收录我为自己开发、也愿意公开维护的 Skill。每个 Skill 都应该有明确的用途、读得懂的说明，以及能证明它仍然可用的检查。我不想把这个仓库变成某天顺手装过什么的仓库。

## 我使用什么 Harness

我目前主要使用自己 Fork 的 OMP，并配了一套很精简的预设。

我希望界面足够美观，也希望日常开发中常用的功能随手可用。OMP 自带很多开箱即用的功能，可以理解为预装了大量功能的 Pi。关掉大量不需要的功能后，它已经挺好用。不过 OMP 也有自己的限制，未来我应该还会迁移到更合适的 Harness。

我维护自己的 Fork，是因为 OMP 并不完全符合我的要求，其中一些行为也无法通过 extension 修改。一旦开始 Fork 并修改源码，这个 Fork 也就逐渐变成了 "My Harness"。

我也会使用 Pi、Claude Code 和 Codex。

## 这里会有什么

- **Skills。**我为自己的工作开发，并愿意公开维护的 Agent Skills。
- **扩展。**为 Agent Harness 增加或调整功能的独立扩展。
- **可选变体。**仓库内容或配置面向不同语言、环境和使用偏好的可选版本。
- **相关文档。**Skill 索引、安装方式、开发约定和验证说明。

## 开发

安装 Git hook：

```bash
uvx pre-commit install
```

运行全部检查：

```bash
uvx pre-commit run --all-files
```

## 许可证

Ruokee Agent Kit 使用 [MIT License](LICENSE)。
