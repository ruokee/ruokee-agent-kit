# ADR 提案：为 omp-qol 增加原生重放调整

Draft owner: Ruokee
Draft writer: deepseek/deepseek-v4.1-flash

[English](./2026-09-22-add-native-replay-adjustment.md) | 中文

## 动机

OMP 18.2.4 按请求决定 `openai-responses` 调用重放会话携带的原生条目，还是在本地重新编码对话，依据是 provider 会话状态上的一个字段。[`openai-responses.ts:1194`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/providers/openai-responses.ts#L1194) 读取 `providerSessionState?.nativeHistoryReplayWarmed ?? true`。该状态创建时字段为 false（[`openai-responses.ts:237`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/providers/openai-responses.ts#L237)），只有在一次成功且产出可重放条目的请求之后才置真（[`openai-responses.ts:899`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/providers/openai-responses.ts#L899)）。这些状态存放在会话持有的 Map 中（[`agent-session.ts:881`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/coding-agent/src/session/agent-session.ts#L881)），因此无论会话文件多热，新进程开始时该字段都是 false。

于是被接管的会话首条请求走本地重编码形态：丢掉 reasoning 条目、按本地方式重写助手条目；而写下该会话的进程是以重放原生条目结束的。两种形态从第一个被重编码的条目起就不同，因此覆盖整段 prompt 的提示缓存无法服务接管会话的首条请求，而第二条请求还要再付一次代价，因为它已切换成首条请求没有写入的重放形态。

在本机、OMP 18.2.4、`pro-20x/gpt-5.6-luna`、单轮非交互运行下测得：一个约 19k prompt token 的会话，接管后首条请求报 2,387 个未命中 input token；而同样位置、请求已携带重放形态时为 362。差距随对话增长：一次记录在案的生产会话约 98k token，首条请求付 84,490 个未命中 token，第二条 76,522 个（只命中两种形态共有的 21,632 静态前缀），第三条 7,332 个。

宿主没有请求级的重放策略，没有相关设置，也没有持久化的预热标记：该字段是只有宿主写入的进程内状态。本地调整仍能决定宿主创建该状态时读到的值。

## 提议

### 能力与位置

在现有 `omp-qol` 组件中新增第四个模块 `replay`，实现位于 `projects/omp-qol/src/native-replay.ts`，由 `projects/omp-qol/src/extension.ts` 接入并与其他模块一同上报。它的开关是 `replayEnabled`，默认为真，受组件主开关 `enabled` 约束。组件保持现行决定赋予它的契约：一个包、一次安装、一个配置入口、一套检查，各模块各自拥有开关、可用状态与失败上报。

### 挂载点

模块在启用期间安装一个进程级的 `Map.prototype.set` 包装。包装按宿主写入 `openai-responses` provider 状态所用的键来识别这些写入 —— `openai-responses:<provider>`（[`openai-responses.ts:168`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/providers/openai-responses.ts#L168)、[`openai-responses.ts:256`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/providers/openai-responses.ts#L256)）—— 以及它收到的值上的该字段。命中时，包装在宿主存入该状态之前把字段置真；其它调用（包括非法输入）原样转交给先前的实现。

调整只改宿主创建对象时的一个字段，不改模型、不改流选项、不改请求体，也不改 provider 调用本身的任何行为。

### 效果

新进程的首条请求走上一进程请求已经走过的路径，因此它的头部与上一进程结束时的请求一致，只有新回合追加的条目未命中缓存。调整消除的是两种形态之间的切换；除了宿主在后续每条请求上本就选择的条目形态之外，它不决定请求内容。

### 归属与生命周期

一个进程共用一个包装，其效果不取决于由哪个会话创建状态，因此进程内每个请求该模块的激活共享这一次安装。

- 首个在模块启用状态下运行的激活安装包装；后续激活在包版本相同且模块启用时保留它，并把模块上报为已启用，而不是第二个所有者，因为没有窗口、事件或会话 ID 决定该包装改写什么。
- 安装方会话结束时包装保持安装。它预热过的状态属于可能仍在运行的会话，否则同一进程后续创建的状态会退回重编码形态。
- 生效设置使模块保持关闭，或设置无法读取、被拒绝的激活，恢复先前的 `Map.prototype.set` 并上报原因。组件既有的「任何模块都不在它读不到的取值上运行」规则不变。
- `Map.prototype.set` 缺失或不可写时，模块拒绝安装，并通过日志与 `/qol` 上报原因。
- 当前的 `Map.prototype.set` 不再是本模块的包装时，状态上报 `patch-overwritten`，而不是已启用。
- 状态同时上报包装改写过的状态写入次数，使宿主在键或值形态上的变化表现为改写次数为零，而不是无声的成功。

### 诊断与文档

`/qol` 增加该模块的一行，含生效开关与改写次数。`projects/omp-qol/docs/adjustments.md` 及其中文对应文档增加该模块的章节，包含原生行为、为什么需要、挂载点、设置、副作用与取消、适用性与限制、版本与验证。README 对、包描述与设置 schema 在同一变更中写出第四个模块。组件发布为 `0.3.0`。

## 考虑过的替代方案

- **经拓展 provider 接缝注册一个委托给 Responses provider 的自定义 API。** 在寻找受支持的、能触达 provider 调用的方式时考虑过。`pi.registerProvider` 可注册一个自定义 API ID，其 `streamSimple` 可以委托给 `streamOpenAIResponses`（[`openai-responses.ts:986`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/providers/openai-responses.ts#L986)），且调度器优先使用已注册的自定义 API，而非内置分支（[`stream.ts:1695`](https://github.com/can1357/oh-my-pi/blob/1c0303b1f2ec515cbf4b44a9a49d68a029531aac/packages/ai/src/stream.ts#L1695)）。要走到该委托，会话的模型必须携带该自定义 API ID，这要么重新声明 provider 的整个模型列表，要么改写注册表中的模型对象；而宿主代码在多处按 `model.api === "openai-responses"` 分流 —— 工具选择、`textVerbosity` 流设置、图片预算、Responses 家族的会话消息投影，以及模型切换后与压缩后的 provider 会话清理。这些分支会走另一条路径，而请求体仍由 Responses provider 产出，而本调整要保护的缓存前缀恰恰取决于这些请求体字段。放弃：它的影响面比它所替换的那个字段更宽、更不易观测。
- **不给 provider 传会话状态，让 `?? true` 默认选择重放。** 与委托路线一并考虑，作为不碰该字段而强制重放形态的方式。它同时丢弃进程为 provider 保留的严格工具状态、reasoning effort 回退记忆和 `previous_response_id` 有状态基线，用缓存性质换来这些传输行为的代价。放弃。
- **新建独立组件，而不是放在 `omp-qol` 内的模块。** 在决定调整落脚点时考虑过。这类补丁需要的进程补丁纪律 —— 全局 symbol 中的注册表、拒绝原因、从进程读取的状态上报、设置激活与 `/qol` 行 —— 在 `omp-qol` 中已经存在，第二个组件会重复它，并要求用户维护两套安装同步。放弃。
- **在传输层改写外发 prompt 请求体，使首条请求逐字重复上一进程的条目。** 在寻找不依赖宿主状态的调整方式时考虑过。它把只有宿主才能维护的 provider 原生条目（加密 reasoning、条目顺序、response id）交由拓展负责，任何不匹配都会发出宿主从未校验过的请求体。放弃。
- **要求宿主提供重放策略开关。** 作为长期修复考虑过：请求级或会话级开关会让本调整不再必要。本仓库不修改宿主，该请求另行作为给项目的报告存在。此处不采纳。

## 验收标准

- 在 OMP 18.2.4 上，主开关开启且 `replayEnabled` 为默认值时，模块上报已启用；接管进程的首条请求携带重放形态：用真实 OMP CLI 验证，比较外发请求体与上一进程最后一条请求 —— 前导条目相同，其后只跟随新回合的条目。
- `replayEnabled: false` 或主开关关闭时，不安装包装，`Map.prototype.set` 就是进程启动时的那个函数。
- 包装不认识的调用原样抵达先前的实现。单元测试覆盖：被识别的键与值形态；其它 provider 状态键（`openai-codex-responses`、`anthropic-messages`、`openai-completions:`）与非字符串键；不是 provider 状态的值；`Map.prototype.set` 缺失或不可写；安装后被其它拓展替换的包装上报为 `patch-overwritten`；第二个激活保留安装并把模块上报为已启用；设置关闭模块的激活恢复先前的函数。
- 组件检查通过，模块文档、README、包描述与设置 schema 在同一变更中以两种语言落地。组件版本为 `0.3.0`。

## 风险

- 包装作用于进程中每一次 `Map.prototype.set`，包括与 provider 无关的代码。实现代价高时，宿主所有写入 Map 的位置都要付这笔开销。对预期形态做的 200 万次调用基准中，字符串键在原生函数下为 150.2 ms、在包装下为 154.1 ms，数字键无可测差异；这条路径上的退化是进程级代价，而不是 provider 局部代价。
- 模块读取的宿主形态可能变化而不产生任何编译错误：另一个状态键、另一个字段名，或带有自身 `set` 的 `Map` 子类。此时模块不改写任何内容却仍上报已安装，用户以为调整生效而继续支付重编码代价。上报的改写次数是唯一的本机信号，且只有读取 `/qol` 时才能看到。
- 另一个拓展在本模块之后包装 `Map.prototype.set`，会改变宿主调用的函数。若上报前不做比较，`/qol` 会显示一个已不再运行的调整，代价仍在、工具却说相反。
- 让首条请求处于预热状态意味着它会重放更早进程存入的条目。端点拒绝这些条目时（过期或与账号绑定的 reasoning），首条请求会付出重编码形态本不会冒的失败，而模块无法把这种情况与健康重放区分开。宿主的重放路径会回退并重置其基线，代价被限制在该次请求内。
- 同一进程内的两个会话共用一个包装。后续激活关闭模块后，其后创建的状态退回重编码形态，而先前创建的状态仍是预热形态，进程会保持混合状态直到重启。
