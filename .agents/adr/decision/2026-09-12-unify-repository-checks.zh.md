# ADR 决定：统一仓库检查入口

Decision owner: Ruokee
Decision writer: OMP GPT-6 Astra

[English](./2026-09-12-unify-repository-checks.md) | 中文

## 动机

仓库验证涉及 Markdown 格式、tk Rust 代码、各个独立打包的 OMP 拓展，以及 tk 原生适配器。根 [package.json](../../../package.json) 与组件脚本需要一个完整入口，使仓库检查成功能够覆盖全部已有自动化检查。

仅执行 Markdown 与 Rust 检查，无法发现 TypeScript 拓展或原生适配器的失败。明确列出组件目标并可靠地传递失败，为开发者提供一致的完整检查。

## 决定

### 入口与覆盖范围

仓库根目录的 `pnpm check` 是完整自动化检查入口。`pnpm check:base` 提供 Markdown 与 Rust 检查序列，用于局部工作。完整入口仅执行一次基础序列，然后按下列顺序运行组件检查：

| 顺序 | 范围 | 命令 |
| --- | --- | --- |
| 1 | 仓库基础检查 | 通过 `pnpm check:base` 依次执行 `pnpm docs:lint`、`pnpm cargo:fmt:check`、`pnpm cargo:test` |
| 2 | [projects/omp-status-bar/package.json](../../../projects/omp-status-bar/package.json) | 先执行 `pnpm --dir projects/omp-status-bar run typecheck`，再执行 `pnpm --dir projects/omp-status-bar run test` |
| 3 | [projects/omp-system-prompt/package.json](../../../projects/omp-system-prompt/package.json) | 先执行 `pnpm --dir projects/omp-system-prompt run typecheck`，再执行 `pnpm --dir projects/omp-system-prompt run test` |
| 4 | [projects/omp-codex-web-access/package.json](../../../projects/omp-codex-web-access/package.json) | 先执行 `pnpm --dir projects/omp-codex-web-access run typecheck`，再执行 `pnpm --dir projects/omp-codex-web-access run test` |
| 5 | [projects/omp-context-pin/package.json](../../../projects/omp-context-pin/package.json) | 先执行 `pnpm --dir projects/omp-context-pin run typecheck`，再执行 `pnpm --dir projects/omp-context-pin run test` |
| 6 | [projects/tk/adapter-tests/common.test.ts](../../../projects/tk/adapter-tests/common.test.ts) | `bun test projects/tk/adapter-tests` |
| 7 | [scripts/skills.sh](../../../scripts/skills.sh) | 通过 `pnpm check:skills` 执行 `sh scripts/tests/skills.sh` |

根包脚本明确列出命令，通过 `&&` 连接，并复用组件脚本执行局部检查。入口明确选择目标，不递归扫描整个仓库来发现测试。新增或调整组件必需的自动化检查时，同步更新根入口。

`pnpm check:base` 只报告所列基础范围。请求审查前必须执行的仓库检查为完整入口。自动化成功不能证明真实模型行为或交互界面正确性；组件特定的场景验证继续遵循已有要求。

### 前置条件与执行

使用根 `packageManager` 声明的 pnpm 版本、包含 `rustfmt` 且满足 tk 构建前提的 Rust 工具链，以及能够安装已提交组件锁文件并运行测试的 Bun。

依赖安装是显式步骤：在根目录运行 `pnpm install --frozen-lockfile`，在每个 OMP 组件目录中分别运行 `bun install --frozen-lockfile`。各组件保留独立依赖树。聚合入口不增加依赖安装或自动格式化源码步骤。构建和测试可以创建自身正常使用的生成文件与临时文件。

检查按顺序执行。输出每条命令及足以识别组件的上下文，保留子命令输出，并在首次失败时停止。任一检查失败、必需可执行文件缺失或依赖缺失，都使聚合入口以非零状态退出。前面的检查成功不能掩盖后续失败。

聚合入口执行已有自动化检查，不增加 CI 平台、覆盖率阈值、测试框架、模型服务调用或 Harness 安装操作。pre-commit 格式化钩子保持其职责。

### 文档

[README.md](../../../README.md)、[README.zh.md](../../../README.zh.md) 和 [AGENTS.md](../../../AGENTS.md) 区分完整检查与基础检查，并说明前置条件。组件文档须与聚合入口实际调用的命令保持一致。

本仓库验证政策与 [Markdown 格式化决定](./2026-09-02-format-markdown-with-prettier.md)互为补充。该决定规定的格式化工具及格式要求继续生效。

## 考虑过的替代方案

**保留基础入口，另行记录需要手动执行的完整命令序列。**这能让遗漏的检查可见，也允许开发者分别执行。但标准根入口成功仍不足以证明完整自动化覆盖，每个调用者都必须记住额外的命令序列。

## 结果

一个根命令即可报告全部必需的自动化检查是否通过。检查成功时，受 Git 管理的源码及配置文件保持不变；构建和测试可以创建自身正常使用的生成文件与临时文件。

完整检查需要每个组件的依赖树，耗时也高于基础检查。即使只修改文档，缺失依赖或组件 fixture 失败也可能阻塞交付。明确的准备说明和基础入口支持局部诊断，请求审查前仍须执行完整检查。

## 变更

### 2026-09-15：纳入 omp-context-pin 组件检查

聚合入口增加 `pnpm --dir projects/omp-context-pin run typecheck` 与 `run test`，排在原生 tk 适配器之前，适配器顺延为第 6 项。覆盖表按执行顺序列出受检组件，正文不写死组件数量。

### 2026-09-20：纳入 Skill 生命周期测试

聚合入口在原生 tk 适配器之后增加第 7 项 `pnpm check:skills`，执行 `sh scripts/tests/skills.sh`。测试通过合成的 fixture 仓库检查 [scripts/skills.sh](../../../scripts/skills.sh) 的安装、更新与卸载命令，只需要 POSIX shell、`diff` 和常见系统文件工具，该步骤不安装任何依赖。测试还会检查拒绝边界与不可读目录树，后者报告为失败，而不是差异或一致。
