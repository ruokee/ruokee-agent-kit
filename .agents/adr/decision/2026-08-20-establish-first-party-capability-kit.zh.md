# ADR 决定：建立第一方 Agent 能力工具集

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

[English](./2026-08-20-establish-first-party-capability-kit.md) | 中文

## 动机

早期名称 `ruokee-skills` 只描述 Skill，但实际工作已经包含 Plugin、Package、Extension、可执行项目、安装器、宿主适配和验证支持。直接重命名旧仓库还会继承混合结构，以及不属于新公开项目的内容。

新仓库需要稳定的身份、所有权规则和内容模型，不能强迫每种 Agent 能力都伪装成 Skill。

## 决定

使用 `ruokee-agent-kit` 作为项目名和仓库名，完整保留 `ruokee-` 所有者前缀。`agent` 说明领域，`kit` 可以容纳多种独立能力，又不会声称仓库本身是 Agent Harness 或完整运行栈。

创建独立项目，不整体重命名或复制 `ruokee-skills`。审慎选择内容，并按本仓库自己的规则重新组织。

这里只保留 Ruokee 创作并公开维护的能力，以及开发和分发这些能力所需的第一方代码、打包、安装、文档与验证支持。仓库不编目或镜像从第三方安装的软件。

Skill、Plugin、Extension、可执行项目、可选 variant 和宿主包是相互独立的内容类型。各类型都可以采用原生格式。只有第一项真实组件证明有此需要时，才建立相应顶层区域。Extension 不必包装 Skill，Plugin 也不必放进 `skills/`。

## 考虑过的替代方案

**继续使用 `ruokee-skills`。**这个名称会继续让所有非 Skill 内容显得像附属品。

**重命名或复制旧仓库。**这样会继承旧有分类和混合所有权，无法明确新公开仓库的边界。

**把所有能力建模成 Skill。**可执行项目、宿主包和 Extension 有不同的安装与验证要求。包装成 Skill 只会隐藏这些合同。

**用某一个现有 Plugin 代表仓库。**`code-quality` 或任何单一 Plugin 都只能代表一种能力。项目名称和布局必须适用于彼此无关的内容类型。

**使用 `harness`、`stack`、`manager`、`depot` 或改写 Ruokee 的拼写。**这些名称会夸大运行职责、只表达被动存储，或者削弱直接的所有权信号。因此排除 `rookery`、`ruukit` 和 `rookit` 等候选。

## 结果

仓库继续使用 `ruokee-agent-kit`，并与 `ruokee-skills` 保持独立。每项受追踪能力都由 Ruokee 公开维护，或者是该能力的第一方支持。仓库不收录第三方镜像、Fork 或已安装软件清单。

Skill、Plugin、Extension、可执行项目、variant 和宿主包可以采用符合实际行为的格式。只有真实组件出现时才增加顶层结构，不预建空目录分类。

`kit` 的含义宽泛，也很常见。README 和仓库规则必须持续明确所有权与内容边界。这种宽度并不意味着可以加入无关工具。只有本仓库能力在开发、安装、分发、文档或验证中需要的第一方支持才属于这里。
