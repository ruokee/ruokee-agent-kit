# omp-system-prompt

[English](./README.md)

本 OMP 扩展把维护者自有的英文策略应用到 OMP 系统提示词，并为当前使用的模型追加用户自有的规则文档。策略经由宿主自身的模板机制进入提示词：用户选择组件附带的 `host-template.hbs`，宿主用运行时数据渲染它，扩展在每一轮补全该渲染结果。OMP 每一轮都会重新装配系统提示词，并把块数组交给 `before_agent_start` 事件；本扩展变换的是该事件输入，而不是启动时的快照。

## 工作机制

OMP 用多个块装配系统提示词：主块、可选的 Computer Safety 块与 active-repo 块，以及 `<project-context>` 页脚。组件附带的 `host-template.hbs` 由自有来源 `src/prompt-template.md` 通过 `bun run build:template` 生成，其中工具、设备、`xd://` URI、Skill、规则与运行时模式槽位都绑定到宿主数据，因此宿主会在本扩展看到该 turn 之前渲染出自有结构。该产物不是运行时输入：扩展仍然读取 `src/prompt-template.md`，并在激活时从该来源推导识别锚点。

恰好有一个块是附带模板的渲染结果时，扩展逐步处理该 turn：

- 模板块在其位置逐字节保留。它的工具、设备、`xd://` URI、Skill、规则和运行时模式槽位已经带有宿主注入的动态数据，包括已挂载设备文档。扩展不会在其内部归一化空白，槽位绑定本身已经维持区段边界。
- 自有 `# Delivery` 章节作为独立块紧跟模板块；`renderDelivery` 为 false 时不插入。该位置若已存在以 `# Delivery` 开头的他人块，扩展保留该块并报告 `delivery-block-conflict`，不写入自己的章节。
- 页脚原地修正：宿主的加载说明与自动加载提示行替换为自有文本。在已校验的外层 `<project-context>` 边界之后，精确识别主代理固定尾部或 OMP 18.5.0 子代理尾部，按命中文本的长度连同前面的空行删除。未知尾部保持原样。上下文文件正文、路径列表、工作区内容、附加根目录、`<active-repo-context>` 块和追加的提示词字节逐字节保留，包括正文和 append 中完整的已知 `<critical>` 尾部副本。
- 重复转换通过自有加载说明或位于已校验外层位置的中性 `<!-- omp-system-prompt:project-context -->` 注释识别已处理页脚，不触碰 append，即使 append 以完整的已知 critical 尾部开头。仅在三个条件同时成立时新增注释：页脚没有加载说明、本次转换移除了精确识别的原生尾部、append 开头为完整已知 critical 块。注释放在 `</workstation>` 后，位于所有不透明字段及 append 之外。相对于原完整输出，仅注释及其分隔符允许改变；普通 append 和有加载说明的页脚保留原输出。识别适用于 Delivery 的两种取值及切换，不使用进程内缓存或新增设置，也不是作者身份的证明或安全边界。
- 页脚不存在时无需处理也不报告。边界不唯一时报告 `project-footer-ambiguous`，加载说明无法识别时报告 `project-footer-not-recognized`；两种情况下页脚保持输入原样，其余步骤继续应用。

识别以自有来源中的静态文本为锚点：每个锚点去除首尾空白后按原顺序匹配，第一个锚点位于块首，最后一个位于块尾。动态槽位正文不参与识别，因此完整复刻静态骨架、只修改槽位正文的第三方模板同样会被识别。其他模板的渲染结果、被截断或损坏的渲染结果，以及只以自有身份行开头的第三方块都不会被识别。

其他主块不属于本组件修改的范围。未选择模板、使用 `SYSTEM.md`、使用 `--system-prompt` 或使用其他模板时，扩展保持宿主构建的系统提示词不变，也不报告诊断；模型规则文档仍会追加。

## Agent 协调

自有协调规则在 `renderDelivery` 的两种取值下都生效。父会话派发子代理后继续推进独立且已授权的工作；无此类工作可推进且仍有子任务未完成时等待；正常交付前收齐并核验每个子代理的结果。等待可能因单个结果、消息、超时或中断返回，因此父会话必须重新核对剩余任务。已经取得的结果无需额外等待；失败、取消和阻塞应当如实说明，不得仅为提早结束而取消正常执行的工作。

任务完成无需等待 idle 或 parked 代理退出。仅用于确认完成、空闲或结束的消息无需回复；实质问题、纠正和新工作仍需处理。这些是模型指令，扩展不增加运行时等待屏障，也不改变宿主任务和消息机制。

## Delivery 配置

包在 `omp.settings.renderDelivery` 中声明 boolean 设置，默认值为 `true`。

