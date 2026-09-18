# ADR 决定：为系统提示词扩展增加模型级规则

Decision owner: Ruokee
Decision writer: deepseek/deepseek-v4.1-flash

[English](./2026-09-14-add-model-prompt-rules.md) | 中文

## 动机

各模型遵循指令的方式并不相同。维护者可能希望某个模型在改动前先说明自己的假设，而另一个模型直接给出简短回答，同时不必修改扩展源码、宿主文件或分发包。

在[已核对的修订](https://github.com/can1357/oh-my-pi/commit/61b1b8aef634334eaf1412afd003a763e1d1b9c1)中，OMP 没有模型级指令机制。上游 [issue #6739](https://github.com/can1357/oh-my-pi/issues/6739) 要求提供模型级 `modelInstructions`。公开的 `before_agent_start` 事件暴露已渲染的 `systemPrompt: string[]`，并接受用于当前 turn 的替换数组（[event](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/extensibility/extensions/types.ts#L752-L768)、[result](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/extensibility/extensions/types.ts#L1149-L1153)），`ctx.model` 提供当前 `Model`，包括其 provider 和 id（[context](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/extensibility/extensions/types.ts#L476-L480)）。因此 OMP 扩展无需修改 OMP 即可按模型选择提示词文本。

`@ruokee/omp-system-prompt` 已经变换同一个数组以替换固定策略。另建一个组件会对同一 turn 输入叠加第二次变换，可见结果取决于安装顺序（[chaining](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/extensibility/extensions/runner.ts#L1715-L1725)）。由同一个组件按固定的内部顺序完成两项工作可以避免该依赖。

所需形式是用户自有的 Markdown。frontmatter 块承载匹配元数据，该部分不注入；正文承载注入文本。

## 决定

### 组件

本能力由 `projects/omp-system-prompt` 承载，遵循 [增加 OMP 系统提示词扩展](./2026-09-09-add-omp-system-prompt.zh.md) 与 [保持组件自包含](./2026-08-24-keep-components-self-contained.zh.md) 两项决定。包名、原生 `omp.extensions` 入口、`renderDelivery` 设置与 peer dependency 合同保持不变；其他仓库组件中的文件不参与。

没有规则文件时，每个 turn 的行为与之前一致，因此该变更对已安装用户是增量式的。不提供启用开关：规则文件是否存在决定该能力是否生效。

按顺序注册两个 `before_agent_start` 处理器：原有的替换在前，规则追加在后。追加步骤读取替换步骤产出的数组，因此不会重新识别替换步骤刚写入的块。两个步骤独立失败。替换失败时为追加步骤保留传入的宿主数组，追加失败时保留替换结果。两者都通过组件已有的、按会话去重的有界诊断通道报告。

### 规则文档与匹配

在钩子运行的每个 turn 读取两个固定目录：

- 用户目录 `getAgentDir()/model-prompts`，通过 `@oh-my-pi/pi-utils` 提供的 `getAgentDir()` 解析；
- 项目目录 `getProjectAgentDir(ctx.cwd)/model-prompts`，通过同一包的 `getProjectAgentDir()` 解析。

目录只贡献其直接子项中扩展名为小写 `.md` 的普通文件。加载器不递归、不跟随文件符号链接、不读取隐藏文件。文件按文件名的 JavaScript 字符串比较排序，因此 `10-`、`20-` 这类前缀决定顺序，异步读取不会改变该顺序。用户目录的正文排在项目目录的正文之前。正文不跨目录去重，项目文件不遮蔽用户文件，内容相同的文件不合并。目录缺失视为空集，一个目录读取失败不影响另一个目录继续提供规则。

规则文档以 frontmatter 块开头，分隔行内容恰好为 `---`，前面可以有一个 UTF-8 BOM。frontmatter 只有一个必需键 `match`，其值为非空数组。每个条目是只含下列键之一、且值为非空字符串的对象：

| 键 | 匹配对象 |
| --- | --- |
| `exact` | 与 `${model.provider}/${model.id}` 相等 |
| `model` | 与 `model.id` 相等 |
| `contains` | 是 `${model.provider}/${model.id}` 的字面子串 |
| `regex` | 以不带标志的 `new RegExp(value).test()` 测试 `${model.provider}/${model.id}` |

条目之间是“或”的关系。任一匹配条目即应用该文件，命中多个条目的文件只追加一次。匹配区分大小写且为文本匹配：不解析别名、角色、家族、显示名、传输名或选择思考等级的后缀，也不提供通配符或模型列表。包含 `/` 的模型 id 按完整 id 比较。

追加步骤取闭合分隔行之后的正文，逐字节追加，包括空行、CRLF、缩进、HTML 注释、模板形似文本和末尾换行。它移除开头的 BOM。

未知键、一个条目含多个键、`match` 数组为空、值不是字符串、YAML 无效、分隔行缺失或格式错误、正则无法编译，都会使该文件无效。组件跳过无效文件，并报告一条指明该文件和固定原因码的诊断。被跳过的文件不会部分生效，组件也不会删除或替换来自其他文件的文本。追加步骤在钩子运行的每个 turn 重新读取规则文件，因此新增、修改和删除在下一个 turn 生效，无需重启会话。

### 注入契约

至少有一条规则匹配时，追加步骤返回传入数组本身，并在其后追加每个匹配文件对应的一个块，顺序如上。没有匹配时，它不返回任何内容，传入的 turn 输入保持不变。

只使用系统提示词通道。宿主在每个 turn 从其基础提示词重新装配（[base prompt](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/session-tools.ts#L1488-L1524)），不会把某个 turn 的 override 当作下一 turn 的输入，因此连续的普通 turn 不会累积追加的块。

追加步骤不读取 `ctx.getSystemPrompt()`，不修改传入块，不添加包装标签或标题，也不重新渲染宿主内容。

### 诊断

无效规则、不可读目录以及校验之外的异常，都通过组件已有的通道报告：交互会话使用 `ctx.ui.notify`，其他情况使用宿主 logger，并按会话与来源去重。诊断包含固定原因码和可定位来源，例如 `project/20-reasoning.md`。诊断不包含规则正文、绝对路径、原始解析错误、正则源码或对话内容。

正则按 JavaScript 正则执行，没有超时，也没有沙箱。

### 上游复核

组件记录当宿主自行提供模型级指令（通过上游 issue #6739 或等价能力）时需要复核的内容：

- 宿主覆盖的匹配维度，例如精确 `provider/model` 键、裸模型 id、子串与正则；
- 宿主文本与替换后或自定义系统提示词的组合方式：替换还是追加，以及它在块序列中的位置；
- 宿主文本的刷新时机：每个 turn、每次 Provider 请求、切换模型、临时切换与回退；
- 宿主发现规则的方式：目录、用户级与项目级优先级、文件顺序。

复核结果决定本能力是保留、只覆盖宿主未提供的部分，还是移除，并伴随相应的版本变更。

### 验证

组件检查覆盖四个匹配键的正反用例、单文件内的多条目替代语义、包含 `/` 的 id、大小写敏感、`exact` 与 `model` 的差别、规则校验与 BOM 处理、LF、CRLF、缩进、HTML 注释与末尾换行的正文保真、跨两个目录且不受读取完成顺序影响的排序、目录缺失、与替换步骤的组合及两个方向的失败、以及追加块跨 turn 不累积。

真实宿主检查记录所用 OMP 版本、所用模型和观察到的 Provider-facing 请求。处理器返回值本身不构成 Provider 证据。检查确认追加文本进入请求、frontmatter 从不进入、切换模型后按新模型重新匹配、宿主块与动态内容保留、连续 turn 以及轮中重建后追加文本不重复，以及普通子 Agent turn 继承规则，而受限工具与 plan-mode 子 Agent 不运行该钩子。当前模型配置无法触发的场景（例如自动回退）记为未验证，而不是推断结论。

追加步骤不保存缓存，每个受覆盖的 turn 读取两个目录。目录按设计保持很小，读取范围限于直接子项。

## 考虑过的替代方案

### 分发独立扩展并记录顺序契约

该方案在决定能力归属时进入选择。两个组件变换同一个数组时，可见结果取决于安装顺序，因为处理器按扩展顺序运行且没有优先级选项，同时要求替换步骤识别或保留另一个组件拥有的文本。合并到同一个组件可以消除这两项依赖。

### 为追加的块添加可识别前缀

该方案在加固独立扩展设计时进入选择。组件自有的标记会让替换步骤的块识别失败，而不是识别错误。它把组件内部的记账文本写进本应逐字节注入的提示词内容，因此随独立扩展方案一并放弃。

### 作为首条对话消息注入

该方案在决定注入位置时进入选择。`message` 通道把 `role: "custom"` 消息插入该 turn 的消息列表（[consumption](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/agent-session.ts#L6496-L6525)），会话把它们记录为 `custom_message` 条目（[persistence](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/agent-session.ts#L2806-L2820)、[entry](https://github.com/can1357/oh-my-pi/blob/61b1b8aef634334eaf1412afd003a763e1d1b9c1/packages/coding-agent/src/session/session-manager.ts#L2488-L2499)），因此每个 turn 都会向历史追加一份指令副本。切换模型后，历史仍保留为上一个模型选择的指令，且该文本的权威级别低于系统提示词。因此选择了每个 turn 都会重建的系统提示词。

### 按 OMP 角色别名匹配

该方案在决定匹配维度时进入选择。宿主不记录启动角色，因此角色条件只能表示该角色当前解析到的模型，这是另一个问题。该方案被放弃，只保留上述四个键。

### 补丁修改 Provider 请求载荷

该方案在考虑按每次 Provider 请求而非每个 turn 刷新时进入选择。它需要掌握各 Provider 的载荷结构，而现有扩展点没有发布 Provider 请求载荷的契约。所需行为不需要逐请求刷新，因此该方案保留为未来变更的备选，不进入本决定。

## 结果

项目目录中的规则文件会把仓库内容变成系统提示词文本。OMP 不做项目信任校验，项目设置与扩展会随当前目录无条件加载。因此，随仓库提供 `.omp/model-prompts/*.md` 的克隆仓库可以向在该目录内打开的任意会话添加指令。公开文档写明该目录和注入行为，维护者把自己的规则放在用户目录。

如果宿主某次变更加入「把上一 turn 的 override 作为输入传回」的行为，追加文本会不断累积。追加步骤依赖宿主每个 turn 从基础提示词重新装配；该行为一旦改变，每个匹配正文每 turn 都会多出一份副本。上述验证覆盖连续 turn 和轮中重建，上游复核覆盖迁移到宿主自有机制的情形。

规则正文会增大每个匹配 turn 的系统提示词。不存在大小限制或额度检查，因此一个很大的规则文件会把自己的全文加入该会话后续所有 turn，可能挤占其他提示词内容。公开文档写明：只要文件匹配，追加步骤就逐字节加入其正文。

文本匹配无法区分预期匹配与偶然匹配。`contains` 或 `regex` 规则可能作用于比作者预期更多的模型，而无法编译的正则只会以一条不说明作者本意的诊断丢弃该规则。公开文档写明匹配对象、大小写敏感性和诊断通道；把规则解析到当前模型由作者负责。

追加步骤在钩子运行的每个 turn 读取两个规则目录，因此缓慢或远程的目录会拖慢每个 turn 的提示词装配，且没有缓存可摊薄。目录按设计保持很小，读取范围限于直接子项；不可读目录进入诊断通道，而不会阻塞该 turn。
