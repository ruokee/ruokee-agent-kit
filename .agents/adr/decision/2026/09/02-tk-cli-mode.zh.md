# tk CLI 模式

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [tk CLI 模式](../../../archived/2026/09/02-r1-tk-cli-mode.zh.md)

[English](./02-tk-cli-mode.md) | 中文

## 动机

以 `tk-cli` 与 `tk-cli-zh` Skill 提供 tk 的纯 CLI 形态。

这些 Skill 通过公开 `tk` CLI 执行全部 Task 操作。tk 将 Task 进度、共识和支撑材料保存在普通项目文件中。

同时教授逻辑操作与公开 CLI 的 Skill 会让 Agent 对同一项 Task 操作保留两条路线，路线选择可能受先前调用影响，而不是依据已安装的集成合同。

部分安装还需要 Task 指引，但不希望注册操作或适配器上下文。独立的 Skill 身份可以避免在 tools Skill 里写条件分支。

## 决定

tk 通过自包含的 `tk-cli` 与 `tk-cli-zh` Skill 提供纯 CLI 模式。这些 Skill 中的每项 Task 操作都使用公开 `tk` CLI。

纯 CLI Skill 内容不含逻辑操作名称、发现说明、路线比较、工具失败处理、回退行为，也不假设其他入口不存在。每个 Skill 包含自身语言所需的完整当前 CLI 指引。

Harness cli 安装把 `tk-cli` 或 `tk-cli-zh` 写入该 Harness 的用户级普通 Skill 根目录：

- Codex 使用 `$CODEX_HOME/skills`，未设置时为 `~/.codex/skills`。
- Claude Code 使用 `~/.claude/skills`。
- Pi 使用 `~/.pi/agent/skills`。
- OMP 使用 `~/.omp/agent/skills`。

安装不产生 Harness 注册，也不安装原生 manifest。它移除该 Harness 的 tools 目标与已有 tk 注册，并移除同一根目录下的另一个语言变体。注册移除失败时保留 tools 目标，并把移除列为未完成项。tools 安装移除同一根目录下的两个 CLI Skill 目录，因此一个 Harness 只保留一个 tk 选择。

`--mode cli --skill-root <dir>` 仍只写 `<dir>/tk-cli` 或 `<dir>/tk-cli-zh`，不触碰 Harness 目标或注册。固定 `$HOME/.local/bin/tk` 可执行文件仍是外部前置条件。

[Skill 语言选择](./02-tk-language.zh.md)负责两个语言身份。[Harness 组件与自定义根目录 CLI Skill 分发](../08/28-tk-distribution.zh.md)负责安装与打包。

## 考虑过的替代方案

无

## 结果

纯 CLI 安装携带更少集成内容，也不向 Agent 会话添加 tk 操作 schema。Agent 需要自行选择 CLI 子命令和选项，Harness 无法在调用边界约束请求结构。

普通 Skill 发现取决于 Harness 版本与其用户级 Skill 根目录。Harness 不扫描已安装目录时，即使文件存在也不会加载该 Skill。
