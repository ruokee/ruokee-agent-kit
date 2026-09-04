# ADR 提案：添加可配置的 OMP 状态栏项目

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

[English](./2026-09-04-add-omp-status-bar-project.md) | 中文

## 动机

Ruokee 目前通过 OMP fork 维护个人 Harness 修改。这项能力已经不需要修改核心代码：上游 OMP Extension 可以通过 `ctx.ui.setStatus()` 发布带 key 的状态文本，OMP 会根据当前 Composer 和 statusline 配置渲染该通道，OMP Plugin Package 也能加载 Extension，并启用或停用它。

状态行需要支持多个可选来源。用户必须能够选择状态、安排顺序，并分别配置每项状态。如果把数据获取、配置、生命周期、组合和 OMP UI 写入都放在一个 Extension 函数中，每增加一项状态都会继续扩大同一个模块的条件分支。

[第一方 Agent 能力仓库决定](../decision/2026-08-20-establish-first-party-capability-kit.zh.md)允许真实能力使用 `projects/`。[可分发组件自包含决定](../decision/2026-08-24-keep-components-self-contained.zh.md)要求每个可分发组件保持独立。

当前上游 `PluginSettingSchema` 只接受 `string`、`number`、`boolean` 和 `enum` 值，Extension 公共 API 也没有导出运行时 Plugin settings 读取函数。这套机制因此无法向 Package 提供有序 Provider 列表和嵌套的 Provider 专属 options。

## 提议

### 保持一个自包含项目和 Package

在 `projects/omp-status-bar/` 创建一个第一方、自包含的 OMP Plugin Package。`package.json` 通过 `omp.extensions` 声明原生 Extension 入口。Package 只使用上游 OMP 公开 API，不包含、不修改，也不要求 Ruokee 的 OMP fork。

在同一个 Package 内把实现拆成状态栏 Host 和注册的状态 Provider。Host 和随附的第一方 Provider 保持在同一个 Package 内，不把它们发布为相互独立的仓库组件。Provider 注册是受支持的公开 Package API。安装 Host Package 后，单独安装的 OMP Extension 可以注册用于自定义状态的 Provider。

通过 `package.json#exports` 导出专用的 Provider 入口。第三方 Extension 在激活阶段导入该入口并注册 Provider。注册结果不能依赖 `session_start` 前的 Extension 加载顺序；即使第三方 Provider 使用自己的 Host Package 副本，注册也必须生效。实现不能依赖普通模块单例身份；必须采用带版本的进程级 Registry，或其他不受模块重复加载影响的机制。

公开合同注册 Provider 定义和实例工厂，涵盖 Provider 身份、options 校验、实例创建和生命周期、状态片段发布和托管调度。Host 为每个配置项创建一个实例。多个配置项可以使用同一个 Provider ID，并分别设置 options。Registry 存储、配置加载、内容组合、诊断和 OMP UI 调用保持私有。导出的类型和函数遵守语义化版本合同。Host 在创建实例前拒绝冲突的 Provider 注册和不兼容的合同版本。

每个 Provider 实例负责一个状态来源及其格式化，验证自己的 options，通过 Host context 发布一个纯文本片段，并在停止时释放资源。Provider 不调用 `ctx.ui.setStatus()` 或其他 OMP UI 方法。

Host 必须随至少一个读取真实数据源的第一方 Provider 一起交付。

### 使用原生 Package 开关和 Package 自有配置

OMP 原生 Plugin 的启用和停用状态是 Package 的唯一总开关。Package 不另设 `enabled` 字段。

`@oh-my-pi/pi-coding-agent` 公开重新导出 `getAgentDir()`。Host 将 `omp-status-bar.yml` 保存在该函数返回的当前 OMP agent 目录中。配置因此天然按 profile 隔离，也不需要向 OMP 核心 settings schema 增加字段。

配置文件首先声明 schema 版本。`statuses` 是有序数组，同一个结构既选择要显示的 Provider，也定义它们的显示顺序。每项包含 Provider `id` 和可选的 Provider 专属 `options`。每项创建独立的 Provider 实例，因此同一个已注册 Provider 可以出现多次。Host 级 separator 控制组合方式。

