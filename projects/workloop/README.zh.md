# workloop

[English](./README.md) | 中文

workloop 用 Markdown 指引 Agent 的任务工作流：澄清目标、按 Plan 实现、独立核验结果，并完成项目定义的交付。它使用 tk 管理持久 Task，通过目标 Harness 现有机制加载 Skill，不包含工作流运行时或程序化动作拦截。

## 使用 Skill

选择一套完整语言目录：

| 语言 | Skill 源 | OMP Prompt 源 | 安装名 |
| --- | --- | --- | --- |
| 英文 | `skills/workloop/` | `prompts/` | `workloop` |
| 中文 | `variants-zh/skills/workloop-zh/` | `variants-zh/prompts/` | `workloop-zh` |

每套 Skill 包含入口、全部操作正文、条件 Reference 和初始化说明。通过 Harness 加载所选 Skill，以自然语言请求操作。保留完整目录，不只保留 `SKILL.md`。入口路由到活动，正文仅在需要时加载共享规则。

单独安装 tk，按项目 Task 规则使用其公开接口。协作采用用户或项目选定的终端复用器，例如 Tern、Herdr、tmux；所列工具仅为示例，本组件不内置工具偏好。其他 Skill 按各自启用规则用于相关活动，本组件不会安装它们或将其统一设为必需。

workloop 面向新任务，支持自身 Task 的跨会话继续和返工，不迁移旧流程入口或材料名称。

## 安装

默认安装完整 Skill。OMP 用户可额外安装五个对应 Prompt 模板。一次只安装一种语言。命令块使用“定位 OMP 目录”中设置的变量。组件没有 OMP 包清单、Extension、构建步骤、运行时依赖或专用安装器，仓库普通 Skill 安装器不管理它。单独安装 tk 及所需协作工具。Setup 配置可选工作流默认值，不是安装或普通使用的前置条件。

### 解除既有包

直装前，按原管理方式移除已有的 `@ruokee/workloop` 安装。OMP 原生包管理命令如下：

```sh
omp plugin list
omp plugin uninstall @ruokee/workloop
```

只对列表中准备替换的安装运行 uninstall。OMP 18.12.3 会移除注册包和插件状态，不删除链接的来源检出目录，也不移除独立副本或手动安装的命令。直装组件没有包清单，不对它运行 `plugin link`。

定位自己安装在实际用户级或项目级 `commands/` 目录中的 workloop 文件命令。安装模板前，将五个自有文件 `wl-clarify.md`、`wl-exec.md`、`wl-verify.md`、`wl-ship.md`、`wl-supervise.md` 移到发现根之外。同名文件命令先于 Prompt 模板运行，会让旧入口继续生效。不移除无关命令或其他所有者的文件。其他同名处理器冲突应与其所有者解决，不依赖发现顺序。

### 定位 OMP 目录

从包含 `skills/`、`prompts/` 和 `variants-zh/` 的组件根目录运行示例。默认配置下，OMP 使用 `~/.omp/agent/skills/` 和 `~/.omp/agent/prompts/`。环境设置或 profile 改变位置时，通过实际 CLI 解析有效 agent 目录：

```sh
component_root="$PWD"
agent_root="${agent_root:-$(omp config path)}"
skill_root="$agent_root/skills"
prompt_root="$agent_root/prompts"
```

检查时可以显式设置 `agent_root` 指向临时根目录。使用与目标 OMP 会话相同的环境和 profile 运行 `config path`。例如命名 profile 使用 `omp --profile work config path`，不要用默认路径替代输出。自定义 Skill 来源和项目资源也可能存在冲突，验证发现时核对报告来源。明确采用项目级安装时，改用该项目实际的 `.omp/skills/` 和 `.omp/prompts/` 根目录。

### 安装 Skill

所选 Skill 目标和另一语言目标必须不存在。未知内容先保留，不直接覆盖。复制前先选择语言。

英文：

```sh
skill=workloop
other_skill=workloop-zh
skill_source=skills/workloop
prompt_source=prompts
for name in "$skill" "$other_skill"; do
  if [ -e "$skill_root/$name" ] || [ -L "$skill_root/$name" ]; then
    printf '目标已存在：%s\n' "$skill_root/$name" >&2
    exit 1
  fi
done
mkdir -p "$skill_root"
cp -R "$component_root/$skill_source" "$skill_root/$skill"
```

中文：