- `true` 或未配置时渲染完整的末尾 `# Delivery` 章节。
- `false` 时省略该精确章节，包括 `Task scope`、`Completion`、`Evidence` 和 `Pausing`。
- 每个携带自有模板渲染结果的 turn 都通过公开的 `getPluginSettings(PACKAGE_NAME, ctx.cwd)` API 读取有效值。用户级值可用 `omp plugin config set @ruokee/omp-system-prompt renderDelivery false` 设置；项目级 `.omp/plugin-overrides.json` 中 `settings.@ruokee/omp-system-prompt.renderDelivery` 下的值覆盖用户级值。
- 设置读取失败或值不是 boolean 时保持 Delivery 启用，针对该原因每个会话报告一条有界诊断，请求继续执行。
- 设置在两轮之间变化时，扩展识别自己先前的输出，只增加或移除 Delivery 章节块。
- 模板渲染结果之后紧邻的他人 `# Delivery` 块保持不变，并报告 `delivery-block-conflict`。

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

只有恰好一个块是宿主对自有模板的渲染结果时，扩展才修改该 turn；如上所述，其他输入不加改动地通过，也不报告诊断。同一 turn 中出现两个模板渲染结果时报告 `ambiguous-boundary`，输入保持不变。确认唯一的渲染结果之后，Delivery 步骤与页脚步骤各自独立判定，一个步骤保持其输入不变时，另一个步骤仍然应用。所有步骤都保持输入不变的 turn 不返回替换结果，宿主提示词继续生效。诊断只携带有界原因，不包含提示词正文或私有路径。

意外异常回退覆盖常规逐轮转换和结果处理路径中抛出的错误；设置读取失败使用上文的设置回退。扩展不返回替换结果，保持传入数组生效，并且每个会话只报告一次 `unexpected-error`，不包含异常消息或调用栈。

激活期模板失败遵循同一通道约定。模板缺失或不可读（`template-unavailable`）时，扩展仍注册 turn 处理器，首次 turn 的输入保持不变，并按会话通道报告一次：交互会话使用 `ctx.ui.notify`，其他情况使用 OMP 文件日志。

诊断使用公开的会话 ID 去重，也适用于内存会话。新建和分叉会话各自保存诊断记录；恢复已访问的会话时，保留本次激活期间该会话的去重记录。每个 turn 使用自己的通知或日志通道，即使多个 turn 交叠也不会串用。

扩展不检查 OMP 版本来决定是否激活、转换、告警或回退。保留的运行时内容只来自宿主渲染后的事件块；扩展不会自行加载 Skills、规则、工具或设备。

## 覆盖边界

扩展覆盖普通主会话 turn，以及重新绑定父会话扩展的普通子 Agent turn。各子 Agent 保留其角色、yield 协议和独立块。

plan-mode 子 Agent 不加载扩展，因此该钩子不会运行。公开的 task 参数或 agent 定义字段都不能直接请求工具限制；plan mode 是公开入口，其子 Agent 就是受限子 Agent。

Handoff 生成使用基础提示词，标题生成与难度分类采用独立路径，都不运行本轮钩子。

`/btw` 等临时旁路请求不独立运行该钩子，而是发送当前生效的 Agent 提示词。逐轮 override 会一直生效，直到下一轮替换或清除。

override 的作用范围是一个 Agent turn，而不是一次 Provider 请求。turn 中途的宿主重建会保留它，因此补全后的提示词描述的是 turn 开始时的装配结果，直到下一轮。追加的规则块属于同一个 turn 级提示词。之前扩展产生的块保持原样，之后的处理器仍可覆盖本结果；扩展不调整其他扩展的顺序，也不声称对最终 Provider 请求拥有优先权。

## 兼容性

最低维护宿主为 OMP `18.5.0`，没有维护上限。本节说明维护承诺，而不是安装、激活、转换或回退条件：低于下限的宿主不会被阻止，仍可能运行本包，但不会因此获得下限以下的维护承诺；没有上限也不表示之后的每个版本都可用或已验证。

包的 peer 以无限制的范围 `*` 声明 `@oh-my-pi/pi-coding-agent` 与 `@oh-my-pi/pi-utils`。该声明只列出组件导入的宿主包，不构成维护范围，不带运行时检查，也不表示任何宿主版本可用。

三个直接 OMP 开发依赖固定为 `18.5.0`，测试套件渲染该已安装包中的宿主模板。开发依赖版本既不是维护下限，也不是支持版本范围。附带模板绑定的是 OMP 18.5.0 的运行时区段字段，并且有测试从自有来源重新生成已提交的产物，两者不会脱节。

扩展不读取宿主版本。它依据事件文本识别模板渲染结果与 `<project-context>` 页脚，无法识别的内容保持宿主构建的原样，因此维护下限不会变成运行门槛。

## 安装

包尚未发布。克隆 GitHub 仓库后，安装锁定依赖并将包安装进 OMP：

```bash
git clone https://github.com/ruokee/ruokee-agent-kit.git
cd ruokee-agent-kit/projects/omp-system-prompt
bun install
omp install "$(pwd)" --scope user
```

`omp install` 是 `omp plugin install` 的别名；`omp plugin link "$(pwd)" --scope user` 效果相同。OMP 从 `package.json` 的 `omp.extensions` 读取扩展声明并加载 `src/extension.ts`。

### 选择模板

这一步是可选的。不选择模板时，扩展只追加模型规则文档。模板由用户选择：组件从不写入模板文件、不修改已安装的宿主，也不会自行选择模板。使用宿主自身的输入之一：

