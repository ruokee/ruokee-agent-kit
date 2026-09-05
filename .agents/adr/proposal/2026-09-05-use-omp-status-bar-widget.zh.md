# ADR 提案：OMP 状态栏改用常驻 Widget

Decision owner: Ruokee
Draft writer: OMP GLM-5.3 Flash

[English](./2026-09-05-use-omp-status-bar-widget.md) | 中文

## 动机

[可配置 OMP 状态栏提案](./2026-09-04-add-omp-status-bar-project.zh.md)选择了原生 `ctx.ui.setStatus()` Extension 状态通道，以纯文本 Provider 片段发布内容，并通过 OMP 原生 statusline 设置控制外观。已确认的指标设计不再适合该通道：内置指标带有固定的逐项配色，context 指标增加了一个在上下文进入投机区间时闪烁的弱化字形，组合行还必须在终端宽度处截断且不能切断颜色序列。公开的 `setStatus()` 合同对每个 key 只接收一个字符串，不提供 theme、结构化 span 和 `render(width)` 生命周期。原始 ANSI 序列和重复的 `setStatus()` 更新虽然能勉强模拟其中一部分，却把清理、样式和宽度处理变成脆弱的字符串协议。

产品范围同时发生了变化。原先笼统的 `tokens` 指标拆分为各个独立的指标 Provider，新增缓存命中率，context 指标增加投机区间估计，separator 收紧为封闭的四值集合。费用显示是明确的产品边界排除。这项排除只覆盖金额相关功能，并不表示与 OMP 原生功能重复的指标都要移除。

本提案保留先前提案仍然有效的架构：一个自包含 Package、Host 与 Provider 分离、带版本的进程级 Registry、agent 目录 YAML 配置、OMP 原生 Plugin 启用开关，以及生命周期和失败隔离边界。它只替换先前关于渲染通道、纯文本片段合同、内置指标集合和 separator 规则的选择。当前没有仓库决定记录状态栏架构，因此本提案替代的是先前的提案，而非决定，不使用 `Reverses`。维护者批准本提案后，实现变更会创建新的双语决定，并移除旧状态栏提案对（其实现未交付到 main）和本提案对。

## 提议

### 保持一个带 Host 与 Provider 的自包含 Package

在 `projects/omp-status-bar/` 创建一个第一方、自包含的 OMP Plugin Package。[第一方 Agent 能力仓库决定](../decision/2026-08-20-establish-first-party-capability-kit.zh.md)允许真实能力使用 `projects/`，[可分发组件自包含决定](../decision/2026-08-24-keep-components-self-contained.zh.md)要求每个可分发组件保持独立。`package.json` 通过 `omp.extensions` 声明原生 Extension 入口，Package 只使用上游 OMP 公开 API，不包含、不修改也不要求本地 fork。

把实现拆分为状态栏 Host 和注册的状态 Provider。Provider 注册作为公开的 Package API，经 `package.json#exports` 的 `@ruokee/omp-status-bar/provider` 入口导出。注册使用带版本的进程级 Registry，以 `Symbol.for()` 为 key，因此解析到自己 Package 副本的 Extension 仍然注册到同一个 Registry，注册也不依赖 Extension 加载顺序。Registry 在注册时拒绝重复的 Provider ID 和不兼容的合同版本，Host 在创建实例前再次校验。

公开合同涵盖 Provider 身份、options 校验、实例创建和生命周期、片段发布和托管调度。Registry 存储、配置加载、内容组合、诊断和 OMP UI 调用保持私有，导出的类型和函数遵守语义化版本合同。每个配置项创建独立实例，因此同一个 Provider ID 可以使用不同 options 出现多次。

### 使用原生开关和 agent 目录配置

OMP 原生 Plugin 启用和停用状态是 Package 唯一的总开关，Package 不另设 `enabled` 字段。

配置保存在当前 OMP agent 目录下的 `omp-status-bar.yml`，agent 目录由公开重新导出的 `getAgentDir()` 取得，配置因此跟随 OMP profile，也不需要向 OMP 核心 settings schema 增加字段。当前上游 `PluginSettingSchema` 只接受 `string`、`number`、`boolean` 和 `enum` 值，且不导出运行时 settings 读取函数，有序 Provider 列表和嵌套 options 因此无法来自 Plugin settings。

