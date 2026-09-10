# ADR 决定：添加 OMP Codex 网页访问组件

Decision owner: Ruokee
Draft writer: OMP GPT-6 Astra
Archived: 2026-09-10
Reversed by: [ADR 决定：Codex 网页访问使用原生插件设置](../decision/2026-09-10-use-codex-web-plugin-settings.zh.md)

[English](./2026-09-06-add-omp-codex-web-access.md) | 中文

## 动机

OMP 内置的 `web_search` 支持直接向 OMP 提供 Codex 订阅，但无法使用第三方转发 Provider 暴露的 Codex 订阅。Codex Harness 支持这种调用方式。因此，OMP 需要一组网页搜索和页面提取工具，通过转发 Provider 在 OMP 中登记的 `openai-responses` 模型运行，并与内置工具共存。用户还需要分别控制每个工具是否可用，以及工具参数定义是直接提供给模型，还是通过 `xd://` 按需发现。

## 决定

### 组件与工具

仓库在 `projects/omp-codex-web-access` 维护自包含的 OMP 扩展包，包名为 `@ruokee/omp-codex-web-access`。运行时、包元数据、检查以及 `README.md` 与 `README.zh.md` 文档均位于组件目录内。两个 README 分别是该语言下组件的完整文档，覆盖工具、安装、配置、加载模式、模型执行、开发检查和许可证。扩展入口通过 `package.json` 的 `omp.extensions` 声明。仓库 `README.md` 和 `README.zh.md` 在 OMP 扩展列表中列出该组件，并分别链接对应语言的组件 README。

扩展包提供两个工具：

| 工具 | 参数 | 结果 |
| --- | --- | --- |
| `codex_web_search` | 必填的非空 `query` | 模型生成的回答及引用来源 URL |
| `codex_web_fetch` | 必填的 `url`（HTTP 或 HTTPS）；可选的 `prompt` | 模型从指定页面提取的信息及引用来源 URL |

页面提取可能总结或清理内容，不返回原始 HTML 或逐字页面快照。工具说明和组件文档明确结果由模型辅助生成。两个工具均使用 OMP 的 `read` 审批级别，并将取消信号传递给请求。

页面提取在任何模型解析、凭据查询或网络请求之前验证 URL 协议为 HTTP 或 HTTPS。网页访问由模型完成；扩展不直接抓取目标 URL，也不执行 DNS 或私网地址探测。

扩展包只注册这两个名称，不修改 OMP 内置搜索或抓取工具的设置。

### 配置

扩展初始化时，从 OMP 当前活动的 agent 目录读取 `omp-codex-web-access.yml`，目录通过 `getAgentDir()` 获取。配置在每次激活时读取一次，配置修改在新启动的 OMP 会话中生效。

```yaml
model: provider/model-id
tools:
  codex_web_search:
    enabled: true
    loadMode: essential
  codex_web_fetch:
    enabled: true
    loadMode: discoverable
```

`model` 选择 OMP 已登记的模型，示例中的占位值不是默认模型。省略的工具设置使用示例所示的默认值，配置文件不存在时也使用这些默认值。只有键缺失才使用省略语义：`model`、`tools` 或工具条目出现显式 `null` 属于类型错误，会使配置无效。模型选择缺失或为空时，在工具调用时报错。YAML 格式错误、未知字段、字段类型或取值无效时，报告配置错误，两个工具均不注册。

每个工具独立设置 `enabled` 和 `loadMode`：

| 设置 | 行为 |
| --- | --- |
| `enabled: false` | 不注册工具，顶层调用和 `xd://` 均不可用 |
| `enabled: true`、`loadMode: essential` | 注册工具，作为顶层工具提供 |
| `enabled: true`、`loadMode: discoverable` | 注册工具，通过 `xd://codex_web_search` 或 `xd://codex_web_fetch` 发现 |

`loadMode` 只接受 `essential` 和 `discoverable`。工具禁用时，有效的加载模式设置不影响行为。

发现方式遵循 OMP 宿主规则。启用 `tools.xdev` 且所需的读写传输工具可用时，`discoverable` 工具通过 `xd://` 使用，宿主显式固定为顶层的工具除外。xd 不可用时，OMP 可以将它们作为顶层工具提供。需要让工具不可用时，应设置 `enabled: false`，而不是 `discoverable`。扩展不修改宿主设置，也不自行实现发现传输机制。

### 模型执行

两个工具均通过配置模型的 `openai-responses` API 使用原生网页搜索，所选模型必须支持该能力。模型标识、端点、请求头和凭据通过 OMP 的模型登记与凭据 API 解析。请求直接发送到模型的 Responses 端点，扩展不启动 Codex CLI。

YAML 文件是扩展包的配置来源，保存模型选择而非凭据。两个工具共用请求与响应实现，包括回答正文、引用收集、Responses 错误处理，以及 JSON 和 SSE 响应支持。

## 考虑过的替代方案

无

## 结果

OMP 获得两个可独立控制的网页工具，加载模式遵循宿主的发现规则。组件测试覆盖注册、配置语义、请求传输和取消行为；真实 OMP 冒烟测试仍是宿主集成的验证入口。

模型辅助的页面提取可能遗漏或改写原文。调用方若将结果视为逐字来源，可能依据改写后的文本得出结论。工具说明和组件文档通过声明结果由模型辅助生成来缓解该问题，但无法消除该限制。
