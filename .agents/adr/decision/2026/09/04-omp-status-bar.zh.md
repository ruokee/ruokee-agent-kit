# OMP 状态栏

Decision owner: Ruokee
Decision writer: OMP Claude Opus 5.5
Reverses: [OMP 状态栏](../../../archived/2026/09/04-r4-omp-status-bar.zh.md)

[English](./04-omp-status-bar.md) | 中文

## 动机

把 `@ruokee/omp-status-bar` 维护为一个由状态 Host 与注册的 Provider 组成的自包含包，并用一个标识上下文窗口的静态字形取代投机区间估计。

`@ruokee/omp-status-bar` 包在编辑器下方的一行常驻输出中显示当前会话的上下文用量、token 读数、缓存命中率和已回答的模型请求次数。当前选择包括：由它持有的常驻输出行、Host 组合的结构化且经过清理的 Provider 片段、agent 目录下的有序配置、内置指标 Provider 及其固定颜色、已回答请求次数、静态的上下文窗口字形，以及随 Package 保存的文档与证据。Package 在 README 中声明维护承诺，维护承诺不决定哪些宿主可以安装它。

Package 原先给上下文读数配上上下文已进入 OMP 投机区间的估计。估计通过 `Settings.getGroup` 读取宿主的压缩设置，而从 18.4.0 起宿主不再提供该方法，指示器在当前宿主上始终隐藏。按照[宿主内组件按共同的 OMP 下限维护](../../../archived/2026/09/28-r2-host-maintenance.zh.md)，面向 OMP 的组件共用维护下限 OMP 18.5.0，没有任何受维护宿主还能支持该估计，Package 也没有其他公开途径读取这些设置。

OMP 把带外的模型调用与对话记在同一个会话账本里，并通过同一个会话用量统计报告出来。Find 工具的判定级联就是这样一个调用方：它以 `purpose: "find"` 记录自己的调用，而这些记录不携带任何 cache 读数，因为判定路径只报告输入数、输出数与计费成本，无论服务端是否复用了缓存前缀都把 cache read 与 cache write 写为零。因此取自会话统计的读数会计入对话从未发起的流量，抬高输入读数并压低缓存命中率，计入量还随一次搜索读取的文件数增长。

## 分析

宿主 peer 声明只说明 Package 导入哪些宿主包，而在其中写入数值范围会同时替每个解析该依赖的宿主决定能否安装（[共同 OMP 下限决定](./28-host-maintenance.zh.md)）。因此维护下限不放进 peer 声明，而在组件 README 的兼容性小节声明；Package 与 OMP 的耦合保持为对公开 Widget 和上下文用量 API 的能力耦合。实际验证过的版本与场景是组件文档中的证据，不是下限本身。

[先前的决定](../../../archived/2026/09/04-r1-omp-status-bar.zh.md)不接受列表之外的内置 ID，而枚举本身并不是被保护的边界。同一节还排除了金额、cost 和 premium request 读数以及旧的 `tokens` 别名，而 Package 使用文档已经维护内置 ID 及其 options 和颜色。写明 Provider 范围，并用链接把该文档指定为清单归属，就能保留边界。

由会话活动推导出的读数只能作为内置 Provider 发布。公开的 Provider 合同只给实例提供它的 options、它的配置、一次发布调用和受管定时器；它不携带会话数据和事件，宿主也只对内置 Provider 绑定会话数据源。为公开合同增加这样一条通道，比增加这个读数本身的改动更大，而宿主已经向扩展报告每一轮，并同时给出响应是如何结束的。

会话总量没有按用途拆分，也没有逐条明细，因此该 API 的任何调用方都无法把对话的用量与其余部分分开；而会话所持分支带着每条条目的父子链。该分支已经是已回答请求次数的来源，因此两项读数在沿树回退、新建分支和切换会话时一起重新取值。`task` 工具结果报告的是子代理为对话这次请求所做的工作，因此这些 token 属于对话，保持计入。只累加有限数值，因此异常记录导致少计，而不是产生非数值读数。

## 决定

### 包

