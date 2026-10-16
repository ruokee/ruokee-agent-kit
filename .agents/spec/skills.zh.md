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
- Skill 树只放宿主可发现的材料，例如 `SKILL.md`、工作流、参考、示例和术语表，不放许可与声明文件。`grill-me` 保留其 `agents/openai.yaml` 调用策略。
- `grill-me` 只在用户明确调用时加载。`architect`、`code-quality`、`deep-research`、`msgspec`、`python-engineering` 和 `well-said` 可以由模型加载。
- `code-quality` 和 `python-engineering` 的审查工作流可以报告发现和建议，但审查请求不授权修改被审查的文件。
- 改编自第三方的材料把来源署名与许可信息记在仓库层面：仓库根 README、组件自带的 README，或拥有该材料的决定。
- `well-said` 在输出任何内容时使用。完整写作指南包含防御性表述，区分工作问题与文字问题。每个语言组件在 `metadata.version` 声明版本，且只包含 `SKILL.md`；来源署名写在仓库根 README，具体要求见 [well-said 决定](../adr/decision/2026/09/12-well-said.zh.md)。
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

- [Skill 语言变体](../adr/decision/2026/08/20-skill-variants.zh.md)
- [组件自包含](../adr/decision/2026/08/24-component-self-containment.zh.md)
- [第一方能力](../adr/decision/2026/08/20-first-party-capabilities.zh.md)
- [双语文档](../adr/decision/2026/08/20-bilingual-docs.zh.md)
- [grill-me](../adr/decision/2026/09/06-grill-me.zh.md)
- [architect](../adr/decision/2026/08/22-architect.zh.md)
- [deep-research](../adr/decision/2026/09/06-deep-research.zh.md)
- [well-said](../adr/decision/2026/09/12-well-said.zh.md)
- [审查授权](../adr/decision/2026/09/06-review-authorization.zh.md)
