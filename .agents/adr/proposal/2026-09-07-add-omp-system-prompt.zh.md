# ADR 提案：添加 OMP 系统提示词扩展

Decision owner: Ruokee
Draft writer: OMP GPT-6 Astra

[English](./2026-09-07-add-omp-system-prompt.md) | 中文

## 动机

OMP 默认系统提示词将运行时能力与工程偏好、派发策略、人格、固定工作流程和无条件续行要求放在一起。维护者自有提示词应描述运行时和如实交付的契约，将工作方式和工程取舍留给适用的用户及项目规则。

静态 `SYSTEM.md` 不能保留默认装配契约。在 OMP 18.1.11 中，custom 包装保留部分上下文和资源信息，却不包含默认工具目录、内部资源目录和设备文档。插入的文本也不会作为模板递归渲染。

公开的 `before_agent_start` 事件提供已渲染的 `systemPrompt: string[]`，并接受替换数组，允许通过独立分发的扩展实现而不修改 OMP。公开的 `getCommands()` API 在启用 Skill 命令时也能提供 Skill 名称和描述，但不标识最终可见目录。因此，description 归一化必须核对其与事件输入的对应关系，并明确格式与覆盖范围限制。

证据基线为 OMP `v18.1.11`，提交 `e3106be68f778635da3a17106835ce2e0e6992af`：

