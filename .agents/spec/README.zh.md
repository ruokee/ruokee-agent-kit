# 规格

[English](./README.md) | 中文

规格（spec）说明一个组件或仓库领域当前的目标状态：它应该做成什么样，边界在哪里，以及哪些可观察的结果能证明它达到了目标。这一目标背后的决定和理由由 ADR 记录。

## spec 文件

| spec | 对象 |
| --- | --- |
| [.agents/spec/repository.zh.md](./repository.zh.md) | 仓库约定：边界、布局、文档、Git 工作流和检查 |
| [.agents/spec/host-compatibility.zh.md](./host-compatibility.zh.md) | 把代码加载进宿主进程运行的组件的维护下限 |
| [.agents/spec/skills.zh.md](./skills.zh.md) | Skill 体系：`skills/` 及 `variants/zh/skills/` 下的中文变体 |
| [.agents/spec/tk.zh.md](./tk.zh.md) | `projects/tk` 整体 |
| [.agents/spec/omp-context-pin.zh.md](./omp-context-pin.zh.md) | `projects/omp-context-pin` |
| [.agents/spec/omp-system-prompt.zh.md](./omp-system-prompt.zh.md) | `projects/omp-system-prompt` |
| [.agents/spec/omp-qol.zh.md](./omp-qol.zh.md) | `projects/omp-qol` |
| [.agents/spec/omp-status-bar.zh.md](./omp-status-bar.zh.md) | `projects/omp-status-bar` |
| [.agents/spec/omp-codex-web-access.zh.md](./omp-codex-web-access.zh.md) | `projects/omp-codex-web-access` |

`projects/` 下的每个组件都有一份以其目录命名的 spec。增加或删除组件，或者增加需要单独 spec 的仓库领域时，在同一次变更中更新这份清单。

## 编写 spec

每份 spec 是同目录的一对文件 `name.md` 和 `name.zh.md`，标题下方紧接互相指向的语言链接。两种语言描述同一目标，并一起修改。

spec 按适用情况、依以下顺序使用这些小节：

- 目标
- 非目标
- 公共面
- 不变量
- 宿主下限
- 验收标准
- 相关 ADR

不适用的小节省略，例如仓库约定没有宿主下限。

spec 写当前目标，直接在原文上修改，不保留修订历史、审查记录、任务记录或会话信息。内容依据现行决定（包括其 `变更` 条目）和组件文档。归档决定不是当前依据，spec 既不引用也不搬运其内容。

spec 链接到拥有某项细节的页面，而不复述它。命令和参数参考、设置表、文件格式以及组件的维护声明留在所属页面，spec 只补充读者需要的上下文。相关 ADR 以链接列出。链接遵循仓库的文档相对链接规则。

## 分工

- spec 说明对象应该做成什么样。
- ADR 记录持久选择、理由、替代方案和后果。
- 组件文档告诉用户如何安装和使用组件。
- 仓库说明和 README 告诉贡献者如何在仓库中工作。

spec 不得与现行决定冲突。会与现行决定冲突的目标变化，先走 [ADR 流程](../adr/README.zh.md)，再修改 spec。不改变持久选择的 spec 修改不需要 ADR，是否需要 ADR 由 ADR 规则判断。决定可以链接 spec，但链接不能替代决定所记录的契约。

改变组件目标的变更，在同一次变更中同时更新 spec、组件和组件文档。

## 引用方向

引用只能单向。spec 可以链接组件文件、组件文档和 ADR。可分发组件内部的任何文件都不链接 `.agents/spec/`、不写出其中的路径，也不依赖它，因此安装后的组件不需要仓库也能使用。

spec 是说明性文档。组件的运行、构建和分发都不依赖 spec，仓库检查像对待其他 Markdown 文档一样对待 spec。

## 相关 ADR

- [增加规格层](../adr/decision/2026-10-04-add-spec-layer.zh.md)
