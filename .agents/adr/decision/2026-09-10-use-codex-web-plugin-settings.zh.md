# ADR 决定：Codex 网页访问使用原生插件设置

Decision owner: Ruokee
Decision writer: OMP GPT-6 Astra
Reverses: [ADR 决定：添加 OMP Codex 网页访问组件](../archived/2026-09-06-add-omp-codex-web-access.zh.md)

[English](./2026-09-10-use-codex-web-plugin-settings.md) | 中文

## 动机

`omp-codex-web-access` 通过转发 Provider 的 Codex 订阅提供网页搜索和页面提取，并使用 OMP 原生插件设置进行配置。OMP 内置的 `web_search` 支持直接向 OMP 提供 Codex 订阅，但无法使用这种 Codex Harness 已支持的转发方式。扩展通过转发 Provider 在 OMP 中登记的 `openai-responses` 模型运行，并与 OMP 内置工具共存。用户需要分别控制每个工具是否可用，以及工具参数定义是直接呈现给模型，还是通过 `xd://` 发现。

该组件还需要一套 OMP 配置合同，同时支持用户值和项目覆盖。原生插件设置通过 OMP CLI 和公开设置 getter 提供这套合同，并继续使用 OMP 现有的模型登记与凭据 API 保存模型凭据。

## 决定

### 组件与工具

仓库在 `projects/omp-codex-web-access` 维护自包含的 OMP 扩展包，包名为 `@ruokee/omp-codex-web-access`。运行时、包元数据、检查以及 `README.md` 与 `README.zh.md` 文档均位于组件目录内。两个 README 分别是对应语言下组件的完整文档，覆盖工具、安装、配置、加载模式、模型执行、开发检查和许可证。扩展入口通过 `package.json` 的 `omp.extensions` 声明。仓库 README 在 OMP 扩展列表中列出该组件，并分别链接对应语言的组件 README。

扩展包只提供以下两个工具：

| 工具 | 参数 | 结果 |
| --- | --- | --- |
| `codex_web_search` | 必填的非空 `query` | 模型生成的回答及引用来源 URL |
| `codex_web_fetch` | 必填的 HTTP 或 HTTPS `url`；可选的 `prompt` | 模型从指定页面提取的信息及引用来源 URL |

页面提取可能总结或清理内容，不返回原始 HTML 或逐字页面快照。工具说明和组件文档明确结果由模型辅助生成。两个工具均使用 OMP 的 `read` 审批级别，并将取消信号传递给请求。

fetch 工具在任何模型解析、凭据查询或网络动作之前验证 URL 协议为 HTTP 或 HTTPS。网页访问由模型完成；扩展不直接抓取目标 URL，也不执行 DNS 或私网地址探测。扩展包不修改 OMP 内置搜索或抓取工具的设置。

### 原生设置与作用域

OMP 原生插件设置是 `@ruokee/omp-codex-web-access` 的唯一配置来源。包的 `omp.settings` schema 声明以下扁平键：

| 键 | 类型 | 默认值 | 替代的旧 YAML 路径 |
| --- | --- | --- | --- |
| `model` | string | `""` | `model` |
| `searchEnabled` | boolean | `true` | `tools.codex_web_search.enabled` |
| `searchLoadMode` | enum | `essential` | `tools.codex_web_search.loadMode` |
| `fetchEnabled` | boolean | `true` | `tools.codex_web_fetch.enabled` |
| `fetchLoadMode` | enum | `discoverable` | `tools.codex_web_fetch.loadMode` |

两个加载模式枚举只接受 `essential` 和 `discoverable`。运行时会去除 `model` 首尾空白。模型选择缺失或为空时，仍在工具调用时报错，不阻止工具注册。插件设置只保存模型选择器；端点、请求头和凭据由 OMP 解析，不在插件设置中定义。

扩展通过公开的 `getPluginSettings(packageName, cwd)` API 读取有效设置。OMP 将用户设置与 `.omp/plugin-overrides.json` 中 `settings` 下的包条目合并，同名键使用项目值覆盖用户值。扩展不增加 OMP 文件读取器、存储格式或合并规则。项目覆盖示例必须保留其他插件条目。

用户通过 OMP 原生 CLI 设置用户级值，例如：

```bash
omp plugin config set @ruokee/omp-codex-web-access model provider/model-id
omp plugin config set @ruokee/omp-codex-web-access fetchEnabled false
```

