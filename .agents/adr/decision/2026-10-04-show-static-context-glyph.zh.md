# ADR 决定：以静态上下文字形维护 OMP 状态栏

Decision owner: Ruokee
Decision writer: OMP Claude Opus 5.5
Reverses: [随 OMP 宿主升级维护状态栏](../archived/2026-10-02-scope-token-metrics-to-conversation.zh.md)

[English](./2026-10-04-show-static-context-glyph.md) | 中文

## 动机

把 `@ruokee/omp-status-bar` 维护为一个由状态 Host 与注册的 Provider 组成的自包含包，并用一个标识上下文窗口的静态字形取代投机区间估计。

`@ruokee/omp-status-bar` 包在编辑器下方的一行常驻输出中显示当前会话的上下文用量、token 读数、缓存命中率和已回答的模型请求次数。当前选择包括：由它持有的常驻输出行、Host 组合的结构化且经过清理的 Provider 片段、agent 目录下的有序配置、内置指标 Provider 及其固定颜色、已回答请求次数、静态的上下文窗口字形，以及随 Package 保存的文档与证据。Package 在 README 中声明维护承诺，维护承诺不决定哪些宿主可以安装它。

Package 原先给上下文读数配上上下文已进入 OMP 投机区间的估计。估计通过 `Settings.getGroup` 读取宿主的压缩设置，而从 18.4.0 起宿主不再提供该方法，指示器在当前宿主上始终隐藏。按照[宿主内组件按共同的 OMP 下限维护](./2026-10-04-raise-omp-host-floor.zh.md)，面向 OMP 的组件共用维护下限 OMP 18.5.0，没有任何受维护宿主还能支持该估计，Package 也没有其他公开途径读取这些设置。

OMP 把带外的模型调用与对话记在同一个会话账本里，并通过同一个会话用量统计报告出来。Find 工具的判定级联就是这样一个调用方：它以 `purpose: "find"` 记录自己的调用，而这些记录不携带任何 cache 读数，因为判定路径只报告输入数、输出数与计费成本，无论服务端是否复用了缓存前缀都把 cache read 与 cache write 写为零。因此取自会话统计的读数会计入对话从未发起的流量，抬高输入读数并压低缓存命中率，计入量还随一次搜索读取的文件数增长。在读数改为对话口径时记录的验证轮里，一次针对大型仓库的 Find 调用增加 68K 输入 token 且不含任何 cache read，读数从 43.5% 变为 8.9%。

## 分析

宿主 peer 声明只说明 Package 导入哪些宿主包，而在其中写入数值范围会同时替每个解析该依赖的宿主决定能否安装（[共同 OMP 下限决定](./2026-10-04-raise-omp-host-floor.zh.md)）。因此维护下限不放进 peer 声明，而在组件 README 的兼容性小节声明；Package 与 OMP 的耦合保持为对公开 Widget 和上下文用量 API 的能力耦合。实际验证过的版本与场景是组件文档中的证据，不是下限本身。

[先前的决定](../archived/2026-09-05-use-omp-status-bar-widget.zh.md)不接受列表之外的内置 ID，而枚举本身并不是被保护的边界。同一节还排除了金额、cost 和 premium request 读数以及旧的 `tokens` 别名，而 Package 使用文档已经维护内置 ID 及其 options 和颜色。写明 Provider 范围，并用链接把该文档指定为清单归属，就能保留边界。

由会话活动推导出的读数只能作为内置 Provider 发布。公开的 Provider 合同只给实例提供它的 options、它的配置、一次发布调用和受管定时器；它不携带会话数据和事件，宿主也只对内置 Provider 绑定会话数据源。为公开合同增加这样一条通道，比增加这个读数本身的改动更大，而宿主已经向扩展报告每一轮，并同时给出响应是如何结束的。

会话总量没有按用途拆分，也没有逐条明细，因此该 API 的任何调用方都无法把对话的用量与其余部分分开；而会话所持分支带着每条条目的父子链。该分支已经是已回答请求次数的来源，因此两项读数在沿树回退、新建分支和切换会话时一起重新取值。`task` 工具结果报告的是子代理为对话这次请求所做的工作，因此这些 token 属于对话，保持计入。只累加有限数值，因此异常记录导致少计，而不是产生非数值读数。

## 决定

### 保持一个自包含 Package，Host 与 Provider 分离

