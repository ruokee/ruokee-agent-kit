# ADR 提案：统一仓库检查入口

Decision owner: Ruokee
Draft writer: OMP GPT-6 Astra

[English](./2026-09-12-unify-repository-checks.md) | 中文

## 动机

根 [package.json](../../../package.json) 中的 `pnpm check` 只执行 Markdown 格式检查、tk Rust 格式检查和 Rust 测试。三个 OMP 拓展分别拥有 TypeScript 检查和测试，tk 也有 Cargo 不会执行的原生适配器测试。因此，根检查成功不能证明仓库已有的自动化检查全部通过。

开发者需要一个完整的自动化入口，命令来源可见，失败能可靠地向上传递。组件检查已经存在，缺少的是将它们接入仓库流程。

## 提议

### 入口与覆盖范围

将仓库根目录的 `pnpm check` 作为完整自动化检查入口。保留当前 Markdown 与 Rust 检查序列，命名为 `pnpm check:base`，用于局部工作。完整入口仅执行一次基础序列，然后按下列顺序运行组件检查：

| 顺序 | 范围 | 命令 |
| --- | --- | --- |
| 1 | 仓库基础检查 | 通过 `pnpm check:base` 依次执行 `pnpm docs:lint`、`pnpm cargo:fmt:check`、`pnpm cargo:test` |
| 2 | [projects/omp-status-bar/package.json](../../../projects/omp-status-bar/package.json) | 先执行 `pnpm --dir projects/omp-status-bar run typecheck`，再执行 `pnpm --dir projects/omp-status-bar run test` |
| 3 | [projects/omp-system-prompt/package.json](../../../projects/omp-system-prompt/package.json) | 先执行 `pnpm --dir projects/omp-system-prompt run typecheck`，再执行 `pnpm --dir projects/omp-system-prompt run test` |
| 4 | [projects/omp-codex-web-access/package.json](../../../projects/omp-codex-web-access/package.json) | 先执行 `pnpm --dir projects/omp-codex-web-access run typecheck`，再执行 `pnpm --dir projects/omp-codex-web-access run test` |
| 5 | [projects/tk/adapter-tests/common.test.ts](../../../projects/tk/adapter-tests/common.test.ts) | `bun test projects/tk/adapter-tests` |

在根包脚本中明确列出命令，组件脚本继续定义各自的局部检查。聚合入口明确选择这些目标，不递归扫描整个仓库来发现测试。新增或调整组件必需的自动化检查时，同步更新根入口。

`pnpm check:base` 只报告所列基础范围。请求审查前必须执行的仓库检查为完整入口。自动化成功不能证明真实模型行为或交互界面正确性；组件特定的场景验证继续遵循已有要求。

### 前置条件与执行

使用根 `packageManager` 声明的 pnpm 版本、包含 `rustfmt` 且满足 tk 构建前提的 Rust 工具链，以及能够安装已提交组件锁文件并运行测试的 Bun。

依赖安装是显式步骤：在根目录运行 `pnpm install --frozen-lockfile`，在三个 OMP 组件目录中分别运行 `bun install --frozen-lockfile`。各组件保留独立依赖树。聚合入口不增加依赖安装或自动格式化源码步骤。构建和测试可以创建自身正常使用的生成文件与临时文件。

检查按顺序执行。输出每条命令及足以识别组件的上下文，保留子命令输出，并在首次失败时停止。任一检查失败、必需可执行文件缺失或依赖缺失，都使聚合入口以非零状态退出。前面的检查成功不能掩盖后续失败。

本变更聚合已有自动化检查，不引入 CI 平台、覆盖率阈值、测试框架、模型服务调用或 Harness 安装操作。现有 pre-commit 格式化钩子保持其职责。

### 文档与决定归属

更新 [README.md](../../../README.md)、[README.zh.md](../../../README.zh.md) 和 [AGENTS.md](../../../AGENTS.md)，区分完整检查与基础检查，并说明前置条件。组件文档与聚合入口实际调用的命令保持一致。

本提案在 [Markdown 格式化决定](../decision/2026-09-02-format-markdown-with-prettier.md)之外增加仓库验证政策。该决定规定的格式化工具及格式要求继续生效，无需反转现有决定。

## 考虑过的替代方案

**保留基础入口，另行记录需要手动执行的完整命令序列。**这能让遗漏的检查可见，也允许开发者分别执行。但标准根入口成功仍不足以证明完整自动化覆盖，每个调用者都必须记住额外的命令序列。

## 验收标准

1. 在根目录调用一次 `pnpm check`，即可按约定顺序执行全部所列检查，且只有全部成功时才成功。`pnpm check:base` 保留 Markdown 与 Rust 检查序列，不声称覆盖组件检查。
2. 在具备所述前置条件时，完整检查成功运行，受 Git 管理的源码及配置文件保持不变。
3. 不修改产品源码，受控地让一个子命令失败，聚合入口必须非零退出且不启动后续检查。输出能够识别失败命令或组件。
4. 根脚本复用组件脚本和现有工具，不增加自动依赖安装、CI 平台、覆盖率阈值、测试框架、模型服务调用或 Harness 安装。
5. 仓库双语文档与 Agent 指令对完整范围、基础范围、准备步骤及失败行为的说明一致，并继续明确组件特定的场景验证要求。

## 风险

扩大的默认检查需要三个组件的依赖树，耗时也高于基础检查。即使只修改文档，缺失依赖或组件 fixture 失败也可能阻塞交付。明确的准备说明和基础入口支持局部诊断，请求审查前仍须执行完整检查。