`projects/omp-status-bar/` 是一个第一方、自包含的 OMP Plugin Package。[第一方能力套件决定](../08/20-first-party-capabilities.zh.md)允许真实能力使用 `projects/`，[组件自包含决定](../08/24-component-self-containment.zh.md)要求每个可分发组件保持独立。Package 只使用公开的上游 OMP API，不包含、不修补、也不要求本地 Fork。

实现拆分为状态 Host 和注册制 Provider。公开合同覆盖 Provider 身份、option 校验、实例创建和生命周期、片段发布和托管调度。Registry 存储、配置加载、组合、诊断和 OMP UI 调用保持私有。每个配置条目创建独立实例，同一个 Provider ID 可以带不同 options 出现多次。

注册是受支持的 Package API，其规则由 [Provider 合同](../../../../../projects/omp-status-bar/docs/provider-contract.zh.md)持有：导出的类型及其背后的导入路径、进程级 Registry key、注册时的拒绝规则，以及 Host 在创建实例前重复执行的版本校验。解析到自己 Package 副本的 Extension 因此仍注册到同一个 Registry，注册也不依赖 Extension 加载顺序。

### 配置

OMP 原生 Plugin 启用状态是唯一的 Package 级开关，Package 不定义单独的 `enabled` 字段。

配置存放在 `omp-status-bar.yml`，位于公开再导出的 `getAgentDir()` 返回的当前 OMP agent 目录下，使配置跟随 profile 而不需要给 OMP 核心设置 schema 增加键。上游 Plugin 设置 schema 只接受标量和枚举值，因此带嵌套 options 的有序 Provider 列表无法来自 Plugin 设置。

