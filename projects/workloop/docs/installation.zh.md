# 安装 workloop

[English](./installation.md) | 中文

每个安装的 Skill 选择一种管理方式：通过 Harness 管理独立目录，或使用 OMP 资源包。两者都提供完整工作流，OMP 资源包还提供五个斜杠命令。两种方式都不安装 tk、协作工具或辅助 Skill。

仓库普通 Skill 安装器不管理本组件。不需要构建或安装组件依赖。

## 安装独立 Skill

使用 Harness 文档说明的 Skill 发现与加载机制。根据实际 Harness 的文档确定用户级或项目级 Skill 根目录，不假定另一宿主的路径适用。从本组件 `skills/` 中选择完整英文 `workloop` 或中文 `workloop-zh` 目录。

对于能发现普通 Skill 目录的 Harness，以下 POSIX shell 示例复制一个完整 Skill。从包含 `package.json`、`skills/` 和 `commands/` 的组件根目录执行，将 `skill_root` 设为实际发现根目录。目标 `$skill_root/$skill` 必须不存在，已有安装使用更新步骤。

```sh
component_root="$PWD"
skill=workloop
skill_root="/path/to/skill-root"
mkdir -p "$skill_root"
cp -R "$component_root/skills/$skill" "$skill_root/$skill"
```

中文设置 `skill=workloop-zh`。两个名称独立，可按需同时安装。保留所选目录下的全部文件，只复制 `SKILL.md` 会丢失操作正文和初始化说明。

Harness 支持目录符号链接时，可以用链接替代复制：

```sh
ln -s "$component_root/skills/$skill" "$skill_root/$skill"
```

将链接来源保留在稳定位置。安装后按 Harness 的规则重新加载或重启，再按名称使用所选 Skill，以自然语言请求操作。独立安装不会增加 `/wl-*` 命令。

### 更新独立 Skill

先取得所需组件版本，替换前核对安装目录中的本地修改。对于复制安装，将旧的完整目录移到 Harness 发现根目录之外的新备份位置，再复制新的完整目录。这也会移除新版本已不再包含的文件。

将 `backup_root` 设为新位置，确保 `$backup_root/$skill` 不存在：

```sh
backup_root="/path/to/new-backup"
mkdir -p "$backup_root"
mv "$skill_root/$skill" "$backup_root/$skill"
cp -R "$component_root/skills/$skill" "$skill_root/$skill"
```

复制失败时，旧目录仍在备份中，恢复该目录后再使用 Skill。对于链接安装，更新来源即更新链接内容；来源移动后，仅将安装的链接替换为指向新位置的链接。两种更新都需按 Harness 规则重新加载或重启。目录复制或版本相同，不表示运行中的会话已经加载新正文。

### 移除独立 Skill

复制安装在保存本地修改后，只删除所选安装目录：

```sh
rm -r -- "$skill_root/$skill"
```

链接安装只移除链接，不加尾部斜杠：

```sh
rm -- "$skill_root/$skill"
```

不删除共享 Skill 根目录、另一语言安装或来源检出目录。按 Harness 规则重新加载或重启，使发现状态反映移除结果。

## 安装 OMP 资源包

包名为 `@ruokee/workloop`。`omp` 清单启用原生包发现，OMP 从 `skills/` 读取完整 Skill，从 `commands/` 读取 Markdown 命令 Prompt。包没有 Extension 入口或运行时依赖，与两个 Skill 共用同一版本。

以下命令使用 OMP 的本地包链接接口。从组件根目录执行：

```sh
component_root="$PWD"
omp plugin link "$component_root"
omp plugin list
```

这会注册指向本组件的用户级链接，包含两个语言 Skill 及全部五个命令。保留来源目录。OMP 18.12.3 的本地包链接属于用户级，`--scope project` 不会使其变成项目级链接。同包名链接会替换已有包链接，只对准备管理的安装执行此操作。

链接后，在活动 OMP 会话中运行 `/reload-plugins`，或启动新会话。使用以下入口之一：

```text
/wl-clarify <idea or Task reference>
/wl-exec <Task reference>
/wl-verify <Task reference and candidate>
/wl-ship <Task reference>
/wl-supervise <Task reference>
```

明确的语言 Skill 选择优先，未指定时命令加载英文 `workloop`。例如：

```text
/wl-exec 使用 workloop-zh，执行这个 Task 的剩余 Plan
```

入口加载所选 Skill，并根据实际加载的 Skill 目录定位操作正文，不到全局 Prompt 目录寻找工作流正文。两个 Skill 也可以不经斜杠命令，直接按名称使用。

### 更新 OMP 资源包

将链接的组件检出目录更新到所需版本，再运行 `/reload-plugins` 或启动新 OMP 会话。组件移动后，用新的绝对路径执行 `omp plugin link`。`omp plugin upgrade @ruokee/workloop` 不更新本地链接，OMP 对该操作拒绝链接来源。更新链接不会更新单独复制的 Skill。

### 移除 OMP 资源包

```sh
omp plugin uninstall @ruokee/workloop
```

随后运行 `/reload-plugins` 或启动新会话。卸载移除注册的包链接及插件状态，不删除来源组件目录，也不移除独立 Skill 副本或手动安装的命令，后者按各自安装方式管理。

### 处理资源重名

每个 Skill 名称使用一种安装方式，避免加载不同版本。OMP 18.12.3 中，原生 `.omp` 资源优先级为 100，包资源为 90。同名 Skill 内容不同时，高优先级副本保留原名称，其他副本获得带命名空间的身份；相同副本会去重。自定义 Skill 目录另有更高优先级的覆盖行为。先核对报告的来源，不假定 `workloop` 就是包内副本。

原生同名文件命令优先于包内文件命令。内置、Extension 和自定义命令处理器先于文件命令运行，文件命令先于 Prompt 模板。`wl-` 前缀不保证不会与用户定义冲突。只移除或重命名自己管理的冲突安装，再重新加载，不依赖同优先级来源之间的顺序。

### 接口依据

上述 CLI 和源码合同按 OMP 18.12.3 核对。这是接口依据，不是宿主维护下界或实机安装声明：

- [包管理](https://github.com/can1357/oh-my-pi/blob/v18.12.3/docs/plugin-manager-installer-plumbing.md)说明链接、更新限制、移除及约定资源目录。
- [命令发现](https://github.com/can1357/oh-my-pi/blob/v18.12.3/docs/slash-command-internals.md)说明 `commands/`、优先级及展开。
- [Skill 重名](https://github.com/can1357/oh-my-pi/blob/v18.12.3/docs/skills.md#collision-and-duplicate-handling)说明同名处理。
- [重载实现](https://github.com/can1357/oh-my-pi/blob/v18.12.3/packages/coding-agent/src/slash-commands/builtin-marketplace.ts)通过 `/reload-plugins` 刷新 Skill 及文件命令。

其他 OMP 版本遵循其当前公开接口。文件复制和清单检查证明资源完整性，验证具体安装时另行检查实际宿主发现与模型行为。
