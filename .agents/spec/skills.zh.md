# Skill

[English](./skills.md) | 中文

`skills/` 下的普通 Skill 及其位于 `variants/zh/skills/` 的中文变体的规格。tk 的 Skill 随 tk 分发，由 [.agents/spec/tk.zh.md](./tk.zh.md) 覆盖。

## 目标

- 把每个 Skill 作为自包含、可被宿主发现的组件分发：英文基础版在 `skills/<name>/`，中文变体在 `variants/zh/skills/<name>/`。
- 选定的语言变体安装到宿主常规的 Skill 路径 `<skill root>/<name>/`，不带只存在于源码中的 `variants/zh/` 前缀。
- 每个 Skill 能独立理解。指向其他 Skill 的链接只能作为相关阅读。
- 在仓库能力清单中把每个 Skill 标为用户主动调用或 Agent 调用。

## 非目标

- 在 Skill 树中放入插件 manifest、市场元数据、包变更日志、宿主专用的 Agent 定义或包 README。
- 第三方 Skill、fork 或上游镜像。Skill 可以引用、摘录或改编第三方材料。
- 为假设的 Skill 预建结构。

## 公共面

- Skill 列表与调用方式：仓库 README 的 [Skills](../../README.zh.md#skills)。
- 检查、安装、更新、卸载和备份：[docs/installation.zh.md](../../docs/installation.zh.md)。
- 各 Skill 的行为：其自身的 `SKILL.md` 及同目录文件。

## 不变量

- Skill 内的引用都在该 Skill 目录内解析。Skill 不链接、不依赖、也不指示加载仓库的其他组件或仓库支持文件。
- 中文变体内的链接使用安装后的 `skills/<name>/` 形式。
- 同一 Skill 的两个语言变体文件集相同、范围相同。任何一方都不缺少另一方具有的可观察能力或必需指令，两者一起修改。
- Skill 树只包含宿主可发现的材料：`SKILL.md`、工作流、参考、示例和术语表。`grill-me` 保留其 `agents/openai.yaml` 调用策略。
- `grill-me` 只在用户明确调用时加载。`architect`、`code-quality`、`deep-research`、`msgspec`、`python-engineering` 和 `well-said` 可以由模型加载。
- `code-quality` 和 `python-engineering` 的审查工作流可以报告发现和建议，但审查请求不授权修改被审查的文件。
- 改编自第三方的材料在两个语言变体中都保留来源署名和许可声明。
- 安装工具从不写入 `skills/` 或 `variants/zh/skills/`。

## 宿主下限

无。Skill 是指令材料，不把代码加载进宿主进程，因此没有维护下限。见 [.agents/spec/host-compatibility.zh.md](./host-compatibility.zh.md)。

## 验收标准

- `skills/` 下的每个 Skill 都有同名、文件列表相同的中文变体。
- Skill 内没有解析到其目录之外的链接。
- `pnpm check:skills` 通过。
- 仓库 README 的中英文能力清单列出相同的 Skill 和相同的调用方式，并链接到两个变体。
- 决定要求真实宿主或真实模型检查的 Skill（例如 `grill-me` 和 `well-said`），在行为变化时继续执行这些检查。

## 相关 ADR

- [将 Skill 打包为自包含语言变体](../adr/decision/2026-08-20-package-self-contained-skill-variants.zh.md)
- [保持可分发组件自包含](../adr/decision/2026-08-24-keep-components-self-contained.zh.md)
- [建立第一方 Agent 能力工具集](../adr/decision/2026-08-20-establish-first-party-capability-kit.zh.md)
- [同目录维护中英文公开文档](../adr/decision/2026-09-07-colocate-bilingual-docs.zh.md)
- [添加用户主动调用的 grill-me Skill](../adr/decision/2026-09-06-add-grill-me-skill.zh.md)
- [允许模型调用 architect](../adr/decision/2026-09-18-make-architect-model-invoked.zh.md)
- [提供 deep-research Skill](../adr/decision/2026-09-06-migrate-deep-research.zh.md)
- [增加 well-said 写作 Skill](../adr/decision/2026-09-12-add-well-said-skill.zh.md)
- [审查授权](../adr/decision/2026-09-06-review-authorization.zh.md)
