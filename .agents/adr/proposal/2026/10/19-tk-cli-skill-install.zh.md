# tk CLI Skill 安装

Draft owner: Ruokee
Draft writer: DeepSeek V4.1 Flash

[English](./19-tk-cli-skill-install.md) | 中文

## 动机

把 tk 的 CLI Skill 作为普通 Skill 安装到每个已支持 Harness 的用户级 Skill 根目录。

英文与中文形态分别为 `tk-cli` 与 `tk-cli-zh`，二者都通过公开 `tk` CLI 执行 Task 操作。

当前 cli 模式用两种方式安装同一个 Skill。Codex 写入普通 Skill 目录。Claude Code 安装 plugin，Pi 安装 package，OMP 注册插件包 `@ruokee/tk-omp`。后三者会在 Harness 的 plugin 或 package 目录下留下 Skill 副本，位于普通 Skill 根目录之外。副本与仓库源可能出现差异，Harness 因此可能加载过期 Skill。同一模式在各 Harness 上的行为也不同，安装检查无法使用同一套规则。

[tk CLI 模式](../../../decision/2026/09/02-tk-cli-mode.zh.md)规定，只含 CLI 的 Harness 组件安装 `tk-cli` 或 `tk-cli-zh`，Claude Code、Pi 与 OMP 还安装加载它所需的原生 manifest。[tk 分发](../../../decision/2026/08/28-tk-distribution.zh.md)规定，`components` 集合覆盖四个 Harness、两种模式与两种语言；组件格式版本 3 负责这套 schema；Harness CLI 载荷包含 `tk-cli` 或 `tk-cli-zh`，以及该 Harness 所需的原生 manifest；运行时携带十八份载荷；已支持 Harness 的用户级集成保留现有安装与真实加载验证。

这些条款与只安装普通 Skill 不能同时成立。组件生命周期会注册宿主对象，该注册依赖原生 manifest。在 Claude Code、Pi 与 OMP 上，组件目标是普通 Skill 根目录之外的目录，注册组件从该目录提供 Skill。保留组件并增加普通 Skill 目标会产生同一 Skill 的两份副本。从 `components` 移除 CLI 组件后，该集合只剩 tools 条目，模式字段与 Harness CLI 载荷随之移除，载荷数量改变，并且需要新的格式版本。保留现有安装的条款同样无法成立，因为 cli 安装不再使用官方组件生命周期。

## 提议

### 安装目标

cli 安装把 `tk-cli` 或 `tk-cli-zh` 写入 Harness 的用户级普通 Skill 根目录，不产生 Harness 注册：

- Codex 使用 `$CODEX_HOME/skills`，未设置时为 `~/.codex/skills`。
- Claude Code 使用 `~/.claude/skills`。
- Pi 使用 `~/.pi/agent/skills`。
- OMP 使用 `~/.omp/agent/skills`。

`--language` 默认 `en`，写入 `tk-cli`。`zh` 写入 `tk-cli-zh`，并移除同一根目录下的另一个语言变体。Skill 身份与语言映射不变。`--mode cli --skill-root <dir>` 仍只写 `<dir>/tk-cli` 或 `<dir>/tk-cli-zh`。

### 每个 Harness 只保留一个 tk 选择

Harness cli 安装（`--harness <h> --mode cli`）移除该 Harness 的 tools 目标与已有 tk 注册。Harness tools 安装（`--harness <h> --mode tools`）移除该 Harness Skill 根目录下的两个 CLI Skill 目录。注册移除失败时保留 tools 目标，并把移除列为未完成项。

Harness cli 安装与 `tk uninstall --harness <h>` 同时移除 `${XDG_DATA_HOME:-~/.local/share}/tk/components/<harness>` 目录。在 Claude Code、Pi 与 OMP 上，该目录就是 tools 目标。Harness 可执行文件不可用或清理命令失败时，Skill 目录操作仍然完成，命令把注册清理列为未完成项。

`--mode cli --skill-root <dir>` 只管理 `<dir>/tk-cli` 与 `<dir>/tk-cli-zh`，不触碰 Harness 目标或注册。

`tk uninstall --harness <h>` 移除该 Harness 的 tools 目标、注册、两个 CLI Skill 目录与组件目录。

### bundle 格式

`components` 集合只保留 tools 条目，并移除条目的模式字段。与 Harness 无关的 `cli_skills` 集合为四个 Harness 提供两种语言的 CLI 选择。Harness CLI 载荷及其原生 manifest 条目移除。运行时携带十份载荷。组件格式版本 4 负责变更后的 schema。

