# 智能体编码（Agentic Coding）

关于 *AI 智能体配置*质量的参考文档——即塑造智能体行为的文件：`AGENTS.md`、`CLAUDE.md`、SKILL 文件、提示规则、权限清单和工作流文档。这里的主题是配置表面，而不是智能体生成的代码。生成的代码中的坏味道（长函数、重复知识、薄包装器、投机通用性）属于 `variants/zh/skills/code-quality/references/refactoring` 和 `variants/zh/skills/code-quality/references/design-principles`；本目录是关于首先驱动智能体的指令、上下文和引用。

前提是智能体的配置本身就是一个工程制品，有其自己的失败模式。上下文是一个预算，指令可能矛盾，引用可能失效，模板会腐化。这些问题会悄无声息地降低智能体性能——智能体仍然运行，但它是在更嘈杂或过时的输入上进行推理——因此它们需要与生产代码相同的刻意审查。

所有内容都在一份文档中：[config-smells.md](./config-smells.md)。它将每种失败模式视为 Fowler 意义上的坏味道——一个值得调查的表面症状，而不是一个自动的缺陷。在审查或编写任何面向智能体的配置时，请参考该文档。
