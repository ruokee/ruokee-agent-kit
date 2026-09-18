# ADR 决定：集成 tk 与 Harness

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Archived: 2026-09-02
Reversed by: [集成 tk 工具与 Harness](../decision/2026-09-02-integrate-tk-tools-with-harnesses.zh.md)

[English](./2026-08-28-integrate-tk-with-harnesses.md) | 中文

## 动机

[tk 产品架构](../decision/2026-08-21-define-tk-product-architecture.zh.md)支持 Codex、Claude Code、Pi 和 OMP，同时不把 Task 语义移入 Harness 专用代码。这些 Harness 使用不同的组件、MCP、extension、Package、工具注册和加载接口，但仍需要共享一套逻辑工具、请求和结果合同。

集成失败不能终止所在的 Agent 会话。适配器也必须在暴露工具前拒绝不兼容运行时或不完整 schema，避免注册无法履行公开合同的工具。

## 决定

### 逻辑工具与 schema

tk 定义六个与传输无关的逻辑工具：search、read、create、update、log 和 exec。

MCP 在 `tk` 命名空间中暴露 `search`、`read`、`create`、`update`、`log` 和 `exec`。Pi 和 OMP 注册 `tk_search`、`tk_read`、`tk_create`、`tk_update`、`tk_log` 和 `tk_exec`。

Rust 从同一组请求类型生成 MCP 和原生 JSON schema。Harness 不增加请求字段、不修改默认值、不展开 schema 结构，也不重复实现领域验证。exec 只接受 `--version`、`init`、`check` 和 `rename`。只有 update、log 和 exec rename 接受 actor。

所有工具都返回运行时统一 JSON 结果。适配器把进程启动失败、进程被终止、输出损坏、输出超限和解码失败与领域错误分开处理。

### Harness 形式

Codex 使用英文 Skill，以及启动固定 `tk mcp` 运行时的 MCP 注册。这些安装内容共同组成一个 Codex 组件，不需要外部 Codex Plugin。

Claude Code 使用包含英文 Skill 和固定运行时 MCP 配置的自包含 Plugin，并遵守官方 Plugin 生命周期。

Pi 使用包含英文 Skill 和原生 extension 的自包含 Package。extension 注册六个原生工具，不设置 `loadMode`。

OMP 使用单独的自包含 Package，其中包含英文 Skill 和原生 extension。read、create、update 和 log 标记为 essential，search 和 exec 标记为 discoverable。OMP 把取消信号传给运行时。

Pi 和 OMP 可以由用户另行配置 MCP，但它们的 tk Package 只安装和管理原生集成。

### 适配器加载

注册第一个原生工具前，适配器完成以下验证：

1. `$HOME/.local/bin/tk` 存在，是常规文件，并具有 Unix 执行位；
2. 版本 JSON 合法；
3. Rust 判断运行时与组件范围兼容；
4. 生成的原生 schema 对当前 Harness 合法；
5. 六个工具的名称、描述、请求 schema 和 Harness 专用字段全部存在。

预检失败时不注册任何工具。extension 入口捕获失败，输出一条长度受限的诊断，然后返回，不终止 Harness 会话。

如果 Harness API 在接受前面若干工具后拒绝某次 `registerTool` 调用，适配器停止后续注册并报告错误。已经被接受的前缀按 Harness API 行为保留。适配器不承诺回滚。

### 工具调用

每次原生工具调用依次从显式请求、Harness 会话目录和进程目录选择 cwd。只有会追加 WAL 的操作才选择 actor。适配器把逻辑请求映射为公开 CLI 参数，不经过 shell 直接启动 `tk`，并发读取有界 stdout 和 stderr，再解码统一结果。

适配器不实现 Task 解析、名称规范化、授权、路径解析、搜索排序、迁移、GC、安装或语义版本范围解析。这些规则由 Rust 负责。

权威集成细节见 [Harness 集成](../../../projects/tk/docs/design/harnesses.zh.md)和[工具 API](../../../projects/tk/docs/design/tool-api.zh.md)。Agent 行为由[英文 Skill](../../../projects/tk/skills/tk/SKILL.md) 定义，并提供完整的[中文替代版本](../../../projects/tk/skills/tk-zh/SKILL.md)。

## 考虑过的替代方案

**所有 Harness 组件都使用 MCP。** Pi 和 OMP 提供带会话上下文、取消和加载元数据的原生工具 API。忽略这些接口会让这些 Harness 的集成不够直接，同时仍然需要 Harness 专用安装配置。

**在每个适配器中手写 schema。** 手写副本会在字段、默认值、union、描述和工具名称上发生偏差。Rust 生成 schema 可以保持单一合同来源。

**在 TypeScript 适配器中实现 Task 规则。** 这会产生 Harness 专用行为，并在运行时之外重复兼容、验证和错误逻辑。

**通过 shell 启动运行时。** shell 调用会给固定可执行文件增加引用、命令解释和平台差异。

**tk 加载失败时终止 Harness。** tk 只是较大 Agent 会话中的一种可选能力。加载错误应使 tk 不可用并保持可见，而不是终止无关工作。

## 结果

Codex 和 Claude Code 使用 MCP，Pi 和 OMP 使用符合其公开 API 的原生工具。四个 Harness 仍然共享相同的逻辑请求、schema、领域规则和统一结果。

适配器保持轻量，但并非没有职责。它们必须执行运行时与 schema 兼容检查、资源限制、上下文映射、加载错误隔离和传输故障报告。

增加 Harness 需要提供自包含组件、生成或映射的 schema、生命周期支持、加载验证和隔离测试，不需要再实现一套 Task，也不改变 Harness 的定义。

Harness API 已经接受部分原生工具后，注册失败可能留下工具前缀。这是明确的 API 边界，不是事务保证。
