# 仓库

[English](./repository.md) | 中文

仓库级约定的规格。

[仓库 README](../../README.zh.md) 介绍仓库，并说明贡献者如何在仓库中工作。

[规则层](../rule/README.zh.md)说明在这个仓库里工作要怎么做。

## 目标

- 只收录 Ruokee 编写和维护的能力，以及开发和分发它们所需的第一方代码、打包、安装、文档和验证。
- 每项能力保持宿主原生或构建原生的格式。
- 每个可分发组件保持自包含。
- 用双语 ADR 记录持久决定，用双语 spec 说明每个组件和仓库领域的当前目标。
- 用双语页面承载仓库工作规则，位于 `.agents/rule/`，让每条规范性陈述只有一个归属层。
- 在短期分支上开发，squash 合入 `main`；开发期间运行受影响检查，最终候选运行完整检查。

## 非目标

- 第三方能力、fork 或上游镜像。
- 开发者本地目录、机器清单、部署与恢复配置、敏感信息、凭据、私有主机名、内部服务 URL，或设备上使用的模型、提供方、渠道配置。
- 空的能力分类，或为假设的 Skill、宿主或需求预建的结构。
- 会安装依赖、格式化源文件，或用全局工具掩盖本地环境缺失的检查。
- 只在开发者本地成立，或包含敏感信息、特定模型、提供方、端点或绝对路径的规则。

## 公共面

- 仓库布局：[仓库布局](../../README.zh.md#仓库布局)。
- 按活动的规则：[.agents/rule/README.zh.md](../rule/README.zh.md)，索引边界、开发、Git 和文档规则。
- Git 工作流、提交规则和钩子：[Git](../../README.zh.md#git)、[Git 规则](../rule/git.zh.md)和[验证规则](../rule/development.zh.md#验证)。
- 检查前置条件、受影响检查和完整合并门禁：[检查前置条件](../../README.zh.md#检查前置条件)、[受影响检查](../../README.zh.md#受影响检查)和[完整合并验证](../../README.zh.md#完整合并验证)。
- 常用命令：[常用命令](../../README.zh.md#常用命令)。
- ADR 规则和术语表：[.agents/adr/README.zh.md](../adr/README.zh.md) 和 [.agents/adr/glossary.zh.md](../adr/glossary.zh.md)。
- spec 规则：[.agents/spec/README.zh.md](./README.zh.md)。

## 不变量

- 可分发组件内的文件只引用该组件内的文件。组件不链接、不依赖、也不指示使用仓库的其他组件、仓库支持文件、`.agents/spec/` 或 `.agents/rule/`。
- 英文 Skill 位于 `skills/<name>/`，中文变体位于 `variants/zh/skills/<name>/`。tk 的 Skill 保留在 `projects/tk/skills/` 下的路径。
- 代码、注释、配置和默认公开文档使用英文。普通公开文档在同一目录成对维护为 `name.md` 和 `name.zh.md`，入口页为 `README.md` 和 `README.zh.md`，互相提供语言链接。两种语言一起修改。
- 仓库文件链接相对于所在文档：当前目录或其子目录用 `./`，离开当前目录用 `../`；不使用前导 `/`、相对仓库根的目标或 GitHub 绝对 URL。
- Prettier 格式化所有受跟踪的 Markdown。
- 提交信息使用英文 Conventional Commits。可选 scope 只能是 `skills`、`extensions`、`adr` 或 `repo` 之一，跨两个领域的变更不带 scope。commit-msg 钩子执行这一规则。
- `main` 是唯一的长期分支。每项变更在短期分支上开发，获得明确授权后 squash 合入 `main`。
- `pnpm check:changed` 为一次变更选择受影响检查。未知、共享或无法可靠分类的输入回退为一次完整检查。
- 完整检查集合、选择器映射和选择器回归测试覆盖相同的组件和文档消费者。
- ADR 以动机开篇，遵守 [ADR 规则](../adr/README.zh.md)中的内容边界；撰写或修改 ADR 遵循[文档规则](../rule/documentation.zh.md)。spec 从不与现行决定冲突。
- 组件的 `X.Y.Z` 版本号随它交付的行为变化，递增规则及其权限由[边界规则](../rule/boundary.zh.md)拥有。
- 组件不保留不可达代码、重复实现或为假设需求保留的设计。简化保持每个组件的目标以及对外的命令、工具、设置、文件格式和行为不变。

## 验收标准

- `pnpm docs:lint` 对受跟踪的 Markdown 不报告 Prettier 变更。
- commit-msg 钩子拒绝类型未知或 scope 不在集合内的提交信息。
- `pnpm check:selector` 通过。
- `.agents/rule/` 含层 README 配对和每个活动一份页面配对，且只改其中 Markdown 的变更选择文档检查，而不触发完整检查。
- 完整 `pnpm check` 在干净、已提交且包含目标 `main` 的最终候选上通过。
- Skill 之外的每个公开 Markdown 页面都有同目录的语言配对，并互相链接：普通页面为 `name.md` 和 `name.zh.md`，入口页面为 `README.md` 和 `README.zh.md`。Skill 按现有布局验收：英文 Skill 位于 `skills/<name>/`，中文变体位于 `variants/zh/skills/<name>/`；独立命名的 tk Skill 保留在 `projects/tk/skills/` 下的现有路径。这条标准不移动 Skill 文件，也不在 Skill 之间新增跨语言链接。
- 组件内的引用都不会解析到组件目录之外。

## 相关 ADR

- [建立第一方 Agent 能力工具集](../adr/decision/2026-08-20-establish-first-party-capability-kit.zh.md)
- [把短期分支 squash 合入 main](../adr/decision/2026-08-20-use-trunk-based-squash-workflow.zh.md)
- [使用动机作为起始章节](../adr/decision/2026-08-22-use-motivation-heading-in-adrs.zh.md)
- [保持可分发组件自包含](../adr/decision/2026-08-24-keep-components-self-contained.zh.md)
- [文件路径使用文档相对链接](../adr/decision/2026-08-24-use-document-relative-file-links.zh.md)
- [使用 Prettier 格式化 Markdown](../adr/decision/2026-09-02-format-markdown-with-prettier.zh.md)
- [审查授权](../adr/decision/2026-09-06-review-authorization.zh.md)
- [同目录维护双语公开文档](../adr/decision/2026-09-07-colocate-bilingual-docs.zh.md)
- [强制执行提交信息规范](../adr/decision/2026-09-17-enforce-commit-message-conventions.zh.md)
- [明确 ADR 内容边界](../adr/decision/2026-09-23-clarify-adr-content-boundaries.zh.md)
- [按范围执行开发检查](../adr/decision/2026-09-30-scope-aware-repository-checks.zh.md)
- [增加规格层](../adr/decision/2026-10-04-add-spec-layer.zh.md)
- [新增规则层](../adr/decision/2026-10-12-add-rule-layer.zh.md)