### 收敛

只有在目标内容一致，并且没有待清理的旧注册、组件目录、tools 目标或另一个语言变体时，Harness cli 安装才报告 `no_change`。仍有待清理项时，命令执行可执行的清理并报告更新动作。dry run 在无变更时报告 `no_change`，计划中存在变更时报告 `would_install`。

### 失败处理

注册清理与 Skill 目录操作是两个独立结果。Harness 可执行文件缺失不阻断 Skill 目录一侧，命令也不会报告清理完成。注册移除失败时保留 tools 目标。

### 决定反转

提案获准后，实现变更归档 [tk CLI 模式](../../../decision/2026/09/02-tk-cli-mode.zh.md)与 [tk 分发](../../../decision/2026/08/28-tk-distribution.zh.md)，使用各自的下一修订号，并在规范路径写入完整的中英后继决定。后继决定保留仍然有效的规则，包括 tools 模式的内容与注册、固定运行时可执行文件、归档校验、确定性生命周期、真实加载验证与公开 CLI 合同。

## 考虑过的替代方案

**只改 OMP。** OMP 改为写普通 Skill，Claude Code 与 Pi 仍保留 plugin 与 package 注册。同一个模式仍有两种安装方式，安装检查与重复副本的问题会留在另外两个 Harness 上。

**改 OMP 与 Claude Code，Pi 保留 package。** Pi 会在 package 目录下继续保留一份 Skill 副本。Pi 也读取普通 Skill 根目录，用户可能在已安装 Skill 之外拿到过期副本。

**写入共享的 `~/.agents/skills` 根目录。** 该目录是跨工具位置，而不是某个已支持 Harness 的用户级 Skill 根目录。Pi 会读取它，一次语言选择会影响共用该目录的所有 Harness。

## 验收标准

1. 在四个 Harness 上分别执行 Harness cli 安装后，`tk-cli` 或 `tk-cli-zh` 出现在该 Harness 的用户级普通 Skill 根目录，并且不产生 Harness 注册。
2. `--language` 默认 `en`。选择 `zh` 后，该根目录下只有 `tk-cli-zh` 这一个 tk CLI Skill。
3. 同一 Harness 上先做 Harness cli 安装再做 Harness tools 安装，或顺序相反，最终只保留最后执行的模式。cli 安装移除该 Harness 的 tools 目标与注册，tools 安装移除两个 CLI Skill 目录。
4. Harness 可执行文件可用时，在旧组件安装之上执行 Harness cli 安装不会留下 tk plugin 或 package 副本、tk 注册与组件目录。
5. Harness 可执行文件不可用时，Skill 目录操作仍然完成，结果把注册清理列为未完成项。
6. 注册移除失败时，该 Harness 的 tools 目标保留，结果把移除列为未完成项。
7. 内容一致且没有清理工作时，重复执行 Harness cli 安装报告 `no_change`。
8. `tk uninstall --harness <h>` 移除该 Harness 的 tools 目标、注册、两个 CLI Skill 目录与组件目录。
9. `--mode cli --skill-root <dir>` 只写 `<dir>/tk-cli` 或 `<dir>/tk-cli-zh`，不改变 Harness 目标与注册。
10. tools 模式在四个 Harness 上保持原有载荷内容与注册方式。CLI Skill 的内容与身份不变。
11. 新启动的 Harness 通过普通 Skill 发现机制加载已安装的 Skill。
12. 相关决定完成反转，后继决定记录这套合同。

## 风险

**Harness 可能不发现假设的普通 Skill 根目录。** Pi 的用户级 Skill 位置与发现规则取决于其版本。Pi 不扫描已安装目录时，安装会报告成功，但 Harness 没有 tk CLI Skill，用户失去原 package 提供的指引。

**注册清理可能在新 Skill 安装时失败。** Harness 同时持有普通 Skill 与旧 plugin 副本，可能加载过期 Skill 或报告名称冲突。

**安装可能在 Skill 写入成功前移除 tools 目标。** Skill 目录写入或进程中断可能发生在 tools 目标与注册移除之后，Harness 最终既没有 tools 集成，也没有 CLI Skill。

**较旧的运行时会恢复已移除的注册。** 在此变更之前构建的运行时仍会注册 plugin 或 package，新安装之后再运行它就会重建重复的 Skill 副本。
