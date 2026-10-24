# deep-research

Decision owner: Ruokee
Decision writer: OMP
Reverses: [deep-research](../../../archived/2026/09/06-r1-deep-research.zh.md)

[English](./06-deep-research.md) | 中文

## 动机

以纯 Skill 分发完整的双语 `deep-research` 指导，由组件维护内部文件。

研究行为来自指令，不依赖 Plugin 运行时。前驱将每种语言固定为一个文件，使内部组织选择成为公共约束，却没有增加研究能力或安装保证。

## 决定

按 [Skill 打包](../08/20-skill-variants.zh.md)和[组件边界](../08/24-component-self-containment.zh.md)合同提供 `deep-research`。[英文入口](../../../../../skills/deep-research/SKILL.md)与[中文入口](../../../../../variants/zh/skills/deep-research/SKILL.md)使用同一 `deep-research` 身份、等价描述、对应文件集合和语义等价的指令。任一语言独立安装到正常的 `skills/deep-research/` 宿主路径，不含源码专用前缀。

覆盖问题澄清、研究维度、广泛探索、定向研究、证据验证和综合输出。采集来源，区分论断类型，默认产出报告，记录未解决缺口。在环境并发上限内使用子 Agent 并行研究。不设置固定时间或 token 上限，完成请求范围与全部交付物后停止。

每种语言以 `SKILL.md` 作为完整、自包含研究指导的可发现入口。组件负责内部材料组织，不固定文件数。组件包含研究指令，不包含宿主专用包装或 Plugin 运行时。

仓库两种语言的 README 均在能力索引中列出该 Skill 并链接两种语言入口。保持链接有效，执行[仓库检查](./12-repository-checks.zh.md)。

## 考虑过的替代方案

要求每种语言只有一个指令文件。这使源码形态可预测，但即使研究行为和安装不变，整理参考资料也会成为仓库决定。

## 结果

每种语言保持独立可安装、可使用。内部组织变化须保留完整研究指导、对应语言文件集合和安装后的引用，不改变公开研究合同。
