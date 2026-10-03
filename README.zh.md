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
- **[well-said](./skills/well-said/SKILL.md)**：在撰写、编辑或审阅用户可见自然语言时应用，包括 Agent 之间的委派、交接和评审消息。综合清理文风、可见的写作会话残留和不必要的自我证明，同时保留原意、作者声音与字面材料。也支持显式调用。 [中文变体](./variants/zh/skills/well-said/SKILL.md)

### 拓展

为 Harness 增加或调整功能的独立插件与扩展。

**通用**

- **[tk](./projects/tk/README.zh.md)**：tk 是一个持久化任务管理工具，管理值得保留的临时项目努力。提供 `tk` CLI、MCP、Pi Package 等方式接入使用。`tk` 可在跨上下文压缩、跨会话以及跨 Agent 保存任务进度和共识。

**OMP**

- **[omp-status-bar](./projects/omp-status-bar/README.zh.md)**：OMP 状态栏拓展，提供额外的上下文信息显示，包括当前会话上下文（数值而非原生提供的百分比）、总 Token、输入 Token、缓存 Token、输出 Token、缓存命中率、已回答的模型请求次数和投机压缩指示。
- **[omp-codex-web-access](./projects/omp-codex-web-access/README.zh.md)**：让 OMP 支持通过转发 Provider 使用 Codex 订阅，接入网页搜索与页面提取工具。
- **[omp-system-prompt](./projects/omp-system-prompt/README.zh.md)**：将 OMP 默认系统提示词中的固定策略文本替换为维护的英文文本，同时保留动态运行时段落；识别失败时原样回退到宿主提示词。
- **[omp-context-pin](./projects/omp-context-pin/README.zh.md)**：让少量固定条目在当前会话分支的每次普通模型请求中原样出现，并在每次提交后的压缩之后恢复这些条目。
- **[omp-qol](./projects/omp-qol/README.zh.md)**：提供可独立开关的等待期限、模型错误后的受限续跑、实验性的压缩期限延长、原生历史重放，以及可选择启用的远端压缩缓存对齐。

## 安装

Skill 安装与下方的开发环境准备相互独立，不需要开发依赖或构建。拓展和 tk 运行时在各自目录中构建和安装，具体要求见各自的 README。

### 选择能力

| 需求 | 组件 |
| --- | --- |
| 代码与测试质量分析 | [code-quality](./skills/code-quality/SKILL.md) |
| Python 工程实践 | [python-engineering](./skills/python-engineering/SKILL.md) |
| `msgspec` 结构体、验证与序列化 | [msgspec](./skills/msgspec/SKILL.md) |
| 跨系统边界的架构判断 | [architect](./skills/architect/SKILL.md) |
| 采集并验证来源的研究 | [deep-research](./skills/deep-research/SKILL.md) |
| 通过分轮提问澄清需求 | [grill-me](./skills/grill-me/SKILL.md)，需显式调用 |
| 跨会话、跨 Agent 保存任务状态 | [tk](./projects/tk/README.zh.md)，附带独立运行时 |
| 调整 OMP 界面或行为 | 下方的 OMP 拓展 |

### 普通 Skill

普通 Skill 是一个包含 `SKILL.md` 的目录，需要时还包含自己的 references 和 workflow。安装会把整个目录复制到 Harness 加载 Skill 的根目录，例如 OMP 的用户级目录 `$HOME/.omp/agent/skills`。

语言选择、Skill 根目录，以及检查、安装、更新和卸载命令见 [安装 Skill](./docs/installation.zh.md)。同一批 Skill 的中文变体位于 `variants/zh/skills/`。

### 拓展

拓展各自提供安装与更新说明，请按组件 README 操作，根 README 不重复这些步骤。

