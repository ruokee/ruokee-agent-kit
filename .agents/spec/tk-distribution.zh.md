# tk 分发

## 目标

在 Linux 用户级环境中，离线安装、更新、切换和干净卸载 tk Harness 集成及普通 CLI Skill。安装结果不依赖源码检出。只更新检出不会更新已安装运行时或其分发内容。

## 非目标

组件生命周期命令不安装、升级或卸载运行时本身，不安装第二个运行时、包装器、并行运行时版本或私有可执行文件。不使用网络来源，不接受本地 archive，也不依赖安装历史数据库。

## 公共面

### 运行时

固定公开运行时为 `$HOME/.local/bin/tk`，必须是至少带一个 Unix 执行位的普通文件。实际启动失败时保留操作系统错误。每个集成都直接启动该运行时，不经 shell，不使用回退运行时。

### 选择

tools 模式支持 Codex、Claude Code、Pi 和 OMP，各有 `en`、`zh`。每项只包含所选 Harness 集成及 tools Skill。Codex 和 Claude Code 使用 MCP，Pi 和 OMP 使用原生工具。Pi 或 OMP 单独配置的外部 MCP 不属于原生组件管理范围。

cli 模式安装普通 `tk-cli` 或 `tk-cli-zh` Skill，不创建注册或 native manifest。tools 模式选择 `tk` 或 `tk-zh`。默认语言是英文。完整分发提供 tools 模式的全部受支持 Harness 与语言组合，以及各语言独立于 Harness 的 CLI Skill。每项都自包含，不包含其他 Harness 内容、源码、任务材料、审查记录或运行时可执行文件。相同分发输入产生相同的所选文件路径、字节、权限和分发内容。

分发格式 `4` 用语言和 Skill 标识每项选择，只有 tools 选择带 Harness 身份。它声明运行时版本、来源修订、运行时兼容范围、允许的载荷路径、文件类型、Unix 权限和内容摘要。写入前的兼容与完整性检查必须使用这些声明。

安装必须恰选 `--harness codex|claude|pi|omp` 或 `--skill-root <directory>` 之一。Harness 模式默认 `tools`，自定义根安装必须显式 `--mode cli`，拒绝 tools 模式。相对 Skill 根从进程 cwd 解析，不使用组件操作拒绝的全局 `--cwd`。结果以绝对 `skill_root` 报告解析后的根。

Harness CLI 根目录为：

| Harness | Skill 根目录 |
| --- | --- |
| Codex | `$CODEX_HOME/skills` |
| Claude Code | `~/.claude/skills` |
| Pi | `~/.pi/agent/skills` |
| OMP | `~/.omp/agent/skills` |

自定义根操作只管理直接子项 `tk-cli` 和 `tk-cli-zh`，可以创建缺失的根及父目录。保留根本身、`tk`、`tk-zh` 和其他全部子项，不检查 Harness 配置或无关子项，不要求 Harness 可执行文件，也不安装 Harness 专属集成。

### 安装

安装只使用当前可执行文件携带的所选分发内容。预检和 dry-run 检查固定运行时、所选内容的格式与兼容性、完整性、可读受管目标、计划修改，以及不存在其他活动多目标操作。不支持的格式、不兼容运行时、错误选择、无效路径、不支持的文件类型或权限、重复项、缺失或额外内容及损坏内容都在持久写入前失败。预检不检查任务数据、WAL、项目配置、Git 状态或安装历史。

tools 操作额外要求 Harness、可用的安装接口，以及完整的共享配置解析。优先使用 Harness 官方 install/uninstall API，只有不存在可用官方 API 时才直接管理固定 tk 专属目标和结构化 tk 配置。配置必须指向规范目标，不能指向临时位置。

tools 安装写入所选集成和注册，再删除被取代的 tk Skill 目标，包括两个 CLI 变体。CLI 安装不创建注册。它删除 tk 注册和 tools 目标，写入所选 CLI Skill，删除另一 CLI 变体及遗留组件内容。注册删除失败或状态无法读取时，保留 tools 目标，继续 Skill 操作和独立的遗留组件清理，将注册清理列入 `uncompleted`。Harness 可执行文件不可用不阻止 CLI Skill 写入或删除。

安装收敛到完整所选内容，包括替换专属目标中的漂移。只有所选内容、受管目标集合和注册清理状态都符合请求时，重复安装才返回 `no_change`。否则报告 `installed` 或 `updated`，有变更的 dry-run 报告 `would_install`。结果恰含 `harness` 和绝对 `skill_root` 之一，以及解析后的 `mode`、`language`、`skill` 和计划或实际变更。