文件包含 schema 版本、既选择 Provider 又定义显示顺序的有序 `statuses` 数组，以及顶层 separator 设置。[使用文档](../../../../../projects/omp-status-bar/docs/usage.zh.md#配置)持有文件的字段、可取值与默认值、separator 字形，以及逐条目的失败行为。Host 用弱化样式渲染 separator，Provider 不输出 separator，没有 UI 支持的会话保持空闲。

### 常驻 Widget

Widget 在会话期间常驻编辑器下方，并作为原生 statusline 的补充：Package 不注册 statusline 段，也不替换任何段。挂载、组合与宽度处理由 Host 负责，具体规则见[使用文档](../../../../../projects/omp-status-bar/docs/usage.zh.md#常驻-widget)。

### 片段

发布合同是结构化片段而不是字符串。[Provider 合同](../../../../../projects/omp-status-bar/docs/provider-contract.zh.md#发布)持有片段类型、Host 执行的标准化规则、隔离 Provider 后续修改的深复制，以及空片段、撤回片段与结构无效片段的处理方式。

Provider 不调用 OMP UI 方法，不获取 Widget 或 theme，也不输出 separator。

### 内置 Provider

Package 提供内置指标 Provider。[Package 使用文档](../../../../../projects/omp-status-bar/docs/usage.zh.md)持有当前清单：内置 ID、它们的 options、输出形式，以及数值背后的公式。此后增删内置 ID 是清单变更，不是对本次决定的反转。

Provider 范围保持封闭：Package 不提供金额、cost 或 premium request 读数，也不读取、格式化或配置这些金额。旧的 `tokens` ID 直接消失，没有别名。

颜色遵循 pi-moon 配色且不可配置。label option 按实例选择 compact 或 word 形式，一份配置可以混用两种形式，窄终端不会改变已选形式。缓存命中率的精度是另一项显示 option，取值范围由同一份使用文档维护。

token 指标和缓存命中率共享一个取自对话自身用量而非会话总数的数据口径：会话所持分支上的 assistant 消息，以及 `task` 工具结果报告的用量，带外记录不贡献任何用量。读数不依赖编排字段与金额，使用文档与该口径一起说明被排除的记录、共享的 token formatter 与各项读数的公式。

`context` Provider 读取公开的上下文用量 API，支持 `percent`（默认）和 `absolute` 两种模式，`absolute` 只用共享 formatter 显示当前 token 数。

### 请求计数

Package 提供一个内置 Provider `turn`，统计本次会话有多少次模型请求得到了成功响应，并把该计数作为一项独立读数发布，不据此再推导任何指标。它的标签、options 和显示形式由使用文档持有。

数值在会话被恢复或切换后保持，并始终反映会话所持有的分支历史，因此沿会话树回退或新建分支时会按当时的前台分支重新取值。

只有成功的响应才使数值前进；失败的请求、被中断的响应，以及在模型调用前就被拦下的请求都不改变它。

Provider 跟随会话的轮次生命周期，而不是依赖快照的指标：它不注册 timer，采样周期由那些指标负责。

### 上下文字形

`context` 状态的文本左侧固定显示 Nerd Font 字形 `U+F0068`，作为上下文窗口的标识。字形与文本属于同一个状态片段。字形不闪烁，不随上下文用量变化，也不显示窗口大小。终端字体缺少该字形时没有回退。

Package 不读取任何压缩设置，也不估计 OMP 的投机区间。

### 证据

[英文和中文公开文档决定](../08/20-bilingual-docs.zh.md)适用，Package 本地使用文档互相链接。Package 文档覆盖安装、启停、配置 schema、内置 Provider ID 及其 options、按条目失败行为、Widget 位置、上下文窗口字形、已回答请求次数的含义和显示形式，以及实际验证过的宿主版本及其覆盖的场景。组件 README 的兼容性小节声明维护下限，该小节是这一下限的权威说明：Package 声明共同的 OMP 下限、不设维护上限，不维护受支持版本白名单，也不会仅凭版本阻止任何宿主。低于下限的宿主不会被阻止运行本 Package，也不因此获得维护承诺；提高下限按[共同 OMP 下限决定](./28-host-maintenance.zh.md)处理。Provider 编写文档定义公开导入路径、注册时机、合同版本、冲突行为、生命周期上下文，以及如何安装和选用独立打包的 Provider。

直接 `@oh-my-pi/*` 导入以不带版本范围的形式声明其宿主包，声明只列出 Package 使用的宿主包，不承载维护限制。行为测试覆盖配置解析与按条目降级、片段清理与无效片段隔离、有序组合与宽度截断、带字形的 `context` 片段、已回答请求次数的计数规则及其显示状态和会话行为、来自独立加载且无共享模块身份的扩展的注册、无残留 timer 或 Widget 的清理，以及目标版本内置 Composer shape 与 statusline preset 加一个扩展注册的 shape，全部走同一个 Widget 路径。自动化测试全部无头运行，看不到终端：确认 Widget 出现在编辑器下方并与原生 statusline 共存的真实 OMP TUI 会话是发布要求，按发布提交运行并评审后才可打标签，不进入单元测试套件。

## 考虑过的替代方案

**在原生 statusline 中保留纯文本指标。** 这样可以继续使用 `setStatus()`，但位置与可见性仍由 `showHookStatus` 和 preset 段控制，代价是失去固定指标颜色、受控截断和独立常驻的一行。

## 结果

Host 负责清理、组合、截断和 Widget 生命周期，Provider 保持很小，也无法破坏整行。第三方扩展获得一个稳定、带版本的合同来增加 Provider，不需要触碰 Host。

Package 与 OMP 公开的 Widget 和上下文用量 API 耦合。它只声明维护下限、不设维护上限，这表达的是维护承诺，而不是后续每个版本都可用；实际验证过的版本与场景与这一声明并列记录在组件文档中。每次发布打标签前都会在它所针对的宿主上运行真实 TUI 检查，因为自动化测试全部无头运行，看不到终端。

该行不再提示上下文大概进入了 OMP 的投机区间。依赖闪烁的用户只能从 OMP 自身界面得知压缩情况；在 18.4.0 以前的宿主上，原本仍能工作的指示器变为静态字形。

已回答请求次数跟随会话所持有的分支，因此回退会让它下降，会话绑定后显示的数值也可能比绑定前记录的数值少一。这两种情况都是预期结果。

Package 不为纯文本合同、`tokens` ID、金额显示或任意 separator 保留兼容层。

token 读数与缓存命中率描述的是对话而不是会话。OMP 自身的 statusline 和任何成本报告仍包含带外流量，因此该行与那些读数按设计不同；使用文档在公式旁写明口径与被排除的记录。

宿主若不再把 `task` 用量报告在工具结果上，或改用另一种形态记录对话用量，读数就会少计。

每次采样都要遍历分支，因此开销按采样节奏随会话条目数增长。遍历只读取需要的字段，并且每 tick 对五项读数至多执行一次。
