# tk Harness 集成

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [tk Harness 集成](../../../archived/2026/08/28-r2-tk-harness.zh.md)
Archived: 2026-10-25
Reversed by: [tk Harness 集成](../../../decision/2026/08/28-tk-harness.zh.md)

[English](./28-r3-tk-harness.md) | 中文

## 动机

通过各 Harness 的组件 API 暴露六个与传输无关的 tk 操作，由运行时负责请求 schema 完整性，适配器校验注册合同。

Codex、Claude Code、Pi 和 OMP 使用不同的注册与加载 API，但需要统一的逻辑操作合同。集成必须在注册前拒绝不兼容运行时，tk 加载失败时不能终止所在的 Agent 会话。

运行时已在 MCP 和 native 集成间共享手写 schema。要求从请求类型派生会增加 schema 生成依赖，却不改变公共行为。要求适配器校验每个请求字段，则会让它们保存第二份领域合同。保留共享声明，明确人工同步责任。

tools 模式需要为已覆盖任务操作确定唯一入口。逻辑操作被拒绝或失败后直接通过 CLI 重试会绕过所选集成，也可能用不同传输行为重复写请求。

## 决定

tk 定义六项与传输无关的逻辑操作：search、read、create、update、log 和 exec。MCP 在 `tk` 命名空间暴露这些操作。Pi 和 OMP 注册 `tk_search`、`tk_read`、`tk_create`、`tk_update`、`tk_log` 和 `tk_exec`。

Rust 运行时拥有一组由 MCP 和 native 集成共享的手写请求 schema。维护者使其中的字段、必填输入、默认值和联合类型与请求类型同步，schema 不从这些类型派生。Harness 适配器只处理上下文与传输映射，不重复任务验证、存储规则、搜索排序、迁移、安装或语义版本范围解析。

`tk` 和 `tk-zh` tools Skill 对已覆盖请求使用逻辑 search、read、create、update 和 log。逻辑操作缺失、拒绝请求或执行失败时，Agent 报告集成或传输故障，不通过直接 CLI 重试。exec 保持受控的公开 CLI 代理，只支持 version、init、check 和 rename。

Codex 和 Claude Code 使用 MCP。Pi 和 OMP 使用原生 extension。Pi 不设置 `loadMode`。OMP 把 search、read、create、update 和 log 标记为 `essential`，exec 为 `discoverable`。Pi 和 OMP 不经过 shell，直接启动固定运行时。OMP 把取消信号传给运行时。

原生注册前，适配器验证固定可执行文件、version 输出、运行时兼容范围、native contract 封套、全部六项工具名称和描述、每个请求 schema 以对象形式存在，以及宿主专用字段。运行时负责 schema 内部完整性，适配器不逐项检查属性或联合分支。空 properties 对象可以通过适配器预检。

预检失败时注册数为零。后续 `registerTool` 失败会停止注册，并可能保留 Harness API 已经接受的前缀。适配器只输出一条有界诊断，不终止 Harness 会话。

当时公开合同由 `projects/tk/docs/design/harnesses.zh.md`、`projects/tk/docs/design/tool-api.zh.md` 和 `projects/tk/skills/tk-zh/SKILL.md` 说明。其六项操作、路由、schema 和注册边界保留在上文。完整 tk 规格集合表达必要行为和验收。组件参考与已安装 Skill 保持独立可用，表达相同合同，设计解释实现。

## 考虑过的替代方案

- 从请求类型派生 schema。可以减少人工重复，但会增加生成依赖和映射工作。共享手写声明无需该机制即可保留现有运行时边界。
- 适配器逐字段校验请求。可以在注册前拒绝内部不完整的 schema，但会在每个消费者中复制领域合同，因此将完整性责任留给生产者。

## 结果

所有 tools 模式 Harness 共享请求、schema、领域规则和统一结果。适配器保留兼容检查、资源限制、上下文映射、取消、加载隔离和传输故障报告。

维护者若只更新请求类型或手写 schema 一方，两者就可能偏离。运行时维护必须同时检查两者，适配器预检不会发现全部内部 schema 遗漏。

原生注册失败可能留下已经接受的工具前缀。这是 Harness API 边界，不是事务保证。
