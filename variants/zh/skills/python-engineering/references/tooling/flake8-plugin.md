# Flake8 插件（Flake8 Plugin）

Flake8 插件是一个注册 AST 或 token 访问器以生成自定义 lint 警告的 Python 包。它让项目能够强制执行通用代码检查器无法覆盖的领域特定或架构特定规则：禁止的导入、必需的装饰器模式、模块边界违规、与框架语义相关的命名约定，或特定基类的结构约束。

## 工作原理（How It Works）

Flake8 插件在 AST 级别操作。它们接收解析后的树（或原始 token/行）并生成 `(line, col, message, type)` 元组。插件通过在 `pyproject.toml` 的 `flake8.extension` 组下的 `entry_points` 进行注册。

一个最小的 AST 检查器插件需要：

1. 一个具有 `name` 和 `version` 类属性的类。
2. 接收 AST 的 `__init__(self, tree)`（对于 AST 检查器）或 `__init__(self, tree, filename)`。
3. 生成 `(line, col, message, type)` 的 `run(self)` 生成器。
4. 在 `pyproject.toml` 中通过 `[project.entry-points."flake8.extension"]` 注册。

对于基于 token 或物理行的检查器，存在替代的注册钩子，但 AST 检查器对于结构性规则最为常见，因为它们可以访问完整的解析树。

## 何时适合编写插件

- 规则是机械性的：可以在没有运行时信息的情况下从 AST 评估。
- 规则一旦正确定义，误报率低。
- 规则在整个代码库中一致适用，而不仅仅在一个模块中。
- 该规则否则需要重复的人工审查努力。
- 该规则无法通过 [Ruff](./ruff.md) 规则配置或 `select`/`ignore` 组合来表达。

## 何时不适合编写插件

- 检查需要运行时类型解析、跨模块数据流或超出 AST 范围的导入解析。这些需要类型检查器，而不是 lint 插件。
- 规则是主观的或依赖上下文的，更适合审查判断。
- [Ruff](./ruff.md) 或其他现有工具已经覆盖了该检查。在编写自定义插件之前，检查 Ruff 是否原生实现了该规则家族（例如 `flake8-bugbear`、`flake8-comprehensions`）。
- 该规则仅适用于一两个文件；代码注释或审查说明就足够了。
- 维护该插件的成本超过了它预防的 bug。

## 测试（Testing）

通过针对合成的 AST 片段调用插件进行测试：

- 使用 `ast.parse` 解析代码字符串。
- 使用该树实例化检查器类。
- 从 `run()` 收集结果。
- 断言正例的期望 line/col/message 元组和反例的空结果。

对于集成测试，针对同时涵盖触发和非触发模式的 fixture 文件运行 `flake8 --select=YOUR_CODE`。

## 与 Ruff 的关系

Ruff 原生实现了许多 Flake8 插件规则集。在编写自定义插件之前，检查 Ruff 是否已经覆盖了该规则家族。如果是，优先使用 [Ruff 配置](./ruff.md)。

自定义项目特定插件仍然有价值，因为 Ruff 不支持任意的用户定义 AST 访问器。需要真正自定义结构检查的项目仍然需要 Flake8 插件（或替代方法：通过不稳定的插件 API 实现自定义 Ruff 规则，或作为独立 AST 脚本在 [pre-commit](./pre-commit.md) 中运行）。

与[自定义 lint 规范](variants/zh/skills/python-engineering/references/spec/custom-lint.md)的关系是：规范文档定义了*创建什么*项目特定规则以及*如何思考*规则设计；本文档涵盖了用于实现和运行这些规则的 Flake8 插件*机制*。

## 错误消息设计（Error Message Design）

一条可操作（actionable）的错误消息应告知开发者：
- 检测到了什么（违规内容）。
- 为什么重要（简要说明）。
- 该怎么做。

在消息前添加短代码前缀（例如 `PRJ001`）以便有选择地抑制。保持消息不超过一行。如果规则需要详细解释，请在消息中链接到内部文档。
