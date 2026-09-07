# ADR 决定：提供 deep-research Skill

Decision owner: Ruokee
Draft writer: OMP

[English](./2026-09-06-migrate-deep-research.md) | 中文

## 动机

`deep-research` 提供结构化、证据优先的研究流程，用于广泛调研和有来源依据的报告。其行为由研究指令定义，不需要 Plugin 运行时。

Ruokee Agent Kit 需要以自包含 Skill 的形式提供这项能力，并保持中英文变体语义一致。

## 决定

以纯 Skill 形式提供 `deep-research`，遵循[语言变体打包决定](./2026-08-20-package-self-contained-skill-variants.zh.md)与[组件边界决定](./2026-08-24-keep-components-self-contained.zh.md)。

- 英文指令存放于 [skills/deep-research/SKILL.md](../../../skills/deep-research/SKILL.md)，中文翻译存放于 [variants/zh/skills/deep-research/SKILL.md](../../../variants/zh/skills/deep-research/SKILL.md)。
- 两种变体使用相同的 Skill 名称 `deep-research`。任一变体均安装到宿主常规的 `skills/deep-research/` 路径，安装路径不含 `variants/zh/` 前缀。
- 覆盖问题澄清、研究维度识别、广泛探索、定向研究、证据验证和综合输出。采集来源，区分论断类型，默认产出报告，并记录未解决的问题。使用子 Agent 开展并行研究，并发数量不超过运行环境的上限。研究不设固定时间或 token 上限，完成请求范围内的工作和全部交付物后停止。
- 每种语言变体由一份包含研究指令的 `SKILL.md` 组成。
- [英文仓库 README](../../../README.md) 与[中文仓库 README](../../../README.zh.md) 均在能力索引中列出该 Skill，并分别提供两种语言变体的链接。

## 考虑过的替代方案

以面向 Claude Code 和 Codex 的 Plugin 形式分发这项能力。这需要宿主专用的包装和分发入口。纯 Skill 可以提供研究指令，而无需承担这些额外的维护工作。

## 结果

任一变体均可独立安装使用。每个组件仅包含自身的研究指令，无需维护宿主专用的包装。

两种变体均使用 `name: deep-research`，`description` 字段含义等价，说明何时使用该 Skill。两者的研究要求保持语义一致。翻译遗漏证据要求或改变研究停止条件，可能导致行为差异，因此应对照审查中英文指令。

保持两份仓库 README 中的能力索引链接有效，并运行 `pnpm check` 验证仓库。
