# 安装 workloop

[English](./installation.md) | 中文

安装一种完整语言 Skill，OMP 另安装对应的五个 Prompt 模板。组件没有包清单、构建步骤、运行时依赖或专用安装器，仓库普通 Skill 安装器不管理它。单独安装 tk 及所需协作工具。Setup 配置可选工作流默认值，不是安装或普通使用的前置条件。

## 解除既有包

直装前，按原管理方式移除已有的 `@ruokee/workloop` 安装。OMP 原生包管理命令如下：

```sh
omp plugin list
omp plugin uninstall @ruokee/workloop
```

只对列表中准备替换的安装运行 uninstall。OMP 18.12.3 会移除注册包和插件状态，不删除链接的来源检出目录，也不移除独立副本或手动安装的命令。直装组件没有包清单，不对它运行 `plugin link`。

定位自己安装在实际用户级或项目级 `commands/` 目录中的 workloop 文件命令。安装模板前，将五个自有文件 `wl-clarify.md`、`wl-exec.md`、`wl-verify.md`、`wl-ship.md`、`wl-supervise.md` 移到发现根之外。同名文件命令先于 Prompt 模板运行，会让旧入口继续生效。不移除无关命令或其他所有者的文件。其他同名处理器冲突应与其所有者解决，不依赖发现顺序。

## 定位 OMP 目录

从包含 `skills/` 和 `prompts/` 的组件根目录运行示例。默认配置下，OMP 使用 `~/.omp/agent/skills/` 和 `~/.omp/agent/prompts/`。环境设置或 profile 改变位置时，通过实际 CLI 解析有效 agent 目录：

```sh
component_root="$PWD"
agent_root="$(omp config path)"
skill_root="$agent_root/skills"
prompt_root="$agent_root/prompts"
skill=workloop
```

使用与目标 OMP 会话相同的环境和 profile 运行 `config path`。例如命名 profile 使用 `omp --profile work config path`，不要用默认路径替代输出。自定义 Skill 来源和项目资源也可能存在冲突，验证发现时核对报告来源。明确采用项目级安装时，改用该项目实际的 `.omp/skills/` 和 `.omp/prompts/` 根目录。

英文选择 `skill=workloop`，中文选择 `skill=workloop-zh`。每项都提供完整 Skill 及固定到该身份的模板。只安装所选语言，将两个 Prompt 子目录都复制到发现根会产生同 basename 命令。模板不根据用户输入选择语言。

## 安装到 OMP

所选 Skill 目标、另一语言 workloop 目标及五个模板文件必须不存在。已有自有安装使用下方替换步骤，未知内容先保留，不直接覆盖。

```sh
mkdir -p "$skill_root" "$prompt_root"
cp -R "$component_root/skills/$skill" "$skill_root/$skill"
cp "$component_root/prompts/$skill"/wl-*.md "$prompt_root/"
```

复制完整 Skill，包括 `operations/`、`references/` 和 `setup.md`。只将所选的五个模板文件直接复制到 Prompt 根，不复制上层 `prompts/` 或语言子目录。OMP 即使递归扫描，也按 basename 命名模板。

安装或更新模板后启动新的 OMP 会话。`/reload-plugins` 刷新插件资源、Skill 和文件命令，不重载 Prompt 模板。在新会话中按名称使用所选 Skill，或使用以下入口：

```text
/wl-clarify <idea or Task reference>
/wl-exec <Task reference>
/wl-verify <Task reference and candidate>
/wl-ship <Task reference>
/wl-supervise <Task reference>
```

当前 Task 和目标明确时可以不传参数。空参数不增加输入标题，非空输入保留宿主解析后的字符。入口先请求安装的 Skill，再沿该 Skill 自身路由加载操作，不在 Prompt 目录寻找工作流正文。

## 替换安装

取得所需组件版本，核对已安装资源中的本地修改。使用发现根之外的新备份位置。`old_skill` 指定当前语言，`skill` 指定目标语言；相同值表示更新，不同值表示切换。切换时新的 Skill 目标必须不存在。