配置只描述数据。初始 schema 只包含版本、separator、有序 Provider 配置项和 Provider 专属 options。Host 在激活时读取并校验配置文件。实现文档说明后续文件修改何时生效，但架构合同不指定某一种 reload 机制。顶层文档格式错误时，Host 不启动 Provider。Provider 不可用、合同版本不兼容或 options 无效时，只停用对应配置项，其他有效配置项继续运行。诊断去重并限制输出量，同时保留各项独立错误。

### 集中管理渲染和生命周期

只使用一个稳定且带 Package 命名空间的 `setStatus()` key。Host 按配置项保存每个 Provider 实例的最新片段，移除空片段，按配置顺序使用 separator 组合，仅在结果变化时写入状态行。组合结果为空或会话关闭时，Host 清除该 key。

只有 Extension context 支持 UI 时才运行终端界面逻辑。Host 负责会话生命周期 handler，并使用 OMP 管理的 `ctx.setInterval()`、`ctx.setTimeout()` 和 `ctx.clearTimer()` 实现公开 Provider context 中的调度能力。Provider 失败必须被隔离和报告，不能留下重叠刷新、未处理的 Promise rejection、未受 OMP 管理的 timer，或超过会话生命周期的资源。

### 适配所有 OMP 外观方案

OMP 原生 Extension 状态通道不依赖特定的 `composer.shape` 或 `statusLine.preset`。目标 OMP 版本支持的所有内置或 Extension 注册的 Composer shape 与所有 statusline preset 都属于支持范围。Host 对所有外观使用同一渲染路径，并保持用户的 OMP 外观设置不变。

OMP 决定原生 Extension 状态通道的最终位置和样式。`statusLine.showHookStatus` 和 custom preset 的 `status` segment 控制该通道的可见性和位置。Package 使用该通道，不注册或替换内置 statusline segment。文档记录这些原生控制项和实际观察到的位置。

### 把实现证据保存在项目内

按照[维护中英文公开文档决定](../decision/2026-08-20-maintain-bilingual-public-documentation.zh.md)增加 Package 内部使用文档，并保持双向语言链接。文档说明 Host 安装、启用和停用命令、配置 schema、随附 Provider ID 与 options、配置项级失败行为、OMP 原生外观控制，以及已验证的渲染矩阵。Provider 开发文档定义公开导入路径、注册阶段、合同版本、ID 冲突行为、生命周期 context，以及如何安装和选择独立发布的 Provider。

测试顶层配置失败、配置项级降级、Registry 唯一性、同一 Provider 的重复实例、有序组合、相同输出不重复写入、Provider 清理和失败隔离。一个单独加载的测试 Extension 必须通过公开 Package 入口注册 Provider，并在被选中后正常渲染。这个过程不能依赖 Extension 加载顺序或共享的模块单例。自动渲染检查覆盖目标 OMP 版本所有内置 Composer shape 与 statusline preset 的笛卡尔积，并包含一个 Extension 注册的 shape 和 custom preset。真实 OMP TUI 冒烟检查使用结构不同的外观组合，确认状态始终可用，并在会话关闭或停用时清除。

实现变更会创建一份记录最终架构的双语决定，随后删除本提案。当前不需要反转任何决定。

## 考虑过的替代方案

**继续维护 OMP fork，并注册自定义 statusline segment。** 这种方式可以直接控制 Composer 内部实现和 segment 位置，但 Ruokee 需要持续让核心补丁适配上游变化。公开 `setStatus()` 合同已经支持所需的纯文本状态行，继续维护 fork 只会增加成本。

**把所有状态直接写进一个 Extension 模块。** 只有一项状态时，这种方式代码更少。状态选择、顺序、Provider 专属 options、刷新任务、清理和第三方注册已经需要独立处理。小而清晰的 Host 与 Provider 边界可以避免这些差异进入 Host 内部实现。

