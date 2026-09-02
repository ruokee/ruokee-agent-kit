# Agent Note: 采用可选择的 tk Skill 模式

Status: proposed
Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol, Ruokee

[English](./2026-09-02-adopt-selectable-tk-skill-modes.md) | 中文

## 动机

当前 tk Skill 同时允许逻辑工具和公开 CLI。在一次实际 OMP 会话中，Agent 加载该 Skill 后直接调用 CLI 16 次，只调用原生工具 2 次，并在原生工具已经成功后再次回到 CLI。两条路径都合法，因此第一次选择的路径继续影响后续操作。

现有两项决定还要求每个 Harness 组件只安装一份英文工具模式 Skill。[Harness 集成决定](../implemented/2026-08-28-integrate-tk-with-harnesses.zh.md) 固定了安装的 Skill 语言和 OMP 工具加载元数据。[运行时与组件分发决定](../implemented/2026-08-28-distribute-tk-runtime-and-harness-components.zh.md) 为每个 Harness 内嵌一份英文组件，并拒绝模式和语言选项。

目标改动保留现有工具模式，新增一个只能使用公开 CLI 的模式，并让安装可以按模式和语言选择四项 Skill 身份之一。这需要替代两项现有决定并增加两项新决定。四项最终决定范围独立，共同构成一项原子合同变更。

## 提议

### 新决定：新增纯 CLI 模式

现有安装已经提供 `tk` 工具模式 Skill。它在绝大多数 Task 操作中优先使用逻辑工具，但不彻底禁用 CLI，exec 本身就是公开 CLI 的代理。新决定在现有工具模式之外新增只能使用公开 CLI 的 `tk-cli` Skill。

纯 CLI Skill 正文不包含工具名称、工具发现、入口比较、工具失败或回退行为，也不声明或假定工具不存在。

纯 CLI 模式的组件更轻量。它不安装 Harness 适配器，也不向 Agent 会话注册工具 schema，因此减少安装内容和上下文开销。缺点是 Agent 需要自行选择 CLI 子命令和参数，Harness 无法在调用入口约束请求结构。

### 新决定：将 Skill 语言选择集成到 `tk install`

此前中文 Skill 作为独立变体进行管理，并且不自动进入安装流程，需要用户手动安装切换。

新决定把中文 Skill 纳入 `tk install` 的选择和切换流程。工具 Skill 在英文和中文下分别使用 `tk` 与 `tk-zh`，纯 CLI Skill 分别使用 `tk-cli` 与 `tk-cli-zh`。

每种模式下的中英文 Skill 提供等价行为。中文 Skill 具有独立发现名称，不是同名源码 variant。

### 替代决定：Harness 工具集成

tk 保留六项逻辑工具：search、read、create、update、log 和 exec。MCP 和原生 schema 继续从同一组 Rust 请求类型生成，Harness 适配器继续只负责转换。

工具模式 Skill 对 search、read、create、update 和 log 优先使用对应逻辑工具，逻辑操作被拒绝或失败后不直接改用 CLI 重试。exec 继续作为公开 CLI 的代理执行其支持的命令。

工具模式组件安装 `tk` 或 `tk-zh` Skill，并附带对应 Harness 集成。Codex 和 Claude Code 使用 MCP。Pi 和 OMP 使用原生 extension。OMP 把 search、read、create、update 和 log 标为 `essential`，exec 保持 `discoverable`。

适配器预检、固定运行时调用、有界输出、取消、传输错误分离和部分注册行为继续属于 Harness 集成决定。

### 替代决定：组件分发

运行时仍是 `$HOME/.local/bin/tk` 下的一份可执行文件。组件组装继续保持确定、内嵌和离线，并由 `projects/tk/build.rs` 单独负责。

每个 Harness 有四种可选择的组件变体：

| `mode` | `language` | Skill | tk 集成 |
| --- | --- | --- | --- |
| `tools` | `en` | `tk` | MCP 或原生工具 |
| `tools` | `zh` | `tk-zh` | MCP 或原生工具 |
| `cli` | `en` | `tk-cli` | 无 |
| `cli` | `zh` | `tk-cli-zh` | 无 |

`tk install` 接受 `--mode <tools|cli>` 和 `--language <en|zh>`。默认值是 `tools` 和 `en`。安装、dry-run、文本输出和 JSON 输出报告解析后的模式、语言和 Skill。

改变模式或语言会直接更新当前 Harness 安装，不要求先卸载。成功后，Harness 中只有一份 tk Skill，并且只包含该模式需要的集成。只按 Harness 执行的卸载会删除当前选择和已知的残留 tk 变体，同时保留无关内容。

