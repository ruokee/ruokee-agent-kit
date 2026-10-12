# 验证

[English](./verification.md)

## 宿主接口

导入使用编译宿主公开的入口。源编码保持使用 `buildResponsesInput`，其经过模型适配及 hoist 的输出传给 `buildOpenAiNativeHistory`，不传原始消息，以执行原生 V2 重放规范化。opaque 来源比较通过同一原生编码器处理单条 compaction record，要求唯一匹配，并在规范化之前恢复原 record。局部图片资格通过原生 `images.urls.enabled` handle 读取当前会话设置，包括子会话覆盖；缺失 handle 报告为不可用。

相关宿主源码路径位于 `@oh-my-pi/pi-agent-core`、`pi-ai` 和 `pi-coding-agent` 包内，包括 `src/sdk.ts`、`src/registry/agent-registry.ts`、`src/session/session-maintenance.ts`、`src/session/date-cwd-reminder.ts`、`src/session/messages.ts`、`src/compaction/compaction.ts` 和 `src/providers/openai-shared.ts`。

Handoff 对齐不使用任何标记 handoff 请求的接口。它通过 `agent.streamFn` 观察普通 dispatch，并从会话的 `convertMessagesToLlm` 与 `prepareSimpleStreamOptions` 两个缝合点重建一次操作，两处收到同一个 `AbortSignal`；`session.isGeneratingHandoff` 标出允许绑定的窗口，`session.handoff` 是宿主生成文档的入口。宿主把这项工作发送在 `agent.streamFn` 之外，因此在该缝合点观察到的参照属于普通 dispatch。对应源码为 `src/session/session-handoff.ts` 和 `src/session/agent-session.ts`。

## 已核对内容

在 OMP `18.5.0` 及更高的受维护宿主上运行的真实原生 CLI 覆盖完整范围复用、工具输出裁剪后的局部复用、主会话/task/Eval 归属、并行子会话隔离、子会话 revive 与取消，以及 switch/branch/tree 恢复。同一批运行还覆盖宿主导入、opaque 身份、必需局部复用，以及原生 task、Eval 子会话的 false/true 图片设置覆盖。

受控合成 HTTP 验证原生 serializer、调度和 maintenance；合成 usage 只覆盖机制，真实 Provider 行为与运行验证来自原生 CLI 运行。没有独立单元合同的 context 或 provider-request handler 会阻止局部证明，完整范围复用仍然可用。缓存收益来自另行授权的真实 Provider 运行。

## Handoff 对齐

在 OMP `18.8.3` 上以 chat-completions 模型运行的真实原生 CLI，在相同提示词、相同会话形态和相同模型下，对比启用本能力与关闭开关（对照）两次运行实际发出的请求体。对照运行的 handoff 请求携带两个系统段，而普通请求发送三个，同时丢失推理强度并增加工具选择。启用后的运行发送同样的三个系统段且摘要一致，保留推理强度，去掉增加的工具选择，消息历史为普通历史之后追加指令。同一会话内连续两次 handoff 都对齐到最新的普通请求，而不是上一次 handoff 请求，复制的前缀从不携带 agent 归属。

同一批运行还覆盖宿主自身的自动压缩路径、参照由更早进程建立的 handoff、参照捕获后修改思考强度、注入系统段、注入还原轴之外的字段、关闭开关、参照捕获后更换启用工具集合，以及响应尚在途中时取消 handoff；另有两个场景分别与已安装的正式副本、试验扩展共同加载本次候选。检查器比较每条记录请求的结构摘要，并断言激活状态、还原轴、计数器、共存结果，以及 `/smart-cache` 不发出模型请求。这些运行的有效设置来自本机插件配置，其中另一项能力已开启且 Provider 与本次模型的 API 不匹配，因此只观察到另一项能力的状态机，其自身改写并未运行；另有场景显式关闭该能力，观察到本能力段落随该能力自身原因保持关闭。记录不保留消息正文，比较只使用字段摘要、系统与历史摘要、工具 schema 摘要和固定标量。

命令输出通过命令自身调用的同一格式化函数核对：该宿主在 print 模式下不回显命令通知，因此裸命令运行以成功退出和零模型请求为证据，报告文本由命令自己的格式化函数配合实时会话快照渲染。

组件级运行直接驱动登记 seam，覆盖不需要 Provider 的边界：不含工具集、因而永远不提供参照的 dispatch；另一项能力关闭且完全不产生分派记账的会话；以另一项能力为目标的会话，其段落保持活跃；以及复用已确认在线视图的侧请求。

这些运行未覆盖：序列化器以 `developer` 角色写出系统提示词片段（而非 `system`）的模型、投机压缩、handoff 响应不完整后宿主的重试、参照与 handoff 之间更换模型、多模态输入、子代理会话、模型 API 允许另一项能力改写的会话，以及真实 Provider 缓存收益。两个场景出现本包两个副本同时加载，上述边界规则依据的是宿主 handoff 路径的源码阅读，而不是触发这些规则的宿主变更。

有三处边界目前是保守处理而非完整处理，后续变更会解决：参照失效后到达的响应会恢复较早的参照，而不是把资格留给新的普通发送；原生 body 未变的重复物理发送会直接复用较早的改写而不重新校验归属，因此归属变化但 body 相同的情形不会保持原生 body；其它扩展已装在会话方法上的包装会被叠加，而不会报告冲突，因此要求报告冲突或不可用的共存条款在该路径上未满足。

## 替换条件

受维护原生接口在所需路径提供等价配置、隔离、复用安全及失败行为后，以行为验证为依据替换本适配。
