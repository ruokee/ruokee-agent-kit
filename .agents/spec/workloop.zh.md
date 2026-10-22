# workloop

[English](./workloop.md) | 中文

本规格覆盖 `projects/workloop/` 下的纯指令组件。[组件指南](../../projects/workloop/README.zh.md)维护使用细节，安装后的 Skill 维护工作流合同。

## 目标

- 为新 tk Task 提供完整 Agent 工作流，涵盖目标澄清、必要设计、规划、实现、独立核验和项目定义的交付。
- 任一语言 Skill 均可通过目标 Harness 既有 Skill 机制独立使用，以自然语言请求操作。
- 在修订和上下文恢复中保留有效要求、许可边界、证据及当前执行状态。
- 通过 Harness 原生机制分发完整 Skill，并以纯资源包提供 OMP 薄命令入口。

## 非目标

- 程序化强制执行、工作流运行时代码或专用安装器。
- 旧流程入口或材料名称的兼容与迁移。
- tk 之外的任务管理或通用用户级与项目级配置层次。这些方向暂缓，不是永久禁止。
- 隐式集成、本机安装、发布、真实模型实验或 Task 关闭。

## 公共面

- 英文 Skill 及公共合同：[workloop](../../projects/workloop/skills/workloop/SKILL.md)。
- 中文 Skill 及公共合同：[workloop-zh](../../projects/workloop/skills/workloop-zh/SKILL.md)。
- 各 Skill 的操作索引从自身目录加载 Clarify、Execute、Verify、Ship 或 Supervise，并通过简短条件引用提供初始化说明。
- [使用指南](../../projects/workloop/README.zh.md)说明依赖、操作选择、材料归属、示例及配置。
- [安装指南](../../projects/workloop/docs/installation.zh.md)说明独立 Skill 的生命周期操作及 OMP 包管理。
- [OMP 包](../../projects/workloop/package.json)包含两个 Skill，以及 Markdown 文件命令 `/wl-clarify`、`/wl-exec`、`/wl-verify`、`/wl-ship`、`/wl-supervise`。

## 不变量

- `workloop` 和 `workloop-zh` 是 `projects/workloop/skills/` 下的独立 Skill 身份，指令完整等价，版本一致。不依赖另一语言或安装目录之外的文件。
- tk 是必需依赖，通过名称和公开接口使用，不读取其实现文件。其他辅助能力只在需要时使用，推荐 Herdr 而非强制使用。
- Clarify 承载目标讨论、必要设计及直接生成或修订 Plan。分析材料和临时文件不授权实现或配置修改，准备完成不启动或邀请执行。
- Goal 描述预期结果，不写实现方法；诊断记录事实与原因，不写修复建议。可选材料保持可选。每个执行任务都有独立 `plan.md`，简单或单单元任务也不例外，可以混用正文单元及子任务链接。
- Execute 直接实现，Supervise 调度独立 Worker。未限定执行时连续完成剩余 Plan，通常同一时间只处理一个单元，可以串行完成多个，不重复索取例行中间许可。执行默认禁止结构化问答工具。
- Plan 形成后自动自检前期材料，前期材料独立 Verify 按请求启动。每个实现单元都需要自检及独立 Verify。上限、提前通过结束、累计计数、作者修订及复查由公共合同规定。
- 独立评估只读，绑定范围和候选，追加到核验记录。变化后的候选不继承旧通过。
- 各角色独立选择，Senior 明确分配，协作保持上下文隔离及适当会话复用，除适用 `nowait` 外请求等待最终结果。恢复以明文保留限制并重读缺失正文，不依赖特定持久化 API。
- Ship 根据项目定义及有效许可执行。交付、验收、生产发布和关闭分别处理。反馈只将受影响工作返回 Clarify 或 Execute，适合独立归属时另建 Task。
- 初始化可选，默认值保存在适用外部指引。普通操作不主动预检环境，实际失败后针对问题收集信息。
- OMP 命令只传操作、用户输入及加载指示，明确的语言 Skill 选择优先，否则使用英文。工作流正文保留在实际加载的 Skill 目录内。
- 独立安装复制完整语言目录，或使用宿主支持的链接。OMP 包管理与仓库普通 Skill 安装器分开，两者都不隐式安装前置依赖。
- 包和两个 Skill 共用同一版本。已知组件 Markdown 选择格式检查，包清单及未登记路径保留完整检查回退。

## 验收标准

- 两个完整语言目录均可复制出仓库，从 `SKILL.md` 沿实际链接读取全部操作及初始化文档，不越出该目录。
- 两种语言表达相同必需行为，包括直接规划、只设计和无需行动路径、混合 Plan、串行执行、独立 Worker 调度、明确范围、自检结束、Verify 修复循环、上下文恢复、已验证依赖开发及项目交付反馈。
- 公共合同、操作正文及示例对 Goal、诊断、Plan、检查计数、许可分离和追加评估的职责一致。
- 组件、规格、语言身份决定及双语公开文档的归属与分发边界一致，普通 Skill 变体保留既有规则。
- 两种语言目录均能在临时目标位置完成完整目录安装、替换、移除及内部加载路径检查。文档说明各宿主的重新加载条件和安装归属。
- 包资源存在、版本一致，各 OMP 入口带上用户输入加载对应操作。原生发现和重名行为声明具有对应宿主接口依据。
- 检查选择器识别已登记组件 Markdown，不增加运行时检查；包、未知输入及其混合变更仍完整回退。
- 证据区分文件与场景审阅、实际 Harness 发现、真实模型行为和用户验收，不从文本检查推定更强运行结论。

## 相关 ADR

- [Skill 语言变体](../adr/decision/2026/08/20-skill-variants.zh.md)。
- [组件自包含](../adr/decision/2026/08/24-component-self-containment.zh.md)。
- [workloop](../adr/decision/2026/10/22-workloop.zh.md)。
