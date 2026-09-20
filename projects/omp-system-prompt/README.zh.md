# omp-system-prompt

[English](./README.md)

本 OMP 扩展将 OMP 默认系统提示词中的固定策略文本替换为维护者自有的英文提示词，并为当前使用的模型追加用户自有的规则文档。扩展把已识别的宿主运行时段落保留在对应语义位置。OMP 每一轮都会重新装配系统提示词，并把块数组交给 `before_agent_start` 事件；本扩展变换的是该事件输入，而不是启动时的快照。

## 工作机制

OMP 将系统提示词装配为多个块：默认主块、可选的 Computer Safety 与活动仓库块，以及 PROJECT 页脚。每一轮中，扩展通过 `before_agent_start` 事件拿到当前块数组，然后：

- 依据 `<conventions>` 前缀与 `§ Role` 身份行识别恰好一个默认主块，并识别恰好一个结构有效的 PROJECT 页脚；其余块按原位置逐字节保留。
- 用扩展自有模板重建主块。七个槽位分别接收宿主渲染的工具目录、动态 `xd://` 设备文档、Internal URLs、Skills、always-apply 规则、领域规则和运行时模式协议。自有模板把工具目录放在 `### Tool inventory` 下，把设备目录放在 `### Mounted devices` 下。
- 将 Computer Use、Scratchpad、Tool I/O 动态行、包含自动 QA 的 Specialized Tools 和 AST 放入 runtime-modes 槽位；删除宿主固定的 Tool Policy、Exploration、Workflow、Delivery 和 Critical 策略文本前，按照已识别的提示词结构校验必需行、条件行及其渲染顺序。自有末尾 `# Delivery` 章节按 `renderDelivery` 决定保留或省略。
- 将保留的 OMP 运行时区段 `# Computer Use`、`§ Scratchpad`、`# Tool I/O`、`# Specialized Tools` 和 `# AST` 统一为标题与正文之间恰好两个 LF。若 OMP 在 `Specialized Tools` 相邻列表项之间注入空行，扩展会删除该区段内所有此类间隔；不会全局压缩空白，也不会改写自有静态正文、代码块或任意宿主内容。自有主块不保留末尾 LF，因此 OMP 使用 `systemPrompt.join("\n\n")` 时，`# Project snapshot` 前恰好只有两个 LF。
- 校验宿主 Internal URLs 区段，包括 `skill://` 条目的有无条件分支，丢弃固定的 `Most FS/bash tools auto-resolve these to FS paths.` 引导句，只保留 URI 条目。
- 校验完整的宿主 Delegation 区段后将其删除。自有的 `# Agent coordination` 章节提供下文所述的协调规则；已渲染的并发上限和额外的 `hub` 通信提示不会进入任何自有槽位。宿主按其设置执行并发限制。
- 在完整 Skill 命令元数据与目录对应时，把 Skill 目录 description 归一化为单行，见下文。
- 只改写 PROJECT 外层内容：外层标题改为 `# Project snapshot`，替换加载说明，并在结构位置删除字节精确的固定 `<critical>` 尾部。上下文文件正文、路径列表、工作区内容、附加根目录和追加的提示词字节逐字节保留。

## Agent 协调

自有协调规则在 `renderDelivery` 的两种取值下都生效。父会话派发子代理后继续推进独立且已授权的工作；无此类工作可推进且仍有子任务未完成时等待；正常交付前收齐并核验每个子代理的结果。等待可能因单个结果、消息、超时或中断返回，因此父会话必须重新核对剩余任务。已经取得的结果无需额外等待；失败、取消和阻塞应当如实说明，不得仅为提早结束而取消正常执行的工作。

任务完成无需等待 idle 或 parked 代理退出。仅用于确认完成、空闲或结束的消息无需回复；实质问题、纠正和新工作仍需处理。这些是模型指令，扩展不增加运行时等待屏障，也不改变宿主任务和消息机制。

## Delivery 配置

包在 `omp.settings.renderDelivery` 中声明 boolean 设置，默认值为 `true`。

