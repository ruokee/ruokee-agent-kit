# ADR 决定：新增 tk 纯 CLI 模式

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol, Ruokee

[English](./2026-09-02-add-tk-cli-only-mode.md) | 中文

## 动机

同一份 Skill 同时教授逻辑操作和公开 CLI 时，Agent 可以用两条合法路径完成同一项 Task 操作。后续选择可能跟随先前调用，而不是当前安装的集成合同。

部分安装还需要 Task 指导，但不需要操作注册或适配器上下文。这个需求应由独立 Skill 身份表达，而不是在 tools Skill 中加入条件化说明。

## 决定

tk 通过自包含的 `tk-cli` 和 `tk-cli-zh` Skill 提供纯 CLI 模式。这两份 Skill 的所有 Task 操作都使用公开 `tk` CLI。

纯 CLI Skill 正文不包含逻辑操作名称、发现说明、入口比较、工具失败处理、回退行为，也不假定另一种入口不存在。每份 Skill 都包含本语言使用所需的完整现行 CLI 指导。

纯 CLI Harness 组件安装所选 CLI Skill。Claude Code、Pi 和 OMP 还会安装加载该 Skill 所需的原生 manifest；Codex 不需要 manifest。纯 CLI 组件不安装 MCP 配置、原生工具 extension 或 tk 操作注册。固定 `$HOME/.local/bin/tk` 可执行文件仍是外部前置条件。

[Skill 语言选择](./2026-09-02-select-tk-skill-language.zh.md)负责两个语言身份。[可选择组件分发](./2026-09-02-distribute-selectable-tk-harness-components.zh.md)负责安装与打包。

## 考虑过的替代方案

**保留一份混合 Skill 并加强入口规则。** Agent 仍会加载两套执行方式，并为已有专用操作考虑两条路径。

**不新增 Skill，只从 tools 模式删除直接 CLI 指导。** 需要纯 CLI 操作的用户将得不到完整、可安装的 Skill。

**在纯 CLI 模式中声明工具不可用。** Skill 不需要这个假设，只需定义自身使用的入口。

## 结果

纯 CLI 安装包含的集成内容更少，也不会向 Agent 会话加入 tk 操作 schema。Agent 需要自行选择 CLI 子命令和选项，Harness 无法在调用入口约束请求结构。

纯 CLI Skill 必须与公开 CLI 合同保持同步，并始终不含集成专用的路由表述。