配置文件首先声明 schema 版本，其有序的 `statuses` 数组既选择 Provider 也定义显示顺序。每项包含非空 Provider `id` 和可选的 Provider 专属 `options`；未知字段使该条目无效。配置在会话启动时读取一次，后续文件修改不热加载，新配置在下一个会话生效。文件缺失时不显示任何内容。顶层文档格式错误时不启动任何 Provider，并记录一条有界诊断。Provider 不可用、合同版本不兼容或 options 无效的条目被跳过，有效条目继续运行。空 `statuses` 数组合法但不挂载 Widget。只有 Extension context 支持 UI（`ctx.hasUI` 为真）时，Host 才执行这些会话行为：headless 会话不读取配置、不启动 Provider、不挂载 Widget。该门控只限制 Host 的会话行为；Extension 激活阶段的 Provider 注册不依赖 UI 支持。

顶层 `separator` 只接受 `space`、`slash`、`dot` 和 `pipe`，默认值为 `slash`。Host 用主题的弱化颜色渲染 separator，Provider 永远不输出 separator。

### 挂载一个常驻 belowEditor Widget

配置加载完成且至少一个 Provider 启动后，Host 通过 `ctx.ui.setWidget(key, factory, { placement: "belowEditor" })` 以一个稳定且带 Package 命名空间的 key 挂载一个组件工厂。每个会话只挂载一次。Provider 更新只替换 Host 保存的片段并请求组件重绘，不再调用 `setWidget()`。会话关闭时，Host 先停止 Provider、清理 timer，再通过 `setWidget(key, undefined)` 卸载。

Widget 只渲染一行，严格按 `statuses` 顺序组合。空片段不产生内容，也不产生 separator。没有任何可见内容时，Widget 渲染零行但保持挂载，让后续数据可以重新出现。

Host 先完成整行着色，再用 ANSI 感知的宽度测量从右侧截断到终端宽度，尾部使用单个省略号，因此靠前的条目优先保留。终端变窄不会重排条目、删除条目，也不会把 `word` 标签降级为 `compact`。

Widget 是 OMP 原生 statusline 的补充：Package 不注册任何 statusline segment，也不替换任何 segment。Widget 的可见性既不依赖 `statusLine.showHookStatus`，也不依赖 custom preset 的 `status` segment。目标 OMP 版本的所有内置 Composer shape 都使用同一个 belowEditor 挂载点。

### 发布结构化且清理过的片段

发布合同是结构化片段，不再是字符串：

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

Host 清理每个 span：剥除 ANSI 和 VT escape sequence，把控制字符替换为空格，合并连续空格，只接受 `#RRGGBB` 颜色，删除空 span，修剪片段边缘，并深复制结果，使 Provider 在发布后修改对象不能改变界面。空片段或清理后没有可见内容的片段撤回该实例的内容。结构无效的片段清除该实例的旧内容并记录一条有界诊断，其他 Provider 继续运行。

Provider 不调用 OMP UI 方法，不获取 Widget 或 theme，也不输出 separator。

### 交付内置指标 Provider

内置 ID 恰好是 `total`、`input`、`cache`、`output`、`cache-hit` 和 `context`。先前的 `tokens` ID 不保留别名。也不提供 `cost` Provider：金额因产品决策整体不在 Package 范围内，Package 不读取、格式化或配置任何 cost、subscription 或 premium request 金额。

`total`、`input`、`cache`、`output` 和 `cache-hit` 各自接受 `options.label`，取值为 `compact` 和 `word`，默认 `compact`。`compact` 显示字母 `T`、`I`、`C`、`O`、`H`；`word` 显示 `Total`、`Input`、`Cache`、`Output`、`Hit`。标签按实例生效，配置可以混用两种形式，终端变窄不会改变已选形式。每个指标使用固定颜色，沿用 pi-moon 配色；颜色不开放配置。

token 指标共用同一数据口径，来自会话使用统计：`I` 为 input 加 cache write，`C` 为 cache read，`O` 为 output，`T` 为 `I + C + O`。指标不读取 orchestration 字段，也不读取金额。token 数值使用同一个十进制 formatter，以 `K`、`M`、`G`、`T` 进位。会话尚未消耗 token 时，token 指标不发布片段，避免显示一排零。缓存命中率是 `C / (I + C)`，显示为四舍五入的百分比，分母为零时不发布。

`context` Provider 接受 `options.mode`，取值为 `percent`（默认）和 `absolute`，读取公开的 context usage API。它把上下文文本和投机区间字形以一个普通空格合并进同一个片段，不经过配置的 separator。

### 用公开数据估计投机区间

