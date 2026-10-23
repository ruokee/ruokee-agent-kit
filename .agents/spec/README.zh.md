# 规格

[English](./README.md) | 中文

本页是非规格索引和项目补充，导航完整规格集合及其语言对应页，不承接正文省略的功能要求。规格完整表达当前要求，独立于原实现及其说明资料。

创建、修改、移除、审查规格，或功能工作改变其目标时，先加载 [maintain-spec](../skills/maintain-spec/SKILL.md)。Skill 持有维护方法。

## 项目补充

- 长期规格放在 `.agents/spec/`。`projects/` 下每个组件具有下方标明的完整集合。可使用命名主文件对加完整主题文件对，或包含主 README 文件对和主题文件对的目录。按要求领域拆分，不按内部模块拆分。增加或删除对象时同次更新索引。
- 每份规格由同目录 `name.md` 和 `name.zh.md` 配对，描述相同完整目标，同次维护。规格正文不含仓库文件链接，包括语言、主题、ADR、规则、源码和组件链接。本索引提供导航。路径本身属于外部接口时，可以连同完整行为保留，不能委托要求。
- 使用 Skill 规定的适用章节顺序：`目标`、`非目标`、`公共面`、`不变量`、`宿主下限`、`验收标准`，对应 `Goals`、`Out of scope`、`Public surface`、`Invariants`、`Host lower bound`、`Acceptance criteria`。省略不适用章节，规格正文不设相关 ADR 节。
- 只有本根 README 文件对是非规格导航例外。规格区域内组件主 README，包括 smart-context 主规格，都属于规格正文，遵守相同独立性和链接规则。
- 遵循[文档规则](../rule/documentation.zh.md)、[Git 规则](../rule/git.zh.md)和[开发检查](../rule/development.zh.md#检查)。这些是项目政策，不是维护方法对所有使用者的要求。
- 持久选择变化时，使用 [maintain-adr](../skills/maintain-adr/SKILL.md) 和 [ADR 项目补充](../adr/README.zh.md)。相关决定是编写依据，读者不需要靠它们补全规格要求。

## spec 文件

### 仓库

- 仓库约定和内部维护 Skill：[English](./repository.md)、[中文](./repository.zh.md)。
- 宿主维护兼容性：[English](./host-compatibility.md)、[中文](./host-compatibility.zh.md)。
- 对外分发 Skill：[English](./skills.md)、[中文](./skills.zh.md)。

### tk

以下五个主题共同完整说明 tk：

- 产品范围：[English](./tk.md)、[中文](./tk.zh.md)。
- 持久数据、发现、生命周期和维护：[English](./tk-data.md)、[中文](./tk-data.zh.md)。
- CLI、逻辑操作、结果和传输：[English](./tk-interface.md)、[中文](./tk-interface.zh.md)。
- 分发和 Harness 集成：[English](./tk-distribution.md)、[中文](./tk-distribution.zh.md)。
- Agent 行为和材料模式：[English](./tk-agent.md)、[中文](./tk-agent.zh.md)。

### OMP QoL

完整 QoL 规格：[English](./omp-qol.md)、[中文](./omp-qol.zh.md)。

### OMP Smart Context

以下七个主题共同完整说明 smart-context：

- 主规格、设置、状态和迁移：[English](./omp-smart-context/README.md)、[中文](./omp-smart-context/README.zh.md)。
- 共享请求对齐：[English](./omp-smart-context/request-alignment.md)、[中文](./omp-smart-context/request-alignment.zh.md)。
- Remote 对齐：[English](./omp-smart-context/remote.md)、[中文](./omp-smart-context/remote.zh.md)。
- Handoff 对齐：[English](./omp-smart-context/handoff.md)、[中文](./omp-smart-context/handoff.zh.md)。
- 压缩用量：[English](./omp-smart-context/usage.md)、[中文](./omp-smart-context/usage.zh.md)。
- 模型提示词规则：[English](./omp-smart-context/model-prompts.md)、[中文](./omp-smart-context/model-prompts.zh.md)。
- Context Pin：[English](./omp-smart-context/pin.md)、[中文](./omp-smart-context/pin.zh.md)。

### OMP Status Bar

完整状态栏规格：[English](./omp-status-bar.md)、[中文](./omp-status-bar.zh.md)。

### workloop

完整纯指令工作流规格：[English](./workloop.md)、[中文](./workloop.zh.md)。

## 相关 ADR

### 仓库决定

- [规格](../adr/decision/2026/10/04-specifications.zh.md)。
- [仓库规则](../adr/decision/2026/10/12-repository-rules.zh.md)。
- [仓库词典](../adr/decision/2026/10/17-repository-dictionary.zh.md)。
- [第一方能力](../adr/decision/2026/08/20-first-party-capabilities.zh.md)。
- [组件自包含](../adr/decision/2026/08/24-component-self-containment.zh.md)。
- [双语文档](../adr/decision/2026/08/20-bilingual-docs.zh.md)和[相对链接](../adr/decision/2026/08/24-relative-links.zh.md)。
- [Skill 变体](../adr/decision/2026/08/20-skill-variants.zh.md)。
- [主干开发](../adr/decision/2026/08/20-trunk-development.zh.md)、[提交信息](../adr/decision/2026/09/17-commit-messages.zh.md)、[Markdown 格式](../adr/decision/2026/09/02-markdown-formatting.zh.md)和[仓库检查](../adr/decision/2026/09/12-repository-checks.zh.md)。
- [ADR 机制](../adr/decision/2026/08/22-adr-mechanism.zh.md)和[宿主维护](../adr/decision/2026/09/28-host-maintenance.zh.md)。

### tk 决定

- [架构](../adr/decision/2026/08/21-tk-architecture.zh.md)。
- [运行时](../adr/decision/2026/08/28-tk-runtime.zh.md)。
- [任务数据](../adr/decision/2026/08/28-tk-data.zh.md)。
- [Harness 集成](../adr/decision/2026/08/28-tk-harness.zh.md)。
- [CLI 模式](../adr/decision/2026/09/02-tk-cli-mode.zh.md)。
- [Skill 语言](../adr/decision/2026/09/02-tk-language.zh.md)。
- [分发](../adr/decision/2026/08/28-tk-distribution.zh.md)。
- [文档](../adr/decision/2026/08/29-tk-documentation.zh.md)。

### OMP 决定

- [QoL](../adr/decision/2026/09/20-omp-qol.zh.md)、[任务参数清理](../adr/decision/2026/10/17-task-argument-cleanup.zh.md)和[复制最后回复](../adr/decision/2026/10/18-copy-last-reply.zh.md)。
- [Smart-context](../adr/decision/2026/10/12-smart-cache.zh.md) 和[共享请求对齐](../adr/decision/2026/10/22-request-alignment.zh.md)。
- [Remote 对齐](../adr/decision/2026/10/10-remote-alignment.zh.md)和 [Handoff 对齐](../adr/decision/2026/10/12-handoff-alignment.zh.md)。
- [压缩用量](../adr/decision/2026/10/13-compaction-usage.zh.md)和[模型提示词规则](../adr/decision/2026/09/14-model-prompt-rules.zh.md)。
- [Context Pin](../adr/decision/2026/09/15-omp-context-pin.zh.md) 和 [Pin 工具合同](../adr/decision/2026/10/17-context-pin-tool-contract.zh.md)。
- [状态栏](../adr/decision/2026/09/04-omp-status-bar.zh.md)。

### 工作流决定

- [workloop](../adr/decision/2026/10/22-workloop.zh.md)。
