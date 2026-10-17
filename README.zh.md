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

- **[tk](./projects/tk/README.zh.md)**：tk 是一个持久化任务管理工具，管理值得保留的临时项目努力。提供 `tk` CLI、MCP、Pi Package 等方式接入使用。`tk` 可在跨上下文压缩、跨会话以及跨 Agent 保存任务进度和共识。

**OMP**

- **[omp-status-bar](./projects/omp-status-bar/README.zh.md)**：OMP 状态栏扩展，提供额外的上下文信息显示，包括当前会话上下文（数值而非原生提供的百分比）、总 Token、输入 Token、缓存 Token、输出 Token、缓存命中率和已回答的模型请求次数。
- **[omp-context-pin](./projects/omp-context-pin/README.zh.md)**：让少量固定条目在当前会话分支的每次普通模型请求中原样出现，并在每次提交后的压缩之后恢复这些条目。
- **[omp-qol](./projects/omp-qol/README.zh.md)**：提供可独立开关的等待期限、模型错误后的受限续跑、实验性的压缩期限延长、压缩请求用量补记、原生历史重放、任务参数清理，以及可选择启用的模型提示词规则。
- **[omp-smart-cache](./projects/omp-smart-cache/README.zh.md)**：使用同一会话已发送的普通请求，对齐原生远端压缩中经过证明的共同内容。默认关闭，覆盖主会话及原生子会话，不把客户端对齐视为 Provider 缓存收益。

## 安装

Skill 安装与下方的开发环境准备相互独立。语言选择、Skill 根目录，以及检查、安装、更新和卸载命令见[安装 Skill](./docs/installation.zh.md)。

扩展和 tk 运行时在各自目录中构建和安装，具体要求见各自的 README。tk 运行时与各 Harness 的接入组件分别安装。

## 开发

### 文档分层

长期仓库决定通过双语 [ADRs](./.agents/adr/README.zh.md) 记录。双语[规格](./.agents/spec/README.zh.md)说明每个组件和仓库领域的当前目标，并链接到拥有细节的决定和文档。双语[规则层](./.agents/rule/README.zh.md)说明在这个仓库里工作要怎么做：贡献者或 Agent 必须做什么、按什么顺序、持哪项授权，以及什么被禁止。这些工作使用的共享用词由双语[词典](./docs/dictionary/README.zh.md)定义。

[开发规则](./.agents/rule/development.zh.md)说明规划改动、准备环境、运行检查和合并门禁。

### Git

项目遵循 [Trunk-Based](https://trunkbaseddevelopment.com/) 开发模式。`main` 是唯一长期分支，工作从当前 `main` 创建的短期分支开始，并在明确授权后通过 squash merge 集成。提交信息使用英文 Conventional Commits。[Git 规则](./.agents/rule/git.zh.md)说明分支、工作目录、提交、scope 以及每个动作需要的授权。

开始开发之前，先确保安装了 Git 钩子：

```bash
pnpm install --frozen-lockfile
pnpm hooks:install
```

钩子在每次提交前格式化暂存文件，并校验提交信息。信息不符合类型或 scope 规则时会阻止提交，并打印违反的规则。

### 仓库布局

英文 Skill 位于 `skills/<name>/`，中文 variant 位于 `variants/zh/skills/<name>/`。Plugin、Extension、可执行程序和 Harness Package 使用对应 Harness 或构建系统预期的布局。

布局规则和文档配对由[仓库规格](./.agents/spec/repository.zh.md)持有，Skill 自身包含什么由 [Skill 规格](./.agents/spec/skills.zh.md)持有。

### 组件宿主维护

将代码加载进宿主进程的组件在自身 README 的兼容性小节声明维护下限，宿主 peer 声明只列出包名，提高下限只能通过独立决定。面向 OMP 的组件共用一个下限。[宿主维护决定](./.agents/adr/decision/2026/09/28-host-maintenance.zh.md)记录完整规则。

### 检查前置条件

使用 [package.json](./package.json) 声明的 pnpm 版本、其支持的 Node.js 运行时和 Git。[检查选择规则](./.agents/rule/development.zh.md#检查)定义一次改动会选中哪些检查。开发阶段只准备这些检查需要的环境：

- 说明性 Markdown 或 ADR 格式检查需要上述根锁定依赖和 Git 钩子。
- 单个 OMP 组件需要根工具链、兼容其锁文件的 Bun，以及该组件目录内的 `bun install --frozen-lockfile`。
- tk 需要根工具链、包含 `rustfmt` 的 Rust、锁定 crate 依赖、Bun 和原生适配器测试所用系统工具。[tk 用户指南](./projects/tk/docs/guide.zh.md#安装运行时)说明运行时源码构建。
- Skill 生命周期工作需要根工具链、Git、非 root 的 POSIX shell 环境、`diff` 和测试脚本使用的常见系统文件工具。
- 完整检查或完整回退需要上述全部环境，包括每个 OMP 组件的锁定依赖树。

已知文档消费者追加所需环境，多范围取并集。

完整验证时，安装每个 OMP 组件的锁定依赖：

```bash
(cd projects/omp-status-bar && bun install --frozen-lockfile)
(cd projects/omp-context-pin && bun install --frozen-lockfile)
(cd projects/omp-qol && bun install --frozen-lockfile)
(cd projects/omp-smart-cache && bun install --frozen-lockfile)
```

### 完整合并验证

合并前需要在干净、已提交且包含目标 `main` 的最终候选上运行完整 `pnpm check`，并记录结果。[合并门禁规则](./.agents/rule/development.zh.md#合并门禁)说明记录内容和使记录失效的情况；执行已授权的 squash merge 时使用未变化的目标和已验证的 tree。

完整入口执行选择器中的完整检查列表，即 `node scripts/check-changed.mjs --complete`，不收集变更路径。检查顺序如下：

1. Markdown 格式检查、tk Rust 格式检查和 Rust 测试，与 `pnpm check:base` 的序列相同。
2. [omp-status-bar](./projects/omp-status-bar/package.json) 的 TypeScript 检查和测试。
3. [omp-context-pin](./projects/omp-context-pin/package.json) 的 TypeScript 检查和测试。
4. [omp-qol](./projects/omp-qol/package.json) 的 TypeScript 检查和测试。
5. [omp-smart-cache](./projects/omp-smart-cache/package.json) 的 TypeScript 检查和测试。
6. 通过 `bun test projects/tk/adapter-tests` 执行 tk 原生适配器测试。
7. 通过 `pnpm check:skills` 执行 `sh scripts/tests/skills.sh`，运行 Skill 生命周期测试。
8. 通过 `pnpm check:selector` 执行受影响选择器回归测试。

完整入口在执行第一条命令前核对所列的全部工具和本地输入，首次命令失败即停止执行并返回非零状态。

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

Ruokee Agent Kit 使用 [MIT License](./LICENSE)。
