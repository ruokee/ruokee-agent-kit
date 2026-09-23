# ADR 决定：OMP 状态栏使用常驻 Widget

Decision owner: Ruokee
Decision writer: OMP GLM-5.3 Flash

[English](./2026-09-05-use-omp-status-bar-widget.md) | 中文

## 动机

先前的 `2026-09-04-add-omp-status-bar-project` 提案选择了原生 `ctx.ui.setStatus()` 扩展状态通道配合纯文本 Provider 片段，外观控制交给 OMP 原生 statusline 设置。确认后的指标设计不再适合该通道：内置指标带有固定的按指标配色；context 指标增加一个弱化字形，在上下文位于投机区间时闪烁；组合后的整行需要在终端宽度处截断且不能切断颜色序列。公开的 `setStatus()` 合同每个 key 只接受一个字符串，没有 theme、没有结构化 span、也没有 `render(width)` 生命周期。原生 ANSI 序列加反复 `setStatus()` 更新可以近似一部分，但那会把样式变成 Host 和 Provider 之间的转义序列协议，宽度截断也要解析任意 Provider 输出。

确认后的产品范围同样变化。通用的 `tokens` 指标拆分为独立的按指标 Provider，新增缓存命中率，context 指标增加投机区间估计，separator 收紧为封闭的四值集合。金额显示作为明确的产品边界被排除。这个排除只覆盖金额相关功能；并不意味着所有与 OMP 原生功能重叠的指标都必须去掉。

先前提案中仍然有效的架构沿用下来：一个自包含 Package、Host 与 Provider 分离、带版本的进程级 Registry、agent 目录 YAML 配置、OMP 原生 Plugin 启停，以及生命周期和失败隔离边界。只有关于渲染通道、纯文本片段合同、内置指标集合和 separator 规则的旧选择发生替换。当前仓库没有记录状态栏架构的决定，因此本决定替换的是一个提案而不是决定，不使用 `Reverses`。

## 决定

### 保持一个自包含 Package，Host 与 Provider 分离

`projects/omp-status-bar/` 是一个第一方、自包含的 OMP Plugin Package。[第一方能力套件决定](./2026-08-20-establish-first-party-capability-kit.md)允许真实能力使用 `projects/`，[组件自包含决定](./2026-08-24-keep-components-self-contained.md)要求每个可分发组件保持独立。`package.json` 通过 `omp.extensions` 声明原生扩展入口；Package 只使用公开的上游 OMP API，不包含、不修补、也不要求本地 Fork。

实现拆分为状态 Host 和注册制 Provider。Provider 注册通过 `package.json#exports` 条目 `@ruokee/omp-status-bar/provider` 成为受支持的 Package API。注册使用通过 `Symbol.for()` 索引的带版本进程级 Registry，因此解析到自己 Package 副本的 Extension 仍注册到同一个 Registry，注册也不依赖 Extension 加载顺序。Registry 在注册时拒绝重复 Provider ID 和不兼容合同版本。Host 创建每个实例前从 Registry 解析配置中的 ID，并再次校验其合同版本。

公开合同覆盖 Provider 身份、option 校验、实例创建和生命周期、片段发布和托管调度。Registry 存储、配置加载、组合、诊断和 OMP UI 调用保持私有。每个配置条目创建独立实例，同一个 Provider ID 可以带不同 options 出现多次。

### 使用原生启停和 agent 目录配置

OMP 原生 Plugin 启用状态是唯一的 Package 级开关，Package 不定义单独的 `enabled` 字段。

配置存放在 `omp-status-bar.yml`，位于公开再导出的 `getAgentDir()` 返回的当前 OMP agent 目录下，使配置跟随 profile 而不需要给 OMP 核心设置 schema 增加键。当前上游 `PluginSettingSchema` 只接受 `string`、`number`、`boolean` 和 `enum` 值，因此带嵌套 options 的有序 Provider 列表无法来自 Plugin 设置。

文件以 schema 版本开头，有序 `statuses` 数组同时选择 Provider 并定义显示顺序。每个条目包含非空 Provider `id` 和可选的 Provider 自有 `options`；未知字段使条目无效。配置在会话开始时读取一次，之后的文件修改不热加载，新配置在下一个会话生效。文件缺失时不显示。顶层文档格式错误时不启动任何 Provider，并记录一条有界诊断。Provider 不存在、合同版本不兼容或 options 无效的条目被跳过，其余条目继续运行。空 `statuses` 数组合法但不挂载任何内容。Host 只在 Extension 上下文有 UI 支持时执行这些会话行为，headless 下保持空闲。

