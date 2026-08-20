# 工作流 (Workflow)

本技能以三种模式之一运行。阅读匹配的文档，然后执行。

| 模式 | 使用时机 | 文档 |
|-|-|-|
| 快速审查 (Fast Review) | 默认模式。开发后日常自检、小型 diff、单文件或 PR 审查。 | [fast-review.md](./fast-review.md) |
| 完整审查 (Full Review) | 仅当用户明确要求"full review"、"complete review"、"systematic review"或"architecture review"时。 | [full-review.md](./full-review.md) |
| 分析 (Analysis) | 讨论、设计对比、机制解释、重构规划、项目结构设计。无需评分的 diff。 | [analysis.md](./analysis.md) |

默认使用快速审查。不要自行升级到完整审查 — 它更重，必须由用户触发。当用户问的是*该做什么*而非*哪里有问题*时，切换到分析模式。

所有三种模式默认都是只读的。仅在用户要求修复时修改代码，并在进行任何不安全、批量或跨文件更改前停下来请求确认。
