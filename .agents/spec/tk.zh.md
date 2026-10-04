# tk

[English](./tk.md) | 中文

[projects/tk](../../projects/tk/README.zh.md) 的规格。本文说明 tk 的目标、边界和不变量。详细契约由 [projects/tk/docs/design](../../projects/tk/docs/design/README.zh.md) 下的设计页面负责，本文链接到这些页面，不复述其内容。

## 目标

- 为 Agent 工作提供一份持久、基于文件、位于项目内的任务记录，上下文丢失后仍然存在，并可跨会话、跨 Harness 和 CLI 使用。见 [projects/tk/docs/design/system.zh.md](../../projects/tk/docs/design/system.zh.md)。
- 任务领域规则、持久化、发现、迁移、维护、CLI、stdio MCP、生成的工具契约和 Harness 组件生命周期都由一个 Rust 运行时负责。见 [projects/tk/docs/design/runtime.zh.md](../../projects/tk/docs/design/runtime.zh.md)。
- 人用 CLI、stdio MCP 以及 Pi 和 OMP 原生工具都经由同一个公开可执行文件访问运行时，共用一套结果、错误和版本模型。见 [projects/tk/docs/design/tool-api.zh.md](../../projects/tk/docs/design/tool-api.zh.md) 和 [projects/tk/docs/design/cli-reference.zh.md](../../projects/tk/docs/design/cli-reference.zh.md)。
- 提供四个 Skill（tools 或 CLI 模式，英文或中文），每种语言共用一份参考文件源。见 [projects/tk/docs/design/skill.zh.md](../../projects/tk/docs/design/skill.zh.md)。
- 从一个内嵌 bundle 离线安装、更新和卸载 Harness 组件和独立的 CLI Skill。见 [projects/tk/docs/design/installation.zh.md](../../projects/tk/docs/design/installation.zh.md) 和 [projects/tk/docs/design/harnesses.zh.md](../../projects/tk/docs/design/harnesses.zh.md)。

## 非目标

- 数据库、全局任务注册表、后台索引、远程服务或常驻守护进程。
- 优先级、排期、收件箱、看板、Issue 镜像、Agent 协调、工作流执行或会话绑定。
- 锁、租约、compare-and-swap、自动合并、自动回滚，或多目标操作的续做状态。
- rename 时改写 Markdown 引用。
- 增加元数据、schema 字段、运行时状态、命令或自动目录的使用模式。

## 公共面

- 产品范围、系统组成和系统级不变量：[projects/tk/docs/design/system.zh.md](../../projects/tk/docs/design/system.zh.md)。
- 任务数据模型、生命周期、写入、迁移、rename、check 和 GC：[projects/tk/docs/design/data-model.zh.md](../../projects/tk/docs/design/data-model.zh.md)。
- 工具操作、结果和错误：[projects/tk/docs/design/tool-api.zh.md](../../projects/tk/docs/design/tool-api.zh.md)。
- CLI 命令、输出和退出状态：[projects/tk/docs/design/cli-reference.zh.md](../../projects/tk/docs/design/cli-reference.zh.md)。
- Harness 组件和适配器：[projects/tk/docs/design/harnesses.zh.md](../../projects/tk/docs/design/harnesses.zh.md)。
- bundle、安装、更新和卸载：[projects/tk/docs/design/installation.zh.md](../../projects/tk/docs/design/installation.zh.md)。
- Skill 行为和使用模式：[projects/tk/docs/design/skill.zh.md](../../projects/tk/docs/design/skill.zh.md)。
- 入门：[projects/tk/docs/guide.zh.md](../../projects/tk/docs/guide.zh.md)。

## 不变量

- `projects/tk/` 是唯一维护的源码区域。一个 Cargo 包构建一个 `tk` 可执行文件，Rust 构建是唯一的 bundle 组装者。
- 项目文件是任务状态的唯一权威来源。
- Harness 组件注册工具和配置，但不重复任务校验或存储。它们直接启动固定的公开运行时，从不安装第二个运行时、包装器或私有可执行文件。
- 适配器通过公开 CLI 映射操作，不解析版本范围；兼容性由运行时判断。
- 预检失败的适配器不注册任何操作，报告一条有界的诊断，不结束会话。
- CLI 模式的 Skill 通过公开 CLI 执行每个操作，不包含工具操作名称、发现、路线比较或回退措辞。
- 组装或安装后的每个组件（包括每个 Skill）只引用自身内部的文件。共享的 Skill 参考文件在源码树中每种语言只保存一份，构建时复制到该语言的每个 Skill 中。
- 每项行为只有一个负责的设计页面。其他页面链接到它，只补充读者需要的上下文。公开文档陈述当前的正式契约。
- tk 组件内的任何文件都不链接 `.agents/spec/`。

## 宿主下限

tk 的 OMP 适配器对其 `tools` 模式随附的宿主端代码遵循共同的 OMP 下限 `18.5.0`，声明在 [projects/tk/omp/README.zh.md](../../projects/tk/omp/README.zh.md#兼容性)。Pi 适配器的声明见 [projects/tk/pi/README.zh.md](../../projects/tk/pi/README.zh.md#兼容性)。`cli` 模式组件以及 Claude Code 和 Codex 组件不包含宿主进程代码，没有维护下限。通用规则见 [.agents/spec/host-compatibility.zh.md](./host-compatibility.zh.md)。

## 验收标准

tk 的验收义务（包括真实 Harness 验证）由 [projects/tk/docs/design/validation.zh.md](../../projects/tk/docs/design/validation.zh.md) 负责。tk 的 Rust、适配器和 Skill 生命周期检查包含在仓库完整的 `pnpm check` 中。

## 相关 ADR

- [定义 tk 产品架构](../adr/decision/2026-08-21-define-tk-product-architecture.zh.md)
- [定义 tk 运行时与 CLI](../adr/decision/2026-08-28-define-tk-runtime-and-cli.zh.md)
- [使用 closed 改名与文件系统引用扫描定义 tk 任务数据模型](../adr/decision/2026-09-10-allow-closed-rename-filesystem-scan.zh.md)
- [集成 tk 工具与 Harness](../adr/decision/2026-09-02-integrate-tk-tools-with-harnesses.zh.md)
- [新增 tk 纯 CLI 模式](../adr/decision/2026-09-02-add-tk-cli-only-mode.zh.md)
- [将 Skill 语言选择集成到 tk install](../adr/decision/2026-09-02-select-tk-skill-language.zh.md)
- [分发 Harness 组件与自定义根目录 CLI Skill](../adr/decision/2026-09-03-distribute-custom-cli-skills.zh.md)
- [以共享的 Skill 参考文件源码统一 tk 使用模式](../adr/decision/2026-10-04-share-tk-skill-references.zh.md)
- [宿主内组件按共同的 OMP 下限维护](../adr/decision/2026-10-04-raise-omp-host-floor.zh.md)
- [保持可分发组件自包含](../adr/decision/2026-08-24-keep-components-self-contained.zh.md)
