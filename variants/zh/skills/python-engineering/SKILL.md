---
name: python-engineering
description: 当需要评估或改善 Python 工程实践时使用，涵盖项目结构、依赖与版本策略、类型注解、测试、语言特性、标准库机制和工具链。
metadata:
  version: "1.0.6"
---

# Python 工程

Python 工程（Python Engineering）：使用本技能进行 Python 专项工程审查、约定设计和分析。

## 进入条件

进入条件（Entry Conditions）：当任务涉及 Python 特有工程问题时激活本技能：项目形态或包布局、Python 版本策略、依赖管理、类型注解及检查策略、测试、文档字符串、自定义 lint、语法选择、标准库机制或工具链配置。

## 模式选择

模式选择（Mode Selection）：提供三种模式。默认为快速审查（Fast Review）。

- 快速审查是日常自检、小型 diff 和 PR 审查的默认模式，读 `./workflow/fast-review.md`。
- 用户明确说「full review」「complete review」「systematic review」或「architecture review」时用完整审查，读 `./workflow/full-review.md`。
- 用户要求讨论、头脑风暴、设计对比、机制分析或重构计划时用分析模式，读 `./workflow/analysis.md`。

只读约束：当用户说"do not modify"、"read-only"、"just analyze"或"survey"时，不要运行任何写入文件的命令。优先使用 `rg`、`git ls-files`、`git show`、`find`、`wc`、`nl`。避免使用 `uv run`、`pytest`、`ruff check --fix`、`pre-commit run` 或任何会创建 `.venv`、缓存或修改源代码的命令。

## 判断顺序

判断顺序（Judgment Order）：根据信号路由到叶子文档。只阅读任务所需的内容。

- 处理 Python 版本、运行时目标和兼容性时，读 [python-version](./references/project/python-version.md)，常搭配 type-hint 和 structure。
- 判断项目形态（脚本式、平面式、src 式、打包应用或工作空间）时，读 [structure](./references/project/structure.md)，常搭配 dependency-management 和 uv。
- 处理运行时、开发、可选依赖、锁文件和分组时，读 [dependency-management](./references/project/dependency-management.md)，常搭配 uv 和 structure。
- 处理代码风格以及 PEP 8 与格式化工具、审查的边界时，读 [style](./references/spec/style.md)，常搭配 ruff 和 custom-lint。
- 要处理设计原则、编程范式和重构的 Python 专项应用时，读 [Python 设计指导](./references/spec/code-quality.md)，常搭配 style 和 type-hint。
- 处理类型注解、`Any`、`cast`、Protocol、泛型、类型别名和类型参数时，读 [type-hint](./references/spec/type-hint.md)，常搭配 python-version 和 ty。
- 处理测试组织、fixture、参数化、异常和警告、日志和输出捕获、mock 边界及异步测试时，读 [testing](./references/spec/testing.md)，常搭配 pytest。
- 处理文档字符串、API 文档、模式元数据和信息放置时，读 [docstrings-api-docs](./references/spec/docstrings-api-docs.md)，常搭配 type-hint。
- 处理项目特定的机械规则和自定义 lint 时，读 [custom-lint](./references/spec/custom-lint.md)，常搭配 flake8-plugin 和 pre-commit。
- 处理 `match`/`case` 和结构模式匹配时，读 [match-case](./references/grammar/match-case.md)，常搭配 type-hint。
- 处理 `with`、`async with` 和资源生命周期语法时，读 [context-manager](./references/grammar/context-manager.md)，常搭配 contextlib 和 exception-groups。
- 处理 `ExceptionGroup`、`except*` 和多错误场景时，读 [exception-groups](./references/grammar/exception-groups.md)，常搭配 context-manager。
- 处理装饰器、高阶函数、参数化装饰器和装饰器类时，读 [decorator](./references/grammar/decorator.md)，常搭配 functools 和 common。
- 使用 pathlib、enum、dataclasses、logging 等常用标准库时，读 [common](./references/stdlib/common.md)，常搭配 functools 和 itertools。
- 处理 `singledispatch`、`partial`、闭包和装饰器辅助函数时，读 [functools](./references/stdlib/functools.md)，常搭配 decorator 和 common。
- 处理 `itertools`、惰性管道、分组和批处理时，读 [itertools](./references/stdlib/itertools.md)，常搭配 common 和 functools。
- 处理 `contextlib`、`ExitStack` 和 `AsyncExitStack` 时，读 [contextlib](./references/stdlib/contextlib.md)，常搭配 context-manager 和 common。
- 使用 uv 的依赖、锁、脚本和工作空间命令时，读 [uv](./references/tooling/uv.md)，常搭配 dependency-management 和 structure。
- 处理 Ruff 的格式化和 linter 职责时，读 [ruff](./references/tooling/ruff.md)，常搭配 style 和 custom-lint。
- 把 ty 作为快速类型检查器、需要 LSP 反馈时，读 [ty](./references/tooling/ty.md)，常搭配 type-hint、mypy 和 basedpyright。
- 处理 mypy 严格模式和遗留项目门禁时，读 [mypy](./references/tooling/mypy.md)，常搭配 type-hint、ty 和 basedpyright。
- 处理 basedpyright 严格模式及其与 Pyright 的对比时，读 [basedpyright](./references/tooling/basedpyright.md)，常搭配 type-hint、ty 和 mypy。
- 处理 pytest 运行器配置、发现、导入模式、marker、严格模式和插件时，读 [pytest](./references/tooling/pytest.md)，常搭配 testing。
- 处理 coverage.py、分支覆盖和阈值时，读 [coverage](./references/tooling/coverage.md)，常搭配 testing 和 pytest。
- 处理 pre-commit 钩子、本地门禁和 CI 集成时，读 [pre-commit](./references/tooling/pre-commit.md)，常搭配 custom-lint 和 ruff。
- 需要 Flake8 插件机制来实现自定义 lint 时，读 [flake8-plugin](./references/tooling/flake8-plugin.md)，常搭配 custom-lint 和 pre-commit。

术语含义或中英文对应不清楚时，读取[术语表](./glossary.md)。

## 输出约定

输出约定（Output Contract）：首先报告发现。区分事实、推断、判断和建议，不要混为一谈。不要重复格式化工具、linter 或类型检查器可以机械确定的问题。

输出格式取决于模式。请遵循对应的工作流文档（`./workflow/fast-review.md`、`./workflow/full-review.md` 或 `./workflow/analysis.md`）。分析模式提供选项和权衡，而非发现列表。

按全局、项目或用户指令要求的语言编写输出；未指定时，使用当前对话的语言。

## 停止规则

停止规则（Stop Rules）如下：

- 不要自动运行完整审查模式。
- 除非用户要求修复，否则不要修改代码。
- 未经明确确认，不要运行不安全的修复、批量压制、跨文件重构、依赖更改或更改锁文件的命令。
- 只读和分析任务不修改被审查文件。已有的报告或任务材料维护授权继续适用。
- 不要报告 Ruff、ty 或 pre-commit 能机械捕获的问题。如果相关，在 Notes 中提一次即可，然后继续。
