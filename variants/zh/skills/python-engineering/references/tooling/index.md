# 工具参考（Tooling References）

当任务涉及选择、配置或推理特定 Python 工具时，请阅读这些文件。每份文档解释该工具的功能、在工作流程中的位置以及其职责边界。

这些工具按层级划分：环境和依赖管理（uv）、格式化和代码检查（ruff）、类型检查（ty、mypy、basedpyright）、测试和覆盖率（pytest、coverage）、提交门禁（pre-commit）以及项目特定的 lint 扩展（flake8-plugin）。

- [uv.md](./uv.md)：项目、依赖、锁文件、脚本和 Python 版本管理器。
- [ruff.md](./ruff.md)：格式化器和代码检查器，自动修复的内容以及留给审查的部分。
- [ty.md](./ty.md)：基于 Rust 的快速类型检查器，其速度与成熟度的权衡。
- [mypy.md](./mypy.md)：成熟的严格类型检查器，插件支持，渐进式采用。
- [basedpyright.md](./basedpyright.md)：pyright 的更严格社区分支，IDE 集成。
- [pytest.md](./pytest.md)：测试发现、fixture、参数化、导入模式。
- [coverage.md](./coverage.md)：分支覆盖率、阈值、覆盖率能证明和不能证明的内容。
- [pre-commit.md](./pre-commit.md)：本地钩子框架、快速提交门禁、可选的 CI 使用。
- [flake8-plugin.md](./flake8-plugin.md)：基于 AST 的插件机制，用于项目特定规则。

没有任何单一工具能保证质量。每个工具衡量的是某个狭窄方面；正确性仍然来自测试、审查和设计。
