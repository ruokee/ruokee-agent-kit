# 规范参考

当关于编码约定、类型注解、测试、文档或项目特定规则的决策是任务的核心时，请阅读这些文件。每个文件都是参考材料：它解释约定的用途及其边界所在，而非盲目应用的检查清单。

- [style](./style.md)：格式化工具和 linter 机械处理的内容与仍需人类判断的内容之间的界限——命名、模块边界、抽象层次和在 PEP 8 基线之上的显式性。
- [type-hint](./type-hint.md)：类型注解作为接口契约——类型参数和别名、渐进类型策略、`Any` 的遏制、Protocol 与 ABC、`TYPE_CHECKING` 隔离以及类型检查器之间的关系。
- [testing](./testing.md)：测试组织、夹具设计、参数化、行为覆盖胜过行覆盖、模拟边界以及测试作为可执行的文档。
- [docstrings-api-docs](./docstrings-api-docs.md)：每种信息所属的位置——签名 vs 文档字符串 vs 模式元数据 vs 文档站点——以及文档字符串何时增加价值 vs 重复签名。
- [custom-lint](./custom-lint.md)：何时需要项目特定的 lint 规则，如何设计机械性、低误报率的规则，以及它在何处运行。

这些文档描述的是约定及其权衡，而非审查策略。审查工作流位于 [`workflow`](variants/zh/skills/python-engineering/workflow/index.md) 中。
