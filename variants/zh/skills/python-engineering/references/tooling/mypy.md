# mypy

mypy 是 Python 类型生态系统中成熟、参考级的静态类型检查器。当项目需要严格、理解充分的门禁、广泛的第三方桩文件支持，或与更广泛的开源社区期望保持一致时，它是自然的选择。

## 严格模式（Strict Mode）

`--strict` 启用一组标志，这些标志共同要求完整的注解覆盖，并拒绝渐进类型系统（gradual typing）允许的静默缺口：`disallow_untyped_defs`、`disallow_any_generics`、`warn_return_any`、`no_implicit_optional`、`warn_unused_ignores` 等。在新项目上从一开始启用严格模式成本很低；将其回溯应用到未类型化的代码库则是工作量所在。

```toml
[tool.mypy]
strict = true
```

## 渐进式采用（Gradual Adoption）

mypy 是为渐进类型系统（gradual typing）设计的，这使得它非常适合在现有代码库上逐步采用。从宽松开始，然后使用按模块覆盖（per-module override）部分逐个模块收紧，在已经存在注解的地方提高严格性，然后再进入未类型化的区域。

```toml
[[tool.mypy.overrides]]
module = "legacy.*"
disallow_untyped_defs = false
```

## 插件系统（Plugin System）

mypy 支持插件，这些插件教会它核心类型系统本身无法表达的框架特定语义。存在针对 ORM、数据建模库以及其他在运行时生成属性或转换类的框架的插件。插件让 mypy 能够理解它原本会视为不透明的 dataclass 类结构。

## 常见痛点（Common Pain Points）

反复出现的摩擦点是第三方桩文件：某个依赖可能不提供任何类型信息、提供不完整的桩文件，或者需要单独安装的 `types-*` 包，缺失桩文件迫使你在安装它们、编写本地桩文件或忽略该模块之间做出选择。条件导入（`TYPE_CHECKING` 块、版本门控导入、可选依赖）是另一个常见的困惑来源。在抑制错误时，请写入特定的错误代码和理由，而不是裸写 `# type: ignore`，以便抑制操作保持可审计。

## mypy 相对于 ty 的增值时机

当项目需要兼容开源生态、延续现有代码库的历史、适应外部贡献者的习惯，或锁定细微的类型行为差异时，mypy 很有价值。[ty](./ty.md) 凭借速度和编辑器集成适合作为默认门禁，mypy 的优势则是成熟度和生态覆盖。发布库或需要匹配上游期望的迁移，通常值得在默认配置之外启用 mypy 严格配置（strict profile）。

## 与其他检查器的关系

mypy、[ty](./ty.md) 和 [basedpyright](./basedpyright.md) 都检查相同的类型系统，但在成熟度、严格性和速度上有所不同。它们在困难的推断案例上偶尔会产生分歧。在个人项目上永久性地以三重门禁运行所有三个检查器，很少值得付出配置成本；将额外的检查器保留给库发布、外部协作或迁移窗口，在这些场景中交叉检查的收益能够覆盖成本。