- `true` 或未配置时渲染完整的末尾 `# Delivery` 章节。
- `false` 时省略该精确章节，包括 `Task scope`、`Completion`、`Evidence` 和 `Pausing`。
- 每个 `before_agent_start` turn 都通过公开的 `getPluginSettings(PACKAGE_NAME, ctx.cwd)` API 读取有效值。用户级值可用 `omp plugin config set @ruokee/omp-system-prompt renderDelivery false` 设置；项目级 `.omp/plugin-overrides.json` 中 `settings.@ruokee/omp-system-prompt.renderDelivery` 下的值覆盖用户级值。
- 设置读取失败或值不是 boolean 时保持 Delivery 启用，针对该原因每个会话报告一条有界诊断，请求继续执行。
- 设置在 turn 之间变化时，扩展识别有 Delivery 和无 Delivery 两种自有形态，复用已捕获的动态槽位、Skill 回退目录、PROJECT 块和独立块，只切换 Delivery 章节。

## Skill description 单行化

宿主把每个 Skill 渲染为 `- <name>: <description>`，description 文本直接插入，不带字段边界。一个 Skill 的 description 为 `First\n- beta: Second` 时，渲染结果与两个 Skill `alpha: First`、`beta: Second` 完全相同，因此仅凭列表语法无法还原条目边界。

当事件中存在非空 Skill 目录时，扩展读取当前公开 `pi.getCommands()` 中 `source: "skill"` 的条目作为有序候选，只使用名称、顺序和 description。候选可以不出现在事件目录中，包括隐藏 Skill。事件目录仍决定可见集合。扩展不读取命令路径、不重新扫描资源，也不会把候选补入输出。

只有完整可见目录能够对应到一个唯一的有序候选子序列时才建立对应。每个可见名称及其顺序必须匹配，每个宿主渲染的完整 description 区间必须与候选 description 在空白归一化后相等。元数据只用于确定边界，不会覆盖与事件文本不同的内容。对应成功后，仅对可见 description 区间将连续空白归一化为一个 ASCII 空格并去除首尾空白，覆盖 LF、CRLF、制表符、空段落和 Unicode 行分隔符。未使用的隐藏候选不会进入输出。

无法建立唯一对应时，扩展逐字节保留完整且已经分离的 `<skills>` 目录，然后继续其他提示词变换：

- Skill 命令被关闭，没有可用的 Skill 命令元数据。
- 候选缺失、顺序不同，或多余元数据无法与可见目录对应。
- description 与事件文本不符，或前序扩展改写了目录内容。
- 条目区间有歧义、名称格式错误或宿主排版不受支持。

缺失或受支持的空 Skill 目录无需元数据，保持缺失或为空。扩展不会从命令清单补入 Skill。Skill 外层边界无法分离时仍按结构失败处理，完整输入原样保留。局部 Skill 回退报告 `Skill catalog formatting skipped`，不会声称整份系统提示词替换失败。

## 模型提示词规则

同一扩展还会为当前使用的模型追加用户自有的提示词文本。每个受覆盖的 turn 都会读取用户 agent 目录（`getAgentDir()`，即当前 profile 的 agent 目录）下的 `model-prompts`，以及项目 agent 目录（`getProjectAgentDir(cwd)`，即 `<cwd>/.omp`）下的 `model-prompts`。只处理直接子项：目录缺失视为空，子目录被忽略，也不会向上查找祖先目录或资源根目录。规则文件是文件名以小写 `.md` 结尾且不以点开头的直接普通文件，按文件名的 JavaScript 字符串顺序排列，用户目录的规则在前。

规则文档是带 `---` frontmatter 的 Markdown：

```markdown
---
match:
  - exact: pro-20x/gpt-5.6-luna
  - model: gpt-5.6-sol
  - contains: gpt-5.6
  - regex: ^pro-20x/gpt-5\.6
---

追加到系统提示词的文本。
```

`match` 为必需且非空。每个条目只带一个键，条目之间是“或”的关系：

- `exact` 比较完整的 `provider/id` 字符串。
- `model` 比较裸模型 id。
- `contains` 测试 `provider/id` 的子串。
- `regex` 用不带标志的 JavaScript 正则测试完整的 `provider/id`。

匹配区分大小写且为文本匹配。这些键按字面理解模型 id：角色别名、其他或路由后的 id、思考等级后缀只有在 id 本身包含该文本时才匹配；不存在别名、家族、通配符或 `name` 键。frontmatter 中的其他键被忽略，永不注入。追加的内容是闭合分隔行之后的正文，逐字节保留，包括其自身的标题、空行和 CRLF 换行。

