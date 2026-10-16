# 验证

[English](./verification.md)

## 宿主接口

导入使用编译宿主公开的入口。源编码保持使用 `buildResponsesInput`，其经过模型适配及 hoist 的输出传给 `buildOpenAiNativeHistory`，不传原始消息，以执行原生 V2 重放规范化。opaque 来源比较通过同一原生编码器处理单条 compaction record，要求唯一匹配，并在规范化之前恢复原 record。局部图片资格通过原生 `images.urls.enabled` handle 读取当前会话设置，包括子会话覆盖；缺失 handle 报告为不可用。

相关宿主源码路径位于 `@oh-my-pi/pi-agent-core`、`pi-ai` 和 `pi-coding-agent` 包内，包括 `src/sdk.ts`、`src/registry/agent-registry.ts`、`src/session/session-maintenance.ts`、`src/session/date-cwd-reminder.ts`、`src/session/messages.ts`、`src/compaction/compaction.ts` 和 `src/providers/openai-shared.ts`。

Handoff 对齐不使用任何标记 handoff 请求的接口。它通过 `agent.streamFn` 观察普通 dispatch，并从会话的 `convertMessagesToLlm` 与 `prepareSimpleStreamOptions` 两个缝合点重建一次操作，两处收到同一个 `AbortSignal`；`session.isGeneratingHandoff` 标出允许绑定的窗口，`session.handoff` 是宿主生成文档的入口。宿主把这项工作发送在 `agent.streamFn` 之外，因此在该缝合点观察到的参照属于普通 dispatch。对应源码为 `src/session/session-handoff.ts` 和 `src/session/agent-session.ts`。

## 已核对内容

在 OMP `18.5.0` 及更高的受维护宿主上运行的真实原生 CLI 覆盖完整范围复用、工具输出裁剪后的局部复用、主会话/task/Eval 归属、并行子会话隔离、子会话 revive 与取消，以及 switch/branch/tree 恢复。同一批运行还覆盖宿主导入、opaque 身份、必需局部复用，以及原生 task、Eval 子会话的 false/true 图片设置覆盖。

受控合成 HTTP 验证原生 serializer、调度和 maintenance；合成 usage 只覆盖机制，真实 Provider 行为与运行验证来自原生 CLI 运行。没有独立单元合同的 context 或 provider-request handler 会阻止局部证明，完整范围复用仍然可用。缓存收益来自另行授权的真实 Provider 运行。

## 工具续接

组件回归遵循原生顺序：模型前 hook、上下文准备、凭据解析、stream、payload hook 和最终 fetch。覆盖两个普通 dispatch 共享 run signal、较新工作不改变压缩操作的初始参照、历史失效后在同一 signal 上继续普通工作，以及新压缩操作使用恢复后的参照。epoch 变化后旧操作仍发送原生正文，取消阻止建立新的普通参照。fixture 使用锁定的 `18.5.0` 宿主库和受控 HTTP 响应，不测量 Provider 缓存收益。

两种 remote 模式的运行时回归均覆盖 opaque 历史后的原生 Eval 显示投影、已确认普通前缀复用及新增原生尾部保留。相同文本若属于用户消息、用户归属 custom 内容、其他 custom 类型或未经观察的构造，仍作为依赖；删除该依赖时压缩正文保持原生。

## 原生 remote 续接

OMP `18.8.3` 对 `0.1.3` 的原生验证覆盖 `hooks` 模式下两个独立会话的五次自动 remote V2 压缩。每次宿主 `tokensBefore` 与实际 Provider 输入均超过 `131072`，五次请求均收到缓存输入、由原生采用并继续普通工作。其中一个会话的第二次压缩捕获精确的隐藏、agent 归属 Eval 元数据，保留完整 canonical source，并发送已确认的普通 prepared 前缀及新增原生尾部。完整比较包含 opaque 字节，不解码。另一个会话三次压缩所用参照不含 Eval custom 消息，压缩后的普通参照中仍观察到该消息。该会话单独验证普通续接，不构成精确 Eval 压缩条件的独立重复。结果保留一次零缓存普通续接，不把它算作压缩缓存命中。这些运行不扩大现有 Handoff API 边界，也不覆盖原生 `standard` 模式。

## Handoff 对齐

在 OMP `18.8.3` 上以 chat-completions 模型运行的真实原生 CLI，在相同提示词、相同会话形态和相同模型下，对比启用本能力与关闭开关（对照）两次运行实际发出的请求体。对照运行的 handoff 请求携带两个系统段，而普通请求发送三个，同时丢失推理强度并增加工具选择。启用后的运行发送同样的三个系统段且摘要一致，保留推理强度，去掉增加的工具选择，消息历史为普通历史之后追加指令。同一会话内连续两次 handoff 都对齐到最新的普通请求，而不是上一次 handoff 请求，复制的前缀从不携带 agent 归属。

同一批运行还覆盖宿主自身的自动压缩路径、参照由更早进程建立的 handoff、参照捕获后修改思考强度、注入系统段、注入还原轴之外的字段、关闭开关、参照捕获后更换启用工具集合，以及响应尚在途中时取消 handoff；另有两个场景分别与已安装的正式副本、试验扩展共同加载本次候选。检查器比较每条记录请求的结构摘要，并断言激活状态、还原轴、计数器、共存结果，以及 `/smart-cache` 不发出模型请求。这些运行的有效设置来自本机插件配置，其中另一项能力已开启且 Provider 与本次模型的 API 不匹配，因此只观察到另一项能力的状态机，其自身改写并未运行；另有场景显式关闭该能力，观察到本能力段落随该能力自身原因保持关闭。记录不保留消息正文，比较只使用字段摘要、系统与历史摘要、工具 schema 摘要和固定标量。