OMP 在扩展看到设置前负责解析自己的配置。用户运行时 JSON 缺失时，用户级设置对象为空；有效的项目覆盖仍然可以提供值。用户运行时 JSON 损坏时，公开 getter 会拒绝。项目覆盖候选缺失时，OMP 会继续检查下一个候选目录。候选文件损坏时会跳过。如果没有有效项目候选文件，则不存在项目覆盖。扩展只校验 getter 返回的对象，不直接解析 OMP 文件来恢复 OMP 已吞掉或拒绝的错误。

### 激活与校验

factory 只安装 `session_start` 处理器。加载 factory 时不读取设置，也不注册任何工具。扩展激活后的第一次 `session_start` 中，处理器等待 `getPluginSettings(PACKAGE_NAME, ctx.cwd)` 返回，校验一份完整有效的设置对象，再根据这份快照注册启用的工具。模型选择器和两个工具定义都使用同一份快照。

每次激活都会缓存同一个初始化 Promise。同一次激活中的重复或并发 `session_start` 共享该 Promise，不重新读取设置，也不重复注册工具。设置读取被拒绝或有效对象无效时，本次激活终止，不会重试。重启 OMP 进程会重新激活扩展并读取更新后的值。同一 OMP 进程中新建或切换 session 不会刷新已有激活的快照。正常 OMP 模式会等待这次初始化完成后才提供 `prompt`。直接 OMP SDK 调用方必须先初始化 OMP 扩展运行时，发出 `session_start` 并等待该事件完成，再调用 `prompt`。

运行时默认值与 manifest 一致，但 manifest 默认值本身不能替代 getter 结果。getter 返回的空有效设置对象使用全部默认值。只有缺失键使用默认值；显式 `null`、未知键、错误类型和无效枚举值会使完整对象无效。即使工具已禁用，也要校验加载模式。getter 被拒绝或对象无效时，不注册任何工具，并输出有界诊断，指出字段和原因，不转储配置值。

配置校验完成后才调用注册 API，但注册 API 自身抛错时，异常前已经注册的工具可能保留。扩展报告错误并停止继续注册，不承诺对已经注册的前缀做全局回滚。

### 迁移与呈现

扩展不读取、导入、删除或重写 `omp-codex-web-access.yml`，也不保留任何回退行为。现有用户按照上述映射手工转移值。旧 YAML 文件不会自动删除。迁移后必须重启 OMP 进程，让扩展重新激活并读取原生值。如果旧 YAML 是唯一配置来源，它不会产生任何效果，原生默认值生效，包括空模型选择器。

每个工具独立控制启用状态和呈现方式：

- `enabled: false` 映射到原生的 `*Enabled: false` 键。工具不会注册，顶层工具和 `xd://` 都不能调用它。
- `essential` 让已启用的工具保持在 OMP 顶层呈现中。
- `discoverable` 注册已启用的工具供 OMP 发现，在 OMP 传输可用时可能通过 `xd://` 挂载。
- 发现不可用时，OMP 可以将 discoverable 工具回退到顶层呈现。

扩展不修改 OMP 内置工具，也不增加发现传输。

### 模型执行

两个工具均通过配置模型的 `openai-responses` API 使用原生网页搜索，所选模型必须支持该能力。模型标识、端点、请求头和凭据通过 OMP 的模型登记与凭据 API 解析。请求直接发送到模型的 Responses 端点，扩展不启动 Codex CLI。

两个工具共用请求与响应行为，包括回答正文、引用收集、Responses 错误、取消处理，以及 JSON 和 SSE 响应。模型辅助的页面提取限制仍属于公开工具合同。

## 考虑过的替代方案

继续使用专用 YAML 文件作为配置来源。它可以保留现有文件和注册阶段的读取行为，但会继续维护独立配置入口，也无法提供 OMP 原生项目覆盖。因此采用原生插件设置合同，放弃这一方案。

## 结果

OMP 为该组件提供统一的原生 CLI 和 getter 合同，并由 OMP 解析用户值与项目覆盖。工具注册继续绑定到每次激活的一份有效设置快照。面向用户的配置刷新路径是重启 OMP 进程；同一进程中的 session 切换或新建 session 不会刷新已有快照。

用户如果升级时不转移 YAML 值，会失去原有模型和工具设置。旧 YAML 文件会保留，除非用户手动删除，但不会产生效果。模型选择缺失或为空时，工具仍可注册，并只会在调用时失败。

OMP 负责文件解析和作用域合并，扩展负责 schema 校验、有界诊断和工具注册。用户运行时文件损坏可能使 getter 拒绝，项目候选损坏则按 OMP loader 规则跳过。注册 API 在开始注册后失败时可能留下部分注册结果，因此合同不承诺全局回滚。

组件继续与 OMP 内置工具共存，使用 OMP 的发现和审批规则，并将模型辅助的页面提取与原始页面抓取区分开。
