# ADR 决定：随 OMP 宿主升级维护状态栏

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [OMP 状态栏使用常驻 Widget](./2026-09-24-use-omp-status-bar-widget.zh.md)
Archived: 2026-10-02
Reversed by: [随 OMP 宿主升级维护状态栏](../decision/2026-10-02-scope-token-metrics-to-conversation.zh.md)

[English](./2026-09-28-maintain-omp-status-bar.md) | 中文

## 动机

把 `@ruokee/omp-status-bar` 维护为一个由状态 Host 与注册的 Provider 组成的自包含包，并让它跟随 OMP 宿主升级继续可用。

`@ruokee/omp-status-bar` 包在编辑器下方的一行常驻输出中显示当前会话的上下文用量、token 读数、缓存命中率和已回答的模型请求次数，并给出上下文已进入投机区间的估计。当前选择包括：由它持有的常驻输出行、Host 组合的结构化且经过清理的 Provider 片段、agent 目录下的有序配置、内置指标 Provider 及其固定颜色、已回答请求次数、带有明确边界的投机区间估计，以及随 Package 保存的文档与证据。Package 也换用新的维护声明形式：维护承诺不再决定哪些宿主可以安装它。

## 分析

宿主 peer 声明只说明 Package 导入哪些宿主包，而在其中写入数值范围会同时替每个解析该依赖的宿主决定能否安装（[宿主升级决定](../decision/2026-09-28-adapt-components-to-host-upgrades.zh.md)）。因此维护下限从 peer 声明中移出，改为在组件 README 的兼容性小节声明；Package 与 OMP 的耦合保持为对公开 Widget、上下文用量和压缩解析 API 的能力耦合。实际验证过的版本与场景是组件文档中的证据，不是下限本身。

[先前的决定](./2026-09-05-use-omp-status-bar-widget.zh.md)不接受列表之外的内置 ID，而枚举本身并不是被保护的边界。同一节还排除了金额、cost 和 premium request 读数以及旧的 `tokens` 别名，而 Package 使用文档已经维护内置 ID 及其 options 和颜色。写明 Provider 范围，并用链接把该文档指定为清单归属，就能保留边界。

由会话活动推导出的读数只能作为内置 Provider 发布。公开的 Provider 合同只给实例提供它的 options、它的配置、一次发布调用和受管定时器；它不携带会话数据和事件，宿主也只对内置 Provider 绑定会话数据源。为公开合同增加这样一条通道，比增加这个读数本身的改动更大，而宿主已经向扩展报告每一轮，并同时给出响应是如何结束的。

## 决定

### 保持一个自包含 Package，Host 与 Provider 分离

`projects/omp-status-bar/` 是一个第一方、自包含的 OMP Plugin Package。[第一方能力套件决定](../decision/2026-08-20-establish-first-party-capability-kit.zh.md)允许真实能力使用 `projects/`，[组件自包含决定](../decision/2026-08-24-keep-components-self-contained.zh.md)要求每个可分发组件保持独立。`package.json` 通过 `omp.extensions` 声明原生扩展入口；Package 只使用公开的上游 OMP API，不包含、不修补、也不要求本地 Fork。

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

token 指标和缓存命中率共享一个来自会话用量统计的数据口径：`I` 是 input 加 cache write，`C` 是 cache read，`O` 是 output，`T` 是 `I + C + O`，命中率是 `C / (I + C)`。它们不读取编排字段，也不读取金额。token 数值使用一个共享的十进制 formatter，单位为 `K`、`M`、`G`、`T`；指标自身数据不存在时不发布内容，而不是显示零。

`context` Provider 读取公开的上下文用量 API，支持 `percent`（默认）和 `absolute` 两种模式。`absolute` 只用共享 formatter 显示当前 token 数；context window 仍用于数据校验和投机区间计算。它把上下文文本和投机区间字形合入一个片段，用普通空格连接，绕过配置的 separator。

### 统计会话已回答的模型请求次数

Package 提供一个内置 Provider `turn`，统计本次会话有多少次模型请求得到了成功响应，并把该计数作为一项独立读数发布，不据此再推导任何指标。它的标签、options 和显示形式由使用文档持有。

数值为会话累计值：它跨多次提问和多次 agent run 持续增长而不重新开始，并在会话被恢复或切换后保持。它始终反映会话所持有的分支历史，因此沿会话树回退或新建分支时会按当时的前台分支重新取值。

只有成功的响应才使数值前进；失败的请求、被中断的响应，以及在模型调用前就被拦下的请求都不改变它。

Provider 跟随会话的轮次生命周期，而不是依赖快照的指标：它不注册 timer，采样周期由那些指标负责。

### 从公开数据估计投机区间

context Provider 的文本配有一个字形，表示上下文大概进入了 OMP 的投机区间。字形使用与 OMP 自身压缩图标相同的 Nerd Font 码点；终端字体缺少该字形时没有回退。估计只读取公开数据，即上下文用量、当前模型和压缩设置组，并复用 OMP 公开导出的阈值、lead token 和方法解析函数，不复制其逻辑。

