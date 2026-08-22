# Agent Note: 添加 tk 持久项目工作能力

Status: proposed
Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

[English](./2026-08-21-add-tk-persistent-task-capability.md) | 中文

## 问题

`ruokee-agent-kit` 还没有一项能力，可以跨 Agent 会话和 Harness 保存项目工作的权威状态。对话会结束，上下文会压缩，模型也会切换。长期项目不能依赖某一段聊天始终可用。

这种状态也不能依靠 LLM 自行判断 ID、关系、生命周期转换、锁、路径或结构化更新。同一操作在任何受支持宿主上都必须得到相同的校验结果。

因此本仓库需要创建一项新的第一方能力。已有 Task 使用经验提供需求和失败证据，但本项目是在创建 `tk` 新功能，不是延续一个旧的公开 API。

## 提议

### 能力与领域

在 `plugins/tk/` 下添加 tk Plugin，并在 `omp/tk/` 下提供 OMP 原生安装包。两个路径使用同一份实现和同一份生成合同。

Task 是用户已经决定推进、范围有界，并且值得跨会话保存状态的一项项目工作。想法、backlog、快速回答、当前会话 todo、Agent 调度和通用项目管理都在这项能力之外。

命令、Package、Plugin 和工具 namespace 使用 `tk`。持久领域对象仍叫 Task，领域术语继续使用 Task ID 和 `TASK.md`。短名称可以避开 OMP `task` 子 Agent 工具的冲突，又不会把 Task 重新解释成其他概念的缩写。

### Core 与职责分工

实现一份确定性的 Rust Core。它负责发现、身份、关系与生命周期不变量、锁、路径、受管理元数据、WAL 格式和结构化错误。tk Skill 负责确认、恢复、日志、分配边界和关闭意图等语义使用规则。宿主 adapter 只转换注册与传输。

Rust 是本仓库的初始实现。直接导入旧 Python 与 Nuitka 实现，会把缓慢且依赖缓存的 standalone 构建，以及一个本项目无需支持、还会产生维护负担的实现带进来。Python 行为可以作为 fixture 依据，但 `ruokee-agent-kit` 不发布并行的 Python/Rust Core，也不提供旧 `task_*` 别名。

其他领域 Skill 可以在用户意图允许持久化后创建或关联 Task，并使用相同公开合同。tk 不为每个 Skill 增加专用命令、回调或工作流语言。

### 元数据与文件

每个 Task 目录必须包含 `tk.toml` 和 `TASK.md`。`tk.toml` 是 tk 管理的结构化状态，`TASK.md` 是人和 Agent 维护的必需纯 Markdown 入口。WAL 和普通文件保存按时间排列的活动和详细工作产物。

`tk_create` 初始化受管理文件。`tk_update` 只修改受支持元数据和最多一次生命周期动作，不接受正文或通用 Markdown patch 字段。`TASK.md` 和普通材料由宿主文件工具编辑。

当前元数据是权威来源。不通过重放 WAL 重建当前状态，也不让 Core 盘点普通项目材料或为它们强加统一 schema。

### 搜索与修改

提供 `tk_search(query)`，按 ID、名称、目录名、路径和受支持元数据过滤条件返回排序后的候选。搜索结果不能通过模糊匹配授权修改。修改工具必须接收精确引用。

首版不提供全文检索、向量检索、嵌入流程、查询 DSL、索引 daemon 或隐式 current Task。

### 分发与验证

所有宿主 schema 从 Core 合同生成。Package、wrapper、runtime、生成 schema 和 Skill 必须报告相同版本与 protocol。

验证 Codex、Claude Code、Pi 和 OMP 的真实安装入口。每个安装路径都必须执行 `search`、`read`、`create`、`update`、`log` 和受限 `exec`。Batch subtask 创建同时覆盖合法 tagged-union 输入和原子拒绝的非法输入。直接调用缓存 runtime 不能证明发布的宿主 Package 可用。

## 考虑过的替代方案

**原样导入旧 Python Plugin。**这样可以更快得到代码，但也会把缓慢 standalone 构建、混合文件所有权、旧命名和兼容责任变成本项目的新合同。

**把 tk 实现为纯 Skill。**Skill 可以指导语义使用，却无法跨宿主强制身份、生命周期、关系、锁或原子结构化更新。

**为每个宿主实现一套 Core。**宿主专用 Core 和 schema 会发生漂移。Adapter 必须消费同一份合同。

**把元数据保留在 `TASK.md` frontmatter。**Core 和人会重写同一文件，元数据更新可能改动用户 Markdown。

**让 `TASK.md` 可选。**只有元数据的 Task 会失去稳定的人类恢复入口，并让每种读取流程增加分支。

**继续使用 `task` 公开 namespace。**它会与普通任务概念和 OMP 子 Agent 派发工具冲突。

**首版加入全文或向量检索。**当前只需要元数据与路径候选搜索，没有建立索引系统的真实需求。

**只验证 Core。**过去 wrapper、runtime 和生成 schema 的漂移表明，源码测试通过时，已安装宿主调用仍可能失败。

## 验收标准

1. `plugins/tk/` 与 `omp/tk/` 使用一份 Rust Core 和生成合同。
2. 每个 Task 都有稳定身份、权威 `tk.toml`、必需纯 Markdown `TASK.md` 和持久 WAL 活动。
3. Core、Skill、adapter 和领域 Skill 的职责相互独立。
4. tk 不暴露 `TASK.md` 正文编辑参数，元数据更新不会重写该文件。
5. `tk_search` 定义候选来源、过滤、排序、歧义和截断，修改仍要求精确引用。
6. 首次发布不包含 Python Core 兼容路径或 `task_*` 宿主别名。
7. Package、wrapper、runtime、schema 和 Skill 的版本与 protocol 一致。
8. Codex、Claude Code、Pi 和 OMP 的实际安装包完成端到端冒烟验证，包括 batch 的原子拒绝场景。
9. 功能不扩张为 todo 管理、Agent 编排、Issue 管理、工作流执行或知识索引。

## 风险

`tk` 很短，自解释性较低，也容易与 Tcl/Tk 混淆。带 scope 的 Package 名、README 首句、Skill description 和 `tk --help` 必须说明它管理持久项目工作。

分离元数据与 Markdown 后，每个 Task 会多一个必需文件。更简单的所有权规则值得这项成本，但工具必须明确报告文件缺失或冲突，不能自行猜测。

单一 Core 不能阻止陈旧 wrapper 被打包。发布检查必须执行真实安装包，并比较各组件报告的合同版本。

`tk.toml` 的精确 schema 属于 Rust 合同类型，不能让本 Note 变成第二份字段级 schema。
