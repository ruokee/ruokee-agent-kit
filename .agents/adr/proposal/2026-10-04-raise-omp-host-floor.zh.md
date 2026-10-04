# ADR 提案：将 OMP 宿主下限提高到 18.5.0

Draft owner: Ruokee
Draft writer: OMP Claude Opus 5.5

[English](./2026-10-04-raise-omp-host-floor.md) | 中文

## 动机

把所有面向 OMP 的组件的维护下限提高到 OMP 18.5.0，删除只服务更早宿主的代码，并替换两项在当前宿主上已不工作的功能。

面向 OMP 的组件是 `omp-context-pin`、`omp-system-prompt`、`omp-qol`、`omp-status-bar`、`omp-codex-web-access`，以及 `tk` 的 OMP 适配器。它们的 README 声明的下限在 18.1.8 到 18.2.8 之间，而开发和真实宿主检查已经转到 18.4.x 和 18.5.x。每个组件都还保留着服务这一范围底部宿主的代码。其中两项功能在当前宿主上已经不工作，现有的系统提示词决定和状态栏使用文档都记录了这两项限制：

- `omp-system-prompt` 的默认块路线只识别 OMP 18.3.0 以前使用的身份行。在 18.3.0 及以后的宿主上，它找不到主块，每轮报告一次失败，宿主提示词保持原样。没有选择模板的用户既得不到策略文本，每个会话还会收到一条诊断。
- `omp-status-bar` 的投机压缩带指示器通过 `Settings.getGroup` 读取 compaction 设置，当前宿主已不再提供这个方法，指示器在这些宿主上始终隐藏。

[宿主内组件随宿主升级保持适配](../decision/2026-09-28-adapt-components-to-host-upgrades.zh.md)只允许逐个组件提高下限，而且只在该组件无法同时服务两个宿主、或同时服务需要大规模重写时才允许。它要求每次升级时重新阅读宿主源码并按影响验证，上述限制正是这样记录下来的。按同一规则，各组件的下限彼此分散，并长期远低于组件实际开发所用的宿主；每个组件也一直保留只有旧宿主才用到的路径，例如默认块路线和投机压缩带估算。本提案用对这些旧宿主的支持换取更小的维护面：删除只服务 18.5.0 以前宿主的路径，所有组件按一个选定的共同基线维护。

## 分析

以下证据来自下文所列发布标签上的 OMP 公开源码。

