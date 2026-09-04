# ADR 提案：支持把 tk CLI Skill 安装到自定义根目录

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol, Ruokee

[English](./2026-09-03-install-cli-skills-to-custom-roots.md) | 中文

## 动机

`tk-cli` 和 `tk-cli-zh` Skill 只使用公开 `tk` 可执行文件。它们的 Task 行为不依赖 MCP、原生操作或 Harness 专用适配器。

`tk install` 当前必须选择 Codex、Claude Code、Pi 或 OMP。即使其他 Harness 能发现普通 Skill 目录，用户仍然只能手工复制 Skill。这个限制也使 `tk install` 无法把 CLI Skill 放入项目级 Skill 目录。

直接指定 Skill 目标时，仍需保留现有的离线 bundle、确定性更新、dry-run、有限清理和不维护安装数据库等规则。任意目录不能因此被伪装成某种 Harness 集成。

## 提议

### 命令与目标选择

保留现有 Harness 命令，并增加自定义 Skill 根目录形式：

```text
tk install --harness <codex|claude|pi|omp>
  [--mode <tools|cli>] [--language <en|zh>]
  [--dry-run]

tk install --mode cli --skill-root <directory>
  [--language <en|zh>] [--dry-run]

tk uninstall --harness <codex|claude|pi|omp> [--dry-run]

tk uninstall --skill-root <directory> [--dry-run]
```

`--harness` 和 `--skill-root` 互斥，并且必须提供其中一个。自定义形式必须明确传入 `--mode cli`，拒绝 tools 模式。现有 Harness 用法的默认值和行为不变。

相对 `--skill-root` 按进程当前工作目录解析，绝对路径直接使用。install 和 uninstall 继续拒绝全局 `--cwd`。Skill 根目录是安装目标，不参与 tk 项目发现。

### Skill 根目录语义

`--skill-root` 表示 Harness 发现 Skill 的目录，而不是最终 Skill 目录。所选语言决定子目标：

| 语言 | 安装目标 |
| --- | --- |
| `en` | `<skill-root>/tk-cli` |
| `zh` | `<skill-root>/tk-cli-zh` |

install 可以创建不存在的根目录及其父目录。安装保留 Skill 的稳定发现名称，不重写 Skill 元数据或链接。

自定义生命周期只管理所给根目录下两个名称完全匹配的 CLI Skill 目标：`tk-cli` 和 `tk-cli-zh`。安装某个 CLI Skill 时，运行时完整替换所选目标，并删除另一个 CLI 目标。卸载删除这两个目标。`tk` 与 `tk-zh` tools Skill、其他条目和 Skill 根目录本身保持不变。

多个自定义根目录可以并存。tk 不保存根目录列表、所有权记录或安装历史。更新和卸载时，调用者必须再次提供同一个根目录。

### Harness 边界

自定义根目录安装只写入自包含的 `tk-cli` 或 `tk-cli-zh` Skill。它不会：

- 要求或调用 Harness 可执行文件；
- 安装 Plugin、Package、extension 或 MCP 配置；
- 添加、检查或移除 tk 操作注册；
- 声明 Harness 能发现或成功加载所选根目录。

四个已支持 Harness 继续使用各自的正式组件生命周期。用户为其中一个 Harness 安装或切换用户级组件时，应使用 `--harness`。自定义形式用于能够加载普通 Skill 目录的其他 Harness，也可用于已支持 Harness 的项目级 Skill 根目录。

### Bundle 与生命周期

在内嵌 bundle 中增加两份与 Harness 无关的 CLI Skill 载荷，每种语言一份。两者继续来自现有 `projects/tk/skills/tk-cli/` 和 `projects/tk/skills/tk-cli-zh/` 源码树，不包含 Harness manifest、适配器、注册、runtime 副本或源码树依赖。

清单现有的 `components` 集合继续只包含十六种 Harness 选择。新增独立的顶层 `cli_skills` 集合，以 `en` 和 `zh` 为键。每个条目记录语言、Skill 身份、`runtime_compat`、载荷路径和文件记录，不包含 Harness 字段。清单 schema 发生变化，因此实现时提升组件格式版本。

两份自定义载荷使用与 Harness 组件相同的确定性归档、路径校验、文件类型限制、权限、摘要、runtime 兼容范围和来源版本。自定义 install、update、no_change 和 uninstall 复用现有完整目标生命周期。dry-run 和执行共享预检与计划。执行时先暂存所选载荷，再重新检查两个已知 CLI 目标，随后按确定顺序提交。取消或错误会立即停止，结果报告已完成和未完成路径，不自动回滚，也不生成继续状态。GC 仍然只处理 tk 临时操作内容。

自定义根目录不执行 Harness 可用性和注册检查。固定 runtime 检查仍然适用，因为安装后的 CLI Skill 依赖公开用户级可执行文件。

