# uv

uv 是一个 Python 项目和环境管理器：它解析依赖、构建锁文件、运行脚本、管理工具安装以及提供 Python 解释器。它回答的是"这个项目使用哪个 Python、安装了哪些依赖、如何复现环境、如何运行工具"，而不是规定代码风格。

uv 整合了以前需要 pip、pip-tools、pipx、virtualenv 和版本管理器分别完成的工作。它速度很快，并且默认写入锁文件，这使得可复现的环境成为阻力最小的路径。

## 项目创建（Project Creation）

`uv init` 会生成一个包含 `pyproject.toml`、一个固定本地解释器版本的 `.python-version` 文件以及初始源码布局的项目。`[project]` 表包含 `requires-python`、依赖列表和打包元数据。请审慎固定 `requires-python`，因为它驱动版本条件语法决策并约束解析器。

```bash
uv init my-project
cd my-project
uv add httpx
```

## 依赖管理（Dependency Management）

`uv add <pkg>` 和 `uv remove <pkg>` 一步完成编辑 `pyproject.toml` 并更新锁文件。`uv lock` 在不安装的情况下重新解析，`uv sync` 使环境与锁文件精确匹配，移除任何未声明的依赖。环境被视为派生状态：在 `pyproject.toml` 中声明意图，锁文件和 `.venv` 随之自动更新。

```bash
uv add "fastapi>=0.115"
uv add --dev pytest ruff
uv remove requests
```

## 锁文件（Lockfile）

`uv.lock` 记录跨平台带有哈希值的完全解析依赖图。对于应用程序，请将其提交到版本控制，以便每台机器和 CI 运行都能安装完全相同的版本。需要针对一系列依赖版本进行动态解析的库是不提交锁文件的主要情况，但大多数仓库都能从提交锁文件中受益。

## 依赖组（Dependency Groups）

开发、测试、代码检查和类型检查依赖应属于不同的组，而不是放在运行时依赖列表中，这样它们可以有选择地安装，并从发布的制品中排除。使用 `uv add --dev` 添加默认 dev 组，或使用 `--group <name>` 添加命名组。确切的表布局取决于当前 uv 版本在 `[dependency-groups]` 和 `[tool.uv]` 下支持的内容。

## 脚本执行（Script Execution）

`uv run <command>` 在管理的环境中执行，必要时先执行 sync，这样贡献者无需手动激活虚拟环境或使用过时的环境。将每个工具调用都通过 uv run 路由，以保持本地和 CI 行为一致。

```bash
uv run pytest
uv run ruff check
uv run python -m myapp
```

单文件脚本使用 PEP 723 行内元数据：文件顶部的注释依赖块使 `uv run script.py` 无需项目即可提供临时环境。

```python
# /// script
# requires-python = ">=3.12"
# dependencies = ["httpx"]
# ///
import httpx
```

## 工具管理（Tool Management）

`uv tool install` 和 `uv tool run`（别名 `uvx`）在隔离环境中管理独立 CLI 工具，覆盖了 pipx 的角色。这适用于那些全局有用但不是项目依赖的工具。项目范围内的质量工具最好声明为依赖组成员，并使用 `uv run` 运行，这样它们的版本与所检查的代码一起被锁定。

```bash
uvx ruff check
uv tool install pre-commit
```

## 工作空间（Workspace）

工作空间（workspace）将多个相关包组合在一个锁文件和共享解析下，类似于 Cargo 或 npm 的工作空间。成员在 `[tool.uv.workspace]` 下声明。将其用于需要共享单一解析的协同开发包的单仓库；避免将其用于只是碰巧位于同一目录下的无关项目，因为共享解析会耦合它们的依赖约束。

## Python 版本管理（Python Version Management）

uv 下载并管理独立的 CPython 构建，因此 `requires-python` 和 `.python-version` 就足以获得匹配的解释器，无需 pyenv 等独立工具。`uv python install 3.12` 提供某个版本，解析器在选择版本时会尊重项目声明的范围。

## 与 pip、pipx 和 Poetry 的关系

uv 覆盖了 pip（安装）、pip-tools（锁定）、pipx（工具隔离）、virtualenv（环境）和版本管理器各自独立完成的工作。与 Poetry 相比，它在项目和依赖管理上有重叠，但强调速度和更广泛的环境角色。该工具快速且统一是采用它的理由；它不能替代类型检查、测试、覆盖率或 CI，这些仍然是正确性的门禁。现有的 Poetry 或 Hatch 项目、有自身约束的已发布库以及组织标准配置，应根据其自身情况进行迁移，而非自动迁移。
