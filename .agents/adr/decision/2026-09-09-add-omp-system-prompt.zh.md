# ADR 决定：添加 OMP 系统提示词扩展

Decision owner: Ruokee
Draft writer: OMP
Reverses: [添加 OMP 系统提示词扩展](../archived/2026-09-07-add-omp-system-prompt.zh.md)

[English](./2026-09-09-add-omp-system-prompt.md) | 中文

## 动机

`@ruokee/omp-system-prompt` 替换 OMP 已渲染系统提示词中的固定策略，同时保留选定的运行时内容。公开的 `before_agent_start` 事件提供当前 `systemPrompt: string[]`，公开扩展 API 提供有效插件设置与 Skill 命令元数据。因此可以实现自包含扩展，不修改 OMP，也不复制其私有提示词装配器。

peer dependency 与运行时激活不以特定 OMP 版本为条件。固定的 dev dependency 提供可复现的测试 fixture，其版本号并不决定兼容性。转换器在返回替换前会检查完整目标结构，这些检查才是兼容边界。

## 决定

### 分发一个自包含扩展

包、自有英文提示词、运行代码、测试和双语公开文档都位于 `projects/omp-system-prompt/`。通过原生 `omp.extensions` 元数据声明入口。只使用未修改的 OMP 发行版与公开扩展 API。不得导入私有提示词装配器、重新扫描资源、收录上游模板副本、修改已安装文件、另建 SDK 自有会话来替代宿主，或替用户写入 `SYSTEM.md`。

将 `@oh-my-pi/pi-coding-agent` 声明为不限制版本的 peer dependency。不得读取宿主版本来决定安装资格、激活、转换、诊断或回退。固定的 dev dependency 可以复现实测宿主 fixture，但它只是验证证据，不能成为支持边界。

### 转换当前 turn 输入

注册 `before_agent_start`，在每个受覆盖的普通 turn 处理当前 `event.systemPrompt`。不得以启动快照或 `ctx.getSystemPrompt()` 代替处理器链输入。激活时只加载一次自有模板。前序处理器留下的独立块保持原位，后序处理器可以替换本处理器的结果。

识别恰好一个受支持的默认主块和一个结构有效的 PROJECT 块，不假设固定数组索引。检查锚点顺序、数量、可选区段、必需及条件固定文本、已知分隔符与目标完整覆盖。嵌入正文按不透明数据处理。只有外层检查全部通过后才构造输出；完整校验后的输出没有变化时，不返回 `systemPrompt`。

使用自有模板重建主块。保留宿主渲染的工具与设备目录、Internal URL 条目、always-apply 与领域规则、受支持的 runtime-mode 协议和全部独立块。校验并消费宿主 Delegation 策略，不把其固定策略正文复制进自有槽位。只改写已定义的 PROJECT 包装正文和固定外层 critical 尾部；上下文正文、路径、工作区数据、append 文本及无关块逐字节保留。

只有完整校验自有骨架和 PROJECT 结构后，才识别本扩展此前生成的输出。同时支持有 Delivery 与无 Delivery 两种形态，使重复 turn 保持幂等，设置变化只切换该章节。

### 配置 `renderDelivery`

在 `omp.settings` 中将 `renderDelivery` 声明为 boolean，默认值为 `true`。每个受覆盖 turn 都通过公开的 `getPluginSettings(packageName, ctx.cwd)` API 读取当前 `ctx.cwd` 的有效值。只有确切的 boolean `false` 才省略完整的末尾 `# Delivery` 章节，包括 Task scope、Completion、Evidence 和 Pausing。`true` 或未配置时保留该章节。

设置读取失败或值不是 boolean 时使用 `true`，按会话及原因去重报告有界设置诊断，并让请求继续。不得直接解析 OMP 配置文件，也不得增加另一套配置来源。

### 保留 Skill 行为

事件目录决定可见 Skills。当前 `pi.getCommands()` 中 `source: "skill"` 的条目只作为确定 description 边界的有序候选。仅使用名称、顺序和 description；忽略路径，不重新扫描资源，也不把隐藏候选加入输出。