```sh
skill=workloop-zh
other_skill=workloop
skill_source=variants-zh/skills/workloop-zh
prompt_source=variants-zh/prompts
for name in "$skill" "$other_skill"; do
  if [ -e "$skill_root/$name" ] || [ -L "$skill_root/$name" ]; then
    printf '目标已存在：%s\n' "$skill_root/$name" >&2
    exit 1
  fi
done
mkdir -p "$skill_root"
cp -R "$component_root/$skill_source" "$skill_root/$skill"
```

复制完整 Skill，包括 `operations/`、`references/` 和 `setup.md`。一个 Skill 根只安装所选语言。

### 添加 OMP Prompt

五个 Prompt 模板可选，且只用于 OMP。安装与所选 Skill 同语言的模板。语言由安装的模板固定，不按每次调用输入选择。

英文：

```sh
skill=workloop
skill_source=skills/workloop
prompt_source=prompts
for operation in clarify exec verify ship supervise; do
  if [ -e "$prompt_root/wl-$operation.md" ] || [ -L "$prompt_root/wl-$operation.md" ]; then
    printf '目标已存在：%s\n' "$prompt_root/wl-$operation.md" >&2
    exit 1
  fi
done
mkdir -p "$prompt_root"
for operation in clarify exec verify ship supervise; do
  cp "$component_root/$prompt_source/wl-$operation.md" "$prompt_root/"
done
```

中文：

```sh
skill=workloop-zh
skill_source=variants-zh/skills/workloop-zh
prompt_source=variants-zh/prompts
for operation in clarify exec verify ship supervise; do
  if [ -e "$prompt_root/wl-$operation.md" ] || [ -L "$prompt_root/wl-$operation.md" ]; then
    printf '目标已存在：%s\n' "$prompt_root/wl-$operation.md" >&2
    exit 1
  fi
done
mkdir -p "$prompt_root"
for operation in clarify exec verify ship supervise; do
  cp "$component_root/$prompt_source/wl-$operation.md" "$prompt_root/"
done
```

只把这五个文件直接复制到 Prompt 根，不复制 `prompts/` 或 `variants-zh/prompts/` 目录。OMP 即使递归扫描，也按 basename 命名模板，两种语言不能同时存在。

安装或更新模板后启动新的 OMP 会话。`/reload-plugins` 刷新插件资源、Skill 和文件命令，不重载 Prompt 模板。在新会话中按名称使用所选 Skill，或使用以下入口：

```text
/wl-clarify <idea or Task reference>
/wl-exec <Task reference>
/wl-verify <Task reference and candidate>
/wl-ship <Task reference>
/wl-supervise <Task reference>
```

当前 Task 和目标明确时可以不传参数。空参数不增加输入标题，沿用足够的当前 Task 上下文；非空输入保留宿主解析后的字符。入口先请求安装的 Skill，再沿该 Skill 自身路由加载操作，不在 Prompt 目录寻找工作流正文。

### 替换安装

取得所需组件版本，核对已安装资源中的本地修改。使用发现根之外的新备份位置。`old_skill` 设为当前安装的身份，`skill` 设为目标身份，`skill_source` 和 `prompt_source` 设为对应语言的来源。两个 Skill 身份变量相同时表示原地更新。下例从英文切换到中文。目标身份与当前身份不同时，目标 Skill 不得已存在。

```sh
old_skill=workloop
skill=workloop-zh
skill_source=variants-zh/skills/workloop-zh
prompt_source=variants-zh/prompts
backup_root="${backup_root:?set a new backup directory outside discovery roots}"
if [ "$old_skill" != "$skill" ] && { [ -e "$skill_root/$skill" ] || [ -L "$skill_root/$skill" ]; }; then
  printf '目标已存在：%s\n' "$skill_root/$skill" >&2
  exit 1
fi
mkdir -p "$backup_root/skills" "$backup_root/prompts"
mv "$skill_root/$old_skill" "$backup_root/skills/$old_skill"
for operation in clarify exec verify ship supervise; do
  mv "$prompt_root/wl-$operation.md" "$backup_root/prompts/"
done
if [ -e "$skill_root/$skill" ] || [ -L "$skill_root/$skill" ]; then
  printf '目标已存在：%s\n' "$skill_root/$skill" >&2
  exit 1
fi
cp -R "$component_root/$skill_source" "$skill_root/$skill"
for operation in clarify exec verify ship supervise; do
  cp "$component_root/$prompt_source/wl-$operation.md" "$prompt_root/"
done
```

