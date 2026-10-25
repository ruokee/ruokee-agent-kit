# 术语表

[English](./GLOSSARY.md)

本术语表只保留 tk 中有特殊含义、需要固定大小写或容易混淆的词。普通技术词和只属于一个实现章节的细节留在对应设计文档中。

## 产品

- Task：中文形式 `任务`。值得持久保存的项目内临时性努力，创建任务不代表用户或 Agent 已承诺执行或完成。
- Harness：中文形式 `Harness`。围绕模型、使模型能够作为 Agent 运行的软件环境，包括循环、提示、上下文、工具、权限和 hooks。
- Skill：中文形式 `Skill`。Harness 可发现的 Agent 行为说明和参考材料。
- component：中文形式 `组件`。tk 的自包含分发单元。
- payload：中文形式 `载荷`。组件归档内要安装的自包含文件集合。
- runtime：中文形式 `运行时`。固定用户级 `tk` 可执行文件及其 Rust 行为。

## CLI 合同

- exact resolution：中文形式 `精确解析`。不使用搜索排名，把完整引用解析为恰好一个任务。
- actor：中文形式 `发起者`。WAL 的调用归因信息，不表示身份、授权或任务分配。
- result envelope：中文形式 `统一结果`。包含 `ok`、`data`、`warnings` 或 `error` 的结构化结果。
- error code：中文形式 `错误码`。用于机器分支的稳定 `code` 值。

## 任务数据

- Task root：中文形式 `任务根目录`。一个项目内保存顶层任务树的配置路径。
- metadata mode：中文形式 `元数据模式`。项目统一选择的 `split` 或 `embed`。
- metadata representation：中文形式 `元数据表示`。元数据在 split `tk.toml` 或 embed frontmatter 中的物理表达。
- metadata carrier：中文形式 `元数据载体`。保存任务元数据的受管 `tk.toml` 或 embed `TASK.md`。
- frontmatter：中文形式 `frontmatter`。embed `TASK.md` 开头的受限 YAML 元数据块。
- managed file：中文形式 `受管文件`。tk 对格式和变更规则具有规范权的项目文件。
- material：中文形式 `材料`。支持任务的普通文件，不由运行时建立索引。
- lifecycle：中文形式 `生命周期`。planning、open 和 closed 的含义及转换规则。
- relation：中文形式 `关系`。`depends_on` 或 `related_to`。
- WAL：中文形式 `WAL`。按日保存的普通、仅追加 Markdown 活动记录。
- schema migration：中文形式 `schema 迁移`。从一个正式发布的元数据版本逐级向前转换。
- representation switch：中文形式 `表示切换`。在整个项目范围内转换 split 和 embed。
- rename：中文形式 `重命名`。修改任务自身名称、目录和元数据，并报告外部引用。

## 操作

- atomic replacement：中文形式 `原子替换`。用完整临时文件替换单个规范文件，不暴露部分内容。
- partial commit：中文形式 `部分提交`。多目标操作发生错误时，部分目标已经完成的事实。
- cleanup manifest：中文形式 `清理清单`。只记录格式版本、操作进程身份、创建时间和 tk 临时路径的最小清单。
- activity marker：中文形式 `活动操作标记`。多目标项目写入期间阻止其他写操作的进程标记。
- garbage collection：中文形式 `GC`。识别并删除 tk 临时内容和操作进程退出后留下的活动操作标记的维护操作。
- runtime compatibility：中文形式 `运行时兼容范围`。组件声明并由 Rust 判断的 `runtime_compat`。
- clean uninstall：中文形式 `干净卸载`。从所选根目录完整删除两种 CLI Skill，保留根目录和全部无关内容。

## 材料

- Records：中文形式 `记录`。保存有实质活动的本地日期所对应背景、动作、证据和结论的可选材料模式。
- Deep research：中文形式 `深度调研`。保存来源、关键主张的证据、冲突、结论边界和未解决问题的可选材料模式。
- Iterative design：中文形式 `迭代设计`。让每轮大幅改版自包含、只把当前版本作为入口的可选材料模式。
- Scratchpad：中文形式 `草稿纸`。保存仍需留存、尚未整理定稿的临时普通材料的可选材料模式。

## 固定中文形式

- managed：受管
- scratchpad：草稿纸
- human-readable：人类可读
- clean cutover：直接切换
- supported subcommands：支持的子命令
- review：按语境使用“审查”或“评审”
