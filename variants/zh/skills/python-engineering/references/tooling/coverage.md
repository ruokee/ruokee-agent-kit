# coverage.py

coverage.py 测量在测试运行期间哪些代码行和分支被执行。它不是一个测试框架，也不是一个独立的质量指标；它是测试执行之上的一个可观测性层，回答的是"测试实际到达了哪些代码"，而不是"测试是否检查了正确的内容"。

## 语句覆盖率与分支覆盖率（Statement vs Branch Coverage）

语句覆盖率（statement coverage）记录哪些行被执行了。分支覆盖率（branch coverage）额外记录每个条件语句的哪些分支被采用了，因此即使每一行都执行了，如果某个 `if` 的 `else` 路径从未被使用，也会显示为部分分支未覆盖。分支覆盖率捕获了语句覆盖率隐藏的未经测试的决策路径，对于核心逻辑和库来说值得启用。

```toml
[tool.coverage.run]
branch = true
source = ["mypackage"]
```

## 运行覆盖率（Running Coverage）

原生命令直接了当，避免了额外的插件依赖：

```bash
coverage run -m pytest
coverage report -m
coverage html
```

`coverage run` 记录执行情况，`report` 打印终端摘要（使用 `-m` 显示缺失的行号），`html` 生成可浏览的带注释报告。`pytest-cov` 将覆盖率集成到 pytest 调用中，很方便，但它是可选的而非必需的。

## 配置（Configuration）

在 `pyproject.toml` 的 `[tool.coverage.*]` 下进行配置。`source` 将测量范围限定到你的包，这样第三方代码不会稀释数字。`omit` 排除生成代码或迁移等文件。`[tool.coverage.report]` 控制 `exclude_lines`（例如 `pragma: no cover`、`if TYPE_CHECKING:` 和 `raise NotImplementedError`）和 `fail_under` 阈值。

```toml
[tool.coverage.report]
exclude_lines = ["pragma: no cover", "if TYPE_CHECKING:"]
fail_under = 80
```

## 阈值策略（Threshold Policy）

`fail_under` 在总覆盖率低于某个百分比时使运行失败。从一个现实、当前可达到的数字开始，然后逐步提高；设定一个远高于当前实际情况的阈值只会训练人们绕过它。高数字也不是质量的证明，因为覆盖率统计的是执行情况，而不是断言强度。

## 覆盖率衡量什么与不衡量什么

覆盖率告诉你某一行或分支在测试套件中被执行了。它没有说明断言是否检查了结果、边界值是否被测试了，或者错误路径是否得到了有意义的验证。代码可以达到 100% 的覆盖率，但测试却没有断言任何内容。将覆盖率视为一个最低标准，用来标记明显未经测试的代码，而不是行为正确性的证据。

## CI 门禁（CI Gates）

覆盖率通常在 CI 中运行，在此处阈值门禁在所有贡献者之间得到一致执行。在本地，它在需要时运行，而不是在每次提交时运行，因为完整的覆盖率运行比适合提交钩子（commit hook）的快速检查要慢。结合 CI 中的 [coverage.py](./coverage.md) 和 [pytest](./pytest.md) 运行，并将阈值作为本地和 CI 调用共同引用的单一真实来源。