`projects/omp-status-bar/` 是一个第一方、自包含的 OMP Plugin Package。[第一方能力套件决定](./2026-08-20-establish-first-party-capability-kit.zh.md)允许真实能力使用 `projects/`，[组件自包含决定](./2026-08-24-keep-components-self-contained.zh.md)要求每个可分发组件保持独立。`package.json` 通过 `omp.extensions` 声明原生扩展入口；Package 只使用公开的上游 OMP API，不包含、不修补、也不要求本地 Fork。

实现拆分为状态 Host 和注册制 Provider。Provider 注册通过 `package.json#exports` 条目 `@ruokee/omp-status-bar/provider` 成为受支持的 Package API。注册使用通过 `Symbol.for()` 索引的带版本进程级 Registry，因此解析到自己 Package 副本的 Extension 仍注册到同一个 Registry，注册也不依赖 Extension 加载顺序。Registry 在注册时拒绝重复 Provider ID 和不兼容合同版本。Host 创建每个实例前从 Registry 解析配置中的 ID，并再次校验其合同版本。

公开合同覆盖 Provider 身份、option 校验、实例创建和生命周期、片段发布和托管调度。Registry 存储、配置加载、组合、诊断和 OMP UI 调用保持私有。每个配置条目创建独立实例，同一个 Provider ID 可以带不同 options 出现多次。

### 使用原生启停和 agent 目录配置

OMP 原生 Plugin 启用状态是唯一的 Package 级开关，Package 不定义单独的 `enabled` 字段。

配置存放在 `omp-status-bar.yml`，位于公开再导出的 `getAgentDir()` 返回的当前 OMP agent 目录下，使配置跟随 profile 而不需要给 OMP 核心设置 schema 增加键。上游 Plugin 设置 schema 只接受标量和枚举值，因此带嵌套 options 的有序 Provider 列表无法来自 Plugin 设置。

文件以 schema 版本开头，有序 `statuses` 数组同时选择 Provider 并定义显示顺序。条目 schema 由 Package 使用文档持有。配置在会话开始时读取一次，之后的文件修改不热加载，新配置在下一个会话生效。文件缺失时不显示。顶层文档格式错误时不启动任何 Provider，并记录一条有界诊断。Provider 不存在、合同版本不兼容或 options 无效的条目被跳过，其余条目继续运行。空 `statuses` 数组合法但不挂载任何内容。Host 只在 Extension 上下文有 UI 支持时执行这些会话行为，headless 下保持空闲。

顶层 separator 设置选择条目之间的分隔符，可取值和默认值由使用文档持有。Host 用弱化样式渲染 separator，Provider 不输出 separator。

### 挂载一个常驻 belowEditor Widget

配置加载完成且至少一个 Provider 启动后，Host 在编辑器下方、以稳定的包限定 key 挂载一个组件工厂，每个会话只发生一次。Provider 更新只替换 Host 存储的片段并请求组件重绘，不会再次挂载。关机时 Host 停止 Provider、清理 timer 并卸载 Widget。

Widget 渲染一行，严格按 `statuses` 顺序组合。空片段不产生任何内容，也不产生 separator。没有可见内容时 Widget 渲染零行但保持挂载，后续数据可以重新出现。

Host 先为组合行着色，再用 ANSI 感知的宽度测量从右侧截断到终端宽度，尾部使用单个省略号，靠前的条目得以保留。窄终端不会重排条目、删除条目，也不会把 `word` 标签改成 compact 形式。

Widget 是原生 statusline 的补充：Package 不注册 statusline 段，也不替换任何段。Widget 的可见性既不依赖 `statusLine.showHookStatus`，也不依赖自定义 preset 的 `status` 段。目标 OMP 版本的每个内置 Composer shape 都使用同一个 belowEditor 挂载点。

### 发布结构化且经过清理的片段

发布合同是结构化片段而不是字符串：

```ts
interface ProviderSpan {
  text: string;
  color?: `#${string}`;
  dim?: boolean;
}