指示器有三个状态。`hidden`：自动压缩或异步压缩关闭，没有可投机的方法解析成功，或阈值数据不可用。`normal`：字形以弱化样式常亮。`indicating`：字形以 600 ms 节奏在强调和弱化之间闪烁。

指示明确是近似的。扩展无法观察 OMP 是否真的在压缩、是否在生成 handoff，或会话钩子是否阻止了投机任务；OMP 也可能把内部 token 估计抬高到公开上下文用量 API 报告值之上。因此指示只表示上下文大概在区间内；界面和文档不得声称压缩正在运行或已经完成。进入区间后闪烁锁存，即使越过阈值也继续，直到观察到的 token 数下降、压缩设置或解析方法变化、模型或其 context window 变化，或会话结束。下降之后，状态机要求 token 数先回到区间起点以下才允许再次指示。

### 实现证据随项目保存

[英文和中文公开文档决定](../decision/2026-09-07-colocate-bilingual-docs.zh.md)适用，Package 本地使用文档互相链接。Package 文档覆盖安装、启停、配置 schema、内置 Provider ID 及其 options、按条目失败行为、Widget 位置、投机估计及其限制、已回答请求次数的含义和显示形式，以及实际验证过的宿主版本及其覆盖的场景。组件 README 的兼容性小节声明维护下限，该小节是这一下限的权威说明：Package 只声明下限、不设维护上限，不维护受支持版本白名单，也不会仅凭版本阻止任何宿主。低于下限的宿主不会被阻止运行本 Package，也不因此获得维护承诺；提高下限按[宿主升级决定](../decision/2026-09-28-adapt-components-to-host-upgrades.zh.md)作为独立决定处理。Provider 编写文档定义公开导入路径、注册时机、合同版本、冲突行为、生命周期上下文，以及如何安装和选用独立打包的 Provider。

直接 `@oh-my-pi/*` 导入以不带版本范围的形式声明其宿主包，声明只列出 Package 使用的宿主包，不承载维护限制。行为测试覆盖配置解析与按条目降级、片段清理与无效片段隔离、有序组合与宽度截断、投机状态机的时序、已回答请求次数的计数规则及其显示状态和会话行为、来自独立加载且无共享模块身份的扩展的注册、无残留 timer 或 Widget 的清理，以及目标版本内置 Composer shape 与 statusline preset 加一个扩展注册的 shape，全部走同一个 Widget 路径。自动化测试全部无头运行，看不到终端：确认 Widget 出现在编辑器下方并与原生 statusline 共存的真实 OMP TUI 会话是发布要求，按发布提交运行并评审后才可打标签，不进入单元测试套件。

## 考虑过的替代方案

**保留 `setStatus()` 并按指标输出带样式的纯文本。** `setStatus()` 通道接受任意字符串，Provider 可以内嵌原生 ANSI 序列。Host 仍可以解析并选择性放行，但那会把样式变成 Host 和 Provider 之间复杂脆弱的转义序列协议；宽度截断必须解析任意 Provider 输出，闪烁则要求每个 Provider 用自己的 timer 换字符串。采用结构化 span 后，Host 保持为清理、着色、组合和截断的唯一入口。

**把每个指标发布为纯文本，不带投机字形。** 这样 `setStatus()` 仍然可行，因为剩余内容只是一个不带颜色的字符串。代价是失去闪烁指示、固定指标颜色和受控截断。

**通过 `setStatus()` 通道或自定义段把指标渲染进原生 statusline。** 原生 statusline 由用户配置；`showHookStatus` 和 preset 段控制位置和可见性，Package 无法保证稳定的一行，段注册还会替换用户可见的原生组件。常驻 Widget 行让该能力不受用户 statusline 配置影响。

**用一个带显示开关的 Provider 代替独立指标 Provider。** 单个 Provider 加按指标开关会重复 `statuses` 已经提供的选择和排序能力，两个机制还可能对显示哪些指标、按什么顺序各执一词。独立 Provider 让一个结构同时完成选择和排序。

## 结果

Host 负责清理、组合、截断和 Widget 生命周期，Provider 保持很小，也无法破坏整行。第三方扩展获得一个稳定、带版本的合同来增加 Provider，不需要触碰 Host。

Package 与 OMP 公开的 Widget、上下文用量和压缩解析 API 耦合。它只声明维护下限、不设维护上限，这表达的是维护承诺，而不是后续每个版本都可用；实际验证过的版本与场景与这一声明并列记录在组件文档中。每次发布打标签前都会在它所针对的宿主上运行真实 TUI 检查，因为自动化测试全部无头运行，看不到终端。

内置清单现在由 Package 使用文档持有。代码和该文档必须一起变更；只改一侧会让公布的清单失真。

投机指示器是估计而不是观察；用户看到的是一个近似，其限制在文档中明确说明。

已回答请求次数跟随会话所持有的分支，因此回退会让它下降，会话绑定后显示的数值也可能比绑定前记录的数值少一。这两种情况都是预期结果。

Package 不为纯文本合同、`tokens` ID、金额显示或任意 separator 保留兼容层。
