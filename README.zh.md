# Ruokee Agent Kit

[English](./README.md) | 中文

我每天都会使用这些 Agent Skill 和拓展，进行真正的工程开发，管理个人笔记等等。

我在不同 Agent Harness 中反复遇到同一类问题。有些问题适合写成 Skill，有些则需要更复杂的拓展来实现。

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

### 拓展

为 Harness 增加或调整功能的独立插件与扩展。

**通用**

- **[tk](./projects/tk/README.zh.md)**：tk 是一个持久化任务管理工具，管理值得保留的临时项目努力。提供 `tk` CLI、MCP、Pi Package 等方式接入使用。`tk` 可在跨上下文压缩、跨会话以及跨 Agent 保存任务进度和共识。

**OMP**

- **[omp-status-bar](./projects/omp-status-bar/README.zh.md)**：OMP 状态栏拓展，提供额外的上下文信息显示，包括当前会话上下文（数值而非原生提供的百分比）、总 Token、输入 Token、缓存 Token、输出 Token、缓存命中率和投机压缩指示。
- **[omp-codex-web-access](./projects/omp-codex-web-access/README.zh.md)**：让 OMP 支持通过转发 Provider 使用 Codex 订阅，接入网页搜索与页面提取工具。
- **[omp-system-prompt](./projects/omp-system-prompt/README.zh.md)**：将 OMP 默认系统提示词中的固定策略文本替换为维护的英文文本，同时保留动态运行时段落；识别失败时原样回退到宿主提示词。
- **[omp-context-pin](./projects/omp-context-pin/README.zh.md)**：让少量固定条目在当前会话分支的每次普通模型请求中原样出现，并在每次提交后的压缩之后恢复这些条目。

## 开发

### Git

项目遵循 [Trunk-Based](https://trunkbaseddevelopment.com/) 开发模式。`main` 是唯一长期分支。所有工作都从当前 `main` 创建短期分支，使用英文 Conventional Commit 消息，并在明确授权后通过 squash merge 进入 `main`。

提交信息使用 Conventional Commits 类型，scope 可选。带 scope 的信息使用 `skills`、`extensions`、`adr`、`repo` 之一；跨越两个区域的改动不带 scope。

开始开发之前，先确保安装了 Git 钩子：

```bash
pnpm install --frozen-lockfile
pnpm hooks:install
```

钩子在每次提交前格式化暂存文件，并校验提交信息。信息不符合类型或 scope 规则时会阻止提交，并打印违反的规则。

### 仓库布局

英文 Skill 位于 `skills/<name>/`，中文 variant 位于 `variants/zh/skills/<name>/`，但安装后仍使用宿主的正常路径 `skills/<name>/`。纯 Skill 只包含发现、理解和使用该 Skill 所需的材料。

Plugin、Extension、可执行程序和 Harness Package 使用对应 Harness 或构建系统预期的布局。只有真实组件需要时，仓库才增加新的顶层区域。

普通公开文档采用同目录的 `name.md` 和 `name.zh.md` 配对。仓库和组件入口页使用 `README.md` 和 `README.zh.md`。

长期仓库决定通过双语 [ADRs](./.agents/adr/README.zh.md) 记录。

### 检查前置条件

使用 [package.json](./package.json) 声明的 pnpm 版本、包含 `rustfmt` 且满足 [tk 构建前提](./projects/tk/README.zh.md)的 Rust 工具链，以及兼容组件锁文件的 Bun。完成上述根依赖与钩子安装后，分别安装 OMP 组件的锁定依赖：

```bash
(cd projects/omp-status-bar && bun install --frozen-lockfile)
(cd projects/omp-system-prompt && bun install --frozen-lockfile)
(cd projects/omp-codex-web-access && bun install --frozen-lockfile)
(cd projects/omp-context-pin && bun install --frozen-lockfile)
```

### 检查范围

请求审查前，在仓库根目录运行 `pnpm check`。该命令依次执行：

1. 通过 `pnpm check:base` 执行 Markdown 格式检查、tk Rust 格式检查和 Rust 测试。
2. [omp-status-bar](./projects/omp-status-bar/package.json) 的 TypeScript 检查和测试。
3. [omp-system-prompt](./projects/omp-system-prompt/package.json) 的 TypeScript 检查和测试。
4. [omp-codex-web-access](./projects/omp-codex-web-access/package.json) 的 TypeScript 检查和测试。
5. [omp-context-pin](./projects/omp-context-pin/package.json) 的 TypeScript 检查和测试。
6. 通过 `bun test projects/tk/adapter-tests` 执行 tk 原生适配器测试。

首次命令失败即停止执行，并返回非零状态。缺失可执行文件或依赖也会使检查失败。命令及组件输出可以定位失败步骤。检查不安装依赖或格式化源码；构建和测试可以创建自身正常使用的生成文件与临时文件。

`pnpm check:base` 只覆盖 Markdown 与 Rust，适用于局部工作。组件检查也可通过各自已有脚本独立执行。自动化成功不能证明真实模型行为或交互界面正确性，仍须遵循相关组件的场景及发布验证要求。[仓库检查决定](./.agents/adr/decision/2026-09-12-unify-repository-checks.zh.md)定义完整契约。

### 常用命令

```bash
# 在仓库根目录运行完整自动化检查
pnpm check

# 仅运行 Markdown 与 Rust 基础检查
pnpm check:base

# 格式化或检查全部 Markdown 文件
pnpm docs:format
pnpm docs:lint

# 将指定文件直接传给 Prettier
pnpm exec prettier --write [files]
pnpm exec prettier --check [files]
```

## 许可证

Ruokee Agent Kit 使用 [MIT License](./LICENSE)。
