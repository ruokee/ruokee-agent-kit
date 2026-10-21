# tk 分发

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [tk 分发](../../../archived/2026/08/28-r3-tk-distribution.zh.md)

[English](./28-tk-distribution.md) | 中文

## 动机

用同一个内嵌 bundle 分发 tk 的 Harness tools 组件与不依赖 Harness 的 CLI Skill，安装、更新与卸载共用一条路径。

组件安装必须保持确定、离线、可检查和可撤销，并且不增加第二个安装数据库。运行时安装和 Harness 集成分别负责不同内容。

`tk-cli` 与 `tk-cli-zh` Skill 只使用公开 `tk` 可执行文件。用户需要把它们安装到项目级或其他 Harness 的 Skill 目录，该目录不属于四个已支持的 Harness 集成。

## 决定

### 运行时 bundle

Linux 运行时仍是位于 `$HOME/.local/bin/tk`、具有 Unix 执行位的一份常规可执行文件。Harness 组件和直接安装的 CLI Skill 会验证它，但不安装、更新、删除、包装或复制它。

`projects/tk/build.rs` 是唯一 bundle 组装器。Cargo 生成一个确定性 `tar.zst` 和一份清单。`components` 集合包含四个 Harness 与两种语言的 tools 选择。独立的 `cli_skills` 集合包含 `en` 与 `zh` 两项与 Harness 无关的 `tk-cli` 和 `tk-cli-zh` 载荷。

每个 Harness 组件项记录 Harness、语言、Skill 身份、`runtime_compat`、载荷路径、文件类型、Unix 权限和摘要。每个 `cli_skills` 条目记录语言、Skill 身份、`runtime_compat`、载荷路径、文件类型、Unix 权限和摘要，不含 Harness 字段。清单在顶层只记录一次 runtime version 和 `source_revision`。组件格式版本 4 负责这套 schema。

tools 载荷包含 `tk` 或 `tk-zh`，以及所选 Harness 集成。与 Harness 无关的 CLI 载荷只包含所选自包含 Skill。运行时携带十份载荷。载荷不包含 runtime 副本、其他组件文件、评审记录、任务材料或产品源码。

### 公开生命周期

`tk install` 与 `tk uninstall` 的公开 synopsis、标志默认值与互斥规则、绝对根目录报告，以及归档与结果规则见 [CLI 参考](../../../../../projects/tk/docs/design/cli-reference.zh.md)；生命周期语义、目标布局、自定义根目录规则与操作计划见[安装设计](../../../../../projects/tk/docs/design/installation.zh.md)。

Harness cli 安装把 `tk-cli` 或 `tk-cli-zh` 写入 Harness 的用户级普通 Skill 根目录，不产生 Harness 注册。它移除该 Harness 的 tools 目标与已有 tk 注册，并移除另一个语言变体。注册移除失败时保留 tools 目标，并把移除列为未完成项。tools 安装移除两个 CLI Skill 目录。卸载移除 tools 目标、注册、两个 CLI Skill 目录与组件目录。

生命周期计划读取固定目标、已知 tk Skill 目标、tk 注册状态和内嵌字节。它不保存所有权清单、安装历史、先前内容数据库或部分卸载状态。dry-run 与执行共享完整预检。操作先暂存内容，再重验，按确定顺序提交，在错误或取消时停止，并报告完成与未完成项，不自动回滚。

归档验证在持久写入前拒绝不支持的格式、不兼容的运行时范围、逃逸路径、符号链接、特殊文件、重复项、缺失或多余条目、元数据不匹配和摘要不匹配。安装不使用网络、`curl`、检出目录或本地归档来源。

### Harness 所有权

tools 模式保留四个已支持 Harness 的官方组件生命周期。cli 模式安装普通 Skill，不调用该生命周期。自定义根目录操作不要求 Harness 可执行文件。tk 不保存根目录列表、所有权记录、安装历史或续跑状态。

## 考虑过的替代方案

无

## 结果

运行时携带十份载荷，因此载荷变更会增加可执行文件体积，并要求重新构建和分发 runtime。

Harness 可执行文件缺失时，cli 安装或卸载仍会写入或删除 Skill 目录，注册清理则作为未完成项保留。下一次在 Harness 命令可用时运行即可完成该清理。

已支持 Harness 的用户级集成保留现有的 tools 安装和真实加载验证。cli 安装只证明文件已放置；Harness 必须扫描普通 Skill 根目录后，Skill 才可用。

Skill 根目录输入错误时，可能替换或删除其中已有的 `tk-cli` 或 `tk-cli-zh` 目录。dry-run 和完整路径报告会显示计划边界；干净安装和卸载仍会有意把这两个名称完全匹配的子目录视为 tk 所有。
