# ADR 决定：分发可选择的 tk Harness 组件

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [分发 tk 运行时与 Harness 组件](../archived/2026-08-28-distribute-tk-runtime-components.zh.md)
Archived: 2026-09-03
Reversed by: [分发 Harness 组件与自定义根目录 CLI Skill](../decision/2026-09-03-distribute-custom-cli-skills.zh.md)

[English](./2026-09-02-distribute-selectable-tk-harness-components.md) | 中文

## 动机

运行时安装和 Harness 集成分别负责不同内容。组件安装必须保持确定、离线、可检查和可撤销，并且不增加第二个安装数据库。

每个 Harness 现在需要选择 tools 或 CLI 模式，以及英文或中文 Skill。打包与生命周期必须把这两个维度作为一项明确的组件选择处理。

## 决定

Linux 运行时仍是位于 `$HOME/.local/bin/tk`、具有 Unix 执行位的一份常规可执行文件。Harness 组件验证并启动它，但不安装、更新、删除、包装或复制它。

`projects/tk/build.rs` 是唯一组件组装器。Cargo 生成一个确定性 `tar.zst` 和一份包含多份载荷的清单。这些载荷覆盖四个 Harness、两种模式和两种语言。运行时版本在清单顶层只记录一次。每个组件项记录 Harness、模式、语言、Skill 身份、`runtime_compat`、载荷路径、文件类型、Unix 权限和摘要。`source_revision` 标识整份 bundle 的来源。可执行文件内嵌归档与清单。

tools 载荷包含 `tk` 或 `tk-zh`，以及所选 Harness 集成。CLI 载荷包含 `tk-cli` 或 `tk-cli-zh`，并省略 MCP 配置或原生操作 extension。组件不包含运行时副本、其他 Harness 文件、评审记录或产品源码。

公开生命周期为：

```text
tk install --harness <codex|claude|pi|omp>
  [--mode <tools|cli>] [--language <en|zh>] [--dry-run]
tk uninstall --harness <codex|claude|pi|omp> [--dry-run]
```

模式默认 `tools`，语言默认 `en`。install 和 dry-run 报告最终 Harness、模式、语言和 Skill。选择发生变化时直接更新当前组件，并删除新选择所取代的已知 Skill 目标。uninstall 只接受 Harness，删除当前选择和已知的残留 tk variant，并保留无关内容。

生命周期只读取固定目标、已知 tk Skill 目标、tk 注册状态和内嵌字节，不维护所有权清单、安装历史、旧内容数据库或部分卸载状态。dry-run 和执行共享完整预检。操作先暂存内容，再重新验证，按确定顺序提交，错误或取消时停止，并报告完成和未完成项，不自动回滚。

持久写入前，归档验证拒绝不受支持的格式、不兼容运行时范围、逃逸路径、symlink、特殊文件、重复项、缺失或多余项、元数据不匹配和摘要不匹配。安装不使用网络、`curl`、源码检出或本地归档来源。

当前生命周期合同见[安装](../../../projects/tk/docs/design/installation.zh.md)和[用户指南](../../../projects/tk/docs/guide.zh.md)。

## 考虑过的替代方案

无

## 结果

运行时携带多份载荷，因此新增组件会增加可执行文件体积和发布验证工作。更新任一载荷都需要重新构建并分发运行时。

目标与注册符合所选载荷时，install 收敛为 `no_change`。干净卸载会删除 tk 专用目标中的修改和额外文件，包括全部已知 tk Skill variant 目标，同时保留无关共享内容。
