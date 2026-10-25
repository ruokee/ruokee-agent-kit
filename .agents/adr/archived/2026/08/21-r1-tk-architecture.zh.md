# tk 架构

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Archived: 2026-10-25
Reversed by: [tk 架构](../../../decision/2026/08/21-tk-architecture.zh.md)

[English](./21-r1-tk-architecture.md) | 中文

## 动机

把 tk 定义为持久、以普通文件承载、位于项目本地的 Agent 工作记录。

Agent 工作可能跨越多次对话、模型上下文或 Harness 会话，因此 tk 需要一份持久记录，保存当前目标、关系、材料、决定和工作历史。对话历史、分支、Issues、待办列表和 Harness 状态都无法提供一种可在 Codex、Claude Code、Pi、OMP 和直接 CLI 使用之间延续的统一表示。

这份记录必须以普通文件形式保持可检查。它不能把仓库变成工作流服务、Agent 编排器、全局任务数据库或会话存储。

## 决定

### 产品定义

tk 是一种面向 Linux 本地项目的持久任务能力。任务是一项值得持久保存的项目内临时性努力。创建任务会记录这项工作，但不代表已经承诺执行或完成它。

项目文件是唯一权威的任务状态。tk 不使用数据库、全局任务注册表、后台索引、远程服务或常驻守护进程，也不提供优先级、调度、收件箱、看板、Issue 镜像、Agent 协调、工作流执行或会话绑定。

### 系统职责

`projects/tk/` 下的一个 Cargo package 构建一个名为 `tk` 的可执行文件。Rust 运行时负责任务领域规则、持久化、项目发现、迁移、维护、CLI、stdio MCP、工具合同生成和 Harness 组件生命周期。

`projects/tk/` 是运行时、Harness 源码、适配器测试、Skill 和公开 tk 文档的唯一维护源码区域。仓库不保留第二份 tk 源码树、兼容目录、源码别名、symlink、重新导出或提交到 Git 的生成组件树。

Harness 负责模型循环、提示、上下文、权限、hooks、Skill 加载和工具展示。Harness 组件负责注册工具和配置，但不重复实现任务验证或存储规则。

四个自包含 Skill 分别定义 tools 或 CLI 模式下使用英文或中文时的 Agent 行为。公开文档记录当前产品合同。ADR 保存长期决定及其理由。

### Harness 边界

Harness 是围绕模型、使其能够作为 Agent 运行的软件环境。当前集成包括 Codex、Claude Code、Pi 和 OMP。增加其他 Harness 需要提供自包含组件和集成合同，但不改变产品定义。

所有任务接口都调用同一个公开可执行文件。短生命周期命令执行一次操作后退出。MCP 服务器只在一个 stdio 连接期间存在，不缓存项目状态。

当前平台合同是 Linux。运行时使用固定用户级路径 `$HOME/.local/bin/tk`。Harness 组件不会安装第二份运行时、包装器或私有可执行文件。

### 决定归属

以下 ADR 分别负责本架构中的详细合同：

- [任务数据模型](../../../decision/2026/08/28-tk-data.zh.md)；
- [运行时与 CLI](./28-r1-tk-runtime.zh.md)；
- [纯 CLI 模式](../09/02-r2-tk-cli-mode.zh.md)；
- [Skill 语言选择](../09/02-r1-tk-language.zh.md)；
- [Harness 工具集成](./28-r3-tk-harness.zh.md)；
- [Harness 组件与自定义根目录 CLI Skill 分发](./28-r4-tk-distribution.zh.md)；
- [文档与使用模式](./29-r5-tk-documentation.zh.md)。

## 考虑过的替代方案

无

## 结果

任务不依赖创建它的 Harness 也能读取和维护。CLI、MCP、Pi 和 OMP 都调用同一个可执行文件，因此共享一套领域规则。

文件模型使用按需发现和有界扫描，不维护永久索引。工作流、优先级、Agent 调度和远程协作继续由其他系统负责。

运行时是所有接口共同的故障边界。可执行文件中的缺陷可能影响全部接口，而 Harness 适配器缺陷只影响对应集成。新增集成必须保持这一职责划分，不能把任务语义移入 Harness 专用代码。
