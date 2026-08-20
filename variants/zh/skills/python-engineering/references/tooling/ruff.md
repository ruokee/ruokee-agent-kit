# Ruff

Ruff 是一个基于 Rust 的快速格式化器和代码检查器，它在一个工具中覆盖了 Black、Flake8、isort、pyupgrade 以及许多 Flake8 插件的工作。两个职责存在于同一个二进制文件中：`ruff format` 处理机械布局，`ruff check` 处理 lint 规则。将它们放在同一个工具链中意味着共享配置和一致、快速的反馈。

## 格式化器（Formatter）

`ruff format` 重新格式化布局：换行、缩进、引号、括号、空行和尾随逗号。它追求与 Black 兼容，因此输出接近 Black，在 Black 代码库上采用它产生的变动最小。信任它处理所有机械性格式化工作，停止手动审查格式。它是确定性的，可以在每次保存和 pre-commit 中安全运行。

```bash
ruff format
ruff format --check    # CI：未格式化则失败
```

默认风格保持与 Black 兼容。预览风格（preview style）启用进行中的格式化变更；如果项目不接受随着风格演变而周期性出现的重新格式化差异，请关闭它。在 `[tool.ruff.format]` 下进行配置，例如 `docstring-code-format` 用于格式化文档字符串中的代码块，这是可选的，默认不开启。

## 代码检查器（Linter）

`ruff check` 运行按家族组织的 lint 规则，由前缀标识：`E`/`W`（pycodestyle）、`F`（Pyflakes）、`I`（isort 导入排序）、`UP`（pyupgrade 现代化）、`B`（bugbear）、`SIM`（简化）、`C4`（推导式）、`RET`（返回）、`RUF`（Ruff 原生）以及更多。一个较小的起始集合，例如 `E`、`F`、`I`、`UP`、`B`，能够捕获真实的缺陷，而不会让项目淹没在风格噪音中。

```bash
ruff check
ruff check --fix
```

导入排序来自 `I` 家族，因此不需要单独的 isort。避免使用 `select = ["ALL"]`：它会将代码检查变成一组微观偏好，而且每个添加的家族都带有误报成本、审查认知成本、自动修复安全风险以及对现有代码的迁移成本。按需添加诸如 `SIM`、`RUF`、`C4`、`PIE`、`RET` 等家族。

## 规则成熟度（Rule Maturity）

规则分为稳定版和预览版。稳定规则通过 `select` 启用；预览规则需要预览模式，并且可能会发生变化。将预览规则视为可选的实验性功能，而不是默认规则，这样规则集不会在 Ruff 升级时悄然发生变化。

## `ruff check --fix` 行为

`--fix` 应用 Ruff 归类为安全的修复，例如移除未使用的导入并对其进行排序。不安全的修复可能会改变行为或意图，需要 `--unsafe-fixes` 来选择加入。审查自动修复的差异，而不是盲目提交，尤其是在遗留代码库中进行批量操作时，因为针对异常代码的"安全"修复仍然可能带来意外。

## 配置（Configuration）

配置位于 `pyproject.toml` 的 `[tool.ruff]` 下，`[tool.ruff.lint]` 用于规则选择，`[tool.ruff.format]` 用于格式化。设置 `target-version` 和 `line-length` 一次，让两部分共享它们。按文件忽略（per-file ignores）处理合法的例外情况，例如在 `__init__.py` 中放宽导入规则。

```toml
[tool.ruff]
target-version = "py312"
line-length = 88

[tool.ruff.lint]
select = ["E", "F", "I", "UP", "B"]
```

## Ruff 处理的内容与需要人工审查的内容

Ruff 解决格式化和广泛的机械性 lint 问题，这正是不应到达人工审查者的噪音。它不评判命名质量、模块职责、异常上下文、类型边界设计、文档字符串信息价值或架构；这些需要类型检查器、测试和人工审查。Ruff 的安全规则（`S`，来自 Bandit）是低成本的静态提醒，而不是完整的 SAST 或依赖漏洞扫描，也不能替代专用工具或人工安全审查。