- 单次运行时在命令行传入附带文件：

    ```bash
    omp --system-prompt-template /path/to/ruokee-agent-kit/projects/omp-system-prompt/host-template.hbs
    ```

- 长期使用时，把它复制为宿主会发现的 `SYSTEM_TEMPLATE.md`：单个项目使用 `<project>/.omp/SYSTEM_TEMPLATE.md`，所有项目使用用户 agent 目录（默认 `~/.omp/agent/`）中的 `SYSTEM_TEMPLATE.md`。更新改变 `host-template.hbs` 后需要重新复制。

宿主每个会话只选择一个主提示词来源（[`main.ts`](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/main.ts)、[`system-prompt.ts`](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/system-prompt.ts)、[`discovery/builtin.ts`](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/discovery/builtin.ts)）：

- 命令行的 `--system-prompt` 或 `--system-prompt-template` 优先于发现的文件，两个参数不能同时使用。
- 发现的文件中，项目级优先于用户级。
- 同一级别中，`SYSTEM.md` 优先于 `SYSTEM_TEMPLATE.md`。

因此同级或更高优先级的 `SYSTEM.md`，或者 `--system-prompt` 参数，会使模板不生效，扩展也不会修改那份提示词。

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

OMP 按扩展安装顺序运行 `before_agent_start` 处理器，每个处理器把上一个处理器的输出作为输入。本扩展读取它收到的数组，因此在它之后安装的扩展会看到插入的 Delivery 块与修正后的页脚；依赖宿主未修正页脚的扩展必须在它之前运行。

### 已验证范围

组件检查在组件目录运行 `bun run typecheck` 与 `bun test`。测试运行时从已安装的 OMP 18.5.0 宿主模板与组件生成的模板渲染输入，其中一个测试会从自有来源重新生成该产物。测试覆盖模板渲染结果的识别、被修改骨架与仿冒块的拒绝、宿主内置主块与自定义提示词保持不变且无诊断、两种 Delivery 形态及其切换、Delivery 冲突、主代理尾部与子代理尾部的页脚修正、有歧义与无法识别的页脚、重复转换、模型规则文档、设置回退、诊断去重，以及编码安装路径。

OMP 18.5.0 上的宿主检查使用官方 CLI，在不挂载宿主目录的一次性 Podman 容器中运行，使用隔离 `HOME` 并在其中链接组件。主代理和一个普通 `task` 子代理都使用合成项目中被发现的 `.omp/SYSTEM_TEMPLATE.md`。回环转发器记录请求正文，并将请求发送至真实 Provider；抓取的主代理及子代理 instructions 都与同次处理器输出的块以两个 LF 拼接后的文本逐字一致。主代理请求带有自有加载说明，保留合成项目正文与 append 字节，包括完整 critical 尾部的引用副本。子代理请求保留独立角色块，外层 `<project-context>` 结束后没有固定尾部。子代理 footer 没有自动继承主 turn 的项目正文和 CLI append；显式 task context 中的正文引用不等于 footer 继承。这些子代理 footer 输入的逐字节保留由回归测试证明，不是真实子代理观察。两个代理都返回了要求的标记，同次日志没有 `omp-system-prompt` 诊断。这些检查只覆盖 footer 修复，不是 OMP 18.5.0 全面认证，也不验证未变化功能。

页脚回归覆盖两种精确原生尾部、append 起点的完整 critical 块、不透明副本的逐字节保留，以及普通 append 的旧完整输出保持。有歧义的无加载说明页脚仅增加有条件归属注释；检查同时覆盖重复转换的完整数组和 Delivery 往返切换。

后续 OMP 18.5.0 运行使用仅有 workstation 的主代理页脚和 critical 起始 append，覆盖有条件注释。Provider 收到必要注释及完整 append；普通子代理收到不含注释或原生尾部的仅 workstation 页脚，独立角色保持。处理器后的观察器再次转换双方输出，得到相同完整数组和 `changed=false`，并将该数组交给宿主。两个代理都返回了要求标记。另一个带普通 append 的主代理运行将精确的无注释输出发送到真实 Provider，append 保留且重复转换不变；Provider 持续返回 429，耗尽宿主两次重试，因此该运行只证明 Provider 可见输出，没有证明模型完成。

## 开发

```bash
cd projects/omp-system-prompt
bun install
bun run typecheck
bun test
bun run build:template
```

`bun run build:template` 从 `src/prompt-template.md` 重新生成 `host-template.hbs`，并输出字节数与锚点数量；修改自有来源后执行该命令，再执行会因产物与来源不一致而失败的 `bun test`。

运行时导入只限两个不限版本的 peer 依赖：`@oh-my-pi/pi-coding-agent` 提供扩展 API，`@oh-my-pi/pi-utils` 提供感知 profile 的 agent 目录辅助函数。测试把 `@oh-my-pi/pi-coding-agent`、`@oh-my-pi/pi-ai` 与 `@oh-my-pi/pi-utils` 三个直接开发依赖固定为 18.5.0，以便复现宿主模板；开发依赖版本不限制安装或激活。

## 许可

MIT。