**把随附的第一方 Provider 分别发布为仓库组件。** 这种方式允许单独安装，但每个 Provider 都会依赖兼容的 Host 版本。该依赖违反仓库对可分发组件自包含的要求，还会增加独立发布工作。把第一方 Provider 随 Host 一起发布，不影响第三方 Provider 使用公开注册 API。

**把组合结果渲染为 editor 下方的 widget。** Widget 不受 statusline preset 控制，但会创建一行独立 UI，其位置不再跟随 OMP 的原生状态通道。`setStatus()` 已经能跨 Composer shape 和 preset 承载 Extension 状态，同时保留用户的外观控制，因此这项能力不需要 widget。

## 验收标准

1. `projects/omp-status-bar/` 是自包含的 OMP Plugin Package，包含 `omp.extensions` 入口，不依赖本地 OMP 检出或 fork。
2. OMP 原生 Plugin 的启用和停用状态是 Package 唯一的总开关。项目从当前 OMP agent 目录读取带版本的 `omp-status-bar.yml`。
3. 有序 `statuses` 数组选择已经注册的 Provider 并定义顺序。每个配置项创建独立实例，因此同一个 Provider ID 可以使用不同 options 出现多次。顶层文档格式错误时，Host 不启动 Provider；不可用或无效的配置项会被诊断并跳过，不影响其他有效配置项。
4. `package.json#exports` 导出文档化的 Provider 注册入口。单独安装的 OMP Extension 可以在激活阶段注册 Provider，不受 Extension 加载顺序或重复 Package 模块实例影响。
5. 公开合同包含 Provider 身份、options 校验、实例创建和生命周期、状态片段发布和托管调度，不公开 Host 配置、Registry 存储、内容组合或 UI 内部实现。
6. 一个由 Host 管理的 Registry 与 Provider 合同把配置、生命周期、数据获取、格式化与渲染彼此分离。Host 拒绝冲突的注册，合同版本不兼容的 Provider 定义不能创建实例。Host 至少随一个有实际用途的第一方 Provider 交付。
7. 只有 Host 写入一个带 Package 命名空间的 `setStatus()` key。Host 不重复写入相同结果，并在空内容或会话关闭时清除状态。周期和延迟任务使用 OMP 管理的 timer，Provider 错误不能终止 OMP 会话，也不能留下残留资源。
8. 状态能力适配目标 OMP 版本支持的所有内置和 Extension 注册的 Composer shape 与所有 statusline preset。它遵守 OMP 原生的可见性和位置控制，不要求或修改特定外观配置。
9. 行为测试覆盖配置、部分失败、重复实例、单独加载的测试 Provider 通过公开入口注册、顺序、渲染、清理、版本与 ID 冲突和失败隔离。渲染检查枚举目标 OMP 版本内置 shape 与 preset 的笛卡尔积，并包含一个 Extension 注册的 shape 和 custom preset。真实 OMP TUI 冒烟检查记录有代表性的界面渲染结果。
10. Package 内英文和中文文档语义一致并互相链接，同时说明 Host 使用、外观行为和第三方 Provider 开发方式。
11. 实现创建对应的双语决定，删除本提案，并且不反转现有决定。

## 风险

公开的 Provider 注册 API 会形成兼容义务。API 只包含 Provider 身份、options 校验、实例创建和生命周期、状态片段发布和托管调度。合同必须有版本。Host 拒绝不兼容 Provider 时限制诊断输出量。Registry 变更、配置解析、内容组合和 OMP UI 细节保持私有。

OMP Extension 与 OMP 进程同进程运行。未处理的 Provider 异常、未受 OMP 管理的 timer 或重叠刷新可能使整个 Agent 会话终止或降级。Host 必须使用受管 timer，在需要时串行执行 Provider 刷新，隔离错误，并在关闭时释放资源。

OMP 可能改变原生 Extension 状态通道的位置或样式。Package 不复制 OMP 布局逻辑，也不按外观 ID 增加分支。每次发布都会验证目标 OMP 版本的内置 shape 和 preset，在自动检查中包含一个 Extension 定义的 shape，说明原生可见性控制，并记录已测试的 OMP 兼容范围。