顶层 `separator` 接受 `space`、`slash`、`dot`、`pipe`，默认 `slash`。Host 用弱化样式渲染 separator，Provider 不输出 separator。

### 挂载一个常驻 belowEditor Widget

配置加载完成且至少一个 Provider 启动后，Host 通过 `ctx.ui.setWidget(key, factory, { placement: "belowEditor" })` 在一个稳定的包限定 key 下挂载一个组件工厂。每个会话只发生一次。Provider 更新只替换 Host 存储的片段并请求组件重绘，不会再次调用 `setWidget()`。关机时 Host 停止 Provider、清理 timer，并通过 `setWidget(key, undefined)` 卸载。

Widget 渲染一行，严格按 `statuses` 顺序组合。空片段不产生任何内容，也不产生 separator。没有可见内容时 Widget 渲染零行但保持挂载，后续数据可以重新出现。

Host 先为组合行着色，再用 ANSI 感知的宽度测量从右侧截断到终端宽度，尾部使用单个省略号，靠前的条目得以保留。窄终端不会重排条目、删除条目，也不会把 `word` 标签降级为 `compact`。

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

Host 清理每个 span：剥离 ANSI 和 VT escape 序列，把控制字符替换为空格，合并连续空格，只接受 `#RRGGBB` 颜色，删除空 span，修剪片段边缘，并深复制结果，Provider 之后的修改无法改变界面。空片段或清理后没有内容的片段撤回该实例的内容。结构无效的片段清除该实例的旧内容，记录一条有界诊断，其他 Provider 继续运行。

Provider 不调用 OMP UI 方法，不获取 Widget 或 theme，也不输出 separator。

### 提供内置指标 Provider

内置 ID 恰好是 `total`、`input`、`cache`、`output`、`cache-hit` 和 `context`。先前的 `tokens` ID 直接消失，没有别名。没有 `cost` Provider：金额因产品决策排除在 Package 范围之外，Package 不读取、不格式化、也不配置任何 cost、订阅或 premium request 金额。

`total`、`input`、`cache`、`output`、`cache-hit` 各自接受 `options.label`，取值 `compact` 和 `word`，默认 `compact`。`compact` 显示字母 `T`、`I`、`C`、`O`、`H`；`word` 显示 `Total`、`Input`、`Cache`、`Output`、`Hit`。标签按实例生效，配置可以混用两种形式，窄终端不会改变已选形式。每个指标带固定颜色，遵循 pi-moon 配色；颜色不可配置。

token 指标共享一个来自会话用量统计的数据口径：`I` 是 input 加 cache write，`C` 是 cache read，`O` 是 output，`T` 是 `I + C + O`。指标不读取编排字段，也不读取金额。token 数值使用一个共享的十进制 formatter，单位为 `K`、`M`、`G`、`T`。会话尚未消耗 token 时，token 指标不发布内容，而不是显示一排零。缓存命中率是 `C / (I + C)`，显示为四舍五入的百分比，分母为零时隐藏。

`context` Provider 接受 `options.mode`，取值 `percent`（默认）和 `absolute`，读取公开的上下文用量 API。它把上下文文本和投机区间字形合入一个片段，用普通空格连接，绕过配置的 separator。

### 从公开数据估计投机区间

context Provider 的文本配有一个字形，表示上下文大概进入了 OMP 的投机区间。字形使用与 OMP 自身压缩图标相同的 Nerd Font 码点；终端字体缺少该字形时没有回退。估计只读取公开数据：上下文用量、当前模型和压缩设置组，并复用 OMP 公开导出的阈值、lead token 和方法解析函数，不复制其逻辑。

指示器有三个状态。`hidden`：自动压缩或异步压缩关闭，没有可投机的方法解析成功，或阈值数据不可用。`normal`：字形以弱化样式常亮。`indicating`：字形以 600 ms 节奏在强调和弱化之间闪烁。

