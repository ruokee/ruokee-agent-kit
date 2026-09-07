# ADR 提案：添加 OMP Codex 网页访问组件

Decision owner: Ruokee
Draft writer: OMP GPT-6 Astra

[English](./2026-09-06-add-omp-codex-web-access.md) | 中文

## 动机

OMP 需要模型辅助的网页搜索和页面提取能力，工具名称应能与内置工具共存。用户还需要分别控制每个工具是否可用，以及工具参数定义是直接提供给模型，还是通过 `xd://` 按需发现。

## 提议

### 组件与工具

在 `projects/omp-codex-web-access` 维护自包含的 OMP 扩展包，包名为 `@ruokee/omp-codex-web-access`。运行时、包元数据、检查、组件入口页 `README.md` 与 `README.zh.md`，以及使用指南 `docs/usage.md` 与 `docs/usage.zh.md` 均位于组件目录内。入口页介绍组件并链接对应语言的使用指南。通过 `package.json` 的 `omp.extensions` 声明扩展入口。在仓库 `README.md` 和 `README.zh.md` 的 OMP 扩展列表中添加该组件，并分别链接对应语言的组件入口页。

提供两个工具：

| 工具 | 参数 | 结果 |
| --- | --- | --- |
| `codex_web_search` | 必填的非空 `query` | 模型生成的回答及引用来源 URL |
| `codex_web_fetch` | 必填的公开可访问 `url`；可选的 `prompt` | 模型从指定页面提取的信息及引用来源 URL |

页面提取可能总结或清理内容，不返回原始 HTML 或逐字页面快照。两个工具均使用 OMP 的 `read` 审批级别，并将取消信号传递给请求。

扩展包只注册这两个名称，不修改 OMP 内置搜索或抓取工具的设置。

### 配置

扩展初始化时，从 OMP 当前活动的 agent 目录读取 `omp-codex-web-access.yml`，目录通过 `getAgentDir()` 获取。配置修改在新启动的 OMP 会话中生效。

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

`model` 选择 OMP 已登记的模型，示例中的占位值不是默认模型。省略的工具设置使用示例所示的默认值，配置文件不存在时也使用这些默认值。模型选择缺失或为空时，在工具调用时报错。YAML 格式错误、未知字段、字段类型或取值无效时，报告配置错误，两个工具均不注册。

每个工具独立设置 `enabled` 和 `loadMode`：

| 设置 | 行为 |
| --- | --- |
| `enabled: false` | 不注册工具，顶层调用和 `xd://` 均不可用 |
| `enabled: true`、`loadMode: essential` | 注册工具，作为顶层工具提供 |
| `enabled: true`、`loadMode: discoverable` | 注册工具，通过 `xd://codex_web_search` 或 `xd://codex_web_fetch` 发现 |

`loadMode` 只接受 `essential` 和 `discoverable`。工具禁用时，有效的加载模式设置不影响行为。

发现方式遵循 OMP 宿主规则。启用 `tools.xdev` 且所需的读写传输工具可用时，`discoverable` 工具通过 `xd://` 使用，但宿主显式固定为顶层的工具除外。xd 不可用时，OMP 可以将它们作为顶层工具提供。需要让工具不可用时，应设置 `enabled: false`，而不是 `discoverable`。扩展不修改宿主设置，也不自行实现发现传输机制。

### 模型执行

两个工具均通过配置模型的 `openai-responses` API 使用原生网页搜索。模型标识、端点、请求头和凭据通过 OMP 的模型登记与凭据 API 解析。所选模型必须支持原生网页搜索。请求直接发送到其 Responses 端点，扩展不启动 Codex CLI。

YAML 文件是扩展包的配置来源，保存模型选择而非凭据。两个工具共用请求与响应实现，包括回答正文、引用收集、Responses 错误处理，以及 JSON 和 SSE 响应支持。

## 考虑过的替代方案

无

## 验收标准

- 组件可作为 OMP 扩展包独立安装，不依赖仓库内其他组件。包名、工具注册、示例及文档使用本提案定义的名称。仓库 README 文件对在 OMP 扩展列表中列出该组件，并分别链接对应语言的组件 README。
- 每个工具均可独立配置为禁用、`essential` 或 `discoverable`。禁用工具不出现在顶层工具和 xd 发现结果中。修改一个工具的设置不影响另一个工具。
- 在 xd 可用的 OMP 会话中，未被宿主显式固定为顶层的 `discoverable` 工具可通过对应的 `xd://` 地址查看说明并调用，`essential` 工具保持顶层呈现。关闭 xd 时，已启用的 `discoverable` 工具遵循 OMP 的顶层呈现行为。
- 默认设置符合配置契约，配置修改在新会话中生效。模型选择缺失或为空时，工具调用报错；配置无效时，两个工具均不注册。
- 搜索返回生成的回答和引用；页面提取接受 URL 及可选指令，并明确其结果由模型辅助生成。两个工具使用所选 OMP 模型，传递取消信号并报告请求错误。
- 组件 README 和使用指南文件对的中英文语义一致，并保持双向语言链接。组件检查覆盖注册与配置行为，真实 OMP 冒烟测试覆盖搜索、页面提取，以及 xd 发现和调用。

## 风险

模型辅助的页面提取可能遗漏或改写原文。调用方若将结果视为逐字来源，可能依据改写后的文本得出结论。工具说明和使用文档必须明确结果由模型辅助生成。
