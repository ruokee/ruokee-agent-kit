# 项目形态参考

当关于项目整体形态、支持的运行环境或依赖边界的决策是任务的核心时，请阅读这些文件。每个文件都是参考材料：它解释选择背后的动因，而非盲目应用的检查清单。

- [python-version](./python-version.md)：如何选择最低和目标 Python 版本，`requires-python` 的含义，每个近期版本解锁了哪些特性，以及何时有理由提升版本下限。
- [structure](./structure.md)：所有常见的项目形式——单文件脚本、扁平布局、src 布局、打包应用和工作空间——以及区分它们的信号和用于选择的决策表。
- [dependency-management](./dependency-management.md)：运行时/开发/可选/工作空间内部的依赖拆分、锁文件策略、依赖分组、版本约束以及单体仓库中的依赖方向。

这些文档描述的是动因和权衡，而非审查策略。它们提供评判特定项目所需的上下文；审查工作流位于 [`workflow`](variants/zh/skills/python-engineering/workflow/index.md) 中。
