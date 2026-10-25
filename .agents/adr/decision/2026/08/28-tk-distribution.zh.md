# tk 分发

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [tk 分发](../../../archived/2026/08/28-r4-tk-distribution.zh.md)

[English](./28-tk-distribution.md) | 中文

## 动机

用一个确定性的内嵌 bundle 分发两个自包含 CLI Skill。

离线安装不需要检出目录或安装数据库。同一受限文件操作可以处理已知 Harness 根目录、项目级根目录和其他显式选择的 Skill 目录。

## 决定

### 运行时 bundle

Linux 运行时是 `$HOME/.local/bin/tk` 下具有 Unix 执行位的常规可执行文件。Skill 生命周期验证该前提，但不安装、更新、删除、包装或复制运行时。

Rust 将完整的 `tk-cli` 和 `tk-cli-zh` 源码树组装为确定性内嵌产物。各载荷仅包含自身自包含 Skill，不含 Harness 身份、运行时副本、其他组件文件、产品源码、审查记录或任务材料。源码和安装后引用都在同一 Skill 内解析。

组件格式 `5` 记录运行时兼容范围、语言和 Skill 身份、允许的载荷路径、文件类型、Unix 权限及内容摘要。运行时版本和来源修订描述整个分发，[清单定义](../../../../../projects/tk/docs/design/installation.zh.md#清单)负责字段布局。安装只使用内嵌字节，不联网，不使用检出目录或本地归档输入。

### 公开生命周期

`tk install` 和 `tk uninstall` 必须且只能选择 `--harness` 或 `--skill-root`。Harness 只映射普通 Skill 根目录，自定义相对根目录按进程 cwd 解析。安装默认英文，组件操作拒绝全局 `--cwd`。

两种目标只拥有所选根目录的直接子项 `tk-cli` 和 `tk-cli-zh`。安装先写入完整所选 Skill，再删除另一种语言。所选目标内的内容偏差和额外内容都被替换，内容相同时返回 `no_change`。卸载完整删除两个目标，包括修改和额外内容。两种操作保留根目录和全部其他内容，安装可以创建缺失的父目录。

规划只读取固定运行时、受管目标和内嵌分发，不读取 Harness 配置或调用 Harness 命令，不记录根目录列表、所有权数据库、安装历史、先前内容或续跑状态。任务项目发现、Git 策略和 WAL 不属于 Skill 生命周期。

dry-run 与执行共享完整预检。不支持的格式、不兼容运行时范围、路径逃逸、符号链接、特殊文件、归档条目重复或缺失或多余、元数据及摘要不匹配都在持久写入前失败。执行先暂存内容、重新验证目标，再按确定顺序提交。错误或取消时停止，报告已完成项、未完成项及原始错误，不自动回滚或产生续跑状态。

GC 只能删除可证明属于已结束进程的临时内容，不修改规范 Skill 目录或完成生命周期操作。

### 合同归属

[分发规格](../../../../spec/tk-distribution.zh.md)和[接口规格](../../../../spec/tk-interface.zh.md)完整规定行为、选择、默认值、失败、兼容及验收。[CLI 参考](../../../../../projects/tk/docs/design/cli-reference.zh.md)独立说明用法，[安装设计](../../../../../projects/tk/docs/design/installation.zh.md)解释实现和规划，两者都不替代规格要求。

## 考虑过的替代方案

无

## 结果

载荷变更要求重新构建和分发可执行文件。安装不需要宿主可执行文件，实际 Skill 发现仍由 Harness 负责。

错误根目录可能导致已有 `tk-cli` 或 `tk-cli-zh` 被替换或删除。dry-run 和完整路径报告显示操作边界，但完整替换及卸载仍有意把这两个精确名称的子项视为自有目标。