- [tk](./projects/tk/README.zh.md) 是跨多个 Harness 提供组件的任务运行时。运行时与组件分别安装。
- [omp-status-bar](./projects/omp-status-bar/README.zh.md)、[omp-system-prompt](./projects/omp-system-prompt/README.zh.md)、[omp-codex-web-access](./projects/omp-codex-web-access/README.zh.md)、[omp-context-pin](./projects/omp-context-pin/README.zh.md) 和 [omp-qol](./projects/omp-qol/README.zh.md) 是 OMP 拓展。各自 README 说明宿主与配置要求。

## 开发

### Git

项目遵循 [Trunk-Based](https://trunkbaseddevelopment.com/) 开发模式。`main` 是唯一长期分支。所有工作都从当前 `main` 创建短期分支，使用英文 Conventional Commit 消息，并在明确授权后通过 squash merge 进入 `main`。

提交信息使用 Conventional Commits 类型，scope 可选。带 scope 的信息使用 `skills`、`extensions`、`adr`、`repo` 之一；跨越两个区域的改动不带 scope。

代码、配置、脚本、并行任务，以及无法确认独占主工作目录的任务，使用 `.worktrees/` 下的独立 worktree。只有主工作目录干净、没有并行工作且能够确认独占时，串行说明性 Markdown 或 ADR 任务才可以使用主工作目录。编辑前创建并切换到短期分支，任何任务都不直接在 `main` 上编辑或提交。

被测试读取的说明文档仍可以适用该目录例外，但必须运行消费者检查。运行时模板是源输入，不是说明文档。任务范围扩展到说明性 Markdown 之外或失去独占条件时，先停止共享目录编辑，并在继续前将已有工作保存在独立 worktree 中。

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

### 组件宿主维护

将代码加载进宿主进程的组件在自身 README 的兼容性小节声明维护下限，宿主 peer 声明只列出包名，提高下限只能通过独立决定。[宿主升级决定](./.agents/adr/decision/2026-09-28-adapt-components-to-host-upgrades.zh.md)记录完整规则。

### 检查前置条件

使用 [package.json](./package.json) 声明的 pnpm 版本、其支持的 Node.js 运行时和 Git。开发阶段只准备受影响检查选中的环境：

| 选中范围 | 需要准备的环境 |
| --- | --- |
| 说明性 Markdown 或 ADR 格式检查 | 上述根锁定依赖和 Git 钩子 |
| 单个 OMP 组件 | 根工具链、兼容其锁文件的 Bun，以及该组件目录内的 `bun install --frozen-lockfile` |
| tk | 根工具链、包含 `rustfmt` 且满足 [tk 构建前提](./projects/tk/README.zh.md)的 Rust、锁定 crate 依赖、Bun 和原生适配器测试所用系统工具 |
| Skill 生命周期 | 根工具链、Git、非 root 的 POSIX shell 环境、`diff` 和测试脚本使用的常见系统文件工具 |
| 完整检查或完整回退 | 上述全部环境，包括每个 OMP 组件的锁定依赖树 |

已知文档消费者追加所需环境，多范围取并集。这不改变工作目录规则。每个分支保留独立的可写依赖目录和构建目录。包管理器内容缓存可以在同一信任边界内复用；清单或锁文件改变后，重新准备对应环境。

完整验证时，安装每个 OMP 组件的锁定依赖：

```bash
(cd projects/omp-status-bar && bun install --frozen-lockfile)
(cd projects/omp-system-prompt && bun install --frozen-lockfile)
(cd projects/omp-codex-web-access && bun install --frozen-lockfile)
(cd projects/omp-context-pin && bun install --frozen-lockfile)
(cd projects/omp-qol && bun install --frozen-lockfile)
```

### 受影响检查

开发和请求审查前，在仓库根目录运行 `pnpm check:changed`。审查前提交任务改动并保持工作树干净。

默认基线是分支与本地 `main` 的 merge base。范围包含已提交、已暂存、未暂存、非忽略的未跟踪路径、删除路径和重命名两端。使用 `pnpm check:changed --base <ref>` 选择其他 ref 与 `HEAD` 的 merge base，不比较分支顶端。命令不 fetch 历史。

[选择器](./scripts/check-changed.mjs)维护显式映射：

| 变更范围 | 选中检查 |
| --- | --- |
| 已知说明性 Markdown，包括 ADR、根 README、Skill 和组件文档 | 对仍存在的变更文件运行 Prettier，保留仓库配置和忽略规则 |
| 已登记 OMP 组件的非 Markdown 文件，或其 `src/`、`test/` 下的 Markdown | 该组件的 `typecheck`、`test`，以及变更 Markdown 格式检查 |
| tk 非 Markdown 文件，或其 `skills/`、`claude/`、`pi/`、`omp/` 打包树中的 Markdown | Rust 格式与测试、原生适配器测试，以及变更 Markdown 格式检查 |
| [docs/installation.md](./docs/installation.md)、对应中文版，或 Skill 安装与生命周期脚本 | Skill 生命周期测试，以及变更 Markdown 格式检查 |
| 多个已知范围 | 检查并集，每项只执行一次 |
| 共享工具链或检查输入、选择器变更、未知路径，或不可靠的基线与分类 | 只运行一次完整 `pnpm check`，不先执行局部检查 |

消费者规则优先于普通 Markdown 规则。未知组件及其 Markdown 不按仅格式检查处理。新增组件、必需检查和文档消费者时，同步更新根聚合入口、显式映射及[选择测试](./scripts/tests/check-changed.test.mjs)。

输出列出基线和 merge base、路径来源、选中范围与命令、回退原因及失败位置。

缺失工具或选中范围的本地依赖时失败，不安装依赖，也不用全局 TypeScript 替代。缺少 Git、checkout 无效或 index 存在未解决冲突时直接失败。历史不足或无法可靠收集路径时触发完整回退。

删除说明性 Markdown 可以无需格式命令。空的受影响结果不是完整合并验证。

### 完整合并验证

所有审查修改完成后、合并前，验证最终候选：

1. 提交全部改动、保持工作树干净，并确认候选包含目标 `main`。
2. 运行 `pnpm check`，记录候选提交和 tree、目标 `main` 提交、命令及结果。
3. 执行已授权的 squash merge 前，确认目标未变化，并核对合并 tree 与验证 tree 一致。

新增受跟踪变更、待提交内容、候选变化或目标 `main` 前进，都使原成功结果失效。形成新的最终候选并重新完整验证。

完整入口保留下列检查顺序：

1. 通过 `pnpm check:base` 执行 Markdown 格式检查、tk Rust 格式检查和 Rust 测试。
2. [omp-status-bar](./projects/omp-status-bar/package.json) 的 TypeScript 检查和测试。
3. [omp-system-prompt](./projects/omp-system-prompt/package.json) 的 TypeScript 检查和测试。
4. [omp-codex-web-access](./projects/omp-codex-web-access/package.json) 的 TypeScript 检查和测试。
5. [omp-context-pin](./projects/omp-context-pin/package.json) 的 TypeScript 检查和测试。
6. [omp-qol](./projects/omp-qol/package.json) 的 TypeScript 检查和测试。
7. 通过 `bun test projects/tk/adapter-tests` 执行 tk 原生适配器测试。
8. 通过 `pnpm check:skills` 执行 `sh scripts/tests/skills.sh`，运行 Skill 生命周期测试。
9. 通过 `pnpm check:selector` 执行受影响选择器回归测试。

首次命令失败即停止执行，并返回非零状态。缺失可执行文件或依赖也会使检查失败。命令及组件输出可以定位失败步骤。检查不安装依赖或格式化源码；构建和测试可以创建自身正常使用的生成文件与临时文件。完整入口不调用受影响选择器，回退不会递归。

`pnpm check:base` 只覆盖 Markdown 与 Rust，适用于局部工作。组件检查也可通过各自已有脚本独立执行。自动化成功不能证明真实模型行为或交互界面正确性，仍须遵循相关组件的场景及发布验证要求。[仓库检查决定](./.agents/adr/decision/2026-09-30-scope-aware-repository-checks.zh.md)定义完整契约。

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