```sh
old_skill=workloop
skill=workloop-zh
backup_root="/path/to/new-backup"
mkdir -p "$backup_root/skills" "$backup_root/prompts"
mv "$skill_root/$old_skill" "$backup_root/skills/$old_skill"
for operation in clarify exec verify ship supervise; do
  mv "$prompt_root/wl-$operation.md" "$backup_root/prompts/"
done
cp -R "$component_root/skills/$skill" "$skill_root/$skill"
cp "$component_root/prompts/$skill"/wl-*.md "$prompt_root/"
```

备份目标必须是新位置，来源资源须属于自己的安装。先移走完整旧目录可避免嵌套复制，并将废弃文件移出发现范围。整体移走五个模板可避免混合语言入口，无关文件保持不变。

复制失败时，先恢复保存的完整安装再使用。备份留在发现根之外。替换或切换后启动新 OMP 会话，已有会话可能仍保留旧模板内容或 Skill 正文。

## 移除安装

保存本地修改后，只移除所选 Skill 和这五个模板：

```sh
rm -r -- "$skill_root/$skill"
for operation in clarify exec verify ship supervise; do
  rm -- "$prompt_root/wl-$operation.md"
done
```

Skill 为符号链接时，改用不带尾部斜杠的 `rm -- "$skill_root/$skill"`，不删除来源。保留共享根目录、无关资源、备份和来源检出目录。启动新 OMP 会话，使发现状态反映移除结果。

## 使用其他 Harness

采用该 Harness 文档说明的 Skill 根目录和加载机制，将 `skills/` 中所选完整目录复制到实际 Skill 根。除非宿主明确支持该格式，否则不复制 OMP 模板。不需要专用命令或运行时集成，按名称引用 Skill 并以自然语言请求操作。

宿主支持时，可以用目录符号链接替代复制：

```sh
ln -s "$component_root/skills/$skill" "$skill_root/$skill"
```

来源保持在稳定位置。更新复制的 Skill 时，先将完整旧目录移到发现根之外的新备份，再复制新目录。切换语言先将旧身份移出发现范围。链接安装更新来源；来源移动时只替换链接。移除时只处理安装目录或链接。遵循该 Harness 实际重载或重启要求，不假定 OMP 步骤适用。

## 核对加载

分别核对以下结果：

- 文件放置：一种完整所选 Skill，OMP 下有五个同语言模板，没有嵌套副本、旧语言或自有同名文件命令冲突。
- 宿主发现：所需 Skill 身份和命令来源，没有冲突安装抢占入口。
- 实际加载：新会话从真实安装位置加载所选入口要求的 Skill 和操作。发现结果或版本一致不表示已经加载指令正文或 Agent 行为正确。

接口依据为 OMP 18.12.3，不是维护下界：

- [Prompt 模板](https://omp.sh/docs/prompt-templates)说明发现、参数和会话加载，[18.12.3 实现](https://github.com/can1357/oh-my-pi/blob/v18.12.3/packages/coding-agent/src/config/prompt-templates.ts)定义该版本的发现及展开行为。
- [包管理](https://github.com/can1357/oh-my-pi/blob/v18.12.3/docs/plugin-manager-installer-plumbing.md)说明旧包移除。
- [命令发现](https://github.com/can1357/oh-my-pi/blob/v18.12.3/docs/slash-command-internals.md)说明文件命令优先级。
- [配置 CLI](https://github.com/can1357/oh-my-pi/blob/v18.12.3/packages/coding-agent/src/cli/config-cli.ts) 定义 `config path`。

在该接口中，原生 `.omp` 资源优先级为 `100`，包资源为 `90`。内容不同的同名 Skill 中，较高优先级保留裸名称，其他副本获得命名空间身份；相同副本去重，自定义 Skill 目录有自己的覆盖规则。原生文件命令高于包文件命令。内置、扩展和自定义处理器先于文件命令，文件命令先于 Prompt 模板。这些是特定版本的接口事实，不保证相同优先级顺序或未来宿主行为；应核对实际发现来源。

其他版本使用其当前公开接口。文件操作和发现检查各自需要实际观察，模型行为和用户验收需要单独证据。
