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
- 决定反转时保持当前引用稳定，保留可分别访问的历史版本，并按生命周期与首次提出年月组织 ADR。
- 用双语页面承载仓库工作规则，位于 `.agents/rule/`，让每条规范性陈述只有一个归属层。
- 提供两个内部维护 Skill，让 Agent 在项目工作中加载适用方法、读取有效依据，并正确维护长期规格和 ADR。
- 在短期分支上开发，squash 合入 `main`；开发期间运行受影响检查，最终候选运行完整检查。

## 非目标

- 第三方能力、fork 或上游镜像。
- 开发者本地目录、机器清单、部署与恢复配置、敏感信息、凭据、私有主机名、内部服务 URL，或设备上使用的模型、提供方、渠道配置。
- 空的能力分类，或为假设的 Skill、宿主或需求预建的结构。
- 会安装依赖、格式化源文件，或用全局工具掩盖本地环境缺失的检查。
- 只在开发者本地成立，或包含敏感信息、特定模型、提供方、端点或绝对路径的规则。
- 内部维护 Skill 的公开分发或跨项目适配、由它们维护任务 Goal，以及新增 sidecar、归档 manifest、维护 CLI 或通用适配框架。

## 公共面

- 仓库布局：[仓库布局](../../README.zh.md#仓库布局)。
- 按活动的规则：[.agents/rule/README.zh.md](../rule/README.zh.md)，索引边界、开发、Git、文档和术语规则。
- 共享词汇：[docs/dictionary/README.zh.md](../../docs/dictionary/README.zh.md) 和[术语规则](../rule/terminology.zh.md)。
- Git 工作流、提交规则和钩子：[Git](../../README.zh.md#git)、[Git 规则](../rule/git.zh.md)和[验证规则](../rule/development.zh.md#验证)。
- 检查前置条件、受影响检查和完整合并门禁：[检查前置条件](../../README.zh.md#检查前置条件)、[受影响检查](../rule/development.zh.md#检查)和[完整合并验证](../../README.zh.md#完整合并验证)。
- 常用命令：[常用命令](../../README.zh.md#常用命令)。
- ADR 维护：[maintain-adr](../skills/maintain-adr/SKILL.md) 与[项目补充](../adr/README.zh.md)。ADR 术语：[词典的 ADR 页](../../docs/dictionary/adr.zh.md)。
- 规格维护：[maintain-spec](../skills/maintain-spec/SKILL.md) 与[项目补充](./README.zh.md)。

## 不变量

- 可分发组件内的文件只引用该组件内的文件。组件不链接、不导入、也不读取其他组件的文件或包，也不依赖仓库支持文件，例如 `.agents/spec/` 和 `.agents/rule/`。
- 组件正文可以提及其他组件、工具或 Skill，把它声明为前置条件，并按名称或通过公开接口指示使用。声明的前置条件不是文件引用。
- 普通公开英文 Skill 位于 `skills/<name>/`，中文变体位于 `variants/zh/skills/<name>/`。以独立项目形式维护的组件，其包含的 Skill 位于所属 `projects/<component>/skills/` 目录。
- 内部英文 Skill 位于 `.agents/skills/maintain-spec/` 和 `.agents/skills/maintain-adr/`，使用原生项目发现，描述在加载前说明适用工作。它们可引用所维护的项目文档，不是公开安装源，公开组件自包含要求保持不变。
- 每种维护方法由对应 Skill 及必要参考文件主要持有。Spec、ADR README 保留项目覆盖、语言政策、Git 流程、权限和导航，不保留第二套完整方法。
- `maintain-spec` 覆盖长期目标的新增、调整、移除和边界澄清，`maintain-adr` 覆盖创建、事实修复、无冲突更新、反转、拒绝和归档。两者保留有效要求和项目政策，不负责任务 Goal 或任务生命周期，不扩大写入权限，不无条件要求加载对方，也不为没有持久选择变化的修改创建 ADR。
- 代码、注释、配置和默认公开文档使用英文。普通公开文档在同一目录成对维护为 `name.md` 和 `name.zh.md`，入口页为 `README.md` 和 `README.zh.md`，互相提供语言链接。两种语言一起修改。
- 仓库文件链接相对于所在文档：当前目录或其子目录用 `./`，离开当前目录用 `../`；不使用前导 `/`、相对仓库根的目标或 GitHub 绝对 URL。
- Prettier 格式化所有受跟踪的 Markdown。
- 提交信息使用英文 Conventional Commits。可选 scope 只能是 `skills`、`extensions`、`adr` 或 `repo` 之一，跨两个领域的变更不带 scope。commit-msg 钩子执行这一规则。
- `main` 是唯一的长期分支。每项变更在短期分支上开发，获得明确授权后 squash 合入 `main`。
- `pnpm check:changed` 为一次变更选择受影响检查。未知、共享或无法可靠分类的输入回退为一次完整检查。
- 完整检查集合、选择器映射和选择器回归测试覆盖相同的组件和文档消费者。
- 保留的 ADR 在正文布局、身份日期、修订序列、命名、语言配对与维护上遵循 [maintain-adr](../skills/maintain-adr/SKILL.md) 和[项目补充](../adr/README.zh.md)，撰写或修改 ADR 遵循[文档规则](../rule/documentation.zh.md)。规格从不与现行决定冲突。
- ADR 的替代方案有进入同一长期选择的依据，并解释重要取舍。风险性内容与已接受代价具有可信因果和实质后果，包括写在 `结果` 中的内容。具体标准由[编写规则](../skills/maintain-adr/references/writing.md)拥有，真实契约、理由、历史条件及双语含义保持完整。
- 组件的 `X.Y.Z` 版本号随它交付的行为变化，递增规则及其权限由[边界规则](../rule/boundary.zh.md)拥有。
- 组件不保留不可达代码、重复实现或为假设需求保留的设计。简化保持每个组件的目标以及对外的命令、工具、设置、文件格式和行为不变。

## 验收标准

- `pnpm docs:lint` 对受跟踪的 Markdown 不报告 Prettier 变更。
- commit-msg 钩子拒绝类型未知或 scope 不在集合内的提交信息。
- `pnpm check:selector` 通过。
- `.agents/rule/` 含层 README 配对和每个活动一份页面配对，且只改其中 Markdown 的变更选择文档检查，而不触发完整检查。
- `.agents/skills/` 下的 Markdown 选择文档检查，非 Markdown、未知范围和共享选择器输入保留完整检查。内部 Skill 是英文维护材料，不要求公开翻译分发包。
- 实际项目维护显示，无需用户反复点名，两个 Skill 都在适用时主动加载，随后读取相关当前规格、决定及 `Changes`、活跃提案、项目补充和必要组件来源。文档结果保留未受影响要求、必要语言含义、身份、生命周期和引用。证据标明实际使用的文件或候选，只有发现或格式通过不满足本标准。
- 完整 `pnpm check` 在干净、已提交且包含目标 `main` 的最终候选上通过。
- Skill 之外的每个公开 Markdown 页面都有同目录语言配对，并互相链接：普通页面为 `name.md` 和 `name.zh.md`，入口页面为 `README.md` 和 `README.zh.md`。Skill 按上述布局验收，保留文件位置和身份，不在 Skill 之间新增跨语言链接。
- 组件内没有解析到组件目录之外的文件引用。
- 同日、跨月与跨年反转保留不变的规范当前路径与可分别访问的后续版本，并只递增该决定的连续序列。抽出独立主题与命名整改遵循[记录规则](../skills/maintain-adr/references/records.md)，读者可沿准确的直接前后继追溯，不把后续版本误作早期记录的直接后继。
- 保留的 ADR 在布局、命名、语言配对与历史内容保留上符合[记录规则](../skills/maintain-adr/references/records.md)与[项目补充](../adr/README.zh.md)。
- 对全部保留 ADR 文件对的审查未发现没有依据、归类错误或没有重要决策价值的替代方案与风险性内容。空的替代方案和风险章节按规定写 `None` 或 `无`；保留条目完整表达依据和条件，不以通用提醒或审查日志替代。
- 当前决定、维护 Skill、项目补充、文档规则、规格、词典与实际引用表达同一有效契约。当前与历史引用、双向语言链接及标题片段均指向所需内容，历史记录保留自身契约。

## 相关 ADR

- [第一方能力](../adr/decision/2026/08/20-first-party-capabilities.zh.md)
- [主干开发](../adr/decision/2026/08/20-trunk-development.zh.md)
- [ADR 开头](../adr/decision/2026/08/22-adr-opening.zh.md)
- [组件自包含](../adr/decision/2026/08/24-component-self-containment.zh.md)
- [文件相对链接](../adr/decision/2026/08/24-relative-links.zh.md)
- [Markdown 格式化](../adr/decision/2026/09/02-markdown-formatting.zh.md)
- [审查授权](../adr/decision/2026/09/06-review-authorization.zh.md)
- [双语文档](../adr/decision/2026/08/20-bilingual-docs.zh.md)
- [提交信息](../adr/decision/2026/09/17-commit-messages.zh.md)
- [仓库检查](../adr/decision/2026/09/12-repository-checks.zh.md)
- [规格](../adr/decision/2026/10/04-specifications.zh.md)
- [仓库规则](../adr/decision/2026/10/12-repository-rules.zh.md)
- [仓库词典](../adr/decision/2026/10/17-repository-dictionary.zh.md)
- [ADR 机制](../adr/decision/2026/08/22-adr-mechanism.zh.md)
