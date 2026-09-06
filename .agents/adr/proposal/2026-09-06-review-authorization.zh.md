# ADR 提案：审查授权

Decision owner: Ruokee
Draft writer: OMP

[English](./2026-09-06-review-authorization.md) | 中文

## 动机

[skills/code-quality/workflow/full-review.md](../../../skills/code-quality/workflow/full-review.md) 和 [skills/python-engineering/workflow/full-review.md](../../../skills/python-engineering/workflow/full-review.md) 要求在推荐某些变更前取得确认。即使不修改被审查文件，用户要求的完整审查也可能在报告最重要的发现项前停下。

## 提议

审查可以直接报告发现项、建议、风险和验证方法，无需为提出建议单独取得批准。跨文件重构、依赖调整、架构迁移或批量编辑等受控变更，在实际执行时遵守相应的授权要求。

审查请求不授权修改被审查文件。已有的 Task 材料或报告维护授权继续适用。

在 code-quality 和 python-engineering 的完整审查流程及与之冲突的入口、停止规则中统一这一区分，保持中英文变体语义一致。每个 Skill 在自身组件内表达规则，遵循[组件自包含决定](../decision/2026-08-24-keep-components-self-contained.zh.md)。

## 考虑过的替代方案

无

## 验收标准

- 完整审查直接报告跨文件、依赖、架构或批量变更建议，不先询问是否允许提出建议。
- 未取得相应授权时，不实施这些变更。
- 审查期间可以继续维护已获准的报告或 Task 材料。
- 中英文指令的授权边界一致，包括入口和停止规则。

## 风险

无