context Provider 在文本旁配一个字形，表示上下文大概进入了 OMP 的投机区间。字形使用与 OMP 自身压缩图标相同的 Nerd Font 码点；终端字体缺少该字形时没有回退。估计只读公开数据：context usage、当前模型和压缩配置组，并复用 OMP 公开导出的阈值、lead token 和方法选择函数，不复制其逻辑。

指示有三个状态。`hidden`：自动压缩或异步压缩关闭、没有可投机的方法，或阈值数据不可用。`normal`：字形常亮，使用弱化样式。`indicating`：字形按 600 ms 节奏在强调和弱化之间闪烁。

该指示明确是近似值。Extension 无法观察 OMP 是否真的在压缩、是否正在生成 handoff、session hook 是否阻止了投机任务，而 OMP 内部的 token 估计也可能高于公开 context usage API 报告的值。因此指示只表示上下文大概率位于区间内，界面和文档不得声称压缩正在运行或已经完成。进入区间后闪烁锁存，即使超过阈值也继续，直到观测 token 数下降、压缩设置或解析出的方法变化、模型或其 context window 变化，或会话结束。token 下降后，状态机要求 token 先回落到区间起点以下，才允许下一个周期再次进入指示，因为下降也可能来自分支切换或历史裁剪，而非真实压缩。

### 把实现证据保存在项目内

按照[维护中英文公开文档决定](../decision/2026-08-20-maintain-bilingual-public-documentation.zh.md)提供 Package 内使用文档并保持双向语言链接。文档说明安装、启用、配置 schema、内置 Provider ID 与 options、配置项级失败行为、Widget 位置、投机估计及其局限，以及已验证的 OMP 兼容范围。Provider 开发文档定义公开导入路径、注册阶段、合同版本、ID 冲突行为、生命周期 context，以及如何安装和选择独立发布的 Provider。

直接导入的 `@oh-my-pi/*` 包以 `>=18.1.8 <19` 声明 peer dependency；Package 以 OMP 18.x 为目标并记录已验证版本。行为测试覆盖配置解析与配置项级降级、片段清理与无效片段隔离、有序组合、宽度截断、可控时钟下的投机状态机、单独加载的 fixture Extension 在不共享模块身份时的注册，以及不残留 timer 或 Widget 的清理。渲染检查枚举目标版本的全部内置 Composer shape 和 statusline preset，并包含一个 Extension 注册的 shape，全部走同一个 Widget 路径。真实 OMP TUI 冒烟检查确认 Widget 出现在编辑器下方并与原生 statusline 共存，关闭后无残留。

批准后，实现变更创建记录最终架构的双语决定，并移除旧状态栏提案对和本提案对。实现原地替换失效的选择，不为纯文本合同、`tokens` ID、费用显示或任意 separator 保留兼容层。

## 考虑过的替代方案

**保留 `setStatus()`，由各 Provider 自己输出带样式的纯文本。** `setStatus()` 通道接收任意字符串，Provider 可以自行内嵌原始 ANSI 序列。Host 也可以解析并有选择地放行这些序列，但这会让样式变成 Host 与 Provider 之间一套复杂脆弱的转义序列协议；宽度截断必须解析任意 Provider 输出，闪烁还需要每个 Provider 用自己的 timer 轮流换字符串。结构化 span 让 Host 保持为清理、着色、组合和截断的唯一入口。

**发布不带投机字形的纯文本指标。** 这样可以保住 `setStatus()` 通道，因为剩余内容是一段无颜色的字符串。代价是失去已确认设计要求的闪烁指示、固定指标配色和受控截断。

**通过 `setStatus()` 通道或自定义 segment 把指标渲染进原生 statusline。** 原生 statusline 由用户配置，`showHookStatus` 和 preset segment 控制位置与可见性，Package 无法保证一行稳定区域，注册 segment 还会替换用户可见的原生组件。常驻 Widget 行让这项能力不受用户 statusline 配置影响。

**用一个带显示开关的 Provider 代替独立指标 Provider。** 单个 `tokens` Provider 加逐指标开关会重复 `statuses` 已经提供的选择与排序能力，两套机制还可能对显示哪些指标、按什么顺序产生分歧。独立 Provider 让一个结构同时完成选择和排序。

## 验收标准

