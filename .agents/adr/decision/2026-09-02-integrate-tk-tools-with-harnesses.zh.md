# ADR 决定：集成 tk 工具与 Harness

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [集成 tk 与 Harness](../archived/2026-08-28-integrate-tk-with-harnesses.zh.md)

[English](./2026-09-02-integrate-tk-tools-with-harnesses.md) | 中文

## 动机

Codex、Claude Code、Pi 和 OMP 使用不同的注册与加载 API，但需要共享一套逻辑操作合同。集成必须在注册前拒绝不兼容运行时，也不能在 tk 加载失败时终止所在的 Agent 会话。

tools 模式还需要为已覆盖的 Task 操作确定唯一入口。逻辑操作被拒绝或失败后直接通过 CLI 重试会绕过所选集成，也可能用不同传输行为重复写请求。

## 决定

tk 定义六项与传输无关的逻辑操作：search、read、create、update、log 和 exec。MCP 在 `tk` 命名空间暴露这些操作。Pi 和 OMP 注册 `tk_search`、`tk_read`、`tk_create`、`tk_update`、`tk_log` 和 `tk_exec`。

Rust 从同一组请求类型生成 MCP 和原生 JSON schema。Harness 适配器只处理上下文与传输映射，不重复 Task 验证、存储规则、搜索排序、迁移、安装或语义版本范围解析。

`tk` 和 `tk-zh` tools Skill 对已覆盖请求使用逻辑 search、read、create、update 和 log。逻辑操作缺失、拒绝请求或执行失败时，Agent 报告集成或传输故障，不通过直接 CLI 重试。exec 保持受控的公开 CLI 代理，只支持 version、init、check 和 rename。

Codex 和 Claude Code 使用 MCP。Pi 和 OMP 使用原生 extension。Pi 不设置 `loadMode`。OMP 把 search、read、create、update 和 log 标记为 `essential`，exec 为 `discoverable`。Pi 和 OMP 不经过 shell，直接启动固定运行时。OMP 把取消信号传给运行时。

原生注册前，适配器验证固定可执行文件、version 输出、Rust 兼容性结果、生成 schema 和全部六项操作。预检失败时注册数为零。后续 `registerTool` 失败会停止注册，并可能保留 Harness API 已经接受的前缀。适配器只输出一条有界诊断，不终止 Harness 会话。

当前合同见 [Harness 集成](../../../projects/tk/docs/design/harnesses.zh.md)、[工具 API](../../../projects/tk/docs/design/tool-api.zh.md) 和 [tools Skill](../../../projects/tk/skills/tk-zh/SKILL.md)。

## 考虑过的替代方案

**逻辑操作失败后通过 CLI 重试。** 这可能隐藏集成故障，并跨传输重复请求。

## 结果

所有 tools 模式 Harness 共享相同请求、schema、领域规则和统一结果。适配器保持轻量，但必须执行兼容检查、资源限制、上下文映射、取消、加载隔离和传输故障报告。

原生注册失败可能留下已经接受的工具前缀。这是 Harness API 边界，不是事务保证。