text 和 JSON 结果必须且只能报告一个目标字段：现有形式使用 `harness`，自定义形式使用解析后的绝对 `skill_root`。自定义结果还报告 `mode: cli`、语言、Skill 身份、action、安装路径和删除路径。现有 Harness 结果继续保留当前字段及其含义。

### 决定替换

本提案与[分发可选择的 tk Harness 组件](../decision/2026-09-02-distribute-selectable-tk-harness-components.zh.md)冲突。现行决定把 bundle 固定为十六份 Harness 载荷，要求公开生命周期必须选择 Harness，并把计划范围限制在固定 Harness 目标。

本提案被接受并实现后，将反转该决定。替代决定必须保留固定外部 runtime、仅由 Rust 组装、离线内嵌产物、确定性生命周期、不维护安装数据库、完整预检、部分提交报告，以及在各自生命周期所有权边界内清理已知目标等规则，并加入两份与 Harness 无关的 CLI Skill 载荷和显式自定义根目录生命周期。

实现时可以在纯 CLI 模式、Skill 语言选择和产品架构决定的 `Changes` 或 `变更` 部分加入不冲突的更新。公开中英文 CLI、安装、Harness、用户指南、验证和 Skill 文档必须描述同一份现行合同。

## 考虑过的替代方案

**继续手工复制自定义安装。** 这种做法不需要修改 runtime，但用户无法获得内嵌来源选择、摘要校验、dry-run、确定性更新、残留语言清理和有限范围的卸载行为。

**增加 `generic` Harness 值。** 通用目标没有 Harness 可执行文件、正式加载 API、固定路径或真实加载验证。它会误用 Harness 概念，而且仍然需要另一个目录参数。

**新增 `tk skill install` 和 `tk skill uninstall` 命令。** 这些命令可以表达相同行为，但会重复现有的选择、归档、dry-run、结果和失败合同。当前需求只是为现有安装生命周期增加第二种目标形式。

**把参数解释为最终 Skill 目录。** 用户需要自行追加或选择 `tk-cli` 和 `tk-cli-zh`。切换语言时还可能把不同 Skill 身份覆盖到同一路径。Skill 根目录可以保留稳定名称，并把清理限制在已知子目录。

## 验收标准

1. `tk install` 和 `tk uninstall` 必须且只能提供 `--harness` 与 `--skill-root` 中的一个。
2. 自定义 install 只接受明确的 CLI 模式，保留英文默认语言，并拒绝 tools 模式。
3. 相对和绝对 Skill 根目录都会解析为结果中报告的绝对路径。install 会在写入所选 `tk-cli` 或 `tk-cli-zh` 子目录前创建缺失的父目录。
4. 自定义安装不执行 Harness 可用性、正式 API、配置、extension 或操作注册处理。
5. 重复执行相同的自定义安装返回 `no_change`。语言或载荷内容变化时返回 `updated`，完整替换所选目标，并删除该根目录下另一个已知 CLI Skill 目标。
6. 自定义卸载删除所给根目录下的 `tk-cli` 和 `tk-cli-zh`，保留 `tk` 与 `tk-zh` tools Skill、其他全部条目和根目录本身。两个 CLI 目标均不存在时返回 `no_change`。
7. 内嵌归档和清单在 `components` 中保留现有十六个条目，并在独立的 `cli_skills` 集合中增加两个与 Harness 无关的条目。新增条目不含 Harness 字段，组件格式版本随之提升。重复构建仍然逐字节一致，并在写入前拒绝无效载荷元数据或路径。
8. 自定义 dry-run 和执行共享同一套预检与计划。取消和注入故障继续遵守现有的已完成与未完成项目合同，GC 只删除已登记的临时内容。
9. text 和 JSON 结果必须且只能包含 `harness` 与 `skill_root` 中的一个。自定义结果包含解析后的根目录、CLI 模式、语言、Skill、action、安装路径和删除路径。
10. 现有十六种选择的 Harness 安装、更新、切换、卸载和真实加载验证保持不变。
11. 实现时替换冲突的分发决定，并在同一变更中更新受影响的中英文公开文档和 CLI Skill。

## 风险

Skill 根目录输入错误时，可能替换或删除其中已有的 `tk-cli` 或 `tk-cli-zh` 目录。dry-run 和完整路径报告可以减少误操作，但生命周期会有意把这两个名称完全匹配的子目录视为 tk CLI 目标。

Harness 可能忽略所给根目录，或者要求 manifest 或 Package 包装。命令可能成功，但 Harness 没有加载 Skill。文档和结果必须把自定义安装描述为文件安装，不能声称完成加载验证。

使用自定义根目录修改已有的正式 tools 模式安装时，不会移除 MCP 或原生操作注册。Harness 可能同时保留已注册操作和 CLI Skill。文档必须要求已支持 Harness 的用户级组件变更使用 `--harness`。