- **系统提示词身份行。** [18.5.0 的系统提示词](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/prompts/system/system-prompt.md)以 `RFC 2119 keywords:` 开头，身份行是 `You are omp's trusted coding assistant.`。这条身份行从 18.3.0 开始出现；默认块路线识别的两条身份行都来自更早的版本。
- **项目 footer。** 从 18.4.1 起，宿主把项目 footer 渲染为 `<project-context>` 块；18.4.0 仍渲染旧的 `PROJECT` footer。18.5.0 在 footer 块中紧随 `<project-context>` 的 critical tail 里新增了 subagent 分支，模板路线已经能识别它。
- **宿主选择系统提示词的顺序。** 在 18.5.0 中，[`discoverSystemPromptOverride`](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/system-prompt.ts) 先查项目级，再查用户级；同一级别内，字面 `SYSTEM.md` 优先于 `SYSTEM_TEMPLATE.md`。命令行显式指定的模板或提示词优先于发现的文件。选中 `SYSTEM.md` 时，宿主用自己的自定义提示词模板包装其内容，`<project-context>` 块照常追加。
- **compaction 设置。** 18.5.0 的 [`Settings`](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/config/settings.ts) 类没有 `getGroup` 方法；该方法存在到 18.3.x，从 18.4.0 起删除。其余读取方法都接受 setting handle，而扩展创建的 handle 来自扩展自己的模块副本，所以状态栏没有公开途径读取宿主的 compaction 设置。
- **等待入口。** 内置 [`hub` 工具](https://github.com/can1357/oh-my-pi/tree/v18.2.11/packages/coding-agent/src/tools/hub)在 18.1.20 和 18.2.11 标签中存在，在 18.3.0 中不存在；独立的 [`wait` 工具](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/tools/wait.ts)从 18.3.0 开始存在。`omp-qol` 只在 `hub` 路径上使用 `waitMessagesSeconds` 和 `waitProcessSeconds`；在独立 `wait` 上，这两项已经报告为不适用。
- **Pin 的探测。** `omp-context-pin` 激活前检查的宿主成员、`getEntries` 能力探测所依赖的成员，以及用户消息必填的 `timestamp` 字段，在该组件当前的下限 18.1.8 上都已存在。这些检查以及缺少时间戳时的计数回退，只防护低于当前下限的宿主。

以上证据都不依赖晚于 18.5.0 的宿主。

## 提议

### 面向 OMP 的组件共用一个维护下限

每个面向 OMP 的组件都在 `README.md` 和 `README.zh.md` 的兼容性小节中把 OMP 18.5.0 声明为维护下限。对 `tk` 而言，该下限覆盖 OMP 适配器在 `tools` 模式下的宿主侧代码；`cli` 模式组件和 Pi 适配器保持各自的声明。

这个下限是共同的维护基线，即组件开发和验证所针对的 OMP 版本。它为所有面向 OMP 的组件统一选定，而不是按每个组件仍能服务的最旧宿主分别推导。以后提高下限时，通过一份决定同时移动所有面向 OMP 的组件的下限。

组件对 `@oh-my-pi/*` 有开发依赖的，改为 18.5.0，测试 fixture 和真实宿主检查以 18.5.0 的宿主行为为基线。

以下规则保持不变：README 小节是下限的权威声明；没有维护上限；宿主 peer 声明保持不受限制；安装条件、激活检查和运行时版本比较都不承载下限。低于下限的宿主不会被阻止，但不获得维护承诺，并可能失去被删除代码原先提供的行为。

只为 18.5.0 以前的宿主存在的代码路径、探测、fixture、测试和文档段落全部删除。18.5.0 引入的宿主行为继续支持，例如 subagent footer tail。

| 组件 | 当前下限 | 提议下限 |
| --- | --- | --- |
| `omp-context-pin` | 18.1.8 | 18.5.0 |
| `omp-system-prompt` | 18.1.21 | 18.5.0 |
| `omp-qol` | 18.2.8 | 18.5.0 |
| `omp-status-bar` | 18.2.8 | 18.5.0 |
| `omp-codex-web-access` | 18.2.8 | 18.5.0 |
| `tk` OMP 适配器 | 18.2.8 | 18.5.0 |

### 用户失去的宿主支持

18.5.0 以前的宿主不再从任何面向 OMP 的组件获得维护承诺。以下三项在其中部分宿主上仍能工作的行为会被删除：

- 在 18.3.0 以前的宿主上，`omp-system-prompt` 的默认块路线仍会把宿主默认块替换为组件的策略文本。改动后，这些宿主保留宿主提示词，除非用户选择模板，组件也不报告任何内容。
- 在带有内置 `hub` 工具的宿主上，包括 `omp-qol` 当前维护范围内的 18.2.8 到 18.2.11，`omp-qol` 的总期限等待作用于 `hub`。改动后，等待调整在这些宿主上找不到独立的 `wait` 入口，按现有规则保留原生行为并给出有界原因。
- 在 18.4.0 以前、仍有 `Settings.getGroup` 的宿主上，`omp-status-bar` 的投机压缩带指示器仍会估算区间并闪烁。改动后，这些宿主只显示静态字形。

`omp-context-pin`、`omp-codex-web-access` 和 `tk` OMP 适配器没有删除从各自当前下限到 18.5.0 之间的宿主所用的行为。这些宿主上的用户只失去维护承诺。

### omp-system-prompt：模板作为可选示例

组件只保留一条路线：由宿主渲染组件自己的模板。

- 组件随包提供由自身模板源生成的 `host-template.hbs`。中英文 README 的安装指引把它列为可选步骤，并说明两种启用方式：单次运行时传入 `--system-prompt-template <host-template.hbs 的路径>`，或者把文件放为项目级或用户级的 `SYSTEM_TEMPLATE.md`。
- 指引写明宿主的选择顺序：命令行参数优先于发现的文件，项目级优先于用户级，同一级别内 `SYSTEM.md` 优先于 `SYSTEM_TEMPLATE.md`。因此，存在更优先的 `SYSTEM.md` 时，安装的模板不会生效。
- 组件不写入、不复制、不选择模板文件，也不修改、删除用户的任何系统提示词输入。
- 当前轮的主块是组件模板的渲染结果时，现有模板路线照常工作，包括 Delivery 章节、`<project-context>` footer 校正及其分步诊断。
- 主块不能被识别为组件模板的渲染结果时，组件不修改任何块，包括 `<project-context>` footer，也不报告诊断。这包括没有模板、使用 `SYSTEM.md`、使用 `--system-prompt` 以及使用其他模板的会话。宿主按 OMP 的默认逻辑工作。
- 组件不再识别或改写宿主默认系统提示词的文本结构。默认块路线、两条路线之间的优先顺序、旧 `PROJECT` footer 的处理，以及只由默认块路线执行的技能描述单行化，全部删除。
- 按模型追加规则文档的功能与是否使用模板无关，行为不变。

### omp-status-bar：静态的上下文窗口字形

`context` 状态的文本左侧固定显示 Nerd Font 字形 `U+F0068`，作为上下文窗口的标识。字形与文本属于同一个状态片段，以一个普通空格连接。字形不闪烁，不随上下文用量变化，也不显示窗口大小。

组件不读取任何 compaction 设置，也不再估算投机压缩区间。投机压缩带的状态机、采样、诊断、文档和测试全部删除。没有用量数据或 `contextWindow <= 0` 时，`context` 状态仍然不发布任何内容。

### omp-qol：只保留独立 `wait`

等待模块只服务独立的 `wait` 入口，`hub` 等待路径删除。`omp-qol` 0.5.0 的 manifest 声明的设置项逐项保留：全部 20 项的键名、默认值和取值范围不变，不增加也不删除设置项。这 20 项包括 `compactionCacheEnabled` 和 `compactionCacheProvider`，它们由[缓存对齐决定](../archived/2026-10-04-align-remote-compaction-cache.zh.md)随远端压缩缓存对齐加入，此前 manifest 声明 18 项。`waitMessagesSeconds` 和 `waitProcessSeconds` 在受支持的宿主上不起作用，中英文文档和 manifest 中的设置说明写明这一点。

compaction 期限补丁的所有权检查保持不变，包括拒绝与 `Symbol.for("ruokee.omp.compaction-timeout.patched")` 标记的补丁共存。

### 其他面向 OMP 的组件

`omp-context-pin` 删除激活前的成员检查、`getEntries` 能力探测，以及消息缺少时间戳时的计数回退。记录完整性、条目身份、分支范围、交付和持久化归属的规则不变。

`omp-codex-web-access` 只修改下限声明、开发依赖和测试基线。`tk` OMP 适配器只声明了不受限制的宿主 peer，只修改下限声明和验证基线。`tk` 的 runtime 协议、`runtime_compat` 检查、预检校验以及预检失败时注册数为零的结果不属于宿主维护规则，保持不变。

### 需要反转的决定

**[宿主内组件随宿主升级保持适配](../decision/2026-09-28-adapt-components-to-host-upgrades.zh.md)。** 有效条款："下限依据交付组件的加载条件、必要能力和行为确定"，以及"开发依赖版本与最近实测版本不能直接充当维护下限"；提高下限只在"组件确实无法同时服务两个宿主版本，或者同时兼容需要大幅改造而提高下限所需改动明显更小时"才可以提出；以及"一个组件提高下限不移动其他组件的下限"。提议的选择：所有面向 OMP 的组件共用一个下限，定在开发目标版本上，并一起提高。两者不能同时成立：`omp-context-pin`、`omp-codex-web-access` 和 `tk` OMP 适配器可以在没有冲突、无需重写的情况下继续服务各自当前的下限，而本提案让它们的下限与其他组件一起移动。后继决定保留该决定的其余规则：README 作为权威声明、没有上限、peer 不受限制且没有版本门禁、保留受维护宿主所需的行为、适配实现隔离、按能力选择实现、加载与失败边界局部化、验证强度随改动确定，以及只通过决定提高下限。

**[由宿主模板渲染系统提示词策略](../decision/2026-09-30-render-system-prompt-from-host-template.zh.md)。** 有效条款：识别两种指令块，即默认块路线和模板路线；两条路线之间的优先顺序；"其他形态一律保持输入不变并给出一个有界原因"；"description 单行化只保留在旧路径"；以及 2026-10-03 变更中的"旧 `PROJECT` 路径的严格合同不变"。其兼容性边界还写明组件不提高维护下限，维护声明按宿主升级决定的记录保持不变。提议的选择：只保留模板路线，主块不是组件模板的已识别渲染结果时，不做任何修改，也不报告诊断。两者不能同时成立：该决定要求默认块路线，并要求每个未匹配的轮次给出有界诊断，而本提案删除这条路线和这条诊断。后继决定写明共同的 18.5.0 下限，并保留模板路线的合同、由用户自行选择模板、组件不写入提示词文件、peer 不受限制以及不读取宿主版本。

**[随 OMP 宿主升级维护状态栏](../decision/2026-10-02-scope-token-metrics-to-conversation.zh.md)。** 有效条款："从公开数据估计投机区间"一节，包括指示器的三种状态以及把 compaction 设置组作为输入；`context` provider 把文本与投机字形连接；与 compaction-resolution API 的耦合；以及投机估算的文档和测试。提议的选择：静态的 `U+F0068` 字形，不读取 compaction 设置。两者不能同时成立：该决定要求根据 compaction 设置计算估算值，而本提案禁止读取这些设置。后继决定保留 Widget、Provider 契约、内置指标清单、已应答请求计数，以及每个发布标签前的真实 TUI 检查。

**[维护 OMP 体验调整并保留投机压缩](../decision/2026-10-04-preserve-speculative-cache.zh.md)。** 有效条款：2026-09-29 的变更"按能力选择等待入口"，其中写明"内建 `hub` 完整保留既有行为"，并让两个入口共用一套期限机制。提议的选择：只保留独立 `wait`。两者不能同时成立：该决定保留 `hub` 行为，而本提案删除它。后继决定保留独立 `wait` 的合同、设置键、错误恢复、compaction 期限实验及其所有权规则、原生重放和缓存对齐。

### 只需更新、不需反转的决定

- [添加 omp-context-pin 扩展](../decision/2026-09-15-add-omp-context-pin.zh.md)没有记录版本门禁或探测。在 `变更` 中记录新的下限和删除的检查；激活仍使用宿主的公开 API，各项安全边界的规则不变。
- [为系统提示词扩展增加模型级规则](../decision/2026-09-14-add-model-prompt-rules.zh.md)在替换步骤之后执行追加步骤。在 `变更` 中记录：没有模板的轮次对替换步骤而言是无操作而非失败，追加步骤仍然扩展宿主数组，继承的宿主合同改由系统提示词的后继决定提供。
- [集成 tk 工具与 Harness](../decision/2026-09-02-integrate-tk-tools-with-harnesses.zh.md) 保留其 runtime 协议。在 `变更` 中记录 OMP 适配器的新下限。
- [保持可分发组件自包含](../decision/2026-08-24-keep-components-self-contained.zh.md)要求维护声明随组件保存。在 `变更` 中把这条规则指向宿主升级决定的后继决定。

凡是把被反转决定当作现行依据引用的现行决定，包括上面被更新的决定，都改为链接到对应的后继决定。[Codex 网页访问使用原生插件设置](../decision/2026-09-10-use-codex-web-plugin-settings.zh.md)没有记录下限，也没有引用被反转的决定，不需要修改。

## 考虑过的替代方案

**只在组件无法同时服务两个宿主时提高该组件的下限。** 这是现行规则。凡是代码仍能服务的宿主，它都保留到各组件当前的下限，但六个组件会停在彼此不同、且低于开发宿主的下限上，组件也要继续维护只在旧宿主上工作的默认块路线和投机压缩带估算。

**让 `omp-system-prompt` 随包提供一个无需用户操作即生效的默认模板。** 这是替换默认块路线时最初的方向。它能为什么都不选的用户恢复策略文本，但组件必须写入或选择宿主提示词文件，这是系统提示词决定排除的做法，也会覆盖宿主留给用户的选择。

**未识别到模板渲染结果时继续报告诊断。** 这是现行行为。它能提示模板未能匹配的用户，但使用 `SYSTEM.md`、`--system-prompt` 或没有模板的用户，会因为组件本不服务的路径收到失败报告。

**把下限数值写在组件规格中，按普通规格修改来提高。** 分析下限为何分散时提出过这个做法。它让每次提高下限不再需要决定，但依赖仓库目前没有的规格层。本提案仍通过决定提高下限。

## 验收标准

1. 每个面向 OMP 的组件的 `README.md` 和 `README.zh.md` 都把 18.5.0 声明为维护下限，这些组件中所有 `@oh-my-pi/*` 开发依赖都是 18.5.0。宿主 peer 保持不受限制，没有组件在运行时比较宿主版本。
2. 只为 18.5.0 以前的宿主存在的代码路径、探测、fixture、测试和文档段落都不存在，包括 `omp-system-prompt` 的默认块路线、旧 `PROJECT` footer 处理和 18.1.21 fixture，`omp-qol` 的 `hub` 等待路径，`omp-status-bar` 对 compaction 设置的读取，以及上文列出的 `omp-context-pin` 检查。18.5.0 的 subagent footer tail 仍被识别。
3. 在 OMP 18.5.0 或更新的宿主上，用户按 README 选择 `host-template.hbs` 后，主代理的系统提示词由该模板渲染，并经模板路线处理。没有模板，或者使用 `SYSTEM.md`、`--system-prompt` 时，除追加的模型规则文档外，系统提示词与宿主输入逐字节相同，会话中也没有该组件的诊断。组件运行前后，用户的系统提示词文件内容不变。
4. `omp-system-prompt` 的 README 中英文版本把模板列为可选，说明两种启用方式，并写明宿主的选择顺序。
5. 在 OMP 18.5.0 或更新的宿主上，有上下文用量数据时，`context` 状态在文本左侧显示静态的 `U+F0068`。`omp-status-bar` 源码不读取任何 compaction 设置，也不存在投机估算的代码、文档或测试。
6. `omp-qol` 的 manifest 与 `omp-qol` 0.5.0 的 manifest 逐项一致：全部 20 个设置项，包括 `compactionCacheEnabled` 和 `compactionCacheProvider`，键名、默认值和取值范围不变，没有增加或删除设置项。`waitMessagesSeconds` 和 `waitProcessSeconds` 的说明写明它们不起作用；compaction 补丁的所有权，包括拒绝与带标记的外部补丁共存，行为与之前一致。
7. 四项被反转的决定已归档，并有通过 `Reverses` 和 `Reversed by` 互相链接的完整后继决定；四项被更新的决定带有 `变更` 条目；本提案已移除。

## 风险

继续使用 18.5.0 以前 OMP 版本的用户更新组件后，会在没有任何提示的情况下失去被删除的行为。在 18.3.0 以前的宿主上，除非用户选择模板，系统提示词策略不再生效，而且由于未识别的提示词不再产生诊断，组件不会报告任何内容。在带 `hub` 的宿主上，总期限等待不再生效；在 18.4.0 以前的宿主上，投机压缩带指示器被静态字形取代。

模板未生效时不会有提示。模板被更优先的 `SYSTEM.md` 覆盖，或者使用的 `host-template.hbs` 副本已过期、在动态槽位之外被修改，用户都会得到宿主提示词，没有诊断，并可能以为策略已经生效。
