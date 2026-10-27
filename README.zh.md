# Ruokee Agent Kit

[English](./README.md) | 中文

我每天都会使用这些 Agent Skill 和扩展，进行真正的工程开发，管理个人笔记等等。

我在不同 Agent Harness 中反复遇到同一类问题。有些问题适合写成 Skill，有些则需要更复杂的扩展来实现。

Ruokee Agent Kit 只收录我为自己开发、也愿意公开维护的能力。每项能力都应该有明确的用途、读得懂的文档，以及真实的验证路径。

## 我使用什么 Harness

我目前主要使用 OMP（Oh My Pi），并使用了一套很精简的配置。原因是我希望 Harness 能够使用绝大多数模型提供商所提供的模型服务，而不是局限于某些特定的模型；我希望 Harness 有强大的拓展性，界面足够美观，也希望日常开发中常用的功能随手可用。OMP 自带很多开箱即用的功能，可以理解为预装了大量功能的 Pi。关掉大量不需要的功能后，它已经挺好用。当然，OMP 也有自己的限制，如果未来有更好的 Harness 可能也会考虑更换。

我也使用 Pi、Claude Code 和 Codex。

## 功能列表

### Skills

以下是我用于日常工作的 Skill。

**由用户触发的**

- **[grill-me](./skills/grill-me/SKILL.md)**：通过证据优先的分轮提问，将不完整想法或已有方案收敛为共同理解和可行动规格，并维护长期记录和全局问题编号，核验需求、偏好和假设。使用 `/skill:grill-me` 显式调用；普通规划和审查请求不会自动启用。 [中文变体](./variants/zh/skills/grill-me/SKILL.md)
- **[workloop](./projects/workloop/README.zh.md)**：引导新 tk Task 完成目标澄清、规划、执行、独立核验及项目定义的交付。安装一套完整的 `workloop` 或 `workloop-zh` Skill，即可以自然语言跨 Harness 使用；OMP 另通过文件直装接收五个同语言 `/wl-*` Prompt 模板。

**由 Agent 触发的**