生命周期继续根据当前固定目标、注册和内嵌内容规划，不增加安装历史数据库。预检、部分失败、取消、GC 和干净卸载继续保持确定和离线。

工具模式安装 Skill 和对应的 Harness 适配器。Harness 组件负责验证和启动该可执行文件，但不安装、更新、删除、包装或复制它。

纯 CLI 模式只需要安装 `tk-cli` 或 `tk-cli-zh` Skill。

每项 Skill 和集成只能引用自身目录内的文件，遵循 [保持可分发组件自包含](../implemented/2026-08-24-keep-distributable-components-self-contained.zh.md)。

### 所需决策变更

本 Note 提议一项原子变更，由四项新的 implemented 决定表示。在本 Note 状态为 `proposed` 期间，现有 Harness 集成决定和组件分发决定仍然具有权威性。

目标仓库状态包含以下 Agent Note 变更：

1. 归档 [Harness 集成决定](../implemented/2026-08-28-integrate-tk-with-harnesses.zh.md) 和 [运行时与组件分发决定](../implemented/2026-08-28-distribute-tk-runtime-and-harness-components.zh.md) 到 `archived/`；
2. 在 `implemented/` 下新增四组聚焦的决策文件：
    - `2026-09-02-add-tk-cli-only-mode`；
    - `2026-09-02-integrate-skill-language-selection-into-tk-install`；
    - `2026-09-02-integrate-tk-tools-with-harnesses`；
    - `2026-09-02-distribute-selectable-tk-harness-components`；
3. 在每项 archived 决定和对应的新决定中分别添加指向对方的取代关系链接；
4. 删除本提案。
5. 新增 `proposed/.gitkeep`，并让它成为 `proposed/` 下唯一条目。

仓库级的 [语言 variant 决定](../implemented/2026-08-20-package-self-contained-skill-variants.zh.md) 继续有效。它仍然管理同名源码 variant。四项 tk Skill 使用独立发现名称，因此不会改变该规则。tk 产品架构和文档维护决定继续有效，并增加带日期的变更，记录四项新决定及更新后的路径和职责。

## 考虑过的替代方案

**保留一项混合 Skill，只加强入口规则。** Skill 仍需教授两套执行方式，也仍会让 Agent 为同一操作考虑两条路径。新增纯 CLI 模式后，选择纯 CLI 的安装不再加载工具规则，工具模式也不再把 CLI 作为已有专用逻辑工具操作的等价入口。

**使用 `--skill <tk|tk-zh|tk-cli|tk-cli-zh>` 选择 Skill。** 一个四值选项会隐藏模式和语言两个独立维度，并在命令合同中重复 Skill 名称。

**要求显式提供模式和语言选项。** 必填选项会破坏现有安装命令。默认值保留当前英文工具模式行为，显式选项负责选择其他组合。

## 验收标准

- `proposed/` 目录只包含本提案这对权威双语文件，不包含其他 Agent Note。
- 在本 Note 状态为 `proposed` 期间，两项现有 implemented 决定继续有效。
- 目标仓库状态只归档两组已命名的决策文件，并在 `implemented/` 下新增四组已命名的聚焦决策文件。
- 两项替代决定与各自的 archived 前身相互链接；两项新增决定不归档既有决定。新增纯 CLI 模式的决定只负责该模式的 Skill 身份与行为，Skill 语言安装决定只负责 `tk install` 的语言选择合同。
- 目标仓库状态删除本提案这对双语文件，新增 `proposed/.gitkeep`，并让它成为 `proposed/` 下唯一条目。
- 四项 Skill 目录保持自包含，每个 Harness 安装只加载其中一项。
- 工具模式对已覆盖操作优先使用逻辑工具，失败后不直接改用 CLI 重试，并保留 exec 对公开 CLI 的代理；纯 CLI Skill 正文不包含工具相关描述或假设。
- Cargo 为四个 Harness、两种模式和两种语言组装 16 个有效选择。
- 安装默认值、显式选择、切换、无变化行为、结构化结果和指定 Harness 的卸载符合本提案。
- 产品代码、双语公开文档、隔离环境中的 Harness 验证和四项 implemented 决定描述相同的完整行为。

## 风险

四项最终决定分别负责不同合同，但彼此依赖。它们的范围必须保持独立，相互引用也必须让组合后的行为保持一致。

四份完整的 Skill 目录和 16 种内嵌组件选择会增加审查量、内嵌归档和可执行文件体积。发布检查必须测量实际体积并覆盖全部 16 种选择。

模式或语言切换失败时，现有部分完成合同可能留下已完成和未完成的变更。转换验证必须覆盖每个 Harness 的两个模式方向和两个语言方向。
