# tk 架构

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Reverses: [tk 架构](../../../archived/2026/08/21-r1-tk-architecture.zh.md)

[English](./21-tk-architecture.md) | 中文

## 动机

通过唯一 CLI 提供持久、以普通文件承载、位于项目本地的任务管理。

Agent 工作可能跨越对话、模型上下文或 Harness 会话。普通项目文件使目标、关系、材料、决定和活动独立于这些会话保留。唯一公开命令边界把任务语义集中在运行时，避免维护多套接入实现。

## 决定

### 产品定义

tk 是面向 Linux 本地项目的持久任务能力。任务是一项值得保留的项目内临时性努力，创建只记录该努力，不代表承诺执行或完成。

项目文件是唯一权威任务状态。tk 没有数据库、全局任务注册表、后台索引、远程服务或常驻守护进程，也不提供优先级、调度、收件箱、看板、Issue 镜像、Agent 协调、工作流执行或会话绑定。

### 系统职责

`projects/tk/` 下一个 Cargo package 构建名为 `tk` 的可执行文件。Rust 负责任务领域规则、持久化、发现、schema 迁移、维护、CLI 输出和 Skill 生命周期。每个命令执行后退出，每次调用重新读取规范状态。

`projects/tk/` 是运行时、Skill、检查和公开文档的唯一维护源码区域，不维护第二份源码树、兼容目录、源码别名、symlink、重新导出或提交到 Git 的生成组件树。

两个自包含 Skill `tk-cli` 和 `tk-cli-zh` 分别提供英文和中文 Agent 指导，只使用公开 CLI。源码树和安装载荷各自包含自身全部参考资料。公开文档描述当前合同，ADR 保留长期选择及理由。

### Harness 边界

Harness 负责模型循环、提示、上下文、权限、hooks、Skill 加载和命令执行，任务规则留在 Rust。Codex、Claude Code、Pi 和 OMP 具有已知普通 Skill 根目录，也可以显式选择其他适用根目录。

固定 Linux 运行时为 `$HOME/.local/bin/tk`。Skill 生命周期不安装、更新、复制、包装或删除它。安装只拥有所选根目录下的两个 CLI Skill 子项，不检查或修改 Harness 配置。

### 决定归属

详细合同分别由[任务数据](./28-tk-data.zh.md)、[运行时](./28-tk-runtime.zh.md)、[CLI 接入](../09/02-tk-cli-mode.zh.md)、[Skill 语言](../09/02-tk-language.zh.md)、[Harness 集成](./28-tk-harness.zh.md)、[分发](./28-tk-distribution.zh.md)和[文档](./29-tk-documentation.zh.md)负责。

## 考虑过的替代方案

无

## 结果

任务不依赖创建它的 Harness 也能读取和维护。CLI 是人、脚本和 Agent 共用的行为及故障边界。

按需发现避免永久索引，但会重复有界扫描。工作流、优先级、Agent 调度和远程协作继续由其他系统负责。
