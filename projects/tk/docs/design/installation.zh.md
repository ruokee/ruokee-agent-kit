# 安装

[English](./installation.md)

本文说明 Linux 用户级 CLI Skill 的安装和卸载。[CLI 参考](./cli-reference.zh.md#tk-install)定义命令语法和结果。

## 运行时前提

固定运行时为 `$HOME/.local/bin/tk`。规划操作前，tk 验证它是至少具有一个 Unix 执行位的常规文件。Skill 生命周期命令不安装、更新、复制、包装或删除运行时本身。

## 内嵌载荷

Cargo 的 `build.rs` 收集完整的 `tk-cli` 和 `tk-cli-zh` 源码树，在 `OUT_DIR` 写入确定性的 `tar.zst` 和对应清单，运行时通过 `include_bytes!` 嵌入两者。安装只读取内嵌字节，不联网，不依赖源码目录，也不接受本地归档输入。

每种语言都是自包含 Skill，全部文件引用都在自身目录中解析。Markdown 目标缺失、引用逃逸、路径重复、文件类型不受支持或引用源码树都会使组装失败。载荷不含运行时可执行文件、其他组件文件、产品源码、审查记录或任务材料。

## 清单

清单包含：

- `component_format_version`，当前为 `5`；
- `runtime_version`、`source_revision` 和 `archive_sha256`；
- `cli_skills` 中的 `en` 与 `zh` 项，各自包含 `language`、`skill`、`runtime_compat`、`payload` 和 `files`；
- 每个文件的内容摘要和 Unix 权限。

`runtime_compat` 为 `>=0.1,<0.2`。每项选择具有语言和 Skill 身份，独立于 Harness。设置 `TK_SOURCE_REVISION` 时组装使用该值，否则记录 `package-v<CARGO_PKG_VERSION>`。构建脚本不调用 Git。

摘要用于检查内嵌归档的完整性，不记录安装所有权，也不决定卸载时保留哪些已修改文件。

## Skill 根目录

install 和 uninstall 必须且只能选择 `--harness` 或 `--skill-root`。Harness 只映射到普通 Skill 根目录：

| Harness | 根目录 |
| --- | --- |
| Codex | `$CODEX_HOME/skills`，默认 `~/.codex/skills` |
| Claude Code | `~/.claude/skills` |
| Pi | `~/.pi/agent/skills` |
| OMP | `~/.omp/agent/skills` |

自定义根目录是已安装 Skill 的父目录。相对路径按进程 cwd 解析。组件命令拒绝全局 `--cwd`，自定义根目录结果报告绝对路径 `skill_root`。

两种目标都只管理直接子项 `tk-cli` 和 `tk-cli-zh`，不读取 Harness 配置、调用 Harness 命令、检查无关子项或保存安装历史。安装可以创建缺失的父目录，其他全部内容都在操作范围之外。

## 预检

dry-run 和执行都会验证固定运行时、内嵌格式、运行时版本及兼容性、两种语言的完整选择、归档路径、文件类型、权限、重复项、缺失或额外条目及内容摘要。无效或不匹配的内容在持久写入前失败。

已有用户级操作标记会阻止实际执行、dry-run 和无变化的生命周期调用。已结束进程的标记由 GC 清理，生命周期调用不绕过它们。

归档路径必须规范且相对，不包含 `..` 或逃逸载荷的路径。已安装受管目标必须可读，以便比较内容并规划新增、替换和删除。规划不读取任务数据、项目配置、WAL、Git 状态或安装历史。

## 安装

默认语言为英文。安装写入完整的所选 Skill，并删除另一种语言。所选目标内的内容偏差，包括额外文件和目录，都会被替换。重复安装相同内容返回 `no_change`。发生变更时返回 `installed` 或 `updated`，dry-run 返回 `would_install`，不执行写入。

需要变更的操作创建最小清理清单、暂存载荷，并在提交前重新验证已观察目标。先写入或替换所选 Skill，再删除另一种语言，最后删除临时内容和操作清单。

## 卸载

卸载按确定顺序删除两个受管子项，包括目录中的用户修改和额外内容，保留根目录和其他全部子项。内容摘要不用于保留被删除 Skill 的残片。

动作是 `uninstalled`、`would_uninstall` 或 `no_change`。两个身份都会被删除，因此结果省略语言和 Skill。

## 失败

全部领域检查在首次持久变更前完成。目标发生变化时，提交前复检失败。普通 I/O 错误和取消会停止后续提交。结果报告实际已完成和未完成目标，并保留原始错误。部分完成是失败，不提供回滚、续跑令牌或进程退出后的继续执行。后续调用重新读取规范文件，形成新的完整计划。

## GC

生命周期操作使用[最小清理清单](./data-model.zh.md#最小清理清单)。异常退出后，GC 只能删除能够证明属于已结束进程的临时内容，不修改规范 Skill 根目录或用户配置，也不完成安装或卸载。
