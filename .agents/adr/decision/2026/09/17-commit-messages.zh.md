# 提交信息

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash

[English](./17-commit-messages.md) | 中文

## 动机

确定允许的提交 scope，并通过仓库 Git 钩子强制提交信息格式。

仓库 Git 提交的 scope 在仅靠作者记忆时使用并不一致：`skill` 与 `skills` 指向同一区域，还有若干组件名，以及 `package`、`ai`、`system-prompt` 这类一次性标签，同类改动在不同提交里用了不同 scope。scope 列表和校验机制需要一起引入。只有列表时，一旦出现看似合理的标签，列表就会失效；只有校验时，提交会被拒绝，但不会告诉作者哪些取值可用。

仓库指引要求提交信息使用英文并遵循 Conventional Commits，类型、scope 和 header 形式由机制校验，而不是全凭作者记忆。pre-commit 钩子通过 Prettier 格式化暂存文件，`commit-msg` 阶段读取的则是提交信息本身。

## 决定

类型沿用 `config-conventional` 接受的 Conventional Commits 集合，仓库不缩减这份列表；选择一个贴合改动的类型是判断问题。scope 可选：提交信息带 scope 时必须精确等于 `skills`、`extensions`、`adr` 或 `repo` 之一，跨越两个区域的改动不带 scope。

[仓库规格](../../../../spec/repository.zh.md)陈述 scope 集合与 commit-msg 校验，`commitlint.config.mjs` 记录本地规则与预设继承来的约束，[README.md](../../../../../README.md)、[README.zh.md](../../../../../README.zh.md)、`AGENTS.md` 与 [Git 规则](../../../../rule/git.zh.md)陈述提交信息要求。

## 考虑过的替代方案

- 迁移到 Python `pre-commit` 框架。它用一套钩子管理器同时处理提交信息校验与通用文件检查，代价是给使用 pnpm、Rust、Bun 的仓库引入 Python 工具链，现有 Prettier 钩子要么改为 local hook，要么与第二套钩子管理器并存。
- 用仓库内维护的脚本校验提交信息。它不新增软件包，但需要重新实现既有工具已经处理的提交信息形态：`fixup!`、`revert`、合并提交，以及 `feat!:` 之类的破坏性标记和多行正文。

## 结果

- 在托管平台上执行的 squash merge 不经过该校验，仓库也没有 CI 任务，因此被规则拒绝的提交信息仍能进入历史。历史中的 scope 依旧无法用于可靠检索。
- scope 描述的是仓库区域，不指向单个组件。校验只读取提交信息，无法判断所选 scope 是否与本次改动涉及的文件相符，因此不同作者仍可能把同一条跨越两个区域的改动归入不同区域。
- 校验不在根 pnpm 工程之外新增依赖，`pnpm check` 不受影响。