组件级运行直接驱动登记 seam，覆盖不含工具集、因而永远不提供参照的 dispatch，关闭的能力不产生分派记账，以及复用已确认在线视图的侧请求。

组件回归拒绝 epoch、信号、工具、system、thinking 或 Provider 身份变化后晚到的成功响应。payload 回调不记录发送，实际重复传输分别计数。owner 变化后旧操作永久失效，即使恢复原值也不恢复。登记与释放保留未知的会话方法包装。

OMP `18.5.0` 和 `18.8.3` 的受控原生 CLI 运行保留正常七插件及原生 callable 工具 schema，覆盖最终 Chat Completions 路径。连续两次 Handoff 使用各自最新普通参照并提交原生文档。HTTP 503 后的原生传输重试记录一次操作、两次发送和一次重试。后置 provider hook 更换工具集后，Handoff 正文保持原生；响应在途时取消不会提交文档，普通工作仍可继续。登记前干预原生发布及登记后安装方法包装分别报告不可用、保留外部包装，原生文档仍正常采用并续接。后置 provider 选项在最终改写后保持不变。这些运行使用受控本地 HTTP，不测量 Provider 缓存收益。

两个宿主的交互 TUI 均显示实际 `/smart-cache` 通知，包含独立的 remote 和 Handoff 段。随后本地观察记录 HTTP 请求数为零，确认读取状态不启动模型 turn。命令只显示状态和计数，不包含 payload 或私密值。

## Responses Handoff

回归覆盖 instructions、有来源证明的前置 developer、历史 developer 位置、同一系统片段内缺失文本后缀、工具、图片历史、reasoning 配置更新，以及公开 Agent state 尚未同步的普通 dispatch。Handoff-only 和 remote Provider 不匹配时仍能建立独立普通参照。只恢复系统表达，原生 none、reasoning、配置更新及新增 input 保持不变。

OMP `18.5.0` 与 `18.8.3` 的受控原生 CLI 覆盖两种系统表达、连续 Handoff、remote 共存、自动生成及自动空结果。空文档不产生原生 compaction 提交，普通工作继续。两个宿主的交互 TUI 分别以两种系统表达执行实际 `/handoff` 命令，保留手动 focus、原地提交并续接，随后显示不发模型 turn 的 `/smart-cache`。

同一批宿主覆盖最终传输重试、取消、延迟普通确认、会话切换，以及登记前或登记后丢失的方法包装。其中一次操作首次发送完成对齐，工具 owner 变化后的重试保持原生，原工具恢复后的第三次发送仍保持原生；记录三次发送、两次重试，文档采用仍遵循原生路径。外部包装保持安装，后置 payload 选项不丢失。

在会话导航期间观察到普通 context 时报告 `navigation-unsettled`，不采集参照。消费者回归核对该原因以及均为零的参照和 dispatch 标识。

消费者回归允许宿主在普通 dispatch 与 Handoff 之间补写 assistant 完成时间和上下文统计，同时拒绝内容、replay payload、未知来源字段及最终 wire 历史的变化。回放一组已捕获的 74 条来源与 77 条原生 snapshot，其中 22 条仅有记账差异，结果只恢复 instructions，完整原生 input 保持不变。

实际原生 task 和 Eval 工具各自创建两个子会话。父子三会话使用同一模型及不同历史，并发 remote 压缩、续接，再并发生成 Handoff。取消一个子会话不影响其他文档采用；其后 revive 清除自身参照，新普通工作恢复资格。最终 wire 比较和逐会话状态确认归属，不根据模型或端点推断。

正常安装组合中，另一个扩展注册 `session_before_compact`。即使 async 压缩开启且上下文处于提前区间，两个宿主也会原生抑制投机。检查保留这一行为，记录零投机 Handoff 和零提交。它们没有运行正在进行的后台投机取消，也没有停用已有扩展来制造该覆盖。

## 最终 remote 共存

两个宿主的 `0.1.5` 受控原生 CLI 覆盖 `standard` 和 `hooks`、连续两次 remote 提交与普通续接、同会话 Handoff 以及其后的原生 remote 续接。Handoff 后，普通请求的 handoff 包装与原生 V2 的 summary 包装不同；来源证明不足时，后一次 remote 保持原生，不将不同前缀当成相同。有状态 context 变化在 standard 模式被拒绝，handler 不重跑。

正常安装组合存在 context 或 provider-request handler，局部依赖未证明时拒绝局部复用。另行标明的 clean-local 运行没有这些 handler，证明独立局部复用，同时保留原生工具输出裁剪；它不代表正常安装组合具备局部复用证据。独立进程恢复原生会话时没有旧内存参照，先采用无参照原生 remote 结果，再以新普通参照完成后续对齐及续接。

这些运行使用 localhost 受控 HTTP 和合成 usage。`0.1.5` Responses Handoff 的真实缓存收益需要另行 Provider 测量；上述 `0.1.3` remote 观察保留自身候选和范围。