备份目标必须是新位置，来源资源须属于自己的安装。先移走完整旧目录可避免嵌套复制，并将废弃文件移出发现范围。整体移走五个模板可避免混合语言入口，无关文件保持不变。只安装 Skill 时，省略两次 Prompt 循环。

复制失败时，先恢复保存的完整安装再使用。备份留在发现根之外。替换或切换后启动新 OMP 会话，已有会话可能仍保留旧模板内容或 Skill 正文。

### 移除安装

保存本地修改后，只移除所选 Skill 和这五个模板：

```sh
skill="${skill:-workloop}"
rm -r -- "$skill_root/$skill"
for operation in clarify exec verify ship supervise; do
  rm -f -- "$prompt_root/wl-$operation.md"
done
```

该块默认 `workloop`；移除中文 Skill 时在 shell 中设置 `skill=workloop-zh`，或修改默认值。只安装 Skill 时，Prompt 移除可以省略；`rm -f` 不会因文件不存在而失败。Skill 为符号链接时，改用不带尾部斜杠的 `rm -- "$skill_root/$skill"`，不删除来源。保留共享根目录、无关资源、备份和来源检出目录。启动新 OMP 会话，使发现状态反映移除结果。

### 使用其他 Harness

采用该 Harness 文档说明的 Skill 根目录和加载机制，将对应 `skill_source` 中的完整目录复制到实际 Skill 根。除非宿主明确支持该格式，否则不复制 OMP 模板。不需要专用命令或运行时集成，按名称引用 Skill 并以自然语言请求操作。

英文：

```sh
component_root="$PWD"
skill_root="<the Skill root your Harness loads>"
skill=workloop
other_skill=workloop-zh
skill_source=skills/workloop
prompt_source=prompts
for name in "$skill" "$other_skill"; do
  if [ -e "$skill_root/$name" ] || [ -L "$skill_root/$name" ]; then
    printf '目标已存在：%s\n' "$skill_root/$name" >&2
    exit 1
  fi
done
mkdir -p "$skill_root"
cp -R "$component_root/$skill_source" "$skill_root/$skill"
```

中文：

```sh
component_root="$PWD"
skill_root="<the Skill root your Harness loads>"
skill=workloop-zh
other_skill=workloop
skill_source=variants-zh/skills/workloop-zh
prompt_source=variants-zh/prompts
for name in "$skill" "$other_skill"; do
  if [ -e "$skill_root/$name" ] || [ -L "$skill_root/$name" ]; then
    printf '目标已存在：%s\n' "$skill_root/$name" >&2
    exit 1
  fi
done
mkdir -p "$skill_root"
cp -R "$component_root/$skill_source" "$skill_root/$skill"
```

宿主支持时，可以用目录符号链接替代复制，先移动或移除已有副本。英文：

```sh
component_root="$PWD"
skill_root="<the Skill root your Harness loads>"
skill=workloop
other_skill=workloop-zh
skill_source=skills/workloop
prompt_source=prompts
for name in "$skill" "$other_skill"; do
  if [ -e "$skill_root/$name" ] || [ -L "$skill_root/$name" ]; then
    printf '目标已存在：%s\n' "$skill_root/$name" >&2
    exit 1
  fi
done
mkdir -p "$skill_root"
ln -s "$component_root/$skill_source" "$skill_root/$skill"
```

中文：

```sh
component_root="$PWD"
skill_root="<the Skill root your Harness loads>"
skill=workloop-zh
other_skill=workloop
skill_source=variants-zh/skills/workloop-zh
prompt_source=variants-zh/prompts
for name in "$skill" "$other_skill"; do
  if [ -e "$skill_root/$name" ] || [ -L "$skill_root/$name" ]; then
    printf '目标已存在：%s\n' "$skill_root/$name" >&2
    exit 1
  fi
done
mkdir -p "$skill_root"
ln -s "$component_root/$skill_source" "$skill_root/$skill"
```

来源保持在稳定位置。更新复制的 Skill 时，先将完整旧目录移到发现根之外的新备份，再复制新目录。切换语言先将旧身份移出发现范围。链接安装更新来源；来源移动时只替换链接。移除时只处理安装目录或链接。遵循该 Harness 实际重载或重启要求，不假定 OMP 步骤适用。

### 核对加载

分别核对以下结果：

