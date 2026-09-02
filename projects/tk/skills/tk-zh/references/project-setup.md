# 项目设置

## 配置

项目配置文件为 `.agents/tk_config.toml`。配置采用稀疏形式，未指定的值使用以下默认值：

```toml
task_root = ".tk"
subtasks_dir = ""
git_policy = "none"
creation_policy = "strict"
metadata_mode = "split"
```

使用 `tk init` 创建配置。常规 init 会拒绝已初始化的项目。即使旧配置无法解析，`tk init --force` 也会根据显式参数和默认值重写配置。它不会检查、迁移、移动或重写 Task 数据。

## 发现

Git 项目使用 Git 根目录和项目配置。在非 Git 项目中，精确的 Task 路径或材料路径会通过 `YYYY/MM/DD-NN--slug` 拓扑结构和最多额外两级祖先目录定位其 Task 根目录。常规 cwd 发现的范围有限。

即使 cwd 属于另一个项目，完整的绝对 Task 路径或材料路径也能定位其所属项目。

存在多个可能的项目时，请显式传入 `cwd`。

## Git 策略

仅在执行持久化写入之前检查 Git 策略：

- `track` 要求受管 Task 文件不能被忽略；
- `ignore` 要求 Task 根目录被忽略；
- `none` 不调用 Git 策略命令。

read、search 和纯诊断操作不会因 Git 策略而被拒绝。tk 绝不会编辑 `.gitignore`、索引、Git 配置、提交或历史记录。

## 元数据模式

一个项目中的所有 Task 都使用 split 或 embed。不要手动混用这两种模式。请使用：

```sh
tk metadata switch --to split
tk metadata switch --to embed
```

使用 `tk metadata migrate [--file <carrier>]... [--to <version>]` 执行已发布的向前 schema 转换。`--file` 接受规范载体，不接受目录、Task ID、材料路径或 glob。

请通过公开 CLI 执行 switch 和 migrate。`tk_exec` 不接受这些操作。
