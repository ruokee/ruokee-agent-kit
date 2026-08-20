# pre-commit

pre-commit 是一个 Git 钩子框架和多语言钩子环境管理器。它将钩子安装到本地仓库中，使得快速、确定性的检查在提交之前运行，在格式化、基本文件卫生和明显的 lint 错误到达审查之前将其捕获。钩子首先在本地运行；CI 集成是可选的，视项目而定。

## 钩子框架（Hook Framework）

配置位于 `.pre-commit-config.yaml` 中，而不是 `pyproject.toml` 中。这是一个工具事实：pre-commit 读取自己的文件，为了配置集中化而将钩子定义强行放到 `pyproject.toml` 中是不可能的。每个钩子声明一个 repo（仓库）、一个 revision（版本）和要运行的钩子 ID。pre-commit 为每个钩子仓库创建并缓存一个隔离的环境，因此钩子不依赖于项目中虚拟环境中恰好安装的内容。

```yaml
repos:
  - repo: https://github.com/astral-sh/ruff-pre-commit
    rev: v0.6.0
    hooks:
      - id: ruff-format
      - id: ruff
        args: [--fix]
  - repo: https://github.com/pre-commit/pre-commit-hooks
    rev: v4.6.0
    hooks:
      - id: trailing-whitespace
      - id: end-of-file-fixer
      - id: check-yaml
```

## 本地提交门禁（Local Commit Gate）

执行 `pre-commit install` 后，钩子在 `git commit` 时自动对暂存文件运行。其目的是在提交时而不是在审查中捕获琐碎的问题——格式漂移、残留空白、损坏的 YAML。保持钩子集合小而快，使门禁保持低摩擦；缓慢的门禁会训练人们使用 `--no-verify` 跳过它。

## 常见钩子（Common Hooks）

一个典型的 Python 钩子集合：文件卫生钩子（`trailing-whitespace`、`end-of-file-fixer`、`check-yaml`、`check-added-large-files`）、用于格式化和代码检查的 [`ruff-format`](./ruff.md) 和 `ruff`，以及用于项目特定规则的自定义 [Flake8 插件](./flake8-plugin.md)。可以包含类型检查钩子，但全仓库类型检查通常太慢，不适合每次提交，更适合 CI，而编辑器 LSP 提供快速的本地反馈。

## 自动修复钩子与文件修改

一些钩子会修改文件：`ruff-format`、`ruff --fix`、`end-of-file-fixer` 和 `trailing-whitespace` 会就地重写内容。当钩子更改文件时，pre-commit 报告失败并将修复保留为未暂存状态，因此你可以查看更改并在再次提交之前重新暂存。这是有意为之——你能够看到被重写的内容，而不是盲目地提交机器编辑。

## 速度考虑（Speed Considerations）

第一次运行会安装钩子环境，速度较慢；这是预期行为，不是将 pre-commit 视为 CI 替代品的理由。后续运行会复用缓存的环境。将提交钩子保留给快速、确定性的检查，将完整的测试运行、覆盖率以及依赖网络的扫描推送到 CI 或手动任务中。

## 可选的 CI 集成（Optional CI Integration）

pre-commit 仅能捕获那些安装了钩子并且没有跳过它们的贡献者的问题，因此 CI 必须重复关键检查。两种常见方法：托管的 pre-commit.ci 服务，它在拉取请求上运行相同的配置并可以自动修复；或者手动 CI 步骤运行 `pre-commit run --all-files`。并非每个项目都有 CI，因此将此层视为可选而非假设，但如果存在 CI，它应镜像本地钩子配置，以使本地和 CI 结果一致。