### 卸载

卸载恰选一个 Harness 或 Skill 根，不接受 mode 或 language 选择，报告 `would_uninstall`、`uninstalled` 或 `no_change`。自定义根结果报告 `mode:cli`，省略 `language` 和 `skill`，因为两个 CLI 变体都会删除。

完成的 Harness 卸载删除全部 tk 专属目标和注册、已知残留 Skill 变体及遗留组件目录。专属 tk 目标完整删除，包括修改过和额外内容。内容摘要不用于保留不可用的 tk 残片。无关 Skill、Plugin、Package、MCP 注册、用户配置、邻近路径和后续无关修改保持不变。注册删除失败时 tools 清理保持未完成，但仍删除 Skill 目录。

编辑共享配置前必须完整解析。解析失败时保留原文件并失败。只删除结构化 tk 项，不比较其旧值，保留其他全部项。只有配置文件由 tk 在当前生命周期创建，且删除 tk 后为空，才可删除。否则保留合法文件，即使为空。自定义根卸载只删除两个直接 CLI Skill 目标，保留根目录。

### 原生加载

注册首个工具前，Pi 和 OMP 校验固定运行时文件和执行位、可读版本 JSON、有效 native contract 封套、相同运行时版本、native contract 版本 `3`、精确所选 Harness、运行时兼容范围 `>=0.1,<0.2`、全部六个工具名称和描述、每个工具的对象类型请求 schema，以及必需宿主字段。兼容范围求值由公开运行时负责，适配器不能另立偏离规则。

运行时提供由 MCP 和 native 集成共享的完整请求 schema，包括字段、必填输入、默认值和 create 联合语义。适配器校验 schema 对象，不校验其内部字段完整性。空 properties 对象不在适配器预检保证拒绝的范围内。

预检失败时零工具注册，输出一条有界诊断，Harness 会话继续运行。不使用回退可执行文件。注册过程本身中途失败时，停止后续注册并报告错误，已经接受的前缀可以保留，不声称注册回滚。

OMP 通过 `loadMode` 将 search、read、create、update、log 标为 essential，将 exec 标为 discoverable。Pi 不提供 `loadMode`。两种适配器都不改变逻辑请求默认值、联合 schema、领域校验、授权或存储行为。原生调用保留接口规格中的 cwd、actor、取消、结果和传输合同。

## 不变量

首次持久修改前完成全部领域预检。提交前复核计划目标。多目标操作按确定顺序提交，普通 I/O 失败或提交点之间取消时停止，报告真实 `completed` 和 `uncompleted` 项。部分完成是失败，不是支持的部分安装模式。不回滚、不创建续做 token，也不在 producer 退出后继续。

GC 只可删除归属明确的遗留 tk 临时内容，不改变规范 Harness 目标、自定义 Skill 根或 Harness 配置，不完成安装或卸载。

## 宿主下限

OMP tools 模式宿主端代码维护下限为 `18.5.0`，Pi 为 `0.84.4`。两者都没有上限或宿主版本运行门禁。cli 模式不携带宿主进程代码。Codex 和 Claude Code 没有宿主维护下限。这些声明不替代运行时和组件兼容性校验。

## 验收标准

- 四种 tools 集成的两种语言都在真实隔离 Harness 环境中安装、加载和卸载。OMP 额外完成一次真实工具调用；Codex、Claude Code、Pi 成功加载后无需模型调用。观察实际加载及卸载后状态。
- cli 模式在每个 Harness 根中作为普通 Skill 放置和发现。自定义根覆盖相对及绝对根、缺失父目录、语言切换、dry-run、精确收敛、无变化及卸载，同时保留无关内容。
- 运行时缺失、非普通文件、无执行位、版本或契约封套无效、Harness 错误、运行时不兼容、缺少工具、请求 schema 缺失或不是对象、宿主专用字段无效，都产生零注册和一条有界诊断，不结束会话。中途注册失败停在已接受前缀。运行时正常输出的 schema 保持完整，并与实际接受的请求一致。
- 模式和语言切换删除被取代的 tk 内容。注册清理失败保留 tools 目标并报告未完成工作，不阻止规定的 CLI Skill 操作。
- 共享配置解析失败保留原始字节。干净卸载删除修改过及额外的 tk 专属内容，同时保留无关项和后续修改。
- 损坏或不匹配的分发内容在写入前失败。重复相同安装返回无变化，漂移恢复为完整选择。全部部分失败和 GC 效果保持准确可观察。