每个匹配的文件贡献一个块，追加在本轮已有的提示词之后：替换生效时追加在扩展替换后的提示词之后，未生效时追加在传入的宿主提示词之后。宿主把合并后的数组作为该 turn 的系统提示词，因此规则在轮中重建后依然存在，而下一轮从宿主基础提示词重新开始，不会累积。文件每轮重新读取，因此修改后在下一轮生效。

无效文档会被跳过，不影响其他文件，且以第一个失败点为准。分隔行缺失或格式错误（`frontmatter-missing`）、YAML 无法解析（`frontmatter-invalid`）、`match` 缺失或类型错误（`match-missing`）、数组为空（`match-empty`）、条目不是单键对象（`entry-shape`）、键未知（`entry-key`）、值不是字符串或为空白（`entry-value`）、正则无法编译（`regex-invalid`）、正文为空白（`body-blank`）都只跳过该文件。文件读取失败报告 `file-unreadable`；目录不可读报告 `directory-unreadable` 并只跳过该目录。每次跳过按会话去重报告一条有界诊断，以 `<scope>/<文件名>` 指明来源，不含规则正文和解析后的目录。没有匹配文档的 turn，以及没有当前模型的 turn，不追加任何内容。

### 上游复核

上游 [issue #6739](https://github.com/can1357/oh-my-pi/issues/6739) 提出由宿主提供模型级指令（`modelInstructions`）。当宿主实现该机制或等价的「模型 → 提示词」能力后，先复核本扩展再改动：

- 宿主覆盖的匹配维度：精确 `provider/model`、裸模型 id、子串匹配、正则；
- 宿主文本与替换后或自定义系统提示词的组合方式：替换还是追加，以及文本落在块序列的什么位置；
- 刷新时机：每个 Agent 轮次、每次 Provider 请求、切换模型、临时切换与回退；
- 规则发现约定：目录、用户级与项目级优先级、文件顺序。

随后判断模型级提示词是否仍需要保留在本扩展内、是否只保留宿主未覆盖的部分，或是否直接移除，并按相应的版本变更记录结论。

## 失败回退

处理有两个范围。模板缺失或损坏、默认主块或 PROJECT 页脚缺失或重复、无法证明固定 PROJECT critical 位于外层尾部结构、区段顺序异常、受检查区域出现意外结构或非空内容，或 Skill 外层边界不可靠时，执行结构回退。扩展让整组输入在该 turn 原样通过，并报告不包含提示词正文、Skill 名称或私人路径的有界整体替换失败。外层结构确认有效后，Skill 元数据失败只影响 Skill 目录，静态策略、运行时区段和 PROJECT 修改继续应用，并报告另一条独立去重诊断。

本扩展已经归一化的输出只有在完整结构校验通过后才被视为无变化：主块必须与自有模板的静态片段逐字节一致，每个动态槽位位于其有界位置；片段匹配已经固定了静态骨架，因此槽位值中的模板形似文本作为不透明宿主内容被接受。PROJECT snapshot 必须带有完整的已改写结构，包括自有加载说明以及必需的 workstation 与上下文文件区段。每个容器的闭合标签都在下一个已知外层结构之前确定，因此后续容器正文或追加提示词中的闭合标签形似文本不会提前结束前面的容器。只共享身份行、标题顺序或 `# Project snapshot` 前缀，但属于损坏、被注入或第三方构造的块，会以 `owned-output-invalid` 拒绝，不会被认领为本扩展输出。

正常的逐轮设置读取、命令元数据读取、转换或结果处理路径抛出异常时，执行意外异常回退。扩展不返回替换，让传入数组继续生效，并按会话去重报告 `unexpected-error`，不包含异常消息或 stack。

激活期模板失败遵循同一通道约定。模板缺失或不可读（`template-unavailable`）时，扩展仍注册 turn 处理器，首次 turn 的输入保持不变，并按会话通道报告一次：交互会话使用 `ctx.ui.notify`，其他情况使用 OMP 文件日志。

诊断使用公开的会话 ID 去重，也适用于内存会话。新建和分叉会话各自保存诊断记录；恢复已访问的会话时，保留本次激活期间该会话的去重记录。每个 turn 使用自己的通知或日志通道，即使多个 turn 交叠也不会串用。

扩展不检查 OMP 版本来决定是否激活、转换、告警或回退。保留的运行时内容只来自宿主渲染后的事件块；扩展不会自行加载 Skills、规则、工具或设备。

## 覆盖边界

扩展覆盖普通主会话 turn，以及重新绑定父会话扩展的普通子 Agent turn。各子 Agent 保留其角色、yield 协议和独立块。

受限工具及 plan-mode 子 Agent 不加载扩展，因此该钩子不会运行。公开的 task 参数或 agent 定义字段都不能直接请求工具限制；plan mode 是公开入口，其子 Agent 就是受限子 Agent。

Handoff 生成使用基础提示词，标题生成与难度分类采用独立路径，都不运行本轮钩子。

`/btw` 等临时旁路请求不独立运行该钩子，而是发送当前生效的 Agent 提示词。逐轮 override 会一直生效，直到下一轮替换或清除。

设备通知：会话中途挂载 `xd://` 设备时，OMP 会对已交付基础目录中已有的设备抑制通知。替换后的提示词丢掉了该基础目录，因此同一设备会被再次通告，即使自有 `### Mounted devices` 槽位已经列出它。本扩展不额外维护设备状态，因此接受这条重复通知。

覆盖有效期是一个 Agent turn，不是一次 Provider 请求。宿主在轮中重建时保留 override，因此转换后的目录描述的是轮次开始时的装配结果，直到下一轮才更新。追加的规则块属于同一个逐轮提示词。前序扩展的块保持不变，后序处理器可以覆盖本扩展结果；扩展不调整其他扩展的顺序，也不宣称对最终 Provider 请求拥有优先权。

## 安装

包尚未发布。克隆 GitHub 仓库后，安装锁定依赖并将包安装进 OMP：

```bash
git clone https://github.com/ruokee/ruokee-agent-kit.git
cd ruokee-agent-kit/projects/omp-system-prompt
bun install
omp install "$(pwd)" --scope user
```

`omp install` 是 `omp plugin install` 的别名；`omp plugin link "$(pwd)" --scope user` 效果相同。OMP 从 `package.json` 的 `omp.extensions` 读取扩展声明并加载 `src/extension.ts`。

### 更新

注册指向这个检出目录，安装会一直从该目录读取 Package 及其依赖。请在仓库根目录更新：

```bash
cd /path/to/ruokee-agent-kit
git pull
cd projects/omp-system-prompt
bun install --frozen-lockfile
```

之后重启 OMP：运行中的进程会继续使用启动时加载的扩展代码，在同一进程中新建会话不会重新加载。提示词规则文档每轮都会重新读取，修改这些文件不需要重启。

### 扩展顺序

OMP 按扩展安装顺序运行 `before_agent_start` 处理器，每个处理器拿到的输入都是上一个处理器的输出。本扩展读取它收到的任意数组，因此安装在本扩展之后的扩展看到的是自有主块而非默认主块；期望宿主原始主块的扩展必须安装在本扩展之前。

### 已验证范围

组件检查在组件目录运行 `bun run typecheck` 与 `bun test`（117 项测试、647 个断言）。测试运行时从锁定的 OMP 18.2.3 宿主 fixture 渲染输入，覆盖 `hasSkillUriAccess` 的两个分支、原生工具列表、内联工具目录、Code Mode、固定区段的条件分支、条件行错位拒绝、单次槽位填充、固定区域拒绝、结构边界、编码安装路径、逐字节保留、块顺序、PROJECT 页脚变体、Skill description 归一化、隐藏有序候选、两种 Delivery 形态及切换、两种形态中的子代理结果收集与消息规则、设置失败、意外 turn 处理异常与有界诊断。规则部分补充了全部匹配维度、可接受与不可接受的文档形态、分隔行与逐字节保留规则、发现顺序与过滤、读取失败隔离、替换结果之后的追加步骤、模型回退以及默认规则目录。协调规则断言验证渲染后的指令，不能证明实际的父子调度或消息行为。

`<conventions>` 前缀首次出现在 OMP 18.1.21。独立 fixture 检查渲染了未经修改的 18.1.21 主模板与 PROJECT 模板，并确认两种 Delivery 形态均可完成替换。这些 fixture 版本只是测试证据，不构成支持版本表。peer dependencies 保持不限制版本，运行时不检查宿主版本。

下列真实宿主与容器观察均采集于 OMP 18.1.11，并保留该版本范围；它们不是 OMP 18.2.3 的真实宿主证据。

容器检查使用不挂载宿主目录的一次性 Podman 容器。检查结束后删除容器。

- 受控成功场景：两个 Skill，其中一个 description 含制表符、空行和 Unicode 行分隔符空白。最终 Provider 载荷包含自有静态骨架、单行化后的 description、保留的工具与设备目录、`# Project snapshot` 标题，且不含宿主 Delegation 并发上限和额外 `hub` 提示。
- Skill 局部格式回退逐字节保留完整且已分离的目录，包括有效 `<skills>` 外层中的任意正文，同时继续应用静态策略与 PROJECT 改写；诊断写明 `Skill catalog formatting skipped`，下一次变换仍识别为自有输出并保持幂等。
- 结构回退覆盖不可靠的外层边界以及损坏的主块或 PROJECT 结构；输入块原样保留，并报告有界的整体替换失败通道。
- 真实宿主在 `renderDelivery=false` 下产出了预期的 Provider instructions：以自有身份开头且不含 `# Delivery`；模型返回了请求的精确标记。
- 一次真实宿主运行采用以下配置：可见事件目录省略一个隐藏 Skill，但 `pi.getCommands()` 仍返回该候选。Provider-facing instructions 使用自有身份与 PROJECT snapshot，保留挂载的 `xd://` 设备条目和插件加载的运行时策略，并省略隐藏候选。
- 在一次真实宿主运行中，前序扩展对目录做了有界改写；扩展逐字节保留改写后的 Skill 条目，继续应用自有身份与 PROJECT snapshot，并只发出 `Skill catalog formatting skipped` 局部诊断。
- 手动调用隐藏 Skill 仍能解析其命令。Provider 输入通过 `role` 为 `user` 的自定义消息携带完整 Skill 正文和用户参数，模型返回了请求的精确标记。
- 容器中观察到的会话路径：首次 turn、续接的第二次 turn、工具调用后的轮中重建（自有提示词延续到第二次 Provider 请求）、普通子 Agent turn（子 Agent 自身角色块保持完整），以及后序扩展在 Provider 请求前覆盖本扩展结果。
- 容器中观察到的受限子 Agent：`omp --plan-yolo` 的 plan-mode 父会话 turn 使用自有提示词，派生子 Agent 的请求使用宿主默认提示词，工具集为 `read`/`grep`/`glob`/`yield`，不含自有身份。
- 容器中观察到的 Handoff：`/handoff` 完成会话压缩，其旁路请求使用宿主默认提示词。
- 容器中观察到的 `/btw`：任何 turn 之前使用宿主默认提示词；在发生过替换的 turn 之后使用自有提示词。
- 容器中观察到的设备通知：同一个请求既含自有的挂载设备目录条目，又含针对同一设备的隐藏挂载通知；不加载本扩展的同一场景中，设备出现在宿主目录里且没有通知。两种情况下设备均可用。
- 全新的真实宿主运行覆盖仅分析请求、用户要求的原型、项目兼容性要求、授权边界、合理暂停、诚实验证、引用控制标签、运行时设备通知和工作区上下文变化。模型按预期执行或拒绝了每项请求；每个捕获的 Provider 请求都以自有身份开头。

## 开发

```bash
cd projects/omp-system-prompt
bun install
bun run typecheck
bun test
```

运行时只导入两个不限制版本的 peer dependency：`@oh-my-pi/pi-coding-agent` 提供扩展 API，`@oh-my-pi/pi-utils` 提供感知 profile 的 agent 目录辅助函数。测试将 `@oh-my-pi/pi-coding-agent`、`@oh-my-pi/pi-ai` 与 `@oh-my-pi/pi-utils` 的直接 dev dependency 固定为 18.2.3，以便复现宿主 fixture；dev dependency 版本不限制安装或激活。

## 许可

MIT。