1. `projects/omp-status-bar/` 是自包含的 OMP Plugin Package，包含 `omp.extensions` 入口，不依赖本地 OMP 检出或 fork。
2. OMP 原生 Plugin 启用和停用状态是 Package 唯一的总开关。Package 从当前 OMP agent 目录读取带版本的 `omp-status-bar.yml`，每个会话读取一次，不热加载。
3. 有序 `statuses` 数组选择已注册的 Provider 并定义顺序。每个配置项创建独立实例。顶层文档格式错误时不启动 Provider；不可用或无效的条目被诊断并跳过，不影响有效条目；空数组不挂载 Widget。顶层 `separator` 只接受 `space`、`slash`、`dot` 和 `pipe`，默认 `slash`。
4. Host 以稳定 key 每个会话挂载一个 `belowEditor` Widget，按 `statuses` 顺序渲染一行组合结果，从右侧 ANSI 感知截断，终端变窄时不重排、不删除条目、不改变标签形式。Provider 更新不会重新挂载 Widget，会话关闭卸载后无残留。
5. 发布合同是结构化 `ProviderFragment`，span 经过清理。Host 剥除转义序列和控制字符，只接受 `#RRGGBB` 颜色，深复制发布的片段，撤回空内容，按实例隔离无效片段，并且 separator 不在 Provider 职责范围内。
6. 公开注册入口在注册时和实例创建前拒绝重复 ID 和不兼容合同版本，不受 Extension 加载顺序或重复 Package 模块实例影响，Registry 存储、配置、组合和 UI 内部保持私有。
7. 内置 ID 恰好是 `total`、`input`、`cache`、`output`、`cache-hit` 和 `context`。token 指标遵循已确认口径，缓存命中率分母为零时隐藏，`label` 按实例接受 `compact` 和 `word` 且默认 `compact`，`context` 接受 `percent` 和 `absolute`，颜色固定不开放配置。
8. 投机指示只读公开数据和 OMP 导出的解析函数，具有 `hidden`、`normal`、`indicating` 三种状态，区间内锁存，token 下降、条件失效、模型变化或会话结束时退出，回落到区间起点以下才允许再次进入，且不声称压缩正在运行或已经完成。
9. Package 对直接导入的 `@oh-my-pi/*` 包以 OMP 18.x 范围声明 peer dependency，记录已验证版本，并在目标版本所有内置 Composer shape 下通过同一个 belowEditor 挂载点工作，不依赖 `statusLine.showHookStatus` 和 custom preset 的 `status` segment。
10. 行为测试覆盖配置、部分失败、片段清理、有序组合、截断、可控时钟下的投机状态机、单独加载 fixture 的公开注册、headless 会话、资源清理和 shutdown 竞争。渲染检查枚举目标版本内置 Composer shape 和 statusline preset，并包含一个 Extension 注册的 shape，全部走 Widget 路径。真实 OMP TUI 冒烟检查记录有代表性的输出并确认无残留状态。
11. Package 内英文和中文文档语义一致并互相链接，说明使用方式、Widget 位置、投机估计及其局限，以及第三方 Provider 开发方式。
12. 实现创建对应的双语决定，移除旧状态栏提案对和本提案对，原地替换失效的选择，不保留兼容层。

## 风险

Widget API 和 belowEditor 位置由 OMP 控制。如果未来的 OMP 版本更改或移除它们，Widget 会消失或渲染异常，直到 Package 适配为止；而静默面向不兼容版本的发布，问题要到渲染时才暴露，而不是在安装时就被发现。每次发布用真实 TUI 检查验证记录的 OMP 范围，peer dependency 范围让不受支持的版本无法干净安装。

投机估计通过导出的解析函数读取公开数据。如果 OMP 更改这些函数的签名或它们在公开导出中的位置，Package 会加载失败或用错误输入构建区间，导致指示在不该出现的时机出现。Package 把导入路径固定在已验证的 OMP 范围，并在每次发布的 TUI 检查中重新验证。

结构化发布合同是公开的兼容义务。结构有效但文本包含 escape sequence 或控制字符的片段一旦到达终端会破坏 Widget 行；Host 的清理器会在渲染前剥除这类内容，清理器的缺口则会让它穿透并打乱输出。清理器是可靠性边界，不是沙箱：第三方 Extension 是运行在 OMP 进程中的可执行代码，能够绕过合同直接写终端。清理器作用于每个发布的 span，其规则属于受测试的合同。

字形依赖终端字体。在字体缺少 Nerd Font 码点的终端上，指示显示为空白或占位框；Package 接受这一点为范围外，不提供回退字符，并在文档中说明。
