# ADR 决定：分发 Harness 组件与自定义根目录 CLI Skill

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [分发可选择的 tk Harness 组件](../archived/2026-09-02-distribute-selectable-tk-harness-components.zh.md)

[English](./2026-09-03-distribute-custom-cli-skills.md) | 中文

## 动机

运行时安装和 Harness 集成分别负责不同内容。组件安装必须保持确定、离线、可检查和可撤销，并且不增加第二个安装数据库。

`tk-cli` 与 `tk-cli-zh` Skill 只使用公开 `tk` 可执行文件。用户需要把它们安装到项目级或其他 Harness 的 Skill 目录，而不能把任意目录伪装成四个已支持 Harness 之一。

## 决定

### 运行时与内嵌 bundle

Linux 运行时仍是位于 `$HOME/.local/bin/tk`、具有 Unix 执行位的一份常规可执行文件。Harness 组件和直接安装的 CLI Skill 会验证它，但不安装、更新、删除、包装或复制它。

`projects/tk/build.rs` 是唯一 bundle 组装器。Cargo 生成一个确定性 `tar.zst` 和一份清单。`components` 集合包含多种 Harness 选择，覆盖四个 Harness、两种模式和两种语言。独立的 `cli_skills` 集合包含 `en` 与 `zh` 两项与 Harness 无关的 `tk-cli` 和 `tk-cli-zh` 载荷。

每个 Harness 组件项记录 Harness、模式、语言、Skill 身份、`runtime_compat`、载荷路径、文件类型、Unix 权限和摘要。每个 `cli_skills` 条目记录语言、Skill 身份、`runtime_compat`、载荷路径、文件类型、Unix 权限和摘要，不含 Harness 字段。清单在顶层只记录一次 runtime version 和 `source_revision`。组件格式版本 3 负责这套 schema。

tools 载荷包含 `tk` 或 `tk-zh`，以及所选 Harness 集成。Harness CLI 载荷包含 `tk-cli` 或 `tk-cli-zh`，以及该 Harness 加载 Skill 所需的原生 manifest。与 Harness 无关的 CLI 载荷只包含所选自包含 Skill。载荷不包含 runtime 副本、其他组件文件、评审记录、任务材料或产品源码。

### 公开生命周期

公开命令为：

```text
tk install --harness <codex|claude|pi|omp>
  [--mode <tools|cli>] [--language <en|zh>] [--dry-run]

tk install --mode cli --skill-root <directory>
  [--language <en|zh>] [--dry-run]

tk uninstall --harness <codex|claude|pi|omp> [--dry-run]

tk uninstall --skill-root <directory> [--dry-run]
```

每条命令必须且只能提供 `--harness` 与 `--skill-root` 中的一个。Harness install 保留 `tools` 模式和 `en` 语言默认值。自定义根目录 install 必须显式传入 `--mode cli`，拒绝 tools 模式，语言默认 `en`。

install 与 uninstall 拒绝全局 `--cwd`。相对 Skill 根目录按进程当前工作目录解析，结果报告绝对根目录。

### Harness 与自定义根目录所有权

四个已支持 Harness 保留官方组件生命周期。Harness install 检查 Harness 可执行文件，使用官方接口或固定驱动，收敛所选组件，并删除已知的旧目标和注册。Harness uninstall 删除该 Harness 所有的 tk 专用目标与注册，同时保留无关内容。

`--skill-root` 表示 Harness 发现 Skill 的父目录。英文目标是 `<skill-root>/tk-cli`，中文目标是 `<skill-root>/tk-cli-zh`。install 可以创建根目录及其父目录。

自定义生命周期只管理这两个名称完全匹配的 CLI Skill 目标。安装其中一个时会完整替换所选目标，并删除另一个 CLI 目标。卸载删除两者。`tk`、`tk-zh`、其他全部条目和 Skill 根目录本身保持不变。

自定义根目录操作不会要求或调用 Harness 可执行文件，不安装 Plugin、Package、extension 或 MCP 配置，不修改 tk 操作注册，也不声称 Harness 能加载该目录。多个自定义根目录可以并存。tk 不保存根目录列表、所有权记录、安装历史或续跑状态。

### 计划、校验与结果

生命周期计划读取所选内嵌载荷，以及该生命周期所有权边界内的全部目标。dry-run 与执行共享完整预检。操作先暂存内容，再重新检查已观察目标，随后按确定顺序提交。错误或取消会立即停止，结果报告已完成与未完成项，不自动回滚。GC 仍然只处理已登记的 tk 临时操作内容。

归档校验会在持久写入前拒绝不支持的格式、不兼容 runtime 范围、路径逃逸、符号链接、特殊文件、重复项、缺失项、多余项、元数据不匹配和摘要不匹配。安装不使用网络、checkout 或本地归档来源。

text 与 JSON 结果必须且只能包含一个目标字段。Harness 操作使用 `harness`，自定义根目录操作使用 `skill_root`。install 报告模式、语言和 Skill。Harness uninstall 省略这些选择字段。自定义根目录 uninstall 报告 `mode: cli`，但省略语言和 Skill，因为它不查询安装历史，并会删除两个已知 CLI 目标。

## 考虑过的替代方案

**继续手工复制自定义安装。** 手工复制没有内嵌来源选择、摘要校验、dry-run、确定性更新、残留语言清理或有限范围卸载。

**增加 `generic` Harness 值。** 通用目标没有 Harness 可执行文件、官方加载 API、固定路径或真实加载验证。它会误用 Harness 概念，而且仍然需要目录参数。

**新增 `tk skill install` 和 `tk skill uninstall` 命令。** 这会为使用相同机制的第二套生命周期重复现有选择、归档、dry-run、结果和失败合同。

**把参数解释为最终 Skill 目录。** 调用者需要自行选择或追加发现名称，语言切换还可能把不同 Skill 身份覆盖到同一路径。

## 结果

运行时携带十八份载荷，因此载荷变更会增加可执行文件体积，并要求重新构建和分发 runtime。

已支持 Harness 的用户级集成保留现有安装和真实加载验证。其他 Harness 和项目只要能发现普通 Skill 根目录，就可以使用同一份 CLI Skill，但文件安装成功不能证明 Harness 已经加载 Skill。

Skill 根目录输入错误时，可能替换或删除其中已有的 `tk-cli` 或 `tk-cli-zh` 目录。dry-run 和完整路径报告会显示计划边界；干净安装和卸载仍会有意把这两个名称完全匹配的子目录视为 tk 所有。