只有完整目录与命令候选形成唯一有序对应时，才归一化可见 description 的空白。名称、顺序、可见集合与非空白文字保持不变。如果 Skill 外层目录已安全分离，但元数据缺失、格式错误、有歧义、被关闭或与已渲染文本不兼容，则逐字节保留完整目录，并继续其他转换。该局部回退只报告 `Skill catalog formatting skipped`。如果外层边界本身不可靠，则按整份提示词结构失败处理。

隐藏 Skill 保持不出现在自动目录中，同时保留宿主提供的资源访问与手动命令行为。手动 Skill 调用保留完整 Skill 正文、参数与用户归属，不经过目录 description 格式化。

### 使用有界诊断安全回退

custom 提示词、空或损坏的目标结构、缺失或损坏的模板、受检查区域中的未知内容、有歧义的外层边界及无效的自有输出形似结构，都会保持传入块数组不变。交互会话通过 `ctx.ui.notify` 报告有界整体诊断，其他情况使用 OMP logger。诊断不得包含提示词正文、Skill 名称、私人路径或会话上下文。同一会话内对相同诊断去重。

用最小异常边界包围每轮正常的设置读取、命令元数据读取、转换与结果处理路径。如果该路径意外抛出异常，则捕获异常并返回 `undefined`，使传入提示词继续生效；通过同一 tracker 报告原因 `unexpected-error`。不得包含异常消息或 stack。诊断应说明替换未应用，不得声称阻止了模型请求。

激活期模板缺失或损坏时仍注册 turn 处理器。第一个受覆盖 turn 通过正确的会话通道报告 `template-unavailable`，并保持输入不变。

### 明确覆盖与证据边界

该钩子覆盖普通主会话 turn，以及重新绑定父会话扩展的普通子 Agent turn。受限工具及 plan-mode 子 Agent 不加载扩展。Handoff、标题生成和难度分类采用其他路径。`/btw` 等临时旁路请求不独立运行该钩子，可能使用当前生效的 Agent 提示词。turn override 可以在宿主轮中重建后持续到下一轮。替换会改变宿主记录的基础目录交付状态，因此设备挂载通知可能重复。

验证必须区分以下可观察结果：

- 成功替换到达最终 Provider 请求，同时保留运行时内容。
- 结构失败与意外异常保持传入提示词原样生效，并发出有界整体诊断。
- Skill 元数据失败只保留已分离目录，自有提示词与 PROJECT 改写仍到达 Provider。
- `renderDelivery` 的变化在下一轮生效，并保留其他已识别内容。
- 隐藏 Skill 的可见性与手动调用仍由宿主控制。

组件检查必须覆盖结构识别、逐字节保留、幂等、两种 Delivery 形态、设置回退、Skill 成功与局部回退、异常回退和诊断去重。真实宿主检查必须记录实测 OMP 版本、宿主输入、相关命令元数据、处理器结果、最终 Provider-facing 内容和同次运行的诊断。仅有处理器返回值不能作为 Provider 证据。实测版本与固定 dev dependency 仅记录已执行的 fixture，不构成安装、激活或兼容限制。

## 考虑过的替代方案

### 要求精确的 OMP 版本

要求精确的 OMP 版本时，扩展会在检查其他版本是否可能兼容之前就停用，因此不满足兼容要求。

### 维护允许的 OMP 版本白名单

白名单会在每个未列出的版本上停用扩展，还会增加持续维护工作。允许的版本仍须执行结构检查，因此白名单不能提供兼容证明。

## 结果

只要 OMP 加载扩展且所需公开 API 可用，扩展就尝试正常转换。在测试 fixture 之外的发行版上，它同样会转换兼容的已渲染结构；不兼容结构与意外 turn 处理异常则保持宿主提示词生效。

文本识别不是来源或安全边界。后续宿主可能保留可识别语法，却改变 API 或区段语义。真实宿主验证只能证明观察到的行为。公开文档必须准确标识实测 fixture 与每项观察的范围，不得将证据改写成支持版本表或精确兼容承诺。

结构覆盖与安全回退是关键约束：已识别宿主结构、保留的运行时区段、Skill 匹配、Delivery 边界或覆盖路径发生变化时，发布前必须补充对应组件检查；涉及 Provider 行为时，还必须取得真实宿主观察证据。