指示明确是近似的。扩展无法观察 OMP 是否真的在压缩、是否在生成 handoff，或会话钩子是否阻止了投机任务；OMP 也可能把内部 token 估计抬高到公开上下文用量 API 报告值之上。因此指示只表示上下文大概在区间内；界面和文档不得声称压缩正在运行或已经完成。进入区间后闪烁锁存，即使越过阈值也继续，直到观察到的 token 数下降、压缩设置或解析方法变化、模型或其 context window 变化，或会话结束。下降之后，状态机要求 token 数先回到区间起点以下才允许再次指示。

### 实现证据随项目保存

[英文和中文公开文档决定](./2026-09-07-colocate-bilingual-docs.zh.md)适用，Package 本地使用文档互相链接。Package 文档覆盖安装、启停、配置 schema、内置 Provider ID 和 options、按条目失败行为、Widget 位置、投机估计及其限制，以及验证过的 OMP 兼容范围。Provider 编写文档定义公开导入路径、注册时机、合同版本、冲突行为、生命周期上下文，以及如何安装和选用独立打包的 Provider。

直接 `@oh-my-pi/*` 导入以 `>=18.1.8 <19` 范围声明对等依赖；Package 面向 OMP 18.x 并记录验证过的版本。行为测试覆盖配置解析和按条目降级、片段清理和无效片段隔离、有序组合、宽度截断、可控时钟下的投机状态机、来自独立加载夹具扩展的注册（无共享模块身份），以及无残留 timer 或 Widget 的清理。渲染检查枚举目标版本的内置 Composer shape 和 statusline preset，并包含一个扩展注册的 shape，全部走同一个 Widget 路径。自动化测试全部无头运行，看不到终端：确认 Widget 出现在编辑器下方并与原生 statusline 共存的真实 OMP TUI 会话是发布要求，按发布提交运行并评审后才可打标签，不进入单元测试套件。

## 考虑过的替代方案

**保留 `setStatus()` 并按指标输出带样式的纯文本。** `setStatus()` 通道接受任意字符串，Provider 可以内嵌原生 ANSI 序列。Host 仍可以解析并选择性放行，但那会把样式变成 Host 和 Provider 之间复杂脆弱的转义序列协议；宽度截断必须解析任意 Provider 输出，闪烁则要求每个 Provider 用自己的 timer 换字符串。采用结构化 span 后，Host 保持为清理、着色、组合和截断的唯一入口。

**把每个指标发布为纯文本，不带投机字形。** 这样 `setStatus()` 仍然可行，因为剩余内容只是一个不带颜色的字符串。代价是失去确认设计所需的闪烁指示、固定指标颜色和受控截断。

**通过 `setStatus()` 通道或自定义段把指标渲染进原生 statusline。** 原生 statusline 由用户配置；`showHookStatus` 和 preset 段控制位置和可见性，Package 无法保证稳定的一行，段注册还会替换用户可见的原生组件。常驻 Widget 行让该能力不受用户 statusline 配置影响。

**用一个带显示开关的 Provider 代替独立指标 Provider。** 单个 `tokens` Provider 加按指标开关会重复 `statuses` 已经提供的选择和排序能力，两个机制还可能对显示哪些指标、按什么顺序各执一词。独立 Provider 让一个结构同时完成选择和排序。

## 结果

Host 负责清理、组合、截断和 Widget 生命周期，Provider 保持很小，也无法破坏整行。第三方扩展获得一个稳定、带版本的合同来增加 Provider，不需要触碰 Host。

Package 与 OMP 公开的 Widget、上下文用量和压缩解析 API 在 18.x 范围内耦合。每次发布打标签前都用真实 TUI 检查验证该范围。

投机指示器是估计而不是观察；用户看到的是一个近似，其限制在文档中明确说明。

实现会移除先前的状态栏提案对和本决定的来源提案对，原地替换被取代的选择，不为纯文本合同、`tokens` ID、金额显示或任意 separator 保留兼容层。

## 变更

### 2026-09-05

`context` Provider 的 `absolute` 模式只用共享 formatter 显示当前 token 数。context window 仍用于数据校验和投机区间计算，但 Widget 不显示它。

### 2026-09-23

`cache-hit` Provider 新增 `options.decimalPlaces` option，细化它的百分比取整规则：默认保留一位小数，设为 `0` 时显示整数。该 option 只对 `cache-hit` 生效；取值范围与渲染示例由使用文档维护。