- 文件放置：一种完整所选 Skill，安装 OMP Prompt 时有五个同语言模板，没有嵌套副本、旧语言或自有同名文件命令冲突。
- 宿主发现：所需 Skill 身份和命令来源，没有冲突安装抢占入口。
- 实际加载：新会话从真实安装位置加载所选入口要求的 Skill 和操作。发现结果或版本一致不表示已经加载指令正文或 Agent 行为正确。

接口依据为 OMP 18.12.3，不是维护下界：

- [Prompt 模板](https://omp.sh/docs/prompt-templates)说明发现、参数和会话加载，[18.12.3 实现](https://github.com/can1357/oh-my-pi/blob/v18.12.3/packages/coding-agent/src/config/prompt-templates.ts)定义该版本的发现及展开行为。
- [包管理](https://github.com/can1357/oh-my-pi/blob/v18.12.3/docs/plugin-manager-installer-plumbing.md)说明旧包移除。
- [命令发现](https://github.com/can1357/oh-my-pi/blob/v18.12.3/docs/slash-command-internals.md)说明文件命令优先级。
- [配置 CLI](https://github.com/can1357/oh-my-pi/blob/v18.12.3/packages/coding-agent/src/cli/config-cli.ts) 定义 `config path`。

在该接口中，原生 `.omp` 资源优先级为 `100`，包资源为 `90`。内容不同的同名 Skill 中，较高优先级保留裸名称，其他副本获得命名空间身份；相同副本去重，自定义 Skill 目录有自己的覆盖规则。原生文件命令高于包文件命令。内置、扩展和自定义处理器先于文件命令，文件命令先于 Prompt 模板。这些是特定版本的接口事实，不保证相同优先级顺序或未来宿主行为；应核对实际发现来源。

其他版本使用其当前公开接口。文件操作和发现检查各自需要实际观察，模型行为和用户验收需要单独证据。

## 选择操作

- **Clarify** 澄清目标，按需调研或诊断，完成设计，并在同次操作中形成或修订 `plan.md`。单元成为可执行合同前解决目标、必要设计和重要选择；所需子任务澄清仍保留在父 Plan。仅讨论、仅设计、不做 Plan、暂停和写入限制仍有效，准备不启动实现。
- **Execute** 当前会话实现并协调自检和独立 Verify。未限制更小范围时连续完成剩余 Plan，通常同一时间只处理一个单元，可以串行完成多个。
- **Verify** 独立评估指定材料或实现候选，不修改目标。每份报告记录候选、证据、结论及限制。
- **Ship** 按实际请求和许可完成项目定义的交付，不一定表示生产发布或 Task 关闭。
- **Supervise** 调度独立 Worker，不亲自实现。可向不同 Worker 分派独立单元，保留各单元审阅边界。

实际调用 `/wl-exec` 或直接提出等价 Execute 请求后，先确定所属 Task，将其从 `planning` 启动为 `open`，再检查 Plan 是否就绪。已为 `open` 的 Task 直接继续，不重复启动；`closed` Task 仍需单独的重开许可。因缺失规划，或执行、核验、用户验收发现问题而返回 Clarify 时，Task 保持 `open`，不退回 `planning`。

Check 是前期隐含材料检查。目标讨论和 Plan 完成不启动执行，结尾也不邀请执行。

## 区分材料

材料保存在所属 tk Task。`goal.md` 说明预期结果和停止条件，不写实现方法。可选 `design.md` 说明方案。可选诊断记录问题及有依据的原因，不写修复建议。Research 汇总来源，Grill 保留讨论。

每个进入 Execute 的任务都需要独立 `plan.md`，单单元改动也不例外。它可以内联展开单元或链接 tk 子任务。执行记录保存候选及检查。准备自检通常使用 `plan-check.md`，按请求进行的独立准备审查追加到 `material_check.md`，执行候选的独立 Verify 追加到 `verification.md`。仅产出 Markdown 的执行单元仍属于实现候选。保留历史评估及失败，可选活动不需要空文件或职责对应表。

父 Plan 覆盖每个已确认子任务，包括待澄清或受阻的工作。父任务保留其目标、归属、当前环节、依赖或阻塞及材料链接，详细合同和证据归子任务。需要单独准备时，列出 Clarify 环节、输入、预期形成的目标、必要设计和 Plan 材料、完成条件及后续承接。链接现有材料，不创建空子计划。只有任务索引并不够。

例如，父 Plan 可以包含以下条目，同时让无关的已就绪单元继续实施：

```text
U02 支持政策
目标：发布支持范围和联系渠道。
归属及材料：政策子任务，通过链接读取其现有 Task 和设计。
当前环节：Clarify，根据候选方案和维护者决定澄清政策。
阻塞：维护者需要选择支持范围和联系渠道。
准备产物：已确认目标、必要设计及可执行子 Plan。
后续承接：读取上述结果，更新 U02 的下一步、依赖和链接，
再按适用许可实施政策。
```

记录问题不表示准备完成，准备完成也不表示 U02 的最终结果完成。更新 Plan 时保留稳定标签、已完成结果和有效证据。Execute 和 Supervise 继续无关且已授权的就绪工作，不丢弃未解决范围，也不将其分派为实施。准备检查识别遗漏的子任务工作，即使该工作尚不能实施。

## 理解检查

Plan 形成后默认自检前期材料。前期材料的独立 Verify 由用户请求，涵盖作者必要的范围内修订与复查，用户的明确限制优先。每个实现单元都需要快速自检和独立 Verify。

自检默认在三至五轮中选择上限，外部指引可覆盖，通过即提前结束。准备自检与各实现单元分别计数。准备自检按 Clarify 轮次计数：上一轮返回后，因新的请求、返回的材料或设计缺陷，或因需求、依据变化，新一轮从自己的计数开始，上一轮耗尽不阻止本轮。仅为获得新计数而宣布的轮次仍属同一轮。同一轮或同一实现单元内，修订、修复和 Verify 反馈不重置计数。达到适用上限后停止追加自检，完成可处理修订并说明未复查变更。独立 Verify 没有自检上限。

执行通常不为范围内实现、修复、检查或独立 Verify 反复索权。Execute 和 Supervise 禁止结构化问答工具，必须由用户决定的问题用普通文字提出。`confirm` 表示逐项确认，不取消检查，也不启用结构化问答。`nowait` 改变跨会话请求等待，不改变自检屏障或许可。

核验、用户验收、集成、安装、发布和 Task 关闭分别处理。已验证依赖候选可按项目规则支持后续开发，无需集成许可。候选变化后刷新受影响证据。

## 示例

在请求中使用所选 Skill 名称和实际 Task 引用，不要求宿主专用斜杠命令。

```text
使用 workloop-zh 澄清这个想法，保存确认后的目标。
使用 workloop-zh，为已确认目标编写单单元 Plan。
使用 workloop-zh 只讨论设计，不生成 Plan，也不实现。
使用 workloop-zh 执行这个 Task 的剩余 Plan。
使用 workloop-zh 只执行这个 Task 的 U02。
使用 workloop-zh 监督这个 Plan 中的独立单元。
使用 workloop-zh 独立核验这些准备材料。
使用 workloop-zh，按项目交付定义交付这个候选。
```

需要英文指引时请求 `workloop`，以英文表达操作。任一语言都支持完整流程。不可行或无需行动的任务，可以保存有依据的结论后停止；关闭按 tk 适用许可处理，不强制补一份 Plan。

## 配置默认值

初始化可选。请求初始化或重新配置所选 Skill，主 Skill 的简短链接指向完整说明。设置保存在适用的 `AGENTS.md` 一类外部指引，包括独立角色模型及思考强度、两类自检上限、协作方式、项目工作约定和 Ship 目标。Senior 默认模型不启用 Senior。

当次明确选择优先于继续有效选择，后者优先于适用默认。保留准确模型选择器和别名。workloop 不内置本机模型，也不建立用户级与项目级配置层次。普通操作不主动预检可用性，实际报错后针对问题诊断。

## 恢复工作

在可恢复状态中保留当前活动的 Task 或配置范围、依据、适用候选、许可、限制、适用检查次数和下一步。入口、操作或当前必需 Reference 缺失时，从所选安装 Skill 重新加载。记得链接不等于正文仍在，不要求特定 Pin API。

## 验证范围

分发材料是指令文本。无需真实 Harness 即可检查目录完整性、内部链接并走读场景。宿主发现、实际 Agent 行为及用户效果需要各自的实际证据，文件检查不能证明这些结果。评估具体安装时分别表述。

仓库检查将两种语言 Skill 的共享 Reference 目录内的 Markdown 视为文档，无需逐文件登记。未知操作或语言、旧命令路径、非 Markdown 文件、共享检查输入及混合未知变更仍完整回退。