- [提示词装配](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/system-prompt.ts#L988-L1055)分别生成主块、可选安全块、PROJECT 和可选活动仓库块。
- [扩展处理器链](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/extensibility/extensions/runner.ts#L1715-L1766)将每次替换结果传递给下一个处理器。
- [PROJECT 模板](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/prompts/system/project-prompt.md)同时包含上下文数据和固定要求，末尾 critical 块之后还可能有 append 文本。
- [Skill 命令元数据](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/extensibility/extensions/get-commands-handler.ts#L55-L64)在启用 Skill 命令时，通过 `getCommands()` 提供包含隐藏 Skill 的 `session.skills` 信息。[提示词过滤器](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/system-prompt.ts#L970-L972)另外排除隐藏 Skill，并要求存在 `read` 工具。
- [隐藏 Skill 语义](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/extensibility/skills.ts#L24-L29)保留资源访问及已启用的手动命令访问，同时将该 Skill 排除在系统目录之外。[手动调用](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/modes/skill-command.ts#L43-L68)将所选 Skill 与参数展开为归属于用户的消息。
- [旁路请求上下文](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/agent/src/agent.ts#L773-L802)默认使用当前生效的 Agent 提示词；Handoff 等调用者可以显式选择基础提示词。
- [Task 并发限制](https://github.com/can1357/oh-my-pi/blob/e3106be68f778635da3a17106835ce2e0e6992af/packages/coding-agent/src/task/index.ts#L574-L640)由会话 semaphore 根据 `task.maxConcurrency` 执行，独立于提示词中的 Cap 文字。

## 提议

### 分发一个自包含扩展

在 `projects/omp-system-prompt/` 添加第一方包 `@ruokee/omp-system-prompt`，通过原生 `omp.extensions` 元数据声明入口。运行代码、维护者自有英文提示词、检查和双语 README 均位于组件内。该选择遵循[第一方能力边界](../decision/2026-08-20-establish-first-party-capability-kit.zh.md)和[组件自包含契约](../decision/2026-08-24-keep-components-self-contained.zh.md)，无需反转这两个决定。

使用公开 OMP 扩展 API，不导入私有提示词装配器，不重新扫描资源，不复制上下文发现机制，也不收录上游模板副本。不依赖其他仓库组件中的文件或特定机器的安装。安装、启用、禁用和卸载采用原生机制，不替用户写入 `SYSTEM.md`。

扩展运行于未修改的 OMP 发行版。不修改上游源码或安装二进制，不依赖新增上游 API，也不通过 SDK 自主管理会话替代宿主来满足组件契约。

初始 peer dependency 精确限定为 OMP `18.1.11`，并通过公开的 `VERSION` 导出检查运行时版本。版本匹配只是必要条件，每次输入仍须通过支持格式检查。扩展版本范围前应核对源码和完成验证，不预先承诺整个 18.x。

### 分离静态策略与运行内容

自有提示词定义 OMP 身份、指令来源边界、上下文解释、工具可用性与恢复、授权内协作、范围、证据，以及完成与合理暂停的区别。不得宣称 XML 名称赋予内容权威，或所有用户内容都已净化。它不能代替宿主的消息来源和输入安全机制。

工程偏好、沟通风格、默认派发策略、兼容取舍和验证流程由适用的用户及项目规则承担，不自动复制或编辑这些规则。将已识别的默认人格、工程、工作流程、交付和无条件续行正文替换为自有契约。

保留 OMP 已选择并渲染的运行内容：

- 真实工具名、wire name、原生或内联描述、设备目录及内联文档、条件内部资源条目。
- Skill 名称、顺序及过滤结果，仅在下述条件成立时归一化目录 description 的空白。always-apply 规则正文与条件规则目录的顺序和文本保持不变。
- 已启用的 Computer Use 和 Scratchpad 约束、intent 字段与 opaque token 协议、专用工具及 AST 路由、已启用的自动 QA 指令。不因派发偏好使用条件渲染就将其保留。
- PROJECT 环境、已加载文件正文、已发现但未加载的路径、工作区树及根目录、append 文本和全部独立系统块，包括 Computer Safety、子 Agent 角色及 yield 指令。

PROJECT 必须区分已加载正文与仅发现的路径。将已识别的外层 `PROJECT` 标题改为 `# Project snapshot`，仅修改指定的外层加载说明，并移除宿主模板的完整三条 critical 要求。文件正文和 append 即使含相似标签或措辞也必须保留。其余 PROJECT 内容保持原位，不在新主块内重复生成。

### 定义自有静态结构

主块以以下身份正文开头：

```text
You are an assistant in Oh My Pi (OMP), a terminal-based coding agent. You are expected to be precise, and helpful. Fulfill the user's request with current capabilities.
```

顶层章节依次为 `# Instruction sources`、`# Project context`、`# Runtime capabilities`、`# Agent coordination` 和 `# Delivery`。Runtime capabilities 下依次包含 Tool access、Tool devices、Internal resources、Skills、Rules 和 Runtime modes。在 Tool access 下的 `### Tool inventory` 放置实际工具目录，在 Tool devices 下的 `### Mounted devices` 放置实际设备目录与内联文档。目录缺失时不生成示例条目。Delivery 下依次包含 Task scope、Completion、Evidence 和 Pausing。独立 PROJECT 块提供 `# Project snapshot`。

Internal resources 包含自有 URI 说明，其后接宿主实际 URI 条目。校验并丢弃宿主固定引导 `Most FS/bash tools auto-resolve these to FS paths.`，保留 URI 条目本身。审阅注释与历史动态示例不属于运行时提示词正文。

Agent coordination 仅包含以下两段自有英文正文：

```text
Delegate only as authorized by the user, applicable project rules, and active mode; available agent tools do not require delegation.

Provide each child its context, requirements, permissions, and expected result; do not assume shared conversation or loaded context. Use actual IDs, concurrency limits, channels, and retrieval protocols. Respect child restrictions; delegation cannot expand authorization. Accept results on evidence and required verification, not job completion alone. Track the whole deliverable and unresolved dependencies; child success is not overall completion.
```

校验并消费已识别的宿主 Delegation 区段，不将其中的 Cap 文字或额外 `hub` 通信条目放入任何自有槽位。不删除工具描述、运行时通知、子 Agent 指令或用户规则中独立说明这些能力的内容。宿主并发限制继续执行；这一选择减少了主策略正文中提前提示并发数值的信息。

### 利用 Skill 命令候选归一化可见描述

默认 Skill 列表没有编码可恢复的字段边界。一个 Skill 的 description 为 `First\n- beta: Second` 时，渲染结果可能与两个独立 Skill 相同。固定版本及 `- <name>:` 行模式不能检测所有此类歧义。

存在已识别的非空 Skill 目录时，使用当前公开 `pi.getCommands()` 中 `source: "skill"` 的条目作为辅助元数据。OMP 将此类命令命名为 `skill:<name>`，并提供描述与路径。不加载这些路径，不重新扫描资源。Skill 命令可能被关闭，其元数据包含隐藏 Skill，却不提供 `hide` 字段。哪些 Skill 可见仍以事件目录为准。

将有序 Skill 命令元数据作为候选。允许未使用的候选，包括隐藏 Skill；要求完整事件目录在经核对的 18.1.11 渲染格式下，与按原顺序选取的候选形成唯一完整对应。核对每个可见名称、条目顺序及已渲染描述，在修改任何字节前确定无歧义的 description 区间。匹配必须处理宿主格式化的影响，但不得导入私有装配器或复制上游模板。对应关系必须覆盖完整事件目录，不能仅凭名称或列表形状行推断可见性或描述边界。额外隐藏候选本身不是跳过归一化的理由。

在已匹配的事件 description 区间内，将每段连续空白替换成一个 ASCII 空格，并去除首尾空白。空白包括 LF、CRLF、制表符、空段落和 Unicode 行分隔符。保留所有非空白文字、Skill 名称、条目顺序及可见集合。元数据用于确定边界，不得恢复与宿主已渲染事件不同的源文本。输出的每个目录项占一行。不修改 Skill 文件、Skill 正文、规则、项目内容或其他动态描述。

缺失或受支持的空 Skill 目录保持缺失或为空，无需核对元数据对应关系。不得从命令清单补入 Skill。已经识别为本扩展生成的输出保持不变，无论其中的目录已经归一化，还是在 Skill 回退后保留了原文。不能仅因目录仍有多行描述而拒绝有效的自有输出，也不再将该输出与命令元数据重复比较。

完整 Skill 目录的外层边界已被唯一确定后，元数据缺失或格式错误、Skill 命令关闭、description 排版不受支持、description 对应有歧义，或前序处理器修改导致无法匹配时，逐字节保留整个原始目录。不只归一化碰巧匹配成功的条目。继续执行受支持的静态策略、工具、设备、内部资源及 PROJECT 变换。不改用纯文本条目猜测，也不替用户启用 Skill 命令。无法安全确定目录外层边界仍属于下述结构失败。

### 保留隐藏 Skill 与手动调用

隐藏 Skill 继续不出现在自动系统目录中，并保留宿主的 `skill://<name>` 访问，以及在 Skill 命令启用时由用户通过 `/skill:<name>` 调用的能力。其存在于命令元数据中，不得阻止对唯一匹配的可见目录进行归一化，也不得阻止其他提示词变换。不得为获得匹配而修改隐藏标记或命令设置、移除插件，或硬编码 Skill 名称排除项。

使用宿主已有的手动调用路径。保留被调用 Skill 的完整正文、用户提供的参数及用户归属，不对该消息执行目录 description 格式化。手动调用不要求将隐藏 Skill 暴露到自动目录中。扩展不另建调用机制，也不绕过已关闭的宿主命令。

### 区分 Skill 回退与整份提示词失败

使用当前 `event.systemPrompt`，不得以启动时快照或 `ctx.getSystemPrompt()` 代替处理器链输入。每轮独立处理。自有模板在扩展激活时加载；模板编辑通过重新激活或新会话生效，不提供文件监听。

识别支持的默认主块和唯一 PROJECT 块，不假设 PROJECT 位于固定索引。检查锚点顺序、数量、可选区段和目标文本的完整覆盖。每段来源内容必须归属于已识别固定策略、保留运行内容或已知分隔符，不得默默丢弃未知非空区段。

将嵌入正文视为不透明数据，不作为 XML 反序列化或模板递归渲染。经过核对的目录 description 区间空白修改是明确例外。拒绝有歧义的块或目录外层边界；仅限 description 对应的歧义采用 Skill 回退。不全局替换所有 `skills` 或 `critical` 标签。文本识别与元数据对应关系均不能认证模仿宿主格式的任意输入的真实性。

主块、PROJECT 及其他结构检查通过后才生成替换结果。Skill 槽位使用完整归一化后的目录，或 Skill 回退时保留的完整输入原文。相对于事件输入，数组结构、块的相对顺序和未修改文本必须逐字节保留。不承诺恢复 OMP 发出事件前已经改变的排版，不把系统块压成一个字符串，也不从另一个 API 重新生成工具 Schema。

空输入保持为空。重复处理本扩展输出不能追加重复内容。没有实际变化时不返回 `systemPrompt`。未知版本、custom 提示词、自有模板损坏、结构锚点缺失或重复、保留的 Skill 目录之外的未知目标区段，以及外层边界歧义，均保持整个输入数组不变。Skill 回退不能允许跨越未识别的结构边界进行替换。已唯一识别的目录内部 description 匹配失败，不阻止其他变换。

区分“替换已应用但跳过 Skill 格式化”与“整份提示词失败导致替换未应用”。报告受影响范围及简短原因，不包含提示词正文或私人上下文；仅针对 Skill 的诊断不得声称整份替换未应用。交互模式使用宿主通知，其他模式使用宿主日志；每个会话内对相同诊断去重，同时区分这两种失败范围。两种回退都不会阻止模型请求，后序处理器仍可能覆盖已应用的替换。

### 明确覆盖边界

扩展覆盖普通主会话 turn，以及重新绑定父会话扩展的普通子 Agent turn。保留各子 Agent 的角色、yield 协议和独立块。受限工具及 plan-mode 子 Agent 不加载扩展，不在覆盖范围内。

Handoff 生成使用基础提示词，标题生成采用独立路径，两者均不由本轮钩子覆盖。`/btw` 等临时旁路请求不独立运行该钩子，而是使用当前生效的 Agent 提示词，可能复用当时有效的 override。不得将其描述为始终使用基础提示词，也不承诺独立刷新替换结果。不通过 Provider 载荷补丁模拟全局替换钩子。

覆盖有效期是一个 Agent turn，不是一次 Provider 请求。宿主在轮中重建时保留 override，因此转换后的目录描述轮次开始时的装配结果，不保证即时更新。当前工具定义和宿主能力通知仍为依据，下一次启动事件转换新的输入。

保留前序扩展的独立块。前序修改若导致目标外层结构无法识别，则诊断并不替换。修改仅限于已安全分离的 Skill 目录且导致 description 无法对应时，只执行 Skill 回退。后序处理器可以覆盖结果。扩展不调整其他扩展的顺序，也不宣称对最终 Provider 请求拥有优先权。

## 考虑过的替代方案

### 使用 SYSTEM.md 或 custom-prompt 参数

这是更简单的原生替换入口，参与基础装配，也能影响 turn 钩子之外的路径。但在 18.1.11 中，它不保留所需的默认运行内容，custom 正文也不接受递归插值。重建被省略的目录会复制宿主职责，因此本扩展不采用这条路线。

### 修改 OMP 共享装配或使用 SDK 自主管理会话

共享装配器持有结构化数据，通过 SDK 管理的会话也有更底层的替换回调。但两者改变了在未修改宿主上独立安装扩展的要求。即使归一化或路径覆盖无法保证，这些方式也不进入本组件范围。按适用情况使用文档规定的 Skill 或整份提示词回退；这些限制不引入修改上游的前提。

### 改写 Provider 请求

更底层的 Provider 钩子操作 Provider 载荷，覆盖范围不同，宿主文档说明 devin-agent 路径不支持该钩子。它会引入 Provider 专用转换，却不能补足缺失的结构化来源数据。不用它弥补 turn 钩子的范围限制。

### 仅按列表语法归一化描述

将每个 `- <name>:` 行视为新 Skill，适用于描述不会模仿该语法的情况。但它可能将续行静默变成可见 Skill，而且无法检测每种违规输入。因此要求匹配公开元数据，不采用这一源文本假设。

### 所有目录描述保持原样

一律保留目录描述可以避免重建描述区间，但即使匹配元数据可用，也不会归一化普通多行条目。Skill 匹配失败时保留整个目录，同时执行其他受支持的变换。不能仅因元数据还包含隐藏 Skill，就以保留原文为由跳过已唯一匹配的可见目录。

### 要求目录完全相同并在不匹配时放弃全部替换

要求完整命令清单相等可以简化对应检查，但隐藏 Skill 和关闭的 Skill 命令会使原本有效的静态策略替换也无法执行。这把提示词的核心变更与目录格式化绑定。因此允许未使用的元数据候选，将 description 匹配失败限制在 Skill 目录内部；仅在结构或激活失败时回退整份提示词。

## 验收标准

1. 包能在未修改的 18.1.11 中通过原生 OMP 机制安装与加载。文档说明精确版本、格式、会话、元数据、回退和扩展顺序边界，不依赖私人文件、宿主补丁或其他仓库组件。
2. 成功输出符合指定身份正文、章节顺序、工具和设备标题、URI 引导处理及两段 Agent coordination 正文。被移除的宿主 Delegation 片段不迁移至其他自有槽位。实际工具描述、运行通知及独立指令保持完整。
3. 支持的原生工具、内联描述和 Code Mode 输入保留真实访问路径及全部必需描述。条件设备、规则、Skill、模式和 URI 条目来自宿主输入，不来自包内示例。
4. 与有序命令候选形成唯一完整对应时，支持将 LF、CRLF、制表符、空段落及 Unicode 行分隔符归一化为单行 description，保留非空白文字、名称、顺序及可见集合。未使用的隐藏候选不阻止成功，也不进入输出。元数据能区分描述续行与真实下一条目时，分别得到对应的正确结果。源文件及完整 Skill 正文不变。
5. 非空目录已被安全分离时，Skill 命令关闭、元数据不可用或格式错误、description 排版不受支持、description 对应有歧义，或不兼容的前序修改，均保留整个原始 Skill 目录，同时应用其他受支持的提示词变换。不对匹配成功的部分条目进行归一化。诊断仅标明跳过 Skill 格式化。缺失或受支持的空目录无需元数据。若外层结构检查也失败，则改为保留整个输入并报告整份提示词未应用。不补入隐藏 Skill，不进行纯文本猜测，不修改宿主命令设置。
6. 除指定目录空白修改外，代码、类似 XML 的文本、类似模板的字符串、规则正文、工具及设备描述、已加载项目正文、append、Computer Safety、Memory 与 MCP 内容、活动仓库上下文、子 Agent 指令和无关扩展块保留文本与顺序。PROJECT 仅修改外层标题、指定加载说明及宿主拥有的 critical 块。
7. 空输入、重复处理、连续轮次、模式变化和处理器串联不产生重复内容或恢复陈旧输入。已经识别的自有输出无变化返回，包括归一化成功和 Skill 回退后保留多行描述的情况。每轮独立检查新的宿主输入。不支持的版本、custom 路径及未识别的外层结构保持不变，并明确提示。
8. 通过真实 OMP 执行验证主会话和普通子 Agent turn 最终发给 Provider 的内容、受限子 Agent 与 Handoff 边界、有无有效 turn override 时的旁路请求、轮中重建行为及设备通知。在宿主命令启用时手动调用隐藏 Skill，验证请求中的完整正文、参数及用户归属保持不变，该 Skill 未进入自动目录，且提示词替换继续生效。仅有处理器返回值不足以作为证据。
9. 有代表性的配置宿主场景包含已启用插件、其可见及隐藏 Skills 与设备，以及路径有效的外部托管组件。在 Skill 命令启用时，必须证明即使命令候选包含隐藏项，自有策略、PROJECT 替换及可见 description 单行化仍成功。不得为获得成功而移除插件或修改隐藏标记。记录同次运行的宿主输入、命令元数据、处理器输出、最终 Provider 内容及诊断，发现缺失或增加的能力。单独执行 Skill 回退场景，验证其他替换仍到达 Provider；回退场景不能代替代表性配置的成功场景。最小配置场景仅包含该请求所需的模型配置。部分环境须明确标为部分；私人清单与提示词抓取不进入公开产物。
10. 行为检查覆盖只要求分析、按要求交付原型、项目特定兼容要求、授权边界、合理暂停、如实说明验证、引用控制标签、真实运行通知和工作区上下文变化。获准调用模型时使用已配置的 `pro-20x` 渠道的 `luna`。逐场景记录输入、预期行为、观察到的动作或回答及结果。在覆盖路径上使用模型行为验证自有策略前，确认自有提示词已应用；仅有请求抓取或确认字符串不足以作为证据。按观察结果记录范围，不宣称安全保证。
11. 发布前通过组件检查与仓库的 `pnpm check`。公开文档报告已验证行为、隐藏 Skill 支持成功、Skill 局部回退及整份提示词回退的实际场景，不包含私人提示词抓取内容。必需的运行与行为检查未验证时，不将扩展设为日常默认。

## 风险

事件提供的文本没有来源映射或结构化字段边界。宿主格式变化或嵌入内容的模仿可能造成错误切分，丢失指令。精确版本检查、完整目录与命令候选的唯一对应、外层目标完整覆盖、歧义处理和保真测试可以降低风险，但不能将文本识别变成安全边界。纯文本不能揭示原始 Skill 结构中的每一种歧义。

整份提示词回退会在用户期待自有提示词时继续运行默认策略。Skill 局部回退则在自有策略应用时保留未归一化的目录描述。混淆这两种状态的诊断可能错误说明当前生效的策略。必须分别验证并记录两种结果；扩展不能宣称会阻止请求。

Skill 命令元数据可能缺失，也可能包含对提示词隐藏的条目。选择候选时若不验证完整可见目录，可能将续行误判为条目或暴露隐藏 Skill。要求唯一完整对应，无法建立对应时保留原目录。Skill 局部保留依赖可靠的外层边界；边界不确定时，保留猜测得到的区间并不安全，仍必须回退整份提示词。

移除主提示词中的 Cap 提示，可能使模型排入比预期更多的任务。宿主仍执行其并发设置，但 Task 工具 Schema 不提供同等的当前数值提示。必须验证协作仍可使用，不暗示移除该提示没有信息代价。

轮次覆盖在基础提示词轮中重建后仍然有效，目录可能在下一轮前过时。OMP 每次替换还会重置 `baseXdevCatalogDelivered`，可能重复发送设备通知。最终请求与工具变化检查必须确认能力仍可使用，不额外维护一套设备状态管理器。

普通 turn、Handoff 及其他旁路请求可能采用不同静态策略；临时请求也可能继承当时生效的提示词。后序扩展可以替换自有输出。覆盖范围与顺序文档必须明确这些差异。

指令来源措辞的变化既可能影响引用内容处理，也可能影响真实宿主控制消息的识别。仅修改提示词无法证明来源处理正确，任一方向的行为失败都应阻止将其设为日常默认。
