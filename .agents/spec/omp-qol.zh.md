# omp-qol

[English](./omp-qol.md) | 中文

[projects/omp-qol](../../projects/omp-qol/README.zh.md) 的规格。

## 目标

- 在一个包里提供可分别开关的 OMP 调整。
- 这些调整共用一次安装、一个配置入口和一套检查，每项调整有各自的开关、可用状态和失败报告。
- 符合恢复条件的流提前关闭后，在同一主会话中自动继续未完成工作。
- 在宿主校验前从非 seance 任务项删除 seance 专用字段。
- 用一个固定快捷键复制最后一条 assistant 回复的文本。

## 非目标

- 外部工具的守卫，以及与这些调整无关的宿主行为。
- 替用户安装或迁移，或修改其他扩展、用户配置或已安装的宿主文件。
- 在等待入口上提供只含消息的续等、按进程名等待或只含服务的续等。
- 在 remote 切换中精简无关设置。
- 改变宿主轮次内的原生重试、宿主分类器、提供方选择或子代理恢复。
- 匹配服务端错误正文、新增恢复设置，或恢复所有错误。
- 工具恰好执行一次、回滚或幂等续跑。
- 复制选区、思考块、工具调用、工具输出或图片；`/copy` 命令、可配置快捷键或剪贴板历史。

## 公共面

