# 压缩请求用量

[English](./usage.md)

## 原生行为

以下源码基线描述本模块补偿的宿主缺口。激活时检查实际宿主能力，不只根据版本号决定是否补偿。

会话压缩时，OMP 会发出自己的摘要请求：`soft` 方法的 summary、short-summary 与 turn-prefix 调用，以及 `handoff` 方法的请求，各自带自己的 oneshot 类型（[`compaction.ts:1012`](https://github.com/can1357/oh-my-pi/blob/9348320cc4a30a7195d36a1f05a6c11bcb701a17/packages/agent/src/compaction/compaction.ts#L1012)、[`compaction.ts:1226`](https://github.com/can1357/oh-my-pi/blob/9348320cc4a30a7195d36a1f05a6c11bcb701a17/packages/agent/src/compaction/compaction.ts#L1226)、[`compaction.ts:2098`](https://github.com/can1357/oh-my-pi/blob/9348320cc4a30a7195d36a1f05a6c11bcb701a17/packages/agent/src/compaction/compaction.ts#L2098)、[`compaction.ts:1112`](https://github.com/can1357/oh-my-pi/blob/9348320cc4a30a7195d36a1f05a6c11bcb701a17/packages/agent/src/compaction/compaction.ts#L1112)）。每个请求都会在遥测通道的 chat usage 事件上报告提供方的 token 数与分项成本（[`telemetry.ts:1489`](https://github.com/can1357/oh-my-pi/blob/9348320cc4a30a7195d36a1f05a6c11bcb701a17/packages/agent/src/telemetry.ts#L1489)），而它本身只是一次请求：方法要的是答案，账单不在其中。

默认安装下该通道是关闭的。包装层只在 agent 带有遥测配置时才创建 span（[`telemetry.ts:492`](https://github.com/can1357/oh-my-pi/blob/9348320cc4a30a7195d36a1f05a6c11bcb701a17/packages/agent/src/telemetry.ts#L492)），而压缩与 handoff 的调用点在每次调用前从 agent 解析该配置（[`session-maintenance.ts:3410`](https://github.com/can1357/oh-my-pi/blob/9348320cc4a30a7195d36a1f05a6c11bcb701a17/packages/coding-agent/src/session/session-maintenance.ts#L3410)、[`session-maintenance.ts:4819`](https://github.com/can1357/oh-my-pi/blob/9348320cc4a30a7195d36a1f05a6c11bcb701a17/packages/coding-agent/src/session/session-maintenance.ts#L4819)、[`session-handoff.ts:182`](https://github.com/can1357/oh-my-pi/blob/9348320cc4a30a7195d36a1f05a6c11bcb701a17/packages/coding-agent/src/session/session-handoff.ts#L182)）。没有配置时不会创建 span，也不会发出用量事件，提供方的数字随请求返回就被丢弃。

会话文件里本来就有它们的位置：`model_usage` 条目（[`session-entries.ts:82`](https://github.com/can1357/oh-my-pi/blob/9348320cc4a30a7195d36a1f05a6c11bcb701a17/packages/coding-agent/src/session/session-entries.ts#L82)），通过会话管理器自身的接口写入（[`session-manager.ts:3283`](https://github.com/can1357/oh-my-pi/blob/9348320cc4a30a7195d36a1f05a6c11bcb701a17/packages/coding-agent/src/session/session-manager.ts#L3283)），会话统计会把活动分支上的每个此类条目计入总计（[`session-stats.ts:75`](https://github.com/can1357/oh-my-pi/blob/9348320cc4a30a7195d36a1f05a6c11bcb701a17/packages/coding-agent/src/session/session-stats.ts#L75)、[`session-stats.ts:173`](https://github.com/can1357/oh-my-pi/blob/9348320cc4a30a7195d36a1f05a6c11bcb701a17/packages/coding-agent/src/session/session-stats.ts#L173)）。judge 就是这样记录自己的辅助请求的（[`judgment/index.ts:113`](https://github.com/can1357/oh-my-pi/blob/9348320cc4a30a7195d36a1f05a6c11bcb701a17/packages/coding-agent/src/judgment/index.ts#L113)、[`judgment/index.ts:121`](https://github.com/can1357/oh-my-pi/blob/9348320cc4a30a7195d36a1f05a6c11bcb701a17/packages/coding-agent/src/judgment/index.ts#L121)）。压缩与 handoff 请求没有这样做，于是会话文件少算了它执行过的每次压缩的成本，基于这些统计的报告、预算或配额视图也同样偏差。

上游把该缺口记为 [issue #15031](https://github.com/can1357/oh-my-pi/issues/15031)，并在 [pull request #15034](https://github.com/can1357/oh-my-pi/pull/15034) 中修复。在带该修复的宿主发布之前，本调整补上宿主跳过的这一步。

## 动机

这些请求由提供方计费，而发起它们的会话不体现。缺口随会话增长：长对话每压缩一次就付一次摘要请求，而 handoff 请求承载整段保留历史。

## 接入

本调整替换宿主 `Agent` 原型上的 `telemetry` 访问器，也就是压缩与 handoff 调用点读取的那个值。

- 没有配置时，它给出惰性配置：一个会创建宿主本来会创建的 span、记录本模块读取的属性、且不导出任何内容的 tracer。span 不携带内容，宿主对它回答的 `isRecording` 为 `false`。
- 已有配置时，它保留用户设置的每个字段，包装宿主本来会用的 tracer，并以收到的东西调用用户的 `costEstimator` 与 `onChatUsage`。用户的 tracer 继续收到自己的调用与自己的 `this`；包装层转发它认识的每个 span 方法，且不向导出添加任何内容。已经带有这些包装层的配置会先被解包：宿主交给子 agent 的是它从父会话读到的配置的浅拷贝（[`sdk.ts:2385`](https://github.com/can1357/oh-my-pi/blob/3e3c488a58d294e3a10051da588628e2cfb9d35c/packages/coding-agent/src/sdk.ts#L2385)，[`task/executor.ts:4252`](https://github.com/can1357/oh-my-pi/blob/3e3c488a58d294e3a10051da588628e2cfb9d35c/packages/coding-agent/src/task/executor.ts#L4252)），照原样包装这份拷贝会把本模块嵌进它自己的包装层，使每个宿主回调被处理两次。
- 请求由宿主盖在该请求自己 span 上的 oneshot 类型识别（[`telemetry.ts:153`](https://github.com/can1357/oh-my-pi/blob/9348320cc4a30a7195d36a1f05a6c11bcb701a17/packages/agent/src/telemetry.ts#L153)、[`telemetry.ts:1853`](https://github.com/can1357/oh-my-pi/blob/9348320cc4a30a7195d36a1f05a6c11bcb701a17/packages/agent/src/telemetry.ts#L1853)）；span 的其他属性不读，也不触及请求、模型、缓存键、历史或会话文件。
- 白名单为四类：`soft` 的三个摘要类型与 `handoff`，对应 `compaction:summary`、`compaction:short-summary`、`compaction:turn-prefix` 与 `compaction:handoff`，即上游修复所解析的 purpose。该列表是封闭的：`compaction_native` 与 `branch_summary` 属同一族但修复同样不记录，宿主标注的其他类型都属于宿主已记账的调用方。
- 一个完成的请求写一条用量条目，通过 `appendModelUsage` 写入解析出的 purpose、实际运行的 api、provider 与 model、提供方的 token 数、提供方给出的分项成本（宿主携带时）、从该请求自身 span 属性读到的停止原因，以及活动会话的分支位置。请求身份由 provider 与 model id 共同确定，经会话自身的模型注册表解析。事件携带的 provider 是遥测标签，即多个 provider id 归一化后的名字（默认 `openai-codex` 报成 `openai`，宿主也可以安装任意映射），因此标签本身不是身份：宿主报告原始 provider id 时按该 id 解析，否则只有注册表中该 model id 唯一对应一个 provider 时才接受。写入的 provider 是解析出的 provider id，不是标签。解析结果指向别的 provider、在两个提供同一 model id 的 provider 之间择一，或把与注册 provider 同名的标签当成请求本身的身份，都不算解析成功：不会把别的模型的 api 与 provider 写到这条条目上，该请求保持不写入。
- 补丁是进程级的，放在一个注册表槽位中。安装方只有一个：后续激活（同一 runtime 或其他 runtime）把自身会话注册到已安装的补丁上，不再安装第二个，因此事件落到请求所属会话的日志，而不是恰好安装补丁的那个会话。
- 会话按事件的 conversation id 定位，事件不带时按该 agent 实例所属会话定位。没有活动会话，或注册表无法命名其身份的请求不写入。
- 切换日志的会话保持在补丁中：`/new`、`/resume` 与 fork 保留同一个会话管理器，只把它换到另一个会话 id，因此模块订阅 `session_switch` 并按管理器当前 id 重新注册。它离开的那个 id 同时被丢弃，因此仍指向旧 conversation 的请求找不到会话，而不会写进新会话里。
- 设置无法读取或被拒绝的激活会停止其他激活安装的补丁，自己则什么都不安装。已停止的补丁保留其原因：`/smart-context` 读取实时注册表，因此停止状态在该进程的每个会话都会报告，而不只是看到停止的那个会话。
- 自己记录这些请求的宿主会从 `@oh-my-pi/pi-agent-core` 导出 `compactionRequestUsage`，这正是上游修复新增的符号。本调整在激活时读取该符号，在那种宿主上以 `host-records-usage` 保持停用，因此下一个带修复的 OMP 版本会让补偿停用，而不是把条目写两遍。

## 设置

`compactionUsageEnabled` 默认 `true`，接受 boolean，没有总开关。取值非法只停用本模块，其他模块不受影响；未知键或无效根对象会拒绝整个组件配置。修改后重启 OMP。

## 副作用

- 补丁是进程级的。进程里每个 agent 读到的都是它给出的配置，即用户自己的配置加上本模块的钩子，因此用户的 tracer、钩子与导出继续服务它们原本服务的每个 span。子会话的配置是它父会话读到的那份配置的副本，本模块自己的包装层会在重新包装该 agent 的配置前被解包，因此无论多少层会话相互继承，一次宿主回调只到达本模块一次。
- 未配置遥测时，补偿会让宿主为压缩与 handoff 请求创建并运行插桩包装层，而此前它会直接短路。代价在包装层自身的工作，而不在导出：惰性 tracer 不导出任何内容，本模块也不添加内容属性、span 链接或自己的事件。
- 只替换 `telemetry` 访问器，且只在宿主 `Agent` 原型上。宿主的 `setTelemetry` 路径、主回合读取的私有字段以及其他类成员保持原样，因此普通回合行为不变，包括在已配置遥测的宿主上的回合。
- 拒绝安装时会还原它替换掉的访问器。自身开关要求关闭该补偿的激活会释放进程中已有的访问器；设置无法读取的激活会释放另一运行时安装的补丁；其他拓展替换掉已安装的访问器时，本模块按已被替换释放它。

## 取消

- 取消本调整：把 `compactionUsageEnabled` 设为 `false` 后重启 OMP，或直接不带该扩展启动。不写任何磁盘状态，进程结束即消失；已写入的条目留在所属会话中，作为带 `compaction:` purpose 的普通 `model_usage` 条目。

## 边界

- 只写上述四种 purpose。原生压缩、分支摘要、评估补全、技能描述与图片问答的用量留在原处。
- 未消耗任何 token 的尝试（例如快照全为零的取消或失败请求）不写任何内容。以错误状态结束但确实计费的尝试只要报告了 token 就会写入。
- api 无法解析的请求不写入，并在 `/smart-context` 中计为 `unrecorded=api-unresolved`，而不是给一个猜出来的 api。解析结果指向别的 provider，或在两个提供同一 model id 的 provider 之间择一，都不算解析成功：错误的 api 会让统计看起来像被修好了。会话不再注册时同样如此。
- 提供方的分项成本来自 estimator 路径，宿主自 [`a3cdfbdd58`](https://github.com/can1357/oh-my-pi/commit/a3cdfbdd58b6647e216bc5dd3d7df8519f74de9a)（[2026-10-01](https://github.com/can1357/oh-my-pi/commit/a3cdfbdd58b6647e216bc5dd3d7df8519f74de9a)，"fixed telemetry to export provider-computed chat cost"）起携带该字段。没有该字段的宿主上，条目以零成本写入并计为 `costMissing`；本模块从不自行估算价格。
- 条目携带实际运行的 purpose、api、provider 与 model，以及请求报告的用量与停止原因。它不携带请求内容、摘要、交接文档或模型角色，本模块也不存储任何自己的内容。
- 本模块依赖：宿主 `Agent` 原型带有可读的 `telemetry` 访问器；会话管理器接受用量条目；chat usage 事件携带该请求自己的 span；该 span 上可读到 oneshot 类型。宿主不再盖类型戳、把本模块没见过的 span 交给事件，或读取不再经过该访问器，都会让本调整不写入或保持停用，而不会写入错误条目，下面说明的分支位置除外。
- 归属到错误分支的用量会对它本应修正的统计不可见。条目跟随请求完成时的当前分支，也就是该压缩所属的分支，因为压缩在其分支上运行并阻塞该分支直到结束。
- 补偿的已知边界：在宿主自身包装层内被重试掉的尝试无法从本模块读取的事件中恢复。本模块读取事件所指的 span，而宿主的重试在该请求内部进行。

## 历史验证

以下记录来自迁入 `omp-smart-context` 前的 QoL 实现，保留当时的 `/qol` 命令、版本、条件和边界。当前包检查见[验证](./verification.zh.md)。

- **源码基线**：遥测通道、oneshot 类型、压缩与 handoff 调用点、用量条目接口与统计读取方依据 OMP `18.5.0`，提交 `9348320cc4a30a7195d36a1f05a6c11bcb701a17`；提供方计算成本字段依据已安装的 `18.8.3` 阅读（[`a3cdfbdd58`](https://github.com/can1357/oh-my-pi/commit/a3cdfbdd58b6647e216bc5dd3d7df8519f74de9a)）。源码位置如上。
- **退出条件所在界面**：[pull request #15034](https://github.com/can1357/oh-my-pi/pull/15034) 由宿主自己记录这些请求，并为此从 `@oh-my-pi/pi-agent-core` 导出 `compactionRequestUsage`；本调整读取该导出。
- **自动检查**：OMP `18.5.0`，`bun test` 与 `tsc --noEmit`，以记录宿主替代已安装宿主。覆盖 purpose 表、零 token 与非压缩类型的跳过、成本认领及其一次性、拒绝集合（无访问器、无用量的写入方、无法读取的注册表布局、被替换的访问器、runtime 未接受的安装、自己记录这些请求的宿主）、保留用户 tracer 与用户自己的钩子、惰性 tracer、继承自父会话一次的配置与继承两次的配置，以及继承配置而其会话目录在两个 provider 下提供同一 model id 的情形，注册表的访问器身份契约、请求自身身份解析（同一 model id 属于别的 provider、原始 provider id 在本会话没有对应模型、同一 model id 由两个 provider 提供、以及标签与某个注册 provider 同名但该 model id 在本会话由两个 provider 提供，都不写入并计数；唯一一条目录条目与请求自己的 provider id 则解析成功）、写入的 provider、切换日志的会话与被丢弃的旧 id，以及 `/qol` 行。
- **真实 OMP CLI**：OMP `18.8.3`，使用会话配置的 provider 与 model，开启 `compactionUsageEnabled` 并从本检出加载扩展。观察到：一次手动 `soft` 压缩写入 `compaction:turn-prefix`、`compaction:summary`、`compaction:short-summary` 三条条目，其 `api: openai-completions`、provider 与 model 与宿主自身主回合条目一致，成本与宿主自己的单 token 价格吻合；另一次 `soft` 压缩写入它的两个请求而没有第三个，因为该次运行的 short summary 已足够、未发出 summary 请求；一次自动 `handoff` 压缩为每个请求写入 `compaction:handoff` 条目，带输入、输出与缓存读取 token 及提供方成本；在只允许 handoff 的方法顺序下手动 `/compact` 被宿主拒绝且未写任何条目；`/qol` 在这些会话中分别报告 `compactionUsage: enabled (entries=3)` 与 `(entries=2)`，没有 `costMissing` 也没有 `unrecorded`。在其中一个会话中，宿主自身 `/session` 统计在一次 `soft` 压缩前后正好变动了该次压缩写入的两条条目（输入 201 → 774，输出 2 → 317，总计 4,939 → 5,827，成本 0.0000 → 0.0003），这正是此前缺失的增量。
- **真实 OMP CLI，会话切换**：一个会话先压缩，再用 `/new` 切换，随后再次压缩，三步同处一个进程。第二次压缩把它的 `compaction:turn-prefix` 与 `compaction:short-summary` 条目写进了该会话切换到的日志，`/qol` 报告 `compactionUsage: enabled (entries=4)`，没有 `costMissing` 也没有 `unrecorded`。每条写入条目都是 `api: openai-completions`、本次会话自身的 `provider`、`model`，与宿主在同一日志中为自己主回合助手消息记录的 provider、model 与 api 一致。
- **真实 OMP CLI，标签冲突**：同一宿主上压缩了一个会话。它写入的 `compaction:turn-prefix`（输入 135、输出 169、缓存读取 128）与 `compaction:short-summary`（输入 323、输出 173）两条条目，以及该日志中宿主自己的主回合条目，都是 `api: openai-completions`、同一组 `provider`、`model`，`/qol` 报告 `compactionUsage: enabled (entries=2)`，没有 `costMissing` 也没有 `unrecorded`。本部署的标签与 provider id 是同一个字符串，因此这次运行只说明更严的规则不会挡掉身份可达的请求，不代表它能判定归一化过的标签。
- **未验证**：`compaction_native` 与 `branch_summary` 请求（按设计不在范围内）、已自行记录这些请求的宿主（退出路径只针对替身导出运行，未对已发布带修复的宿主运行）、本次所测压缩以外的跨压缩恢复会话、非 TUI 模式，以及两个会话在同一进程并发压缩的情形。继承路径由记录宿主与阅读宿主如何拷贝父配置共同覆盖，没有实机运行覆盖它。真实宿主上身份无法解析的请求同样未覆盖：该跳过由记录宿主与针对锁定宿主遥测的独立探针覆盖。本部署的提供方不做归一化，因此实机运行中原始 provider id 与标签是同一个字符串；会归一化标签、又不报告原始 provider id 的宿主仅由记录宿主与这些探针覆盖，且当该 model id 在会话中由多个 provider 提供时，该请求一律不写入，而不是靠标签取舍。
- **上游历史**：`479e14a71c`（2026-10-09）开始在会话日志中记录 `soft` 与 `handoff` 请求用量，`f4db4d7e64`（2026-10-09）补记被丢弃的模型请求（含过期的投机摘要），`cef6b029b4`（2026-10-09）记录计费的失败尝试并导出 `compactionRequestUsage`，`a3cdfbdd58`（2026-10-01）把提供方计算的 chat 成本导出给估算路径。这些改动经 [pull request #15034](https://github.com/can1357/oh-my-pi/pull/15034) 合入。

## 上游复核

[pull request #15034](https://github.com/can1357/oh-my-pi/pull/15034) 合并后，复核目标宿主的原生记账及会话统计。移除补偿前，确认宿主导出 `compactionRequestUsage`、记录相同 purpose 和分项成本，并把条目计入活动窗口。随后移除本模块的代码、设置、文档和测试，更新组件规格，以决定记录移除。远端及 Handoff 对齐保持独立，既有用量条目留在会话 journal 中。
