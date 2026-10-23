# 规格

[English](./README.md) | 中文

规格说明组件或仓库领域的当前目标。创建、修改、移除、审查规格，或功能工作改变该目标时，先加载 [maintain-spec](../skills/maintain-spec/SKILL.md)。Skill 持有主要编写和维护方法，本页提供仓库位置、语言约定和导航。

## 项目补充

- 长期规格放在 `.agents/spec/`。`projects/` 下每个组件有一份以其目录命名的规格。增加或删除组件，或增加需要独立规格的仓库领域时，同一变更更新下方清单。
- 每份规格由同目录的 `name.md` 和 `name.zh.md` 配对，标题下紧接双向语言链接。两种语言描述同一目标，并一起修改。
- 使用 Skill 规定的章节顺序。中文标题为 `目标`、`非目标`、`公共面`、`不变量`、`宿主下限`、`验收标准`、`相关 ADR`，依次对应 `Goals`、`Out of scope`、`Public surface`、`Invariants`、`Host lower bound`、`Acceptance criteria`、`Related ADRs`。
- 遵循[文档规则](../rule/documentation.zh.md)、[Git 规则](../rule/git.zh.md)和[开发检查](../rule/development.zh.md#检查)。这些是本项目政策，不是维护方法对其他使用者的要求。
- 持久决定变化时，使用 [maintain-adr](../skills/maintain-adr/SKILL.md) 和 [ADR 项目补充](../adr/README.zh.md)。

## spec 文件

- [.agents/spec/repository.zh.md](./repository.zh.md) 覆盖仓库约定和内部项目维护 Skill。
- [.agents/spec/host-compatibility.zh.md](./host-compatibility.zh.md) 覆盖把代码加载进宿主进程运行的组件的维护下限。
- [.agents/spec/skills.zh.md](./skills.zh.md) 覆盖 `skills/` 和 `variants/zh/skills/` 下的对外分发 Skill。
- [.agents/spec/tk.zh.md](./tk.zh.md) 覆盖 `projects/tk` 整体。
- [.agents/spec/omp-context-pin.zh.md](./omp-context-pin.zh.md) 覆盖 `projects/omp-context-pin`。
- [.agents/spec/omp-qol.zh.md](./omp-qol.zh.md) 覆盖 `projects/omp-qol`。
- [.agents/spec/omp-smart-context.zh.md](./omp-smart-context.zh.md) 覆盖 `projects/omp-smart-context`。
- [.agents/spec/omp-status-bar.zh.md](./omp-status-bar.zh.md) 覆盖 `projects/omp-status-bar`。
- [.agents/spec/workloop.zh.md](./workloop.zh.md) 覆盖 `projects/workloop` 中的纯指令工作流。

## 相关 ADR

- [规格](../adr/decision/2026/10/04-specifications.zh.md)
