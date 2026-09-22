# 调整项

[English](./adjustments.md)

逐项说明扩展改动了 OMP 的什么行为、为什么需要调整、介入位置、代价，以及目前有哪些验证。README 只放简表，依据集中在这里。

源码基线为 OMP `18.2.4`，即 [`can1357/oh-my-pi`](https://github.com/can1357/oh-my-pi) 的 tag `v18.2.4`，提交 [`1c0303b1f2ec515cbf4b44a9a49d68a029531aac`](https://github.com/can1357/oh-my-pi/tree/1c0303b1f2ec515cbf4b44a9a49d68a029531aac)。下文的源码链接与行号都指向该提交；文件所属的发行版本与快照读取时的版本可能不同，因此每项调整各自声明基线。

## 版本记录的读法

每项调整末尾的版本与验证记录区分三件事：

- **源码基线**：机制所依据的 OMP 版本与提交，以及它依赖的源码位置。
- **自动检查**：类型检查与测试套件运行所用的 OMP 版本，以及这些测试实际覆盖的内容。替换宿主的测试不能证明宿主行为。
- **真实 OMP CLI**：交互运行的 OMP 版本、模型与场景。尚未执行的项目写 **未验证**；不从 peer 范围、源码阅读或其他调整项通过来推定。

关于宿主版本的结论只适用于该版本，本文不声称存在连续可用范围。

## 持续等待 hub

### 原生行为

内置 `hub` 工具的 `wait` 操作每次阻塞一个窗口，窗口取自固定阶梯 `5s, 10s, 30s, 60s, 300s`（[`packages/coding-agent/src/async/job-manager.ts:51`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/async/job-manager.ts#L51)，由 [`job-manager.ts:493`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/async/job-manager.ts#L493) 的 `nextPollWaitMs` 选择，用于 [`packages/coding-agent/src/tools/hub/index.ts:467`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/tools/hub/index.ts#L467) 的竞态计时器）。阶梯是编译期常量，没有对应设置，因此任务或消息等待无法要求比当前档位更长的窗口。

窗口到期且没有新信息时，工具返回一份完整的快照，并标记它不含信息：`useless: true` 且 `op: "wait"`。仍在运行的任务集合由 [`packages/coding-agent/src/tools/hub/jobs.ts:315`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/tools/hub/jobs.ts#L315) 构造（判定函数 `isWaitingPollDetails` 位于 [`jobs.ts:43`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/tools/hub/jobs.ts#L43)），干净的消息超时由 [`packages/coding-agent/src/tools/hub/messaging.ts:402`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/tools/hub/messaging.ts#L402) 构造。工具描述写明这条规则并要求重新发起："the wait window elapsing (5s, lengthening with each back-to-back wait up to 5m)"（[`packages/coding-agent/src/prompts/tools/hub.md:12`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/prompts/tools/hub.md#L12)）。

该工具的 `timeout` 参数只作用于 logs、stop 和命名进程等待（[`packages/coding-agent/src/tools/hub/index.ts:124`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/tools/hub/index.ts#L124)），任务与消息等待路径从不读取它。

关闭扩展时行为就是如此：每次调用一个窗口，空结果返回给模型，只有模型再次调用时阶梯才上升。

### 为什么需要调整

每个空结果都消耗一次模型轮次。模型读到的结果里没有信息，于是再次发出同样的调用，这会重发会话内容并消耗服务额度。长时间构建或测试是该工具的常见场景，而在一轮工作开始时模型会每 5 秒醒一次，直到阶梯爬升。阶梯减少的是轮次数量，不是单轮成本，而且调用方无法选择档位。

这里没有原生配置可用：`retry.*` 设置管理请求重试，与该工具无关，阶梯也没有设置键。

### 介入位置

扩展注册名为 `hub` 的工具，宿主会将其视为对同名内置工具的重新注册（[`packages/coding-agent/src/extensibility/extensions/wrapper.ts:66`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/extensibility/extensions/wrapper.ts#L66)）。每次调用都通过 `ctx.invokeTool` 转交给原生工具，它运行被遮蔽的内置实现（[`packages/coding-agent/src/extensibility/extensions/runner.ts:573`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/extensibility/extensions/runner.ts#L573)）。

- 非 `wait` 操作与带 `name` 的等待只委派一次，除缺省 `timeout` 填充外不做修改。
- 任务或消息等待中，`timeout` 成为该次调用的总期限，不再转发给原生窗口。不是 `(0, 3600]` 内有限数字的取值按参数错误拒绝，并在消息中说明可用范围。
- 整个调用使用一个期限计时器。每次委派结果都属于确定的空窗时，包装在同一次调用内再次调用原生工具。
- 结果不属于空窗时原样返回：送达的消息、已结束的任务、报告、错误、空的 `jobs` 数组都如此。判断不读文本，只看 `useless`、`details.op`、详情键集合以及 `jobs` 与 `waited` 的结构。
- 工具沿用原生的参数 schema、审批函数、`strict`、`loadMode`，以及等待与跟随日志读取的可中断标记。
- 描述中把原生等待窗口那句替换为实际期限，并追加一段说明期限、路由，以及到期只结束等待这一事实。

委派调用继承外层的中止信号与进度回调，因此中断会停止原生调用，包装循环期间原生进度仍会输出。

### 配置

`waitEnabled`、`waitContinueEmptyWindows`、`waitJobsSeconds`、`waitMessagesSeconds`、`waitProcessSeconds`，默认值与取值见 README。路由在调用开始时确定：`name` 为进程等待，非空 `ids` 为任务等待，`from` 且任务快照显示没有运行中的任务时为消息等待，其余为任务等待。

### 副作用与取消

- 模块重复的是一次只读的原生调用。它不启动后台工作、不取消任何东西、也不自行取得消息或任务结果；这些状态仍由原生工具独占管理。
- 期限到达后后台任务与进程继续运行。返回结果会说明这一点，内容是最后一次确定的空窗加上该提示，或没有窗口时的一段最小文本结果。
- 外层取消会带着自身原因重新抛出，绝不报告为超时。期限中止在途窗口时若结果恰好返回，该结果仍会送达。
- 每次调用只有一个计时器，调用经由任何路径结束时都会清理。
- 关闭该调整：将 `waitEnabled` 设为 `false` 并重启 OMP，之后直接使用原生工具，`waitContinueEmptyWindows` 不再起作用。

### 适用条件与边界

- 仅当会话中存在 source 为 `builtin` 的 `hub` 工具、其描述包含原生等待窗口句子、且参数是 schema 时才注册包装；否则模块保持不生效并报告 `hub-tool-absent`、`hub-tool-shadowed`、`hub-description-unrecognized` 或 `hub-schema-unrecognized`。
- 描述句子按原文匹配。宿主改写措辞时模块停用，而不是同时宣传两套期限。
- 空窗识别依赖宿主继续用 `useless`、`op: "wait"` 和上述详情结构标记确定的空窗。宿主改变该处后，这类窗口不再续接，等待行为与原生一致。
- 模块依赖扩展工具对内置工具的同名优先、参数 schema 可直接复用，以及 `ctx.invokeTool` 能到达被遮蔽的内置实现。任何一项变化都会使模块不生效或行为错误，宿主升级后需重新核对再信任该调整。
- 当宿主允许调用方选择等待窗口，或把阶梯暴露为设置时，该调整不再必要。

### 版本与验证

- **源码基线**：OMP `18.2.4`，提交 `1c0303b1f2ec515cbf4b44a9a49d68a029531aac`，源码位置如上。
- **自动检查**：OMP `18.2.4`，在本组件内运行 `bun test` 与 `tsc --noEmit`，以记录宿主替代真实宿主。覆盖期限构造与路由、跨多个空窗的续接、真实结果立即返回、消息优先、外层取消不记为超时、期限提示文本、计时器清理、工具定义字段，以及按配置注册与否。包边界是真实的：测试使用的 schema 与描述来自已安装的宿主包。
- **真实 OMP CLI**：**未验证**。计划场景：CLI 会话中运行一个有限的后台任务，等待超过首个原生窗口，确认转录中只有一次外层调用、首个真实结果及时送达、中断不会结束后台任务；随后验证消息等待、命名进程等待与非 wait 操作。在该运行出现之前，真实会话中的用户可见行为（包括模型实际拿到哪个工具、包装结果如何呈现）都没有证据。
- **上游变化**：阶梯随 `529950711a`（2026-06-14，"added smart adaptive poll wait mode for job polling"）引入，工具面在 `5ff277349c`（2026-07-15）合并到 `xd://` devices 与 `hub`。两者都早于基线，当前引用的是现行位置。基线之后改变该行为且已定位的提交：无。

## 上游错误后续跑

### 原生行为

失败的模型请求会在轮次内重试，直到重试预算耗尽：`retry.enabled`（默认 `true`）、`retry.maxRetries`（默认 `10`）、`retry.baseDelayMs`（默认 `500`）、`retry.maxDelayMs`（默认 `300000`），由轮次恢复模块执行（[`packages/coding-agent/src/config/settings-schema.ts:1902`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/config/settings-schema.ts#L1902)，预算使用见 [`packages/coding-agent/src/session/turn-recovery.ts:2203`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/turn-recovery.ts#L2203)）。预算耗尽后轮次结束，assistant 消息保留 `stopReason: "error"`，消息文本变为 `Retry budget exhausted after N retries: …`（[`turn-recovery.ts:2406`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/turn-recovery.ts#L2406)）。

此后轮次保持已结束状态。没有任何设置会让工作在错误之后继续；宿主自带的受限轮次恢复处理的是空终止和意外终止，不是这种情况。推动会话继续的是用户消息或新的指令。

宿主在此时刻提供一个钩子：主 Agent 轮次即将结束时发出 `session_stop`，携带 `messages`、`turn_id`、`last_assistant_message`、`session_id`、`session_file`、`stop_hook_active` 与 `signal`（[`packages/coding-agent/src/extensibility/shared-events.ts:97`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/extensibility/shared-events.ts#L97)）。处理器返回 `{continue: true, additionalContext}` 会排入一次隐藏的续跑轮次；宿主对非 `block` 续跑的限制是每条链 8 次（`SESSION_STOP_CONTINUATION_CAP` 位于 [`packages/coding-agent/src/session/agent-session.ts:401`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/agent-session.ts#L401)，执行位置 [`agent-session.ts:4284`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/agent-session.ts#L4284)），子代理与没有注册处理器时完全不触发该钩子，单个处理器的预算是 30 秒（[`EXTENSION_HANDLER_TIMEOUT_MS`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/extensibility/extensions/runner.ts#L92)）。

关闭扩展时，超出重试预算的瞬时故障会结束轮次并等待人工介入。

### 为什么需要调整

502、提前关闭流的网关，或服务端超时，都可能超出重试预算。在途工作随之停止，继续工作要用户发一条消息，模型也失去任务中的位置。并非每次这类中断都带有分类结论：工具调用已经开始流式输出后流被切断时，宿主记录为轮次被中断；也有些错误既没有 HTTP 状态，也没有分类器认识的措辞。

判断所需的信息宿主已经具备：它用 `classifyMessage` 与 `Transient`、`Timeout` 等标记对错误分类（[`packages/ai/src/error/flags.ts:20`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/error/flags.ts#L20)、[`flags.ts:787`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/error/flags.ts#L787)），并暴露状态码判定（[`packages/ai/src/error/retryable.ts:20`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/error/retryable.ts#L20)）。错误之后的轮次级续跑既没有设置也没有其他公开入口，因此该调整使用宿主提供的 stop hook。宿主自带的补救分支针对流提前关闭、停滞或重置，都以可重试的 id 为前提，因此 `errorId: 0` 的错误同样落在这些分支之外。

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

`agent_start` 标记 stop hook 看不到的运行边界。宿主在该处重置轮次计数器（[`agent-session.ts:4312`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/agent-session.ts#L4312)），并以该计数器减一上报 `turn_id`（[`agent-session.ts:4268`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/agent-session.ts#L4268)）；用户提交的提示与续跑轮次都会开启一次 agent 运行（[`agent-loop.ts:610`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/agent/src/agent-loop.ts#L610)、[`agent-loop.ts:673`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/agent/src/agent-loop.ts#L673)）。因此两次都在首个轮次失败的运行都会上报 `turn_id: 0`：去重键把轮次 id 与运行配对，运行计数在该钩子上递增。等待期间开始的运行会作废该等待。续跑预算不因运行边界重置，它跟随宿主的 `stop_hook_active` 标记，因此宿主上限与 `recoveryMaxAttempts` 都跨运行累计同一条链。

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

- **源码基线**：OMP `18.2.4`，提交 `1c0303b1f2ec515cbf4b44a9a49d68a029531aac`，源码位置如上。
- **自动检查**：OMP `18.2.4`，`bun test` 与 `tsc --noEmit`，以记录宿主替代真实宿主。覆盖两种模式的分类矩阵、带或不带状态与判定结论的中断标记、无状态条件、排除清单与终止性状态优先于标记、被标记轮次的续跑、排除优先级、链与退避计算、同一轮次的重复事件、连续多次运行都首个轮次失败、等待期间开始新运行、被取消的等待、会话切换、跨运行的次数上限、正常结束与不可恢复错误终止链、被取消的结束、终止后仍保留的已处理轮次标记、固定续跑文本，以及按配置注册与否。错误分类器使用已安装的 `@oh-my-pi/pi-ai` 代码，不是替身。
- **真实 OMP CLI**：**未验证**。计划场景：CLI 会话对模型请求路径做受控故障注入，观察到轮次以流错误结束，并在转录中看到续跑、其延迟与上限。故障注入尚未搭建，也没有替代方案：直接调用处理器不能作为真实轮次恢复的证据。
- **上游变化**：stop hook 与续跑上限随 `c93774f892`（2026-06-17，"implement session stop hook semantics"）引入；`/reset` 语义在 `a418920ec1`（2026-08-03）改变，因此 reset 之后的链重置依赖宿主的 `stop_hook_active` 而不只依赖计数器。当前"重试预算耗尽"的措辞来自 `f6c5a43a1f`（2026-08-06）；模块按错误分类而不是匹配该措辞。

## 延长单个压缩期限

### 原生行为

远端压缩请求对调用方的信号加了看门狗：`withRequestTimeout` 让信号与 `AbortSignal.timeout(timeoutMs)` 竞速（[`packages/agent/src/compaction/openai.ts:239`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/agent/src/compaction/openai.ts#L239)，使用位置 [`openai.ts:868`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/agent/src/compaction/openai.ts#L868)），常量为 `REMOTE_COMPACTION_TIMEOUT_MS = 300_000`（[`openai.ts:76`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/agent/src/compaction/openai.ts#L76)）；V2 流式路径同理，常量为 `V2_COMPACTION_TIMEOUT_MS = 300_000`（[`packages/agent/src/compaction/compaction-v2-streaming.ts:48`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/agent/src/compaction/compaction-v2-streaming.ts#L48)、[`compaction-v2-streaming.ts:252`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/agent/src/compaction/compaction-v2-streaming.ts#L252)）。取值小于等于 0 时看门狗关闭。

五分钟是常量。压缩相关设置无法触及它（[`compaction.*` 设置键](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/config/settings-schema.ts#L2712)），调用方也不能按请求选择。慢于五分钟的远端压缩会被中断，运行转而走回退路径而不是完成该请求。

OMP 对扩展标出了同一时段：`action: "remote"` 的 `auto_compaction_start`（[`packages/coding-agent/src/session/session-maintenance.ts:4119`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L4119)，发出位置 [`session-maintenance.ts:4140`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L4140)）、自动路径中的 `session_before_compact`（[`session-maintenance.ts:4359`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L4359)）、`compact()` 中的同一事件（[`session-maintenance.ts:1164`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L1164)）、`#compactExperimentalContext()` 中的同一事件（[`session-maintenance.ts:1502`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L1502)）、存在处理器时的 `session.compacting`（[`session-maintenance.ts:3335`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L3335)）、`auto_compaction_end`，以及条目提交后的 `session_compact`。

关闭扩展时五分钟限制照旧，这也是默认状态。

### 为什么需要调整

看门狗的目的是避免挂起的远端压缩拖住会话，加入它的提交正是为此（[`8b8651529d`](https://github.com/can1357/oh-my-pi/commit/8b8651529d)，2026-06-13，"fixed hanging remote compaction requests with request timeouts"）。代价是在慢服务端或大历史下可能出现硬性中断，而既没有设置也没有公开 hook 为单次请求提高该期限。事件流让扩展能看到压缩正在运行，但不能改变期限。

### 介入位置

扩展用包装替换 `AbortSignal.timeout`，并保留对原生函数的引用。

- 没有打开窗口时，包装把收到的参数原样传给原生函数，因此非法输入保持原生 `TypeError`，所有调用方行为不变。
- 窗口内，`ms` 为有限值且满足 `floorMs ≤ ms < timeoutMs` 的调用改为以 `timeoutMs` 调用原生函数。其他取值一律透传，包括高于 `timeoutMs` 的取值和原生函数本就拒绝的取值。
- 窗口由 `action: "remote"` 的 `auto_compaction_start`、`session_before_compact`，或 `session.compacting` 打开；后者的会话 id 同时决定窗口归属。
- 绑定到活跃窗口的是第一个未中止的 `session_before_compact` signal，无论该窗口刚被创建，还是先前由自动轮次或 `session.compacting` 打开。后续 signal 不会覆盖该绑定，具体处理见下面两条规则。已经中止的信号会关闭该窗口而不是被忽略；稍后中止的信号关闭它绑定的窗口。已关闭窗口遗留的监听器不能关闭后续窗口，绑定信号也不会延长守卫租期。
- OMP `18.2.4` 的每次压缩操作只使用一个 controller：`compact()` 使用传入它的 controller（[`session-maintenance.ts:1035`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L1035)），在该方法检查处理器处发出 `session_before_compact`（[`session-maintenance.ts:1164`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L1164)），并在某个方法失败且未提交、controller 未中止时以同一个 controller 重新进入自身（[`session-maintenance.ts:1436`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L1436)）。因此扩展收到的 signal 属于该次操作，方法失败后的这次递归会带着同一个 signal 再次发出该事件。
- 再次收到 `session_before_compact` 且其 signal 正是窗口已绑定的那个，属于同一次操作：重复事件或串行回退的后续方法。模块保留该窗口、其类型、会话 id、代次、守卫租期、提示状态与取消绑定；不新增计时器、不新增监听器、不重新绑定，也不延长守卫租期。
- 已绑定活跃 signal 的窗口若收到不同的 signal，说明一个窗口内出现了两次操作，模块以 `overlapping-round` 停用实验。对先前由自动轮次或 `session.compacting` 打开的窗口同样如此。
- 窗口在 `auto_compaction_end`、`session_compact`、会话切换、会话关闭、取消，或守卫计时器 `compactionWindowGuardMs` 到期时关闭，以先到者为准。
- 安装通过全局 symbol 中的注册表在进程级生效，注册表记录安装它的激活、包版本、激活时的 cwd 与配置快照。只有来自该激活且快照相同的安装请求才是幂等的；也只有版本与快照都一致的激活可以在不安装任何东西的情况下保留补丁。
- 出现以下情况时模块拒绝安装并通过日志与 `/qol` 报告原因：存在同一宿主早期补丁的标记、注册表槽位中的内容本版本无法读取、该进程中的补丁此前已停止、开关开启但当前 `AbortSignal.timeout` 已不是已安装的包装、第二次激活携带其他包版本或其他配置快照、开关关闭，或原生函数缺失。注册窗口事件失败时模块还原原生函数、以 `registration-error` 报告，该进程之后不再安装补丁。
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
- 注册 `session_before_compact` 会改变宿主处理投机压缩的方式，因为宿主把该事件的任何处理器都视为拦截器。在 OMP `18.2.4` 中，处理器存在会关闭三件事：不启动投机运行（[`session-maintenance.ts:1983`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L1983)）、不把阈值压缩推迟到正在运行的投机（[`session-maintenance.ts:2043`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L2043)）、也不消费已就绪的投机结果（[`session-maintenance.ts:2252`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/session-maintenance.ts#L2252)）。宿主在第一处写明了原因：投机结果会绕过拦截器的否决。对本调整意味着启用它会放弃投机压缩，原本可在后台准备好的压缩改为在前台执行，会话可能需要等待。这也是模块只在 `compactionTimeoutEnabled` 开启时注册该处理器的原因：默认关闭时不注册处理器，宿主的压缩调度不受影响。模块需要该钩子，因为其中的 `signal` 是手动压缩的取消入口。
- 关闭该调整：将 `compactionTimeoutEnabled` 设为 `false` 并重启 OMP，或不再加载扩展。不写磁盘，进程结束后不残留。

### 适用条件与边界

- 一个进程只有一个包装，归安装它的激活所有，且只有该激活的事件会打开包装改写的窗口。版本与快照一致的第二次激活保留补丁并报告 `patch-owned-elsewhere`，但不驱动窗口；携带其他快照的激活则停止补丁。因此同一进程中的两个会话不会都驱动该实验。
- 模块依赖 `AbortSignal.timeout` 可写且可配置、原生函数对非法输入抛 `TypeError`，以及压缩路径用 `AbortSignal.timeout` 作为看门狗。宿主改为自行构造信号或改用其他方式配置超时，补丁即失效。
- 扩展可见事件不携带将被计时的请求，窗口是时段而不是请求。模块无法承诺被改写的调用属于压缩，事件冲突时它选择报告而不是猜测。
- 当宿主提供请求级压缩超时或把超时作为参数向下传递时，该实验不再必要。
- 本模块不控制的部分：期限只是单个信号的期限，不是重试与回退的总耗时；超过提高后期限的压缩仍会被中断，与之前一致。宿主的投机压缩同样不受本模块控制，`session_before_compact` 注册会将其关闭。

### 版本与验证

- **源码基线**：OMP `18.2.4`，提交 `1c0303b1f2ec515cbf4b44a9a49d68a029531aac`，源码位置如上。
- **自动检查**：OMP `18.2.4`，`bun test` 与 `tsc --noEmit`，使用记录宿主，并把 `AbortSignal.timeout` 替换为记录器，记录器把非法输入委派给原生函数。覆盖安装顺序与每种拒绝原因、幂等安装与释放、第二次激活保留已安装补丁（其他 cwd、不注册窗口事件、安装方窗口继续改写期限、窗口外调用保持原生而窗口内被延长、不报告冲突）、第二次激活停止已安装补丁（其他快照、其他包版本、本模块开关关闭、总开关关闭、键无效）、已停止的补丁对之后配置一致的激活保持停止、owner 退出（关闭窗口、仅当前全局函数仍是本模块包装时还原原生函数、注册表留下 `owner-stopped`、之后配置一致的激活报告该状态且不安装、会话切换只关闭窗口）、`/qol` 在之后停止后报告注册表状态、安装方激活配置快照变化、本版本无法读取的注册表槽位、读取设置抛错、设置根不是对象、未知键、总开关取值无效、改写区间、非法输入的 `TypeError` 行为、每个窗口一次提示、进程级副作用对非压缩调用方的影响、同一次压缩操作在同一个 signal 上串行回退后续方法（窗口、类型、会话 id、守卫租期与提示状态保持不变，只有一个监听器，改写持续到提交，之后的操作为全新一轮）、自动轮次或 `session.compacting` 先开启窗口时的同样情形、同一窗口内出现不同的活跃 signal、自动轮次进行中再次开始自动轮次、由各事件打开窗口、绑定到已打开窗口的 before-compact 信号、已经中止的信号、遗留监听器、守卫与取消与中止与切换与关闭结束窗口、重叠与外部会话拒绝、被替换后的还原，以及窗口事件注册失败与布局无法识别的注册表各自的 `/qol` 报告。保留路径与 owner 退出的真实 OMP CLI 运行仍待执行，不属于上述检查的覆盖范围。
- **真实 OMP CLI**：OMP `18.2.4`、high thinking 的 `pro-20x/gpt-5.6-luna` 与 `omp-qol 0.1.3` 在同一进程中完成了两次手动远端到本地的回退。该运行关闭 V2 流式压缩，加载不带探针的生产入口，临时排除三个旧 QoL 扩展，保留其他已安装扩展。两次远端失败均回退并提交 soft compaction；`/qol` 均保持 `compaction: enabled`，第二次操作再次报告期限改写，两次操作后的普通模型响应均成功。这验证了串行回退兼容性，不代表 V1 成功压缩或上游自然慢请求已经通过。要证明该调整对慢上游的收益，仍需真实远端请求持续超过 `300000 ms` 后成功，且后续普通模型请求仍可用。仅有 `900000` 日志不能证明这一收益。实验保持默认关闭。
- **上游变化**：远端看门狗随 `8b8651529d`（2026-06-13）引入，V2 流式压缩随 `102d6d54ad`（2026-06-28）引入并复制了该看门狗及其常量。两者都早于基线；基线之后改变五分钟限制且已定位的提交：无。

## 上游提交索引

| 提交 | 日期 | 变更 | 对应调整项 |
| --- | --- | --- | --- |
| [`529950711a`](https://github.com/can1357/oh-my-pi/commit/529950711a) | 2026-06-14 | 为任务轮询加入自适应等待阶梯。 | 持续等待 hub |
| [`5ff277349c`](https://github.com/can1357/oh-my-pi/commit/5ff277349c) | 2026-07-15 | 把工具面合并到 `xd://` devices 与 `hub`。 | 持续等待 hub |
| [`c93774f892`](https://github.com/can1357/oh-my-pi/commit/c93774f892) | 2026-06-17 | 实现 session stop hook 语义及其续跑上限。 | 上游错误后续跑 |
| [`a418920ec1`](https://github.com/can1357/oh-my-pi/commit/a418920ec1) | 2026-08-03 | 改变 `/reset` 语义，增加链重置路径。 | 上游错误后续跑 |
| [`f6c5a43a1f`](https://github.com/can1357/oh-my-pi/commit/f6c5a43a1f) | 2026-08-06 | 处理订阅额度耗尽导致的重试预算耗尽及其措辞。 | 上游错误后续跑 |
| [`8b8651529d`](https://github.com/can1357/oh-my-pi/commit/8b8651529d) | 2026-06-13 | 用五分钟请求超时修复挂起的远端压缩请求。 | 延长单个压缩期限 |
| [`102d6d54ad`](https://github.com/can1357/oh-my-pi/commit/102d6d54ad) | 2026-06-28 | 实现带独立看门狗的 V2 流式远端压缩。 | 延长单个压缩期限 |

日期为提交日期。这些提交通过在现行路径的文件历史中搜索上文提到的标识符定位；某行为没有列出提交，表示没有检索到。
