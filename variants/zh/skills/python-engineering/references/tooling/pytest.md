# pytest

pytest 是非临时项目的默认测试运行器。它处理测试发现、fixture、参数化、标记（marker）、断言内省以及运行入口点。它不直接规定生产代码风格，但它注入依赖和隔离行为的方式推动代码向可测试性发展。

## 测试发现（Test Discovery）

默认情况下，pytest 收集匹配 `test_*.py` 或 `*_test.py` 的文件、以 `test_` 为前缀的函数以及以 `Test` 为前缀的类（不带 `__init__`）。配置 `testpaths` 使收集从正确的位置开始：

```toml
[tool.pytest.ini_options]
testpaths = ["tests"]
addopts = "-ra"
```

将测试放在顶层 `tests/` 目录下，可以使其与可导入的生产包分开，并使发现过程可预测。测试是否包含在 sdist 或 wheel 中，取决于构建后端的包发现和 include/exclude 配置。

## conftest.py

`conftest.py` 包含跨目录子树共享的 fixture、钩子和插件配置，而无需显式导入。pytest 会自动加载它。根级别的 `conftest.py` 项目范围共享 fixture；嵌套的 `conftest.py` 将辅助函数限定到子树。将其用于共享 fixture 和钩子实现，而不是作为测试辅助函数的垃圾场——后者作为普通导入的模块会更清晰。

## Fixture 作用域（Fixture Scoping）

Fixture 具有 `scope`（作用域）：`function`（默认）、`class`、`module`、`package` 或 `session`。更宽的作用域在更多测试之间共享昂贵的设置（数据库、服务器），用隔离性换取速度。根据资源的成本和可变性匹配作用域：每个函数一个临时目录，每个会话一次只读 fixture。`yield` fixture 在 `yield` 之后运行清理，这是释放资源的惯用方式。

```python
import pytest

@pytest.fixture(scope="session")
def db_engine():
    engine = create_engine()
    yield engine
    engine.dispose()
```

## 参数化（Parametrize）

`@pytest.mark.parametrize` 使用多个输入运行同一个测试函数，每个输入作为一个单独报告的例子。它取代了手写循环，并使失败点指向特定的输入。使用 `ids` 获取可读的案例名称，并堆叠 parametrize 装饰器来获取输入集的笛卡尔积。

```python
@pytest.mark.parametrize("value,expected", [(2, 4), (3, 9)])
def test_square(value, expected):
    assert square(value) == expected
```

## 标记（Markers）

标记（marker）用于选择测试：内置标记如 `skip`、`skipif`、`xfail`，以及使用 `-m` 选择的自定义标记如 `slow` 或 `integration`。在配置中注册自定义标记，这样拼写错误不会静默地创建新标记。`--strict-markers` 将未注册的标记视为错误，值得启用。

```toml
[tool.pytest.ini_options]
markers = ["slow: long-running tests", "integration: needs external services"]
```

## 导入模式（Import Modes）

导入模式（import mode）控制测试模块如何到达 `sys.path`。传统的 `prepend` 模式插入根目录并依赖 `__init__.py` 的放置方式，这可能掩盖打包错误。新项目应优先使用 `--import-mode=importlib`，它在不操作 `sys.path` 的情况下导入测试模块，避免名称冲突和意外的导入副作用。

```toml
[tool.pytest.ini_options]
addopts = "--import-mode=importlib"
```

## 严格模式（Strict Mode）

`--strict-markers` 和 `--strict-config` 将未知标记和配置问题转化为硬性失败，及早暴露错误。它们值得启用，但它们将测试套件与 pytest 的当前行为耦合，因此需要固定 pytest 版本。如果你不希望自动吸收未来的严格性变更，请启用具体的严格选项，而不是依赖宽泛的模式。

## 插件生态系统（Plugin Ecosystem）

pytest 拥有庞大的插件生态系统：`pytest-cov` 用于覆盖率，`pytest-xdist` 用于并行运行，`pytest-asyncio` 用于协程测试，以及许多框架集成。基于实际需求添加插件，而不是默认添加；每个插件都是一个依赖，并且可能是收集或 fixture 问题的潜在来源。覆盖率特别可以通过 [coverage.py](./coverage.md) 直接运行，无需插件。

pytest 验证代码能够运行并对行为进行断言，但测试套件通过并不能证明断言是有意义的，也不能证明边界情况已被覆盖。覆盖率工具回答的是哪些代码被执行了；只有断言能回答代码是否正确。
