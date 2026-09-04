---
name: python-engineering
description: 当需要评估或改善 Python 工程实践时使用，涵盖项目结构、依赖与版本策略、类型注解、测试、语言特性、标准库机制和工具链。
---

# Python 工程（Python Engineering）

使用本技能进行 Python 专项工程审查、约定设计和分析。

## 进入条件（Entry Conditions）

当任务涉及 Python 特有工程问题时激活本技能：项目形态或包布局、Python 版本策略、依赖管理、类型注解及检查策略、测试、文档字符串、自定义 lint、语法选择、标准库机制或工具链配置。

## 模式选择（Mode Selection）

提供三种模式。默认为快速审查（Fast Review）。

| 模式 | 触发条件 | 阅读文档 |
| --- | --- | --- |
| 快速审查（Fast Review） | 日常自检、小型 diff、PR 审查的默认模式 | `./workflow/fast-review.md` |
| 完整审查（Full Review） | 用户明确说"full review"、"complete review"、"systematic review" | `./workflow/full-review.md` |
| 分析（Analysis） | 用户要求讨论、头脑风暴、设计对比、机制分析、重构计划 | `./workflow/analysis.md` |

只读约束：当用户说"do not modify"、"read-only"、"just analyze"或"survey"时，不要运行任何写入文件的命令。优先使用 `rg`、`git ls-files`、`git show`、`find`、`wc`、`nl`。避免使用 `uv run`、`pytest`、`ruff check --fix`、`pre-commit run` 或任何会创建 `.venv`、缓存或修改源代码的命令。

## 判断顺序（Judgment Order）

根据信号路由到叶子文档。只阅读任务所需的内容。

| 信号 | 优先阅读 | 常搭配阅读 |
| --- | --- | --- |
| Python 版本、运行时目标、兼容性 | [python-version](./references/project/python-version.md) | type-hint, structure |
| 项目形态：脚本式、平面式、src 式、打包应用、工作空间 | [structure](./references/project/structure.md) | dependency-management, uv |
| 运行时/开发/可选依赖、锁文件、分组 | [dependency-management](./references/project/dependency-management.md) | uv, structure |
| 代码风格、PEP 8 与格式化工具/审查边界 | [style](./references/spec/style.md) | ruff, custom-lint |
| 设计原则、编程范式和重构的 Python 专项应用 | [Python 设计指导](./references/spec/code-quality.md) | style, type-hint |
| 类型注解、`Any`、`cast`、Protocol、泛型、类型别名、类型参数 | [type-hint](./references/spec/type-hint.md) | python-version, ty |
| 测试组织、fixture、参数化、异常/警告、日志/输出捕获、mock 边界、异步测试 | [testing](./references/spec/testing.md) | pytest |
| 文档字符串、API 文档、模式元数据、信息放置 | [docstrings-api-docs](./references/spec/docstrings-api-docs.md) | type-hint |
| 项目特定机械规则、自定义 lint | [custom-lint](./references/spec/custom-lint.md) | flake8-plugin, pre-commit |
| `match`/`case`、结构模式匹配 | [match-case](./references/grammar/match-case.md) | type-hint |
| `with`、`async with`、资源生命周期语法 | [context-manager](./references/grammar/context-manager.md) | contextlib, exception-groups |
| `ExceptionGroup`、`except*`、多错误处理 | [exception-groups](./references/grammar/exception-groups.md) | context-manager |
| 装饰器、高阶函数、参数化装饰器、装饰器类 | [decorator](./references/grammar/decorator.md) | functools, common |
| 常用标准库：pathlib, enum, dataclasses, logging | [common](./references/stdlib/common.md) | functools, itertools |
| `singledispatch`、`partial`、闭包、装饰器辅助函数 | [functools](./references/stdlib/functools.md) | decorator, common |
| `itertools`、惰性管道、分组、批处理 | [itertools](./references/stdlib/itertools.md) | common, functools |
| `contextlib`、`ExitStack`、`AsyncExitStack` | [contextlib](./references/stdlib/contextlib.md) | context-manager, common |
| uv 依赖、锁、脚本、工作空间命令 | [uv](./references/tooling/uv.md) | dependency-management, structure |
| Ruff 格式化/linter 职责 | [ruff](./references/tooling/ruff.md) | style, custom-lint |
| ty 作为快速类型检查器、LSP 反馈 | [ty](./references/tooling/ty.md) | type-hint, mypy, basedpyright |
| mypy 严格模式、遗留项目门禁 | [mypy](./references/tooling/mypy.md) | type-hint, ty, basedpyright |
| basedpyright 严格模式、Pyright 对比 | [basedpyright](./references/tooling/basedpyright.md) | type-hint, ty, mypy |
| pytest 运行器配置、发现、导入模式、marker、严格模式、插件 | [pytest](./references/tooling/pytest.md) | testing |
| coverage.py、分支覆盖、阈值 | [coverage](./references/tooling/coverage.md) | testing, pytest |
| pre-commit 钩子、本地门禁、CI 集成 | [pre-commit](./references/tooling/pre-commit.md) | custom-lint, ruff |
| 用于自定义 lint 的 Flake8 插件机制 | [flake8-plugin](./references/tooling/flake8-plugin.md) | custom-lint, pre-commit |

术语含义或中英文对应不清楚时，读取[术语表](./glossary.md)。

## 输出约定（Output Contract）

首先报告发现。区分事实、推断、判断和建议，不要混为一谈。不要重复格式化工具、linter 或类型检查器可以机械确定的问题。

输出格式取决于模式。请遵循对应的工作流文档（`./workflow/fast-review.md`、`./workflow/full-review.md` 或 `./workflow/analysis.md`）。分析模式提供选项和权衡，而非发现列表。

按全局、项目或用户指令要求的语言编写输出；未指定时，使用当前对话的语言。

## 停止规则（Stop Rules）

- 不要自动运行完整审查模式。
- 除非用户要求修复，否则不要修改代码。
- 未经明确确认，不要运行不安全的修复、批量压制、跨文件重构、依赖更改或更改锁文件的命令。
- 在只读或分析任务期间，不要写入文件修改。
- 不要报告 Ruff、ty 或 pre-commit 能机械捕获的问题。如果相关，在 Notes 中提一次即可，然后继续。