interface ProviderFragment {
  spans: readonly ProviderSpan[];
}
```

Host 清理每个 span 并深复制结果，Provider 之后的修改无法改变界面；可接受的颜色以及 escape 与控制字符的处理规则由 Provider 合同持有。空片段或清理后没有内容的片段撤回该实例的内容。结构无效的片段清除该实例的旧内容，记录一条有界诊断，其他 Provider 继续运行。

Provider 不调用 OMP UI 方法，不获取 Widget 或 theme，也不输出 separator。

### 提供内置指标 Provider

Package 提供内置指标 Provider。[Package 使用文档](../../../projects/omp-status-bar/docs/usage.zh.md)持有当前清单：内置 ID、它们的 options、输出形式，以及数值背后的公式。此后增删内置 ID 是清单变更，不是对本次决定的反转。

Provider 范围保持封闭：Package 不提供金额、cost 或 premium request 读数，也不读取、格式化或配置这些金额。旧的 `tokens` ID 直接消失，没有别名。

每个内置指标带固定颜色，遵循 pi-moon 配色；颜色不可配置。label option 按实例选择 compact 或 word 形式，一份配置可以混用两种形式，窄终端不会改变已选形式。缓存命中率的精度是另一项显示 option，取值范围由同一份使用文档维护。

token 指标和缓存命中率共享一个取自对话自身用量的数据口径：会话所持分支上的 assistant 消息，以及 `task` 工具结果报告的用量。带外记录不贡献任何用量，包括判定级联携带任何用途的 `model_usage` 条目；其他类型的条目或其他角色的消息也不贡献；在计入的 usage 内部，只累加有限数值，因此非法的计数桶被排除，其余有效的计数桶仍然计入。`I` 是 input 加 cache write，`C` 是 cache read，`O` 是 output，`T` 是 `I + C + O`，命中率是 `C / (I + C)`。它们不读取编排字段，也不读取金额。token 数值使用一个共享的十进制 formatter，单位为 `K`、`M`、`G`、`T`；指标自身数据不存在时不发布内容，而不是显示零。

`context` Provider 读取公开的上下文用量 API，支持 `percent`（默认）和 `absolute` 两种模式。`absolute` 只用共享 formatter 显示当前 token 数；context window 仍用于数据校验。它把上下文窗口字形和上下文文本合入一个片段，用普通空格连接，绕过配置的 separator。

### 统计会话已回答的模型请求次数

Package 提供一个内置 Provider `turn`，统计本次会话有多少次模型请求得到了成功响应，并把该计数作为一项独立读数发布，不据此再推导任何指标。它的标签、options 和显示形式由使用文档持有。

数值为会话累计值：它跨多次提问和多次 agent run 持续增长而不重新开始，并在会话被恢复或切换后保持。它始终反映会话所持有的分支历史，因此沿会话树回退或新建分支时会按当时的前台分支重新取值。

只有成功的响应才使数值前进；失败的请求、被中断的响应，以及在模型调用前就被拦下的请求都不改变它。

Provider 跟随会话的轮次生命周期，而不是依赖快照的指标：它不注册 timer，采样周期由那些指标负责。

### 用静态字形标识上下文窗口

`context` 状态的文本左侧固定显示 Nerd Font 字形 `U+F0068`，作为上下文窗口的标识。字形与文本属于同一个状态片段。字形不闪烁，不随上下文用量变化，也不显示窗口大小。终端字体缺少该字形时没有回退。

Package 不读取任何压缩设置，也不估计 OMP 的投机区间。缺少用量数据或 `contextWindow <= 0` 时，`context` 状态仍然不发布任何内容。

### 实现证据随项目保存

[英文和中文公开文档决定](./2026-09-07-colocate-bilingual-docs.zh.md)适用，Package 本地使用文档互相链接。Package 文档覆盖安装、启停、配置 schema、内置 Provider ID 及其 options、按条目失败行为、Widget 位置、上下文窗口字形、已回答请求次数的含义和显示形式，以及实际验证过的宿主版本及其覆盖的场景。组件 README 的兼容性小节声明维护下限，该小节是这一下限的权威说明：Package 声明共同的 OMP 下限、不设维护上限，不维护受支持版本白名单，也不会仅凭版本阻止任何宿主。低于下限的宿主不会被阻止运行本 Package，也不因此获得维护承诺；提高下限按[共同 OMP 下限决定](./2026-10-04-raise-omp-host-floor.zh.md)处理。Provider 编写文档定义公开导入路径、注册时机、合同版本、冲突行为、生命周期上下文，以及如何安装和选用独立打包的 Provider。

直接 `@oh-my-pi/*` 导入以不带版本范围的形式声明其宿主包，声明只列出 Package 使用的宿主包，不承载维护限制。行为测试覆盖配置解析与按条目降级、片段清理与无效片段隔离、有序组合与宽度截断、带字形的 `context` 片段、已回答请求次数的计数规则及其显示状态和会话行为、来自独立加载且无共享模块身份的扩展的注册、无残留 timer 或 Widget 的清理，以及目标版本内置 Composer shape 与 statusline preset 加一个扩展注册的 shape，全部走同一个 Widget 路径。自动化测试全部无头运行，看不到终端：确认 Widget 出现在编辑器下方并与原生 statusline 共存的真实 OMP TUI 会话是发布要求，按发布提交运行并评审后才可打标签，不进入单元测试套件。

## 考虑过的替代方案

**保留 `setStatus()` 并按指标输出带样式的纯文本。** `setStatus()` 通道接受任意字符串，Provider 可以内嵌原生 ANSI 序列。Host 仍可以解析并选择性放行，但那会把样式变成 Host 和 Provider 之间复杂脆弱的转义序列协议，宽度截断也必须解析任意 Provider 输出。采用结构化 span 后，Host 保持为清理、着色、组合和截断的唯一入口。

**把每个指标发布为纯文本。** 这样 `setStatus()` 仍然可行，因为内容只是一个不带颜色的字符串。代价是失去固定指标颜色和受控截断。

**通过 `setStatus()` 通道或自定义段把指标渲染进原生 statusline。** 原生 statusline 由用户配置；`showHookStatus` 和 preset 段控制位置和可见性，Package 无法保证稳定的一行，段注册还会替换用户可见的原生组件。常驻 Widget 行让该能力不受用户 statusline 配置影响。

**用一个带显示开关的 Provider 代替独立指标 Provider。** 单个 Provider 加按指标开关会重复 `statuses` 已经提供的选择和排序能力，两个机制还可能对显示哪些指标、按什么顺序各执一词。独立 Provider 让一个结构同时完成选择和排序。

**从会话总量中减去带外记录。** 这会把会话统计保留为基数。该总量不提供按用途拆分，减法只能遍历直接求和读取的同一分支、分类同一批记录，再从已经包含它们的总量中减去。结果会依赖必须持续一致的两侧：总量决定基数，分类决定修正值；宿主任何一侧发生变化都会留下 Package 无法解释的残差。

**保留会话统计，另加一项带外流量读数。** 这保留所有现有数字，并在旁边报告被排除的量。它让使用者用来对照对话自身成本的读数继续失真，并要求使用者用一项读数减去另一项，才能还原对话的用量。

**把修正后的口径挂在一次上游变更上。** OMP 可以让判定调用报告真实的 cache 字段，或者提供按用途拆分。这两者都不在 Package 控制范围内，也没有承诺，读数会在未知长度的时期内持续失真。

## 结果

Host 负责清理、组合、截断和 Widget 生命周期，Provider 保持很小，也无法破坏整行。第三方扩展获得一个稳定、带版本的合同来增加 Provider，不需要触碰 Host。

Package 与 OMP 公开的 Widget 和上下文用量 API 耦合。它只声明维护下限、不设维护上限，这表达的是维护承诺，而不是后续每个版本都可用；实际验证过的版本与场景与这一声明并列记录在组件文档中。每次发布打标签前都会在它所针对的宿主上运行真实 TUI 检查，因为自动化测试全部无头运行，看不到终端。

内置清单现在由 Package 使用文档持有。代码和该文档必须一起变更；只改一侧会让公布的清单失真。

该行不再提示上下文大概进入了 OMP 的投机区间。依赖闪烁的用户只能从 OMP 自身界面得知压缩情况；在 18.4.0 以前的宿主上，原本仍能工作的指示器变为静态字形。

已回答请求次数跟随会话所持有的分支，因此回退会让它下降，会话绑定后显示的数值也可能比绑定前记录的数值少一。这两种情况都是预期结果。

Package 不为纯文本合同、`tokens` ID、金额显示或任意 separator 保留兼容层。

token 读数与缓存命中率描述的是对话而不是会话。OMP 自身的 statusline 和任何成本报告仍包含带外流量，因此该行与那些读数按设计不同；使用文档在公式旁写明口径与被排除的记录。

宿主若不再把 `task` 用量报告在工具结果上，或改用另一种形态记录对话用量，读数就会少计而没有任何测试察觉，因为测试固定的是当下读取的形态。这类变化最先表现为读数不再符合对话，通过使用者报告或通过真实账本上的发布 TUI 检查到达 Package。

每次采样都要遍历分支，因此开销按采样节奏随会话条目数增长。遍历只读取需要的字段，并且每 tick 对五项读数至多执行一次。
