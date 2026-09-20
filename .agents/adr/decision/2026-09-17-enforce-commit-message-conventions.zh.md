# ADR 决定：强制执行提交信息规范

Decision owner: Ruokee
Decision writer: deepseek/deepseek-v4.1-flash

[English](./2026-09-17-enforce-commit-message-conventions.md) | 中文

## 动机

仓库指引要求提交信息使用英文并遵循 Conventional Commits，类型、scope 和 header 形式由机制校验，而不是全凭作者记忆。pre-commit 钩子通过 Prettier 格式化暂存文件，`commit-msg` 阶段读取的则是提交信息本身。

仅靠作者记忆时，scope 使用并不一致：`skill` 与 `skills` 指向同一区域，还有若干组件名，以及 `package`、`ai`、`system-prompt` 这类一次性标签，同类改动在不同提交里用了不同 scope。scope 列表和校验机制需要一起引入：只有列表时，一旦出现看似合理的标签，列表就会失效；只有校验时，提交会被拒绝，但不会告诉作者哪些取值可用。

## 决定

### 校验位置

在现有 `simple-git-hooks` 配置中加入 `commit-msg` 条目，对提交信息文件运行 commitlint。根 `package.json` 的 `devDependencies` 中增加 `@commitlint/cli` 和 `@commitlint/config-conventional`，规则写在根目录的 `commitlint.config.mjs`。`pnpm hooks:install` 仍是唯一的安装步骤，已有的 checkout 需要重跑一次该命令才能启用新增的钩子阶段。

错误级别的违规会阻止提交。commitlint 打印违反的规则，打开信息文件的命令由钩子命令补上。警告只打印提示，提交照常进行；默认预设把 body 与 footer 前缺少空行归为警告，本决定保留这一级别。

提交被阻止时，信息文件保留原有内容，作者按原来的提交操作重试，因此被阻止的 `git commit --amend` 仍以 amend 方式重试，而不是新建提交。命令从 Git 取路径，因为 linked worktree 的信息文件位于主仓库的 `.git/worktrees/` 目录下。

commitlint 默认忽略的提交信息直接放行，范围包括 `v1.2.3` 这类版本消息、以 `fixup!` 或 `squash!` 开头的 subject，以及 Git 风格的 `Revert "..."` 和 `Merge ...`。Conventional Commits 形式的 `revert(unknown): undo the change` 不在忽略之列，仍要满足 scope 规则。

### 提交信息规则

类型沿用 `config-conventional` 接受的 Conventional Commits 集合：`build`、`chore`、`ci`、`docs`、`feat`、`fix`、`perf`、`refactor`、`revert`、`style`、`test`。仓库不缩减这份列表；选择一个贴合改动的类型是判断问题，不是格式规则。

scope 可选。提交信息带 scope 时，必须精确等于下表四个取值之一。跨越两个区域的改动不带 scope。

| scope | 覆盖范围 |
| --- | --- |
| `skills` | `skills/` 与 `variants/zh/skills/` 下的 Skill 内容 |
| `extensions` | `projects/` 下的组件 |
| `adr` | `.agents/adr/` 下的提案与决定 |
| `repo` | 根配置、钩子、依赖、仓库入口页，以及 `AGENTS.md` 这类流程文本 |

集合由 `commitlint.config.mjs` 中注册的一条本地规则做精确成员判断。内置的 `scope-enum` 无法单独承担这条策略：它会按 `/`、`\`、`,` 拆分 scope，`feat(skills/adr)`、`feat(skills,adr)`、`feat(skills\adr)` 都能通过，而内置规则里没有能表达 scope 命名约束的正则类规则。本地规则在一处拒绝未知取值、大写字母、连字符、下划线以及多区域 scope，并放行不带 scope 的提交信息，commitlint 将其 scope 解析为 `null`。

其余规则沿用 `config-conventional` 的默认值。这一选择还会引入 type 与 scope 策略之外的约束：subject 以大写字母开头或以句点结尾会被拒绝，body 与 footer 的每行长度上限为 100 字符。

### 文档

[AGENTS.md](../../../AGENTS.md)、[README.md](../../../README.md) 与 [README.zh.md](../../../README.zh.md) 的 Git 章节在现有 Conventional Commits 要求旁列出 scope 集合与 commit-msg 校验，钩子安装步骤覆盖两个钩子阶段。ADR 流程与变更流程不变。

## 考虑过的替代方案

- 迁移到 Python `pre-commit` 框架。选择钩子机制时考虑过这一方案。它用一套钩子管理器同时处理提交信息校验与通用文件检查，代价是给使用 pnpm、Rust、Bun 的仓库引入 Python 工具链，现有 Prettier 钩子要么改为 local hook，要么与第二套钩子管理器并存。
- 用仓库内维护的脚本校验提交信息。比较依赖时考虑过这一方案。它不新增软件包，但需要重新实现既有工具已经处理的提交信息形态：`fixup!`、`revert`、合并提交，以及 `feat!:` 之类的破坏性标记和多行正文。
- 为每个 Skill 和组件单独设置 scope。定义 scope 集合时考虑过这一方案。它能精确指出改动单元，但每新增一个 Skill 或组件都要改列表，遗漏时会阻止提交，直到有人更新配置。
- 继续依靠人工遵守。决定是否引入校验时考虑过这一方案。它不动工具链，也放任 scope 使用不一致继续存在。

## 结果

- 在托管平台上执行的 squash merge 不经过该校验，仓库也没有 CI 任务，因此被规则拒绝的提交信息仍能进入历史。历史中的 scope 依旧无法用于可靠检索。
- scope 描述的是仓库区域，不指向单个组件。校验只读取提交信息，无法判断所选 scope 是否与本次改动涉及的文件相符，因此不同作者仍可能把同一条跨越两个区域的改动归入不同区域。
- 找不到合适 scope 的作者可能选择一个无关的 scope，留下通过校验、却指向错误区域的提交信息。绕过钩子则让规则对该作者完全失效。
- 校验不在根 pnpm 工程之外新增依赖，`pnpm check` 不受影响。
