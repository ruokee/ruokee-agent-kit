# 调整项

[English](./adjustments.md)

逐项说明扩展改动了 OMP 的什么行为、为什么需要调整、介入位置、代价，以及目前有哪些验证。README 只放简表，依据集中在这里。

开发依赖基线为 OMP `18.5.0`，即 [`can1357/oh-my-pi`](https://github.com/can1357/oh-my-pi) 的 tag `v18.5.0`，提交 [`9348320cc4a30a7195d36a1f05a6c11bcb701a17`](https://github.com/can1357/oh-my-pi/tree/9348320cc4a30a7195d36a1f05a6c11bcb701a17)。每项调整分别列出其机制所依据的源码基线。带提交 `5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c` 的链接指向 OMP `18.2.8`，即最初阅读上游错误后续跑、压缩期限与原生历史重放机制时的版本；类型检查与测试套件针对 `18.5.0` 运行。

## 版本记录的读法

每项调整末尾的版本与验证记录区分三件事：

- **源码基线**：机制所依据的 OMP 版本与提交，以及它依赖的源码位置。
- **自动检查**：类型检查与测试套件运行所用的 OMP 版本，以及这些测试实际覆盖的内容。替换宿主的测试不能证明宿主行为。
- **真实 OMP CLI**：交互运行的 OMP 版本、模型与场景。尚未执行的项目写 **未验证**；不从 peer 范围、源码阅读或其他调整项通过来推定。

关于宿主版本的结论只适用于该版本，本文不声称存在连续可用范围。

## 持续等待

### 原生行为

内建 [`wait`](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/tools/wait.ts) 工具使用空对象参数 schema，单次原生调用上限为 30 分钟。被监视任务结束、收到对等方消息、发生 steer 中断、service 报告、没有可等待工作或原生窗口结束时，调用都会返回。仍在监视本会话任务的窗口带非空 `details.jobs` 数组；空数组则由数种其他结果共用，差异只存在于模型可见正文中。

关闭扩展后，每个原生窗口在任务仍运行时结束，模型都必须再发起一次调用。

### 为什么需要调整

每次空返回都消耗一个模型轮次：模型读到没有新信息的结果，重发会话，再次发起同一调用。原生 retry 设置管理的是模型请求，不是工具等待；内建入口没有可配置的总等待期限。

### 介入位置

模块要求内建 `wait` 具备已识别的空对象参数结构，重新注册 `wait`，并通过 `ctx.invokeTool` 委派。入口缺失、入口已被其他扩展替换、schema 无法识别或宿主没有可用的 schema 构造器时，模块保留原生行为并报告一个有界原因。

该定义保留原生名称、read 审批、essential 加载模式、严格校验和可中断性。它新增一个模型可见的可选数字 `timeout`，单位为秒，表示这次外层调用的总期限，取值必须是 `(0, 3600]` 内的有限数。委派给原生工具的调用始终是 `{}`，新增参数不会转发给无参数内建工具。

委派由一个基于单调时钟的总期限循环驱动。它只续接标记为 useless、详情中带非空任务数组且每个任务仍为 `running` 的结果。消息、已结束或不存在的任务、错误、中断、取消、未知详情结构与 service 帧都在第一次原生调用后返回。分类器从不读取结果正文。

总期限中止在途原生调用时，原生结果若仍返回则优先并原样交付。只有本次调用自身的期限已经到达，且拒绝符合已识别的宿主中止形态时，拒绝才会转为期限结果；已识别形态包括 `ToolAbortError`、`AbortError`，以及宿主 [`ToolAbortError`](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/tools/tool-errors.ts) 的精确消息 `Operation aborted`。即使计时器已经触发，无关的原生拒绝仍按原样抛出。调用方取消先于这项判断，并保留自身原因。其他情况下，包装返回最后一个确定可续接的窗口并追加一段有界期限说明；从未见过这种窗口时只返回最小说明。每次外层调用只有一个计时器，所有退出路径都会清理它。

### 配置

- `waitEnabled` 与 `waitContinueEmptyWindows` 分别开关本模块及其续接。
- `waitJobsSeconds` 是单次 `wait` 调用的默认总期限；显式 `timeout` 覆盖它。
- `waitMessagesSeconds` 与 `waitProcessSeconds` 照常接受并校验；受支持的宿主没有纯消息或命名进程等待入口，这两项不起作用。
- `/qol` 报告生效的默认值，并把消息续接、命名进程等待与 service 续接标为 `not-applicable`，不显示没有被读取的配置值。

### 副作用与取消

- 模块重复的是只读原生调用。它不启动后台工作、不取消任务或进程，也不自行消费消息或结果。
- 到达期限只结束外层等待调用，后台任务与进程继续运行。期限说明指向再次调用 `wait` 与 `proc://`，这两个入口在宿主上确实存在。
- 调用方取消优先于组件期限并保留自身原因。即使期限信号先到，终止性的宿主结果仍然优先。
- 将 `waitEnabled` 设为 `false` 并重启 OMP，即可直接恢复原生入口。

### 适用条件与边界

- 模块不合并纯消息空窗口、不提供命名进程等待，也不跨原生上限合并纯 service 等待。模块不会用状态轮询或宿主正文分类模拟这些能力。
- 资格检查依赖 builtin 来源与空对象参数结构，续接规则依赖 `useless`、`details.op` 与非空且全部运行中的 `details.jobs` 结构。宿主变化可能使模块保持不生效或提前返回窗口，但模块不会猜测。
- 模块依赖同名扩展优先级，以及 `ctx.invokeTool` 能到达被遮蔽的内建工具。宿主升级后需重新核对这些合同。

### 版本与验证

- **源码基线**：OMP `18.5.0` 的[等待工具](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/tools/wait.ts)、[任务控制](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/async/job-control.ts)、[扩展 API](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/extensibility/extensions/types.ts) 与 [proc 协议](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/internal-urls/proc-protocol.ts)。
- **自动检查**：OMP `18.5.0`，`bun test` 与 `tsc --noEmit`，使用记录宿主。覆盖模型可见 schema、跨运行快照的 `{}` 委派、缺省与显式期限选择、结构化续接规则、终止结果、取消、期限与结果竞态、注册拒绝，以及真实的已注册工具适配器对可中断性、加载模式、严格校验与审批的转发。
- **真实 OMP CLI**：OMP `18.5.1` 与真实模型，`waitJobsSeconds` 为 `600`，并在独立进程中与上一个包版本对照。一次由场景控制把输入固定为 `{}` 的 `wait` 调用在 `900` 秒后台任务仍运行时返回 `600` 秒期限说明，与改动前一致。一次 `timeout` 为 `3600` 的 `wait` 调用跨过 30 分钟原生窗口继续等待，在同一次调用内返回已完成的 `1920` 秒任务，与改动前一致。消息中断、steer 与取消未在 `18.5.x` 上重跑。

## 上游错误后续跑

### 原生行为

失败的模型请求会在轮次内重试，直到重试预算耗尽：`retry.enabled`（默认 `true`）、`retry.maxRetries`（默认 `10`）、`retry.baseDelayMs`（默认 `500`）、`retry.maxDelayMs`（默认 `300000`），由轮次恢复模块执行（[`packages/coding-agent/src/config/settings-schema.ts:1712`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/config/settings-schema.ts#L1712)，预算使用见 [`packages/coding-agent/src/session/turn-recovery.ts:2203`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/turn-recovery.ts#L2203)）。预算耗尽后轮次结束，assistant 消息保留 `stopReason: "error"`，消息文本变为 `Retry budget exhausted after N retries: …`（[`turn-recovery.ts:2406`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/turn-recovery.ts#L2406)）。

此后轮次保持已结束状态。没有任何设置会让工作在错误之后继续；宿主自带的受限轮次恢复处理的是空终止和意外终止，不是这种情况。推动会话继续的是用户消息或新的指令。

宿主在此时刻提供一个钩子：主 Agent 轮次即将结束时发出 `session_stop`，携带 `messages`、`turn_id`、`last_assistant_message`、`session_id`、`session_file`、`stop_hook_active` 与 `signal`（[`packages/coding-agent/src/extensibility/shared-events.ts:98`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/extensibility/shared-events.ts#L98)）。处理器返回 `{continue: true, additionalContext}` 会排入一次隐藏的续跑轮次；宿主对非 `block` 续跑的限制是每条链 8 次（`SESSION_STOP_CONTINUATION_CAP` 位于 [`packages/coding-agent/src/session/agent-session.ts:399`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/agent-session.ts#L399)，执行位置 [`agent-session.ts:4274`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/agent-session.ts#L4274)），子代理与没有注册处理器时完全不触发该钩子，单个处理器的预算是 30 秒（[`EXTENSION_HANDLER_TIMEOUT_MS`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/extensibility/extensions/runner.ts#L92)）。

关闭扩展时，超出重试预算的瞬时故障会结束轮次并等待人工介入。

### 为什么需要调整

502、提前关闭流的网关，或服务端超时，都可能超出重试预算。在途工作随之停止，继续工作要用户发一条消息，模型也失去任务中的位置。并非每次这类中断都带有分类结论：工具调用已经开始流式输出后流被切断时，宿主记录为轮次被中断；也有些错误既没有 HTTP 状态，也没有分类器认识的措辞。

判断所需的信息宿主已经具备：它用 `classifyMessage` 与 `Transient`、`Timeout` 等标记对错误分类（[`packages/ai/src/error/flags.ts:20`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/ai/src/error/flags.ts#L20)、[`flags.ts:815`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/ai/src/error/flags.ts#L815)），并暴露状态码判定（[`packages/ai/src/error/retryable.ts:20`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/ai/src/error/retryable.ts#L20)）。错误之后的轮次级续跑既没有设置也没有其他公开入口，因此该调整使用宿主提供的 stop hook。宿主自带的补救分支针对流提前关闭、停滞或重置，都以可重试的 id 为前提，因此 `errorId: 0` 的错误同样落在这些分支之外。

### 介入位置

扩展注册 `session_stop` 处理器与 `agent_start` 处理器。

1. 结束信号已经中止时直接返回。
2. 从 `last_assistant_message`，或从 `messages` 末尾取出最后一条 assistant 消息；它不是 `stopReason: "error"` 的 assistant 消息时返回。
3. 用宿主分类器对消息的副本分类并读取结果。模块自身不匹配任何错误文本；副本保证宿主消息不被改动。
4. 按模式判定：`knownTransient` 接受带 `Transient` 或 `Timeout` 的错误、宿主标记为流中途中断的错误（`stopDetails.type === "stream_interrupted_after_content"`），以及没有 HTTP 状态且 id 为 `0` 或位于宿主类别掩码之外的错误；`unclassified` 另外接受错误 id 为 `0` 或位于宿主类别掩码之外的错误。
5. 两种模式都排除固定清单：内容拦截、用户中断、中止、静默中止、认证失败、OAuth 过期、用量上限、账户策略、上下文溢出、请求体被拒、语法拒绝、不支持的模式、思考循环、过期 responses 条目、确定性工具 JSON，以及除 408 与 429 之外的 4xx 客户端状态。
6. 应用链规则：`stop_hook_active === false` 的事件开启新链，因此只重置计数器；同一 agent 运行内同一 `turn_id` 的重复事件被忽略；会话切换结束链；达到 `recoveryMaxAttempts` 的链不再续跑。
7. 每一次不属于可恢复错误的结束都终止链：自行正常结束的轮次、配置范围之外的错误、信号已经中止的结束，以及被信号取消的等待。只有本模块请求的续跑才延续链，因此由其他 stop hook 延续的宿主周期从零开始，不会继承已用尽的预算。
8. 先占用该轮次，再在处理器自身的结束流程之外等待 `min(base × 2^(attempt−1), max)`，等待后再核对信号、链代次、agent 运行与会话。
9. 返回 `{continue: true, additionalContext: <固定文本>}`。计数只在确实返回续跑时递增。

`agent_start` 标记 stop hook 看不到的运行边界。宿主在该处重置轮次计数器（[`agent-session.ts:4302`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/agent-session.ts#L4302)），并以该计数器减一上报 `turn_id`（[`agent-session.ts:4258`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/agent-session.ts#L4258)）；用户提交的提示与续跑轮次都会开启一次 agent 运行（[`agent-loop.ts:611`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/agent/src/agent-loop.ts#L611)、[`agent-loop.ts:674`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/agent/src/agent-loop.ts#L674)）。因此两次都在首个轮次失败的运行都会上报 `turn_id: 0`：去重键把轮次 id 与运行配对，运行计数在该钩子上递增。等待期间开始的运行会作废该等待。续跑预算不因运行边界重置，它跟随宿主的 `stop_hook_active` 标记，因此宿主上限与 `recoveryMaxAttempts` 都跨运行累计同一条链。

续跑文本固定，说明上游错误结束了上一轮并要求继续工作，不携带服务端响应体、命令或工具输出。

### 配置

`recoveryEnabled`、`recoveryMode`、`recoveryMaxAttempts`、`recoveryBackoffBaseMs`、`recoveryBackoffMaxMs`、`recoveryNotify`，默认值与取值见 README。`notify` 每次续跑显示一行提示，包含次数与等待时间，这也是延迟过程可见的方式。

### 副作用与取消

- 该调整会启动模型轮次，重发会话内容并消耗服务额度。
- 失败的轮次不会被撤销。错误之前已运行的工具调用保留其效果，该轮次中未运行的调用可能在续跑中执行。
- 续跑是隐藏的自定义消息，历史中保留原样的 assistant 错误消息。
- 宿主每条链 8 次续跑的限制独立于 `recoveryMaxAttempts` 生效；不属于当前链的轮次会让宿主重置链计数。
- 等待期间按 Esc 会取消等待，被取消的等待不计入次数。
- `session_stop` 处理器有 30 秒预算。校验后的倍增上限为 10 秒，因此默认值与可配置值都远在预算之内。
- 关闭该调整：将 `recoveryEnabled` 设为 `false` 并重启 OMP，宿主不再收到本扩展的续跑请求。

### 适用条件与边界

- 模块需要带 `stop_hook_active`、`turn_id`、`last_assistant_message` 与续跑结果字段的 `session_stop`，以及公开的错误分类器。宿主对子代理跳过该钩子，因此恢复不会作用于子代理。
- 安全排除优先于配置的模式：拒绝、配额上限或用户中断无法通过配置变成续跑。
- 调整依赖 `stopReason: "error"` 标记失败轮次、宿主分类器的判定，以及两个宿主细节：表示中断的 `stopDetails.type` 标记，和无 HTTP 状态这一条件。这些都是宿主行为，可能变化。测试从已安装包读取分类器和标记的形态；标记按值比较而非导入，因此宿主改名只会收窄接受的集合，不会直接失效。宿主升级后需重新核对。
- 续跑可能重复副作用。宿主与本模块都不保证重复执行是幂等的。
- 当宿主提供在可续跑错误后继续轮次的设置，或允许 stop hook 拥有自己的重试预算时，该调整不再必要。

### 版本与验证

- **源码基线**：OMP `18.2.8`，提交 `5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c`，源码位置如上。
- **自动检查**：OMP `18.5.0`，`bun test` 与 `tsc --noEmit`，以记录宿主替代真实宿主。覆盖两种模式的分类矩阵、带或不带状态与判定结论的中断标记、无状态条件、排除清单与终止性状态优先于标记、被标记轮次的续跑、排除优先级、链与退避计算、同一轮次的重复事件、连续多次运行都首个轮次失败、等待期间开始新运行、被取消的等待、会话切换、跨运行的次数上限、正常结束与不可恢复错误终止链、被取消的结束、终止后仍保留的已处理轮次标记、固定续跑文本，以及开关或配置让恢复停用时不请求续跑。错误分类器使用已安装的 `@oh-my-pi/pi-ai` 代码，不是替身。
- **QoL `0.5.2`**：`0.5.1` 之后的 patch 版本，运行实现与已有记录中标为 `0.6.0` 的候选一致。真实 OMP `18.5.1` TUI 加载完整包后，`/qol` 显示 `@ruokee/omp-qol 0.5.2`。该版本状态运行没有触发错误恢复，下方恢复证据保留实际运行时的版本。
- **真实 OMP CLI**：QoL `0.6.0`、OMP `18.5.1`、真实模型与默认恢复设置（`knownTransient`、最多 8 次、起始 1000 ms、上限 8000 ms、通知开启）。通过显式入口加载完整候选包并关闭扩展发现；`/qol` 确认版本及有效恢复设置。未关闭或缩短原生重试。仅用于测试的传输包装转发真实上游 SSE 帧，在每条失败流的首个文本增量后、终止事件前关闭流。四次原生失败运行均生成 `OpenAI completions stream closed before a finish_reason was received`，`errorId: 135168`，没有 HTTP 状态或中断标记。进入 `session_stop` 后，QoL 显示第 1 次及 1000 ms，在 1004 ms 后无需用户消息便启动第五次运行，收到正常响应并以 `STREAM_RECOVERY_OK` 结束。该标记证明模型继续输出，不证明测试输入所要求的全部编号行被准确重建。
- **OMP `18.5.1` 对照**：仅将 `recoveryEnabled` 改为 `false` 后，相同截断在四次原生失败运行后结束，没有恢复提示或续跑。启用恢复的真实 TUI 运行显示次数及 1000 ms 等待。测试驱动在提示后 202 ms 发送真实 Esc 键，结束信号随即中止，会话关闭前没有第五次运行或请求。
- **未验证**：新的主会话出现精确报错 `Upstream provider closed the connection before the response completed: stream ended without terminal event or completed response` 后自动续跑。已保存的一次子代理失败带有该错误，`errorId: 0`，没有 HTTP 状态或中断标记；对该形状分类会按无状态未分类错误接受，但历史记录与分类检查不能证明主会话续跑。子代理仍不在该调整范围内。实机运行也未覆盖工具副作用、QoL 连续失败直至上限、其他提供方协议或真实等待期间切换会话。
- **上游变化**：stop hook 与续跑上限随 `c93774f892`（2026-06-17，"implement session stop hook semantics"）引入；`/reset` 语义在 `a418920ec1`（2026-08-03）改变，因此 reset 之后的链重置依赖宿主的 `stop_hook_active` 而不只依赖计数器。当前"重试预算耗尽"的措辞来自 `f6c5a43a1f`（2026-08-06）；模块按错误分类而不是匹配该措辞。

## 延长单个压缩期限

### 原生行为

远端压缩请求对调用方的信号加了看门狗：`withRequestTimeout` 让信号与 `AbortSignal.timeout(timeoutMs)` 竞速（[`packages/agent/src/compaction/openai.ts:237`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/agent/src/compaction/openai.ts#L237)，使用位置 [`openai.ts:866`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/agent/src/compaction/openai.ts#L866)），常量为 `REMOTE_COMPACTION_TIMEOUT_MS = 300_000`（[`openai.ts:74`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/agent/src/compaction/openai.ts#L74)）；V2 流式路径同理，常量为 `V2_COMPACTION_TIMEOUT_MS = 300_000`（[`packages/agent/src/compaction/compaction-v2-streaming.ts:48`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/agent/src/compaction/compaction-v2-streaming.ts#L48)、[`compaction-v2-streaming.ts:252`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/agent/src/compaction/compaction-v2-streaming.ts#L252)）。取值小于等于 0 时看门狗关闭。

五分钟是常量。压缩相关设置无法触及它（[`compaction.*` 设置键](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/config/settings-schema.ts#L2502)），调用方也不能按请求选择。慢于五分钟的远端压缩会被中断，运行转而走回退路径而不是完成该请求。

OMP 对扩展标出了同一时段：`action: "remote"` 的 `auto_compaction_start`（[`packages/coding-agent/src/session/session-maintenance.ts:4134`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L4134)，发出位置 [`session-maintenance.ts:4155`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L4155)）、自动路径中的 `session_before_compact`（[`session-maintenance.ts:4374`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L4374)）、`compact()` 中的同一事件（[`session-maintenance.ts:1163`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L1163)）、`#compactExperimentalContext()` 中的同一事件（[`session-maintenance.ts:1501`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L1501)）、存在处理器时的 `session.compacting`（[`session-maintenance.ts:3338`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L3338)）、`auto_compaction_end`，以及条目提交后的 `session_compact`。

关闭扩展时五分钟限制照旧，这也是默认状态。

### 为什么需要调整

看门狗的目的是避免挂起的远端压缩拖住会话，加入它的提交正是为此（[`8b8651529d`](https://github.com/can1357/oh-my-pi/commit/8b8651529d)，2026-06-13，"fixed hanging remote compaction requests with request timeouts"）。代价是在慢服务端或大历史下可能出现硬性中断，而既没有设置也没有公开 hook 为单次请求提高该期限。事件流让扩展能看到压缩正在运行，但不能改变期限。

### 介入位置

扩展用包装替换 `AbortSignal.timeout`，并保留对原生函数的引用。

- 没有打开窗口时，包装把收到的参数原样传给原生函数，因此非法输入保持原生 `TypeError`，所有调用方行为不变。
- 窗口内，`ms` 为有限值且满足 `floorMs ≤ ms < timeoutMs` 的调用改为以 `timeoutMs` 调用原生函数。其他取值一律透传，包括高于 `timeoutMs` 的取值和原生函数本就拒绝的取值。
- 窗口由 `action: "remote"` 的 `auto_compaction_start`、`session_before_compact`，或 `session.compacting` 打开；后者的会话 id 同时决定窗口归属。
- 绑定到活跃窗口的是第一个未中止的 `session_before_compact` signal，无论该窗口刚被创建，还是先前由自动轮次或 `session.compacting` 打开。后续 signal 不会覆盖该绑定，具体处理见下面两条规则。已经中止的信号会关闭该窗口而不是被忽略；稍后中止的信号关闭它绑定的窗口。已关闭窗口遗留的监听器不能关闭后续窗口，绑定信号也不会延长守卫租期。
- OMP `18.2.8` 的每次压缩操作只使用一个 controller：`compact()` 使用传入它的 controller（[`session-maintenance.ts:1034`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L1034)），在该方法检查处理器处发出 `session_before_compact`（[`session-maintenance.ts:1163`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L1163)），并在某个方法失败且未提交、controller 未中止时以同一个 controller 重新进入自身（[`session-maintenance.ts:1435`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L1435)）。因此扩展收到的 signal 属于该次操作，方法失败后的这次递归会带着同一个 signal 再次发出该事件。
- 再次收到 `session_before_compact` 且其 signal 正是窗口已绑定的那个，属于同一次操作：重复事件或串行回退的后续方法。模块保留该窗口、其类型、会话 id、代次、守卫租期、提示状态与取消绑定；不新增计时器、不新增监听器、不重新绑定，也不延长守卫租期。
- 已绑定活跃 signal 的窗口若收到不同的 signal，说明一个窗口内出现了两次操作，模块以 `overlapping-round` 停用实验。对先前由自动轮次或 `session.compacting` 打开的窗口同样如此。
- 窗口在 `auto_compaction_end`、`session_compact`、会话切换、会话关闭、取消，或守卫计时器 `compactionWindowGuardMs` 到期时关闭，以先到者为准。
- 安装通过全局 symbol 中的注册表在进程级生效，注册表记录安装它的激活、包版本、激活时的 cwd 与配置快照。只有来自该激活且快照相同的安装请求才是幂等的；也只有版本与快照都一致的激活可以在不安装任何东西的情况下保留补丁。
- 出现以下情况时模块拒绝安装并通过日志与 `/qol` 报告原因：存在同一宿主早期补丁的标记（即本模块读取的位置，见下方边界说明）、注册表槽位中的内容本版本无法读取、该进程中的补丁此前已停止、开关开启但当前 `AbortSignal.timeout` 已不是已安装的包装、第二次激活携带其他包版本或其他配置快照、开关关闭，或原生函数缺失。注册窗口事件失败时模块还原原生函数、以 `registration-error` 报告，该进程之后不再安装补丁。
- 同一进程中的第二次激活在自身请求该实验、且包版本与配置快照都一致时保留已安装的补丁。它不安装第二个包装、不注册窗口事件，并报告 `incompatible` 与 `patch-owned-elsewhere`：窗口属于安装补丁的激活，只有它的事件会打开窗口。窗口关闭期间本会话的压缩使用原生期限；窗口打开期间，进程内数值命中的调用——包括本会话的压缩——都会被延长。保留补丁不是冲突，也不按冲突报告。包版本或快照不同、以及被总开关、本模块开关或其键关闭的第二次激活，仍会停止已安装的补丁并报告停止时的原因；处于关闭状态的激活保留自身的开关状态，不报告冲突；该状态描述的是这次激活的安装结果，`/qol` 的压缩行始终以进程注册表为准。
- 安装补丁的激活结束会话时，`session_shutdown` 关闭窗口，并在 `AbortSignal.timeout` 仍是本模块包装时还原原生函数。注册表留下有界的 `owner-stopped` 状态，此后该进程不再安装新补丁：之后配置一致的激活报告该状态而不安装，因此该调整只能通过重启 OMP 恢复。`session_switch` 是同一激活服务新会话：它关闭当前窗口，不是激活退出。
- `/qol` 在命令运行时从进程注册表解析压缩行，因此会话开始之后才停止的补丁会在该进程的每个会话中报告，会话也不会把不再改写的补丁持续显示为 `enabled`。解析只解释本版本能读取的注册表：布局无法识别时保留该激活自身的拒绝原因。
- 设置无法读取或被整体拒绝的激活同样会停止其他激活安装且可识别的补丁，自身不安装任何东西。所有模块按失败结果保持关闭，不会为了完成该检查而用默认值开启任何模块。本版本无法读取的注册表槽位，以及同一宿主早期补丁的标记，都不会被改动。
- 安装方激活以不同的配置快照再次请求安装时，已安装补丁会以 `config-conflict` 停止：配置每次激活只读取一次，快照变化意味着生效配置已不再是补丁建立时的配置。
- 关闭开关时会还原原生函数，前提是当前值仍是本模块的包装；否则报告该情况。
- 窗口重叠、同一窗口内出现第二个活跃 signal、窗口属于其他会话，或事件顺序无法识别时，该进程内的实验停用并报告原因。

### 配置

`compactionTimeoutEnabled`（默认关闭）、`compactionTimeoutMs`、`compactionTimeoutFloorMs`、`compactionWindowGuardMs`、`compactionTimeoutNotify`，默认值与取值见 README。`notify` 在窗口内首次改写期限时显示一行提示，同一窗口内不重复。

### 副作用与取消

- 补丁在进程级生效。窗口期间任何调用 `AbortSignal.timeout` 且数值落在改写区间的代码都会得到更长期限，不只是压缩请求。这是该实验接受的代价，也是默认关闭的原因。这一点无需压缩即可观察：窗口打开时进程内其他代码的命中调用同样被改写。
- 只能延长期限。低于下限的取值以及大于等于 `compactionTimeoutMs` 的取值都不受影响，因此该调整绝不会缩短等待。
- 下限是专家项。被核对的压缩路径恰好传入 `300000` ms，因此高于该值的下限会让压缩请求本身不再命中，实验也就不再延长它；实际生效的下限达到该值时 `/qol` 会说明这一点。
- 包装在补丁正在运行且 owner 尚未退出期间一直安装，窗口之外不起作用。注册失败与 owner 退出都会还原原生函数。关闭事件始终不到达时，守卫限制窗口保持生效的最长时间。
- 窗口由事件打开，因此可能覆盖该时段内无关工作发出的调用，例如恰好使用命中数值的服务端请求。
- 注册 `session_before_compact` 会改变宿主处理投机压缩的方式，因为宿主把该事件的任何处理器都视为拦截器。在 OMP `18.2.8` 中，处理器存在会关闭三件事：不启动投机运行（[`session-maintenance.ts:1982`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L1982)）、不把阈值压缩推迟到正在运行的投机（[`session-maintenance.ts:2042`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L2042)）、也不消费已就绪的投机结果（[`session-maintenance.ts:2251`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/session-maintenance.ts#L2251)）。宿主在第一处写明了原因：投机结果会绕过拦截器的否决。对本调整意味着启用它会放弃投机压缩，原本可在后台准备好的压缩改为在前台执行，会话可能需要等待。这也是模块只在 `compactionTimeoutEnabled` 开启时注册该处理器的原因：默认关闭时不注册处理器，宿主的压缩调度不受影响。模块需要该钩子，因为其中的 `signal` 是手动压缩的取消入口。
- 关闭该调整：将 `compactionTimeoutEnabled` 设为 `false` 并重启 OMP，或不再加载扩展。不写磁盘，进程结束后不残留。

### 适用条件与边界

- 一个进程只有一个包装，归安装它的激活所有，且只有该激活的事件会打开包装改写的窗口。版本与快照一致的第二次激活保留补丁并报告 `patch-owned-elsewhere`，但不驱动窗口；携带其他快照的激活则停止补丁。因此同一进程中的两个会话不会都驱动该实验。
- 模块依赖 `AbortSignal.timeout` 可写且可配置、原生函数对非法输入抛 `TypeError`，以及压缩路径用 `AbortSignal.timeout` 作为看门狗。宿主改为自行构造信号或改用其他方式配置超时，补丁即失效。
- 扩展可见事件不携带将被计时的请求，窗口是时段而不是请求。模块无法承诺被改写的调用属于压缩，事件冲突时它选择报告而不是猜测。
- 当宿主提供请求级压缩超时或把超时作为参数向下传递时，该实验不再必要。
- 本模块不控制的部分：期限只是单个信号的期限，不是重试与回退的总耗时；超过提高后期限的压缩仍会被中断，与之前一致。宿主的投机压缩同样不受本模块控制，`session_before_compact` 注册会将其关闭。
- 早期补丁拒绝保护的是本模块读取的那个标记，即 `globalThis` 上的标记。为旧宿主编写的旧压缩扩展把同一标记写在 `AbortSignal` 上，因此真实的旧扩展不会被拒绝：两者同时加载时本模块会在旧包装之上安装自己的包装，关闭时还原旧包装而不是原生函数。本该阻止两份调整共用同一个全局对象的拒绝因此变成叠加。对真实旧扩展的保护应按未验证看待：自动检查只覆盖把标记写在本版本读取位置的替身。

### 版本与验证

- **源码基线**：OMP `18.2.8`，提交 `5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c`，源码位置如上。
- **自动检查**：OMP `18.5.0`，`bun test` 与 `tsc --noEmit`，使用记录宿主，并把 `AbortSignal.timeout` 替换为记录器，记录器把非法输入委派给原生函数。覆盖安装顺序与每种拒绝原因（早期补丁标记一项是把标记写在本版本读取位置的替身，见边界说明）、幂等安装与释放、第二次激活保留已安装补丁（其他 cwd、不注册窗口事件、安装方窗口继续改写期限、窗口外调用保持原生而窗口内被延长、不报告冲突）、第二次激活停止已安装补丁（其他快照、其他包版本、本模块开关关闭、总开关关闭、键无效）、已停止的补丁对之后配置一致的激活保持停止、owner 退出（关闭窗口、仅当前全局函数仍是本模块包装时还原原生函数、注册表留下 `owner-stopped`、之后配置一致的激活报告该状态且不安装、会话切换只关闭窗口）、`/qol` 在之后停止后报告注册表状态、安装方激活配置快照变化、本版本无法读取的注册表槽位、读取设置抛错、设置根不是对象、未知键、总开关取值无效、改写区间、非法输入的 `TypeError` 行为、每个窗口一次提示、进程级副作用对非压缩调用方的影响、同一次压缩操作在同一个 signal 上串行回退后续方法（窗口、类型、会话 id、守卫租期与提示状态保持不变，只有一个监听器，改写持续到提交，之后的操作为全新一轮）、自动轮次或 `session.compacting` 先开启窗口时的同样情形、同一窗口内出现不同的活跃 signal、自动轮次进行中再次开始自动轮次、由各事件打开窗口、绑定到已打开窗口的 before-compact 信号、已经中止的信号、遗留监听器、守卫与取消与中止与切换与关闭结束窗口、重叠与外部会话拒绝、被替换后的还原，以及窗口事件注册失败与布局无法识别的注册表各自的 `/qol` 报告。真实 OMP CLI 运行无法替代这些检查。
- **真实 OMP CLI**：OMP `18.5.1` 与真实模型，`compactionTimeoutEnabled` 开启；两个会话中 `/qol` 都报告 `compaction: enabled` 及所配置的期限、下限与守卫值。这些会话没有执行压缩，因此受支持宿主上的期限改写与回退序列 **未验证**。
- **上游变化**：远端看门狗随 `8b8651529d`（2026-06-13）引入，V2 流式压缩随 `102d6d54ad`（2026-06-28）引入并复制了该看门狗及其常量。两者都早于基线；截至基线，未发现改变五分钟限制的提交。

## 恢复会话时沿用原生历史

### 原生行为

`openai-responses` 提供方为每个会话与提供方保留一个状态对象。`OpenAIResponsesProviderSessionState` 声明了 `nativeHistoryReplayWarmed`（[`packages/ai/src/providers/openai-responses.ts:204`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/ai/src/providers/openai-responses.ts#L204)），工厂以 `false` 创建该标志（[`openai-responses.ts:237`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/ai/src/providers/openai-responses.ts#L237)），`close()` 又将其清回 `false`（[`openai-responses.ts:241`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/ai/src/providers/openai-responses.ts#L241)）。该状态存放在会话的提供方状态表里（[`packages/coding-agent/src/session/agent-session.ts:873`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/agent-session.ts#L873)，在 [`agent-session.ts:1782`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/coding-agent/src/session/agent-session.ts#L1782) 交给 agent），键为 `` `openai-responses:<provider>` ``（[`openai-responses.ts:168`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/ai/src/providers/openai-responses.ts#L168)，拼接与写入见 [`openai-responses.ts:256`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/ai/src/providers/openai-responses.ts#L256) 与 [`openai-responses.ts:260`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/ai/src/providers/openai-responses.ts#L260)）。

该标志决定会话中已存历史如何序列化。单次请求只读取一次（[`openai-responses.ts:1194`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/ai/src/providers/openai-responses.ts#L1194)），并作为 `nativeHistory.replay` 与 `includeThinkingSignatures` 传给载荷构建器（[`openai-responses.ts:1206`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/ai/src/providers/openai-responses.ts#L1206)）。为 `false` 时，会话携带的消息按通用内容重建，而不是沿用已存的原生条目：对话相同，条目不同，也不含思考签名。产生过可重放助手条目的响应会把它置为 `true`（[`openai-responses.ts:899`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/ai/src/providers/openai-responses.ts#L899)），因此完成过至少一次请求的进程会从第二次请求起沿用原生条目。

该状态属于单个进程，且不会被恢复。因此恢复的会话对每个提供方读到的都是 `false`，而写下该会话的进程结束在 `true`，其最后一次请求发送的是原生条目。两种形式从第一个被重建的条目起描述同一段对话，因此基于上一个进程末尾提示建立的提示缓存无法服务恢复进程的第一次请求。尚未携带任何已存条目的会话（即新会话）没有可重放的内容，两种方式没有差别。

### 为什么需要调整

这个守卫是有意为之。它随 [`8013be90c9`](https://github.com/can1357/oh-my-pi/commit/8013be90c9)（2026-03-21，"guard resumed OpenAI Responses replay (fixes #488)"）引入，目的是让恢复的会话不至于重放本进程从未产生过的原生条目。它的代价落在恢复本身：即使上一个进程的条目正是服务端所期望的形式，恢复进程的第一次请求仍会重建，于是在静态前缀之外由服务端缓存的部分需要重新写入。

按同一次会话、开与关该调整的配对运行测得单次恢复的代价（`omp 18.2.4`、真实模型）：重建的第一次请求报告 `17,920` 缓存命中与 `2,971` 未命中输入 token，重放的第一次请求则为 `19,968` 命中与 `1,002` 未命中。线上形式解释了差异：重放的请求开头四个条目与上一个进程最后一次请求逐字节相同（含 reasoning 条目），而重建的请求丢掉了该条目。两种情况下该会话随后的请求都是热的。

### 介入位置

扩展用包装替换 `Map.prototype.set`，并保留对原生函数的引用；宿主正是通过这个写入来存放标志所属的状态。

- 包装以两个条件同时成立来识别宿主自身的写入：字符串键以 `openai-responses:` 开头，且值的 `nativeHistoryReplayWarmed` 恰为 `false`。它把收到的值上该字段置为 `true`，然后以同样参数调用原生函数，因此宿主的调用返回它期望的 map。
- 其他调用一律原样转发：其他提供方的键（`openai-codex-responses:`、`anthropic-messages:`、`openai-completions:`）、非字符串的键、不是对象的值，以及标志缺失、为 `true` 或不是布尔值的值。
- 包装在整个进程内生效，它包装的表就是会话持有的表。激活在 `session_start` 读取设置，早于同一会话中第一次创建提供方状态；包装的改写次数是判断宿主是否仍在驱动它的依据。
- 安装通过全局 symbol 中的注册表在进程级生效，注册表记录激活身份、包版本、激活时的 cwd 与已改写的状态写入次数。
- 一个进程只有一个包装，其效果不取决于创建状态的会话。因此模块开启的第二次激活会保留该包装，并以当前次数把模块报告为 `enabled`，而不是再持有一个副本；本模块开关或总开关关闭的第二次激活释放包装并报告 `disabled`。释放只在当前安装的函数仍是本模块包装时还原被替换的函数。
- 设置无法读取或整体被拒绝的激活不安装任何东西、不开启任何模块，但会以 `runtime-conflict` 停止其他激活安装且可识别的包装，与压缩实验停止其补丁的方式一致。
- 出现以下情况时模块拒绝安装并通过日志与 `/qol` 报告原因：注册表槽位中的布局本版本无法读取（`registry-unrecognized`）、其他扩展替换了包装之下的函数（`patch-overwritten`）、运行时完全没有接受该包装（`install-failed`）。被拒绝的安装不发布注册表，也不改动它看到的函数。
- 包装没有窗口、没有租期，也不订阅任何事件。安装它的激活结束后包装仍然安装，这正是同一进程后续激活中的恢复会话能够以原生重放开始的原因。
- `/qol` 在命令运行时从进程注册表解析重放行并打印改写次数，因此会话开始之后才停止的包装会在该进程的每个会话中报告。

### 配置

`replayEnabled`（默认开启），默认值与取值见 README。

### 副作用与取消

- 包装位于进程内每次 `Map` 写入的路径上。它把字符串键与前缀比较、读取一个字段，其余原样转发；本机基准测试每轮 `2,000,000` 次字符串键写入、共五轮，原生中位数 `150.2` ms，包装后 `154.1` ms，约合每次调用 2 ns。
- 发生变化的就是宿主传入的那个值，因此标志落在宿主自己的状态对象上；不产生副本，也不写入会话文件。
- 该调整的前提：上一个进程为本会话存下的原生条目对响应恢复请求的服务端仍可重放。这也是上一个进程结束时已经作出的假设，守卫只是不让后续进程继续沿用，并没有证明它不成立。若会话携带的条目被服务端拒绝，标志为 `true` 时第一次请求会失败，而原生路径会重建并继续。配对测量中的交替运行对同一段历史反复重建与重放，均未出现服务端错误。
- 受影响的是恢复后的第一次请求。进程中随后的请求两种方式都是重放，未携带已存条目的会话也不受影响。
- 关闭该调整：将 `replayEnabled` 设为 `false` 并重启 OMP，或不再加载扩展。包装不写磁盘，进程结束后不残留。

### 适用条件与边界

- 该调整只覆盖 `openai-responses` 的提供方状态。`openai-codex-responses` 使用自己的状态键与规则（[`packages/ai/src/providers/openai-codex-responses.ts:1067`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/ai/src/providers/openai-codex-responses.ts#L1067)），Anthropic 与 completions 的状态不受影响。
- 它依赖三个宿主细节：`openai-responses:` 键前缀、`nativeHistoryReplayWarmed` 字段，以及状态通过会话交给提供方的 map 上的 `Map.prototype.set` 存放。宿主改名键或字段，或不经 map 写入直接构造状态，包装会静默失效而不会报错；`/qol` 中的改写次数是唯一的信号。
- 在宿主自身的定义里该标志属于部署范围：账户级重置有意保留它（[`openai-responses.ts:312`](https://github.com/can1357/oh-my-pi/blob/5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c/packages/ai/src/providers/openai-responses.ts#L312) 及其上方注释）。该调整让恢复进程沿用其自身进程若一直存活本会作出的同一决定。
- 它只设置一个标志，不做其他事。不构建、不过滤、不清洗条目；已变热的状态重放什么，发送的就是什么。
- 收益随可重放区域的大小出现。可重放条目不足约 `500` token 的轮次在恢复后两组都命中 `17,920`，因此短会话即使请求形态不同，也量不到差别。
- 未验证：带 `store` 与 `previous_response_id` 链式调用的官方 OpenAI 端点、`openai-codex-responses`、`/clear` 之后恢复的会话、交互式接管，以及压缩后的状态重建。宿主不经 map 写入而重建的状态不在包装覆盖范围内。

### 版本与验证

- **源码基线**：OMP `18.2.8`，提交 `5e0fc867f8a58dfe8812b5e99b2e7b6a0313da6c`，源码位置如上。
- **自动检查**：OMP `18.5.0`，`bun test` 与 `tsc --noEmit`，注入原型访问器，并以记录函数代替进程自身的 `set`。覆盖改写（键命中且值未变热、被修改的是传入的值、转发的调用、计数）与转发矩阵（其他提供方前缀、数字键、symbol 键、不是对象的值、标志缺失或为 true 的值）、每进程一个包装（第二次激活保留并以计数报告 `enabled`，且不再写入第二个包装）、释放（本模块开关关闭、总开关关闭、键无效、激活期间总开关关闭）、已停止的包装仍可调用但不改写、`stopForeignNativeReplayPatch` 只对其他激活还原被替换的函数并报告 `runtime-conflict`、各类拒绝（`registry-unrecognized`、`patch-overwritten` 保留外来函数不动、`install-failed` 不发布注册表）、`/qol` 对已安装、已释放、已被替换、以及本版本无法读取的注册表的行，以及默认配置下安装包装、设置 getter 失败时停止包装的激活路径。
- **真实 OMP CLI**：OMP `18.5.1` 与真实模型；新会话中 `/qol` 报告 `replay: enabled (rewrites=0)`。未在 `18.5.x` 上恢复会话，因此受支持宿主上的重放改写及其缓存效果 **未验证**。“为什么需要调整”中的测量来自 OMP `18.2.4`。
- **上游变化**：该标志与其守卫随 `8013be90c9`（2026-03-21）一同引入。截至基线，未发现改变该标志或其读取处的提交。

## 远端压缩缓存对齐

### 原生行为

非 Codex 的 Responses V2 远端压缩从会话上下文单独构建请求。即使描述同一段对话，它的共享历史和工具定义也可能与前一条在线请求不同。实现位于 [`packages/agent/src/compaction/compaction-v2-streaming.ts`](https://github.com/can1357/oh-my-pi/blob/d0cc52397dc2a68d39cba49b0009b9e50ffd643e/packages/agent/src/compaction/compaction-v2-streaming.ts)。

### 为什么调整

这些差异可能妨碍复用已缓存的前缀。调整只在确认等价的部分复用已发送在线请求的表示，不改变缓存键、提供方路由、模型选择或提供方缓存策略。发生改写不代表缓存命中。

### 挂接位置

- `before_provider_request` 在内存中保留在线候选。归属使用主会话的实时模型，而非单次请求覆盖的模型；其他模型的请求不能替换候选或使在途根信号失效。`fetch` 包装确认请求体原样到达预期在线端点，且信号来自持有归属的根信号后，才允许后续操作使用该参照。
- 薄包装作用于所属 `ctx.modelRegistry.resolver(model, sessionId)` 实例方法及其返回的 resolver，把明确的会话和模型身份绑定到原生根信号。它原样委派凭据解析，不读取凭据结果、不增加认证调用，也不替换返回的 Promise。`AbortSignal.any` 记录派生信号，不改变取消行为。手动、普通自动与投机压缩都经过同一归属边界（[`session-maintenance.ts`](https://github.com/can1357/oh-my-pi/blob/d0cc52397dc2a68d39cba49b0009b9e50ffd643e/packages/coding-agent/src/session/session-maintenance.ts#L3396-L3440)、[`auth-retry.ts`](https://github.com/can1357/oh-my-pi/blob/d0cc52397dc2a68d39cba49b0009b9e50ffd643e/packages/ai/src/auth-retry.ts#L153-L169)）。
- `hooks` 模式以薄包装观察所属会话 runner 的原始上下文与完成结果。它返回原 Promise，不重新运行处理器，复用原生消息转换器与 Responses 编码器。结果必须与原样发出的在线传输一致。复用前，压缩请求必须证明原始共享前缀的对应关系，完整投影候选也必须通过现有等价性检查。扩展名称、私有状态或配套组件均不构成证明。
- 对齐要求顶层字段和工具身份匹配。它复用完整在线工具定义，仅当在线请求没有 `tool_choice` 时移除隐式的 `tool_choice: "auto"`，并对齐已识别的提醒、steering 和重放表示中的共享输入前缀。未知差异使整个请求保持原样。压缩专用尾部、opaque 数据和必要 ID 均保留。
- 每个根信号在原生认证和传输重试间保留为它捕获的同一份已确认参照，包括参照缺失这一状态。新的在线请求可以更新后续参照，不改变在途投机快照。不同根信号可以并存；身份冲突、取消、上下文变化、导航与原生历史提交均阻止过期改写。弱信号归属不维护已完成操作列表。模块不包装 `AgentSession.compact`，操作生命周期、重试、回退、投机结果校验和历史提交仍由宿主管理。

### 配置与副作用

模块默认关闭。将 `compactionCacheProvider` 设为准确的提供方标识，开启 `compactionCacheEnabled`，然后重启 OMP。`compactionCacheMode` 默认 `hooks`；`standard` 保留既有的已识别宿主修复，拒绝未知上下文转换。没有上下文处理器时，两种模式均执行通用对齐。非法模式只使本模块无效。设置每次激活读取一次。配置见[压缩缓存](../README.zh.md#压缩缓存)。

- 缓存模块不注册 `session_before_compact` 处理器，保留原生投机启动与结果采用。其他扩展，包括单独启用的压缩期限模块，仍可能触发 OMP 的否决条件（[`session-maintenance.ts:2057–2061`](https://github.com/can1357/oh-my-pi/blob/d0cc52397dc2a68d39cba49b0009b9e50ffd643e/packages/coding-agent/src/session/session-maintenance.ts#L2057-L2061)）。缓存状态不表示投机压缩已全局启用。
- 进程保留最新在线候选与参照，以及原生 resolver 和信号生命周期持有的快照，并计算比较摘要。`hooks` 还会在传输确认前保留原始和完成的上下文，为已确认参照保留编码后的投影快照。弱信号归属不维护已完成操作历史。较新上下文未被确认时，后续根信号失去改写资格，已绑定根信号不受影响。并发操作可以持有不同载荷。不把请求正文、opaque 数据、凭据或采样日志写入磁盘。
- 传输与信号包装作用于进程级入口，resolver 包装作用于一个注册表实例，`hooks` 的上下文观察作用于所属 runner。只允许一个激活实例持有。后续同配置激活不会叠加包装；提供方、模式或版本冲突会停止持有者。导航、退出或包装被覆盖也会使调整停止，直到重启。清理只还原仍由本模块持有的函数及其原始属性形状。
- `/qol` 显示有效模式、实际状态、改写次数和有界的跳过原因。缺少上下文观察或编码不匹配时，请求保持原样。不显示缓存命中率，也不控制其他扩展对投机压缩的否决。

### 适用条件与边界

- 一个明确选择的提供方、`openai-responses`、非 Codex V2 远端压缩，以及身份可识别的主会话。缺少所需宿主能力时模块不启用。
- 传输必须使用预期端点、POST 方法、字符串 JSON 请求体，以及可追溯到当前原生操作的信号。`Request` 对象、其他请求体、归属不明、过期参照和未知请求差异均原样转发。
- 上下文观察之后的原生转换可能使 `hooks` 投影确认失败，包括内联 developer 指令或被过滤的 reasoning/replay 项。完整请求保持原生形式，并报告 `projection-unconfirmed`；模块不复制这些提供方策略，也不承诺每种策略组合均可对齐。
- 模块不负责开启压缩，不替换原生构建器，不重建 opaque reasoning，也不增加响应重试。不承诺兼容全部提供方或其他修改同类函数的扩展。

### 版本与验证

- **源码与运行基线**：OMP `18.5.1`，提交 `d0cc52397dc2a68d39cba49b0009b9e50ffd643e`。
- **历史提供方测量**：本地试验 `0.2.1`，两组各两次成功压缩。输入 token 加权缓存占比从未对齐的 `4.25%` 变为对齐后的 `98.31%`。基线一次 `503` 由原生重试处理，没有 `429`。这些是非确定性对话，不是四会话对照试验，也没有逐字段隔离因果。该数值不是 QoL `0.5.0` 或 `0.5.1` 的新测量。
- **生命周期修复**：本地试验 `0.2.2` 修复终止失败后的手动操作清理。其独立验证使用合成 HTTP，覆盖七项核心测试、十五项守卫场景、六项原生维护器场景和四项公开方法包装契约场景。
- **QoL `0.5.0`**：针对锁定的 OMP `18.2.8` 开发类型通过 TypeScript 检查。真实 OMP `18.5.1` CLI 使用合成传输执行原生远端压缩：三次尝试、两次对齐、终止失败后立即成功、一次原生历史提交，并还原持有的包装。没有提供方调用。本次发布未重跑完整测试套件。
- **QoL `0.5.1` 实现的运行验证**：标为 `0.6.0` 的发布前候选在真实 OMP `18.5.1` CLI 会话中运行，使用合成 HTTP，没有提供方调用。十一项场景断言覆盖原生投机启动与对齐、在线并行推进、较新在线请求与注入其他模型载荷事件之后的投机 `503` 重试、armed 结果无额外请求采用、opaque 历史重放、连续手动失败均发出新请求、手动 `503` 重试、取消原因、普通自动压缩和包装还原。捕获八次压缩传输、两次原生历史提交。该场景关闭其他 QoL 模块。
- **`0.5.1` 未测量**：新的提供方缓存收益、完整 remote/soft 回退序列、完整已安装扩展组合、并发存活主会话、其他提供方和长期可靠性。严格等价边界保持不变，在线与压缩 status 字段不同的合成通用 assistant 历史会被拒绝，不会额外归一化该差异。
- **QoL `0.6.0`**：针对锁定的 OMP `18.5.0` 开发类型通过 TypeScript 检查与测试套件。真实 OMP `18.5.1` CLI 会话报告 `cache: enabled (rewrites=0)`，已选择提供方；该会话没有执行压缩。
- **QoL `0.5.3` 运行验证**：真实 OMP `18.5.1` CLI 使用本机合成 HTTP，覆盖默认和显式模式、关闭与非法设置、激活快照及重启、无处理器、通用插入/重排/恢复、新增原生工具历史、首次和再次压缩、独立进程恢复、手动与自动压缩、较新上下文之后的投机重试与原生采用、取消、终止失败、已知上下文恢复案例及本机启用的扩展组合。在线载荷原样到达 HTTP；已证明的压缩前缀完成对齐；未知差异保持原生形式。没有真实提供方调用。
- **`0.5.3` 未测量**：新的提供方缓存收益、完整 remote/soft 回退序列、并发存活主会话、其他宿主版本/提供方和长期可靠性。合成用量不能证明缓存收益。

## 模型提示词规则

### 原生行为与预期结果

公开的 `before_agent_start` 事件提供当前 turn 的系统提示词块与有效模型。模块通过该事件追加匹配的用户正文，不修改宿主、模板、历史或 Provider 载荷。上游模型级指令请求见 [issue #6739](https://github.com/can1357/oh-my-pi/issues/6739)，该引用不意味着任意当前宿主都缺少等价能力。

通过[模型提示词设置](../README.zh.md#模型提示词)选择启用本模块。设置改动须重启，规则文件在每个覆盖 turn 刷新。

### 组合、失败与边界

[规则合同](../README.zh.md#模型提示词规则)定义发现、匹配、逐字节追加和诊断。文件与目录失败只影响其来源，handler 意外失败保留传入的块。

模板处理扩展须先于本模块加载；模板与规则失败互不影响，后续 handler 仍可替换结果。启用后项目规则成为系统指令。正则没有沙箱或超时，正文没有大小预算。

### 版本与验证

QoL `0.5.4` 针对锁定的 OMP `18.5.0` 开发类型检查。真实 OMP `18.6.3` CLI/TUI 使用原生显式入口与 `openai-completions` 请求族，覆盖默认、总开关和模块关闭请求、启用后的独立规则请求、模板在前且保留 Delivery 与修正页脚的共存、普通子 Agent、连续编辑/增加/删除/修复及模型重新匹配。在首个 `before_provider_request` 改变已注册的工具表面，直接观察到 turn override 生效期间的原生模板渲染。有效块保持不变，两次真实请求的每条规则仍各一次；未覆盖 prefix-binding 冻结或已有 assistant 消息后的更新。请求观察只保留合成正文、块位置/次数和哈希，不保留私人请求文本；在真实 TUI 观察 `/qol`。切换后的模型到达 Provider-facing 请求边界，但该 Provider 返回余额不足；这证明重新匹配，不证明该 Provider 成功完成响应。

行为测试覆盖解析与匹配边界、关闭或无模型时零访问、配置隔离及重启快照、目录/文件失败、正文保真、动态 cwd/模型输入、诊断隐私/会话归属和不累积。这些检查不认证任意宿主或扩展组合。OMP `18.5.0` 是类型/测试基线，不是新的实机矩阵。Plan-mode、Handoff、标题、分类、自动回退、其他请求族和长期可靠性仍未验证。

### 上游复核

OMP 提供原生模型级指令时，按[上游复核](../README.zh.md#上游复核)要求判断保留、缩窄或移除本能力。

## 上游提交索引

| 提交 | 日期 | 变更 | 对应调整项 |
| --- | --- | --- | --- |
| [`c93774f892`](https://github.com/can1357/oh-my-pi/commit/c93774f892) | 2026-06-17 | 实现 session stop hook 语义及其续跑上限。 | 上游错误后续跑 |
| [`a418920ec1`](https://github.com/can1357/oh-my-pi/commit/a418920ec1) | 2026-08-03 | 改变 `/reset` 语义，增加链重置路径。 | 上游错误后续跑 |
| [`f6c5a43a1f`](https://github.com/can1357/oh-my-pi/commit/f6c5a43a1f) | 2026-08-06 | 处理订阅额度耗尽导致的重试预算耗尽及其措辞。 | 上游错误后续跑 |
| [`8b8651529d`](https://github.com/can1357/oh-my-pi/commit/8b8651529d) | 2026-06-13 | 用五分钟请求超时修复挂起的远端压缩请求。 | 延长单个压缩期限 |
| [`102d6d54ad`](https://github.com/can1357/oh-my-pi/commit/102d6d54ad) | 2026-06-28 | 实现带独立看门狗的 V2 流式远端压缩。 | 延长单个压缩期限 |
| [`8013be90c9`](https://github.com/can1357/oh-my-pi/commit/8013be90c9) | 2026-03-21 | 用每进程的变热标志守卫恢复会话的 OpenAI Responses 重放。 | 恢复会话时沿用原生历史 |

日期为提交日期。这些提交通过在现行路径的文件历史中搜索上文提到的标识符定位；某行为没有列出提交，表示没有检索到。
