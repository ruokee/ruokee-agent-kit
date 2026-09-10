# ADR 提案：Codex 网页访问使用原生插件设置

Decision owner: Ruokee
Draft writer: OMP GPT-6 Astra

[English](./2026-09-10-use-codex-web-plugin-settings.md) | 中文

## 动机

[Codex 网页访问扩展](../../../projects/omp-codex-web-access/README.zh.md)将五项标量设置保存在专用 YAML 文件中。OMP 原生插件设置可以通过 `omp plugin config` 管理这些设置，并应用项目覆盖。使用 OMP 提供的能力可以统一配置入口，并允许不同项目选择各自的模型和工具设置。

[现行 Codex 网页访问决定](../decision/2026-09-06-add-omp-codex-web-access.zh.md)要求以 YAML 为唯一配置来源。本提案反转这一选择。最终形成的决定必须保留当前组件、工具、发现、审批及模型执行合同，并纳入替代的配置合同。

## 提议

### 设置与作用域

将 OMP 原生插件设置作为 `@ruokee/omp-codex-web-access` 的唯一配置来源。在包的 `omp.settings` schema 中声明以下扁平键：

| 键 | 类型 | 默认值 | 替代的 YAML 路径 |
| --- | --- | --- | --- |
| `model` | string | `""` | `model` |
| `searchEnabled` | boolean | `true` | `tools.codex_web_search.enabled` |
| `searchLoadMode` | enum | `essential` | `tools.codex_web_search.loadMode` |
| `fetchEnabled` | boolean | `true` | `tools.codex_web_fetch.enabled` |
| `fetchLoadMode` | enum | `discoverable` | `tools.codex_web_fetch.loadMode` |

两个枚举均只接受 `essential` 和 `discoverable`。去除 `model` 首尾空白。模型选择缺失或为空时，仍在工具调用时报错，不阻止工具注册。设置保存模型选择，不保存凭据。

通过公开的 `getPluginSettings(packageName, cwd)` API 读取有效设置。使用 OMP 的用户设置与项目 `.omp/plugin-overrides.json` 优先级，同名键的项目值覆盖用户值。扩展不为 OMP 配置增加文件读取器、存储格式或合并规则。

用户通过原生 CLI 配置用户级设置，例如：

```bash
omp plugin config set @ruokee/omp-codex-web-access model provider/model-id
omp plugin config set @ruokee/omp-codex-web-access fetchEnabled false
```

项目设置使用 `.omp/plugin-overrides.json` 的 `settings` 下对应包条目。文档必须区分项目覆盖与 CLI 的用户级写入，并说明如何保留其他插件条目。

### 激活与 OMP 前置条件

每次扩展激活时，在注册任何工具之前读取并校验一次设置。等待读取完成后，模型选择、启用开关和加载模式使用同一份快照。配置修改在下次激活生效，现有会话保留其快照。

getter 必须接收 OMP 提供的、属于该扩展会话的 cwd。进程工作目录或全局 settings 单例不能替代它。使用不同项目目录的并发会话必须分别解析自己的项目覆盖。

实施依赖公开 OMP API 在注册前提供此 cwd。OMP 18.1.11 支持异步扩展 factory，但其公开 factory API 没有提供可靠的会话 cwd。事件上下文在生命周期的较晚阶段提供 cwd。实施前必须验证目标 OMP 版本是否支持所需的激活上下文。若不支持，须先修订本提案，明确 OMP 支持方案或经过验证的注册生命周期，再继续实施。不得悄然将读取移到工具执行阶段，或从较晚的事件中注册工具。若需要调整 OMP 兼容版本范围，必须明确说明并验证。

### 校验与失败

扩展校验有效设置对象，并提供与 manifest 一致的运行时默认值。仅声明 manifest 默认值不会让 getter 自动返回该值。空设置对象使用全部默认值。只有缺失键使用默认值；显式 `null`、未知键、错误类型和无效枚举值使整个对象无效。即使工具已禁用，也要校验其加载模式。

设置读取被拒绝或有效对象无效时，不注册任何工具，并输出有界的配置诊断。诊断指出字段和原因，不输出完整配置。完整设置对象通过校验之前，不注册任何工具。

OMP 负责解析自己的配置文件。若公开 getter 将文件缺失或损坏转换为设置缺失，扩展对缺失值应用默认值。扩展无法承诺提供旧 YAML 读取器的文件级解析诊断。应验证并记录受支持 OMP 版本的行为，不通过直接解析 OMP 文件来恢复被 OMP 忽略的错误。

### 迁移与保留行为

移除对 `omp-codex-web-access.yml` 的全部读取，包括回退行为。不自动读取、导入、删除或重写旧文件。组件文档必须提供上述字段映射、原生 CLI 命令、项目覆盖示例、激活时机及 OMP 错误边界。现有用户必须在使用迁移后的扩展前转移设置。仅保留旧 YAML 文件时，原生默认值生效，包括空模型选择。

保留两个工具的名称、参数、`read` 审批、模型或网络操作前的 HTTP(S) 校验、模型与凭据解析、Responses 传输、引用及取消行为。禁用的工具不注册，无法通过顶层工具或 `xd://` 调用。启用的工具保留 OMP 的 `essential` 和 `discoverable` 行为，包括发现能力不可用时的回退。扩展不修改内置工具，也不增加发现传输。

## 考虑过的替代方案

保留专用 YAML 文件。它已经支持全部五项设置，且在注册阶段读取时不需要项目 cwd。但它保留了独立配置入口，无法提供所需的原生项目覆盖。满足激活前置条件后，优先采用原生设置。

## 验收标准

- 公开 OMP API 在注册前提供正确的会话 cwd。测试覆盖会话 cwd 与进程 cwd 不同，以及并发会话使用不同项目覆盖的情况。
- 五个 manifest 键、类型、枚举值和默认值与运行时校验一致。缺失值使用默认值；显式 null、未知键、错误类型和无效枚举值使整个设置对象被拒绝。
- 使用实际公开 getter 的集成检查验证用户与项目优先级，以及 OMP 对文件缺失和损坏的处理，不修改真实用户设置。
- 每次激活读取一份设置快照。读取未完成、读取被拒绝或对象无效时，工具注册数均为零。后续配置编辑只影响下次激活。
- 分别覆盖两个工具的启用开关和加载模式，包括同时禁用。模型选择缺失或为空时，在调用时报错。既有执行与取消检查继续通过。
- 旧 YAML 文件不影响行为，既不读取也不修改。两种语言的组件 README 均说明迁移和 OMP 错误边界。
- 组件类型检查与测试、仓库检查，以及 OMP 注册和发现验证在声明支持的 OMP 版本上通过。
- 完整的新决定保留旧决定仍有效的合同，并替换其 YAML 专属配置规则。中英文语义保持一致。

## 风险

- 用户升级时若未转移 YAML 设置，会失去原有模型选择和工具设置。默认启用可能暴露此前禁用的工具，空模型默认值会导致调用失败。迁移说明必须明确这些影响。
- 激活 cwd 错误可能应用另一个项目的模型和工具设置。满足 OMP 前置条件并通过独立会话测试后，实施才能声明支持项目覆盖。
- 若 OMP getter 忽略损坏的配置文件，原本希望禁用的工具可能因默认值而保持启用。文档必须说明经过验证的 OMP 行为；扩展校验只覆盖 getter 返回的有效值。