- 调整项与默认值：[调整项](../../projects/omp-qol/README.zh.md#调整项)。
- 设置的键名、默认值和范围：[配置](../../projects/omp-qol/README.zh.md#配置)以及 `package.json` 中的 `omp.settings` manifest。
- `/qol` 状态命令：[状态](../../projects/omp-qol/README.zh.md#状态)。
- 各调整的行为、边界和验证：[projects/omp-qol/docs/adjustments.zh.md](../../projects/omp-qol/docs/adjustments.zh.md)。

### 错误恢复

恢复适用于以 assistant 错误结束的主会话运行，包括宿主原生重试已经结束而错误仍未恢复的情形。恢复以运行的结束原因为依据，成功结束无论正文包含什么都按正常流程处理。

总开关与恢复开关启用时，默认 `knownTransient` 模式必须在以下 assistant 错误后自动续跑，除非取消、任一续跑上限、安全排除项或终止性客户端状态阻止恢复：

```text
Error: Upstream provider closed the connection before the response completed: stream ended without terminal event or completed response
```

默认模式接受宿主分类为瞬时或超时的错误、宿主的 `stream_interrupted_after_content` 结束标记，以及既无 HTTP 状态也无分类结论的错误。无状态未分类错误不需要中断标记。较宽的 `unclassified` 模式在相同安全检查后接受瞬时、超时与全部未分类错误，不因中断标记获得额外范围。

这使用原生 session-stop 续跑，不是原失败请求的原样重发。设置及完整排除清单仍由[恢复行为说明](../../projects/omp-qol/docs/adjustments.zh.md#上游错误后续跑)维护。

### 任务参数清理

任务参数模块由开关控制：原生 boolean `taskArgsEnabled` 默认 `true` 并受 `enabled` 约束，为内建 `task` 工具安装一个 `tool_call` handler。仅在内建 task schema 暴露 `sourceSession` 时安装 handler；只有普通 `model` 选择器的 schema 会让模块保持 `unavailable` 且不被改写。取值非法只停用本模块；设置对象被拒绝时沿用整组件规则。

扁平调用视为一个条目，`tasks` 数组视为批次。对 `agent` 为字符串、trim 后非空且不等于 `seance` 的每个条目，handler 删除该条目自身的 `sourceSession` 与 `model`，且只复制被改动的对象。`agent` 缺失、为空、仅空白、非字符串或为 `seance` 的条目、非对象条目、批次级字段及其他所有参数保持不变。只有发生改写时才返回新输入；一次被改写的调用只增加一次计数。

清理不改变 task schema、描述、审批策略、派发、后台生命周期或结果渲染。宿主会把改写后的参数持久化到当前 assistant 消息，后续请求和会话文件会看到它们。handler 注册期间，OMP 的推测启动与实验性推测读取被关闭；模块不修改宿主设置，下一激活关闭模块即恢复原生行为。只为暴露 `sourceSession` 的内建 `task` 安装；工具缺失、被遮蔽或 schema 没有该字段时保留原生行为并报告有界原因。

[任务参数清理](../../projects/omp-qol/docs/adjustments.zh.md#任务参数清理)记载完整规则、接受的推测成本、边界与验证。

### 复制最后回复

复制模块由开关控制：原生 boolean `copyEnabled` 默认 `true` 并受 `enabled` 约束，决定处理器是否动作。`alt+shift+a` 在扩展工厂执行时注册，早于交互模式读取快捷键注册表；模块不注册 `/copy` 命令，也没有可配置键位。模块停用或设置被拒绝时，该键位仍在该扩展绑定存续期间被占用，处理器此时不动作。`copyEnabled` 值无效只停用本模块；设置对象被拒绝时沿用整组件规则。

模块启用且 agent 空闲时，处理器选择当前分支最后一条 assistant 消息，把其 `text` 块无分隔符拼接、去除首尾空白，再通过宿主剪贴板助手写入。内容为空的 aborted 消息会被跳过。最后一条 assistant 消息没有文本时，包括只带思考或工具调用的消息，不复制，也不回退到更早的回复。思考、工具调用、工具输出、图片及其他非文本块均被排除，模块不新增会话条目，也不发送请求。agent 不空闲时，处理器提示并且不复制任何内容；宿主剪贴板助手是尽力而为并吞掉写入失败，因此真实写入失败不会被报告，而复制函数抛出异常时会被捕获并给出一条错误提示，不重试。

[复制最后回复](../../projects/omp-qol/docs/adjustments.zh.md#复制最后回复)记载完整行为、键位占用限制与验证。

## 不变量

- 全部无关设置保留键名、默认值、范围及校验。远端对齐、压缩用量和模型规则归属 `omp-smart-context`。`compactionCacheEnabled`、`compactionCacheProvider`、`compactionCacheMode`、`compactionUsageEnabled`、`modelPromptsEnabled` 均不存在，并按未知键拒绝；不保留运行时兼容路径。QoL 不安装或停止迁出模块。
- `waitMessagesSeconds` 和 `waitProcessSeconds` 在受支持的宿主上不起作用，中英文文档和 manifest 的设置说明写明这一点。
- 续等只服务独立的 `wait` 入口。入口缺失、属于他方或无法识别时，保留原生行为并报告有界的原因。
- 压缩期限补丁保留所有权检查：拒绝与带有 `Symbol.for("ruokee.omp.compaction-timeout.patched")` 标记的补丁共存，后续的同类激活也不会接管已有的所有者。
- 配置只来自 OMP 插件设置，每次激活读取一次。
- 一项调整出错不会停用其他调整。被拒绝的设置只给出键名和规则，不回显其值。
- 组件保留的每条代码路径都服务 OMP 18.5.0 及更高宿主，包括服务独立 `wait` 入口的等待路径。
- 恢复只处理主会话的 assistant 错误。正常输出引用错误不触发恢复；开关关闭或所需宿主接口缺失时保留原生行为。
- 安全排除与终止性 4xx 规则优先于两种模式及中断标记。恢复模块对副本分类，不改动原始 assistant 错误。
- 现有每链续跑预算及倍增退避跨模型运行生效。只有实际返回的续跑计入次数；同一运行及轮次的重复结束事件不增加等待或续跑。宿主上限独立生效。
- 正常完成、范围外错误或取消结束当前链。后续独立链使用新预算。会话切换、关闭、新运行或原链失效后，旧等待不得触发续跑。
- 恢复使用既有固定续跑文本，要求核对已完成工作及副作用，不携带服务端错误正文、命令或工具输出。历史、工具调度及审批仍由 OMP 管理。
- 恢复通知遵循现有开关，显示次数及等待时间。`/qol` 报告有效状态及配置，不启动模型运行。
- 任务参数清理只从 `agent` 为非空且不等于 `seance` 的字符串条目删除 `sourceSession` 与 `model`。Agent 缺失、为空、仅空白、非字符串或为 `seance`、非对象条目、批次级字段及其他所有参数保持不变。
- handler 只为暴露 `sourceSession` 的内建 `task` 注册；工具缺失或被遮蔽，或 schema 只有普通 `model` 选择器时保留原生行为、保留 `model` 并报告有界原因。注册期间推测启动与实验性推测读取被拒绝；模块不修改宿主设置。
- 模块改写事件输入。宿主会把改写后的参数持久化到当前 assistant 消息，后续请求和会话文件会看到它们。它不改 task schema、描述、审批、派发或结果渲染；因其他原因无效的调用仍失败。
- `taskArgsEnabled` 值非法只停用任务参数模块。关闭本模块或总开关后，下一激活恢复原生参数与行为。
- 复制快捷键在工厂执行时注册，而不是在 `session_start`；处理器读取激活快照，只在模块启用时复制。
- 复制处理器只写最后一条 assistant 消息的 `text` 块，跳过内容为空的 aborted 消息，不回退到更早的回复，也不写空字符串。思考、工具调用、工具输出、图片及其他非文本块均被排除。
- agent 不空闲时复制处理器不复制任何内容。宿主剪贴板助手会吞掉写入失败，因此真实写入失败不会被报告；复制函数抛出异常时会被捕获并报告，不会逃出处理器。
- 复制模块不注册 `/copy` 命令，也没有可配置键位。模块停用、总开关关闭或设置被拒绝时，固定键位仍被占用，处理器此时不动作。
- `copyEnabled` 值非法只停用复制模块。关闭本模块或总开关后，下一激活保留原生行为。

## 宿主下限

OMP `18.5.0`，声明在[兼容性](../../projects/omp-qol/README.zh.md#兼容性)。`@oh-my-pi/*` 开发依赖锁定为 `18.5.0`，测试以该宿主的行为为基线。通用规则见 [.agents/spec/host-compatibility.zh.md](./host-compatibility.zh.md)。

## 验收标准

- 在组件目录运行 `bun run typecheck` 和 `bun test` 通过。
- 无关设置保留键名、默认值、范围及校验。旧远端键及迁出的用量、规则键均触发整个配置的未知键拒绝。迁移从用户及项目作用域删除迁出键，保留有效启用结果和无关设置。
- `waitMessagesSeconds` 和 `waitProcessSeconds` 的说明写明它们不起作用。
- 每项调整的真实 OMP CLI 证据记录在 [projects/omp-qol/docs/adjustments.zh.md](../../projects/omp-qol/docs/adjustments.zh.md) 对应的验证小节，未运行的场景标为未验证。
- 受维护宿主的真实 OMP CLI 证明符合恢复条件的上游流关闭后，使用默认恢复设置，且不经用户消息便在同一主会话自动续跑。仅有原生重试或 `/qol` 启用状态不能证明该行为。
- 行为检查覆盖原始报错的真实宿主字段在默认模式下的恢复。新的真实会话再次出现其精确措辞不是开发前提；未运行的精确报错场景仍标为未验证。
- 相同故障下关闭恢复后，不出现 QoL 续跑。真实 TUI 显示次数及等待时间，等待期间取消会阻止续跑。
- 行为检查覆盖两种模式、有标记及无标记的无状态错误、安全优先级、独立上限、退避、跨运行失败链、重复事件、失效等待、开关、通知，以及原始错误与固定上下文的边界。
- 组件说明、manifest、仓库指引、双语文档及现行项目 Spec 的归属和即将弃用状态一致，保留全部剩余调整及每项无关有效要求。
- 任务参数清理检查覆盖扁平调用、批次条目、seance 保留、Agent 缺失/空/空白/非字符串、无目标字段、异常 task 形状、每次改写调用计一次、内建守卫、扁平与批次 seance schema、没有 `sourceSession` 的 model-only schema、缺失与遮蔽工具、停用与不兼容状态，以及关闭开关。真实 CLI 证据记录在对应验证小节，未运行则标为未验证。
- 复制检查覆盖最后一条 assistant 消息的选择、文本块拼接与去空白、思考与工具调用的排除、空的 aborted 消息、最后一条消息无文本时不回退、停用/流式输出/无文本/剪贴板失败等处理器路径、工厂阶段注册、带实际键位的 `/qol` 行，以及 copy 专用设置错误。真实 CLI 键位投递与系统剪贴板写入记录在对应验证小节，未运行则标为未验证。

## 相关 ADR

- [OMP QoL](../adr/decision/2026/09/20-omp-qol.zh.md)
- [宿主维护](../adr/decision/2026/09/28-host-maintenance.zh.md)
- [组件自包含](../adr/decision/2026/08/24-component-self-containment.zh.md)
- [任务参数清理](../adr/decision/2026/10/17-task-argument-cleanup.zh.md)
- [复制最后回复](../adr/decision/2026/10/18-copy-last-reply.zh.md)