- **[architect](./skills/architect/SKILL.md)**：覆盖系统级架构分析、设计、审查、技术选型与演进。遇到跨越模块或服务边界、需要明确取舍的系统级决策时使用。它提供架构判断依据、常见取舍和例子。 [中文变体](./variants/zh/skills/architect/SKILL.md)
- **[code-quality](./skills/code-quality/SKILL.md)**：涵盖代码与测试质量、设计取舍和重构机会，支持快速审查、完整审查和探索性分析。 [中文变体](./variants/zh/skills/code-quality/SKILL.md)
- **[python-engineering](./skills/python-engineering/SKILL.md)**：涵盖 Python 项目结构、版本与依赖策略、类型注解、测试、标准库选择、工具链和 Python 专项代码审查。 [中文变体](./variants/zh/skills/python-engineering/SKILL.md)
- **[msgspec](./skills/msgspec/SKILL.md)**：使用 `msgspec` 进行结构体定义、类型验证、序列化与反序列化。 [中文变体](./variants/zh/skills/msgspec/SKILL.md)
- **[deep-research](./skills/deep-research/SKILL.md)**：指导结构化、证据优先的研究，涵盖广泛探索、定向研究、来源验证和综合分析，包括来源采集、论断分类、未解决问题记录和子 Agent 并行研究，默认产出报告及支撑文档。 [中文变体](./variants/zh/skills/deep-research/SKILL.md)
- **[well-said](./skills/well-said/SKILL.md)**：输出任何内容时使用，包括回复、文档、代码注释和 Agent 交流。涵盖文风模式、防御性表述、编写会话残留、文章写作和作者声音。防御性表述规则区分文字问题与需要补做或返工的工作。受 [Lauren Tan](https://github.com/poteto) 的 [unslop](https://github.com/cursor/plugins/blob/main/pstack/skills/unslop/SKILL.md) 启发。 [中文变体](./variants/zh/skills/well-said/SKILL.md)

### 扩展

为 Harness 增加或调整功能的独立插件与扩展。

**通用**

- **[tk](./projects/tk/README.zh.md)**：tk 是一个持久化任务管理 CLI，管理值得保留的临时项目努力。英文和中文 Skill 指导 Agent 使用公开 `tk` 命令。`tk` 可在跨上下文压缩、跨会话以及跨 Agent 保存任务进度和共识。

**OMP**

- **[omp-status-bar](./projects/omp-status-bar/README.zh.md)**：OMP 状态栏扩展，提供额外的上下文信息显示，包括当前会话上下文（数值而非原生提供的百分比）、总 Token、输入 Token、缓存 Token、输出 Token、缓存命中率和已回答的模型请求次数。
- **[omp-qol](./projects/omp-qol/README.zh.md)**：提供可独立开关的等待期限、模型错误后的受限续跑、实验性的压缩期限延长、原生历史重放、任务参数清理和复制最后回复。
- **[omp-smart-context](./projects/omp-smart-context/README.zh.md)**：提供远端及 Handoff 请求对齐、压缩请求用量补记、可选模型提示词规则和可选 Pin，各自拥有独立开关和状态。

## 安装

Skill 安装与下方的开发环境准备相互独立。普通 Skill 见[安装 Skill](./docs/installation.zh.md)。

以独立项目形式维护的组件，其构建和安装要求见各自的 README。tk 运行时与 CLI Skill 分别安装。

## 参与贡献

报告问题、提出建议或贡献文档与代码，请阅读[贡献指南](./CONTRIBUTING.zh.md)。

发现疑似漏洞时，请按[安全策略](./SECURITY.zh.md#报告漏洞)私密报告，不要在公开 Issue 或 PR 中披露细节。

参与项目交流须遵守[社区行为准则](./CODE_OF_CONDUCT.zh.md)。行为问题请通过准则中的私密渠道报告。

## 开发

### 文档分层

长期仓库决定通过双语 [ADRs](./.agents/adr/README.zh.md) 记录。双语[规格](./.agents/spec/README.zh.md)完整说明组件或仓库领域的目标要求和可观察结果，独立于实现及其说明资料。索引提供语言、主题和决定导航，规格正文不含仓库文件链接。双语[规则层](./.agents/rule/README.zh.md)说明在这个仓库里工作要怎么做：贡献者或 Agent 必须做什么、按什么顺序、持哪项授权，以及什么被禁止。这些工作使用的共享用词由双语[词典](./docs/dictionary/README.zh.md)定义。

内部 [maintain-spec](./.agents/skills/maintain-spec/SKILL.md) 和 [maintain-adr](./.agents/skills/maintain-adr/SKILL.md) Skill 持有主要维护方法。维护或审查对应文档前加载适用 Skill，也覆盖影响长期目标或持久选择的功能工作。各层 README 保留项目补充和导航。

[开发规则](./.agents/rule/development.zh.md)说明规划改动、准备环境、运行检查和合并门禁。

### Git

项目遵循 [Trunk-Based](https://trunkbaseddevelopment.com/) 开发模式。`main` 是唯一长期分支，工作从当前 `main` 创建短期分支，或在已授权依赖开发中使用已验证前置候选。明确授权后分别通过 squash merge 集成。提交信息使用英文 Conventional Commits。[Git 规则](./.agents/rule/git.zh.md)说明分支、工作目录、提交、scope 以及每个动作需要的授权。

开始开发之前，先确保安装了 Git 钩子：

```bash
pnpm install --frozen-lockfile
pnpm hooks:install
```

钩子在每次提交前格式化暂存文件，并校验提交信息。信息不符合类型或 scope 规则时会阻止提交，并打印违反的规则。

### 仓库布局

公开英文 Skill 位于 `skills/<name>/`，中文 variant 位于 `variants/zh/skills/<name>/`。内部英文维护 Skill 位于 `.agents/skills/`，不是公开安装源。Plugin、Extension、可执行程序和 Harness Package 使用对应 Harness 或构建系统预期的布局。

[仓库规格](./.agents/spec/repository.zh.md)持有仓库约定、文档配对和内部维护 Skill，[Skill 规格](./.agents/spec/skills.zh.md)覆盖公开分发的普通 Skill。

### 组件宿主维护

将代码加载进宿主进程的组件在自身 README 的兼容性小节声明维护下限，宿主 peer 声明只列出包名，提高下限只能通过独立决定。面向 OMP 的组件共用一个下限。[宿主维护决定](./.agents/adr/decision/2026/09/28-host-maintenance.zh.md)记录完整规则。

### 检查前置条件

使用 [package.json](./package.json) 声明的 pnpm 版本、其支持的 Node.js 运行时和 Git，按上文准备根锁定依赖及钩子。开发阶段只准备[检查选择规则](./.agents/rule/development.zh.md#检查)选中检查需要的环境，包括文档消费者；多个范围取并集。

有独立开发环境的组件在[功能列表](#功能列表)链接的 README 或其验证指南中提供精确的锁定准备与检查命令，按这些命令准备并检查。完整验证或完整回退需要[选择器](./scripts/check-changed.mjs)登记的全部环境，不只准备修改的组件。

仓库负责的 Skill 生命周期检查需要非 root 的 POSIX shell 环境、Git、`diff` 及[生命周期脚本](./scripts/tests/skills.sh)使用的系统文件工具。共享 Markdown 和选择器检查使用根工具。依赖安装与检查分开。

### 完整合并验证

合并前需要在干净、已提交且包含目标 `main` 的最终候选上运行完整 `pnpm check`，并记录结果。[合并门禁规则](./.agents/rule/development.zh.md#合并门禁)说明记录内容和使记录失效的情况；执行已授权的 squash merge 时使用未变化的目标和已验证的 tree。

完整命令执行 `node scripts/check-changed.mjs --complete`，不收集变更路径。[选择器](./scripts/check-changed.mjs)持有有序的完整检查列表与显式消费者映射。执行首条命令前核对全部选中工具和本地输入，首次失败即停止并返回非零状态。检查不安装依赖，也不改写源码。

[仓库检查决定](./.agents/adr/decision/2026/09/12-repository-checks.zh.md)定义完整契约。

### 常用命令

```bash
# 开发与审查前运行受影响检查
pnpm check:changed
pnpm check:changed --base <ref>

# 在仓库根目录运行完整自动化检查
pnpm check

# 仅运行 Markdown 与 Rust 基础检查
pnpm check:base

# 仅运行受影响选择器回归测试
pnpm check:selector

# 仅运行 Skill 生命周期测试
pnpm check:skills

# 格式化或检查全部 Markdown 文件
pnpm docs:format
pnpm docs:lint

# 将指定文件直接传给 Prettier
pnpm exec prettier --write [files]
pnpm exec prettier --check [files]
```

## 许可证

Ruokee Agent Kit 使用 [MIT License](./LICENSE)，但[社区行为准则](./CODE_OF_CONDUCT.zh.md#来源)除外。准则改编自 Contributor Covenant 3.0，以 [CC BY-SA 4.0](https://creativecommons.org/licenses/by-sa/4.0/) 授权。
