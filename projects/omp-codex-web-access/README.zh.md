# omp-codex-web-access

[English](./README.md)

这个 OMP 扩展让 OMP 支持通过转发 Provider 使用 Codex 订阅，接入网页搜索与页面提取工具。OMP 内置的 `web_search` 只支持直接提供 Codex 订阅，不支持这种转发方式。扩展使用该 Provider 在 OMP 中登记的 `openai-responses` 模型，以原生网页搜索运行并返回生成文本和引用来源 URL；扩展不启动 Codex CLI。

## 工具

| 工具 | 参数 | 结果 |
| --- | --- | --- |
| `codex_web_search` | 必填的非空 `query` | 模型生成的回答及引用来源 URL |
| `codex_web_fetch` | 必填的 `url`（HTTP 或 HTTPS）；可选的 `prompt` | 模型从指定页面提取的信息及引用来源 URL |

`codex_web_search` 回答搜索查询。`codex_web_fetch` 读取指定的 HTTP(S) 页面并从中提取信息。提取结果由模型辅助生成：可能总结或清理页面内容，不是原始 HTML，也不是逐字页面快照。需要原文精确副本的调用方应直接抓取页面。两个工具均使用 OMP 的 `read` 审批级别，并将取消信号传递给请求。扩展包只注册这两个名称，不修改 OMP 内置搜索或抓取工具的设置。

## 安装

包尚未发布。检出 GitHub 仓库后，安装锁定版本的依赖，再把包安装到 OMP：

```bash
git clone https://github.com/ruokee/ruokee-agent-kit.git
cd ruokee-agent-kit/projects/omp-codex-web-access
bun install
omp install "$(pwd)" --scope user
```

`omp install` 是 `omp plugin install` 的别名；`omp plugin link "$(pwd)" --scope user` 效果相同。OMP 会读取 `package.json` 中的 `omp.extensions` 并加载 `src/extension.ts`，不需要手动设置扩展路径。支持的 OMP 范围为 `>=18.1.8 <19`。

## 配置

扩展初始化时读取一个文件：

```text
<agentDir>/omp-codex-web-access.yml
```

`agentDir` 使用 `@oh-my-pi/pi-coding-agent` 导出的 `getAgentDir()` 取得；一般情况下它是 `~/.omp/agent`，使用其他 OMP profile 时实际目录可能不同。配置在每次激活时读取一次；修改只在新启动的 OMP 会话中生效。

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

示例中的 `provider/model-id` 是占位值，不是默认模型。省略的工具设置使用示例所示的默认值，配置文件不存在时也使用这些默认值。

### 顶层字段

| 字段 | 必填 | 合同 |
| --- | --- | --- |
| `model` | 否 | OMP 已登记模型的模型选择器；键缺失或显式空字符串 `model: ""` 在调用时报错，裸值 `model:`（YAML null）使配置无效 |
| `tools` | 否 | 每工具设置映射；缺失的键保留该工具的默认值 |

YAML 格式错误、未知字段、字段类型错误、显式 `null` 或取值无效时，报告配置错误，两个工具均不注册。文件缺失或空文档时，以默认值注册两个工具。

### 每工具设置

每个工具独立设置 `enabled` 和 `loadMode`：

| 设置 | 行为 |
| --- | --- |
| `enabled: false` | 不注册工具，顶层调用和 `xd://` 均不可用 |
| `enabled: true`、`loadMode: essential` | 注册工具，作为顶层工具提供 |
| `enabled: true`、`loadMode: discoverable` | 注册工具，通过 `xd://codex_web_search` 或 `xd://codex_web_fetch` 发现 |

`loadMode` 只接受 `essential` 和 `discoverable`。工具禁用时，加载模式设置不影响行为。

发现方式遵循 OMP 宿主规则。启用 `tools.xdev` 且所需的读写传输工具可用时，`discoverable` 工具通过 `xd://` 使用，宿主显式固定为顶层的工具除外。xd 不可用时，OMP 可以将它们作为顶层工具提供。需要让工具不可用时，应设置 `enabled: false`，而不是 `discoverable`。扩展不修改宿主设置，也不自行实现发现传输机制。

## 模型执行

两个工具均通过配置模型的 `openai-responses` API 使用原生网页搜索，所选模型必须支持该能力。模型标识、端点、请求头和凭据通过 OMP 的模型登记与凭据 API 解析；YAML 文件保存模型选择，而非凭据。模型键缺失或为显式空字符串 `model: ""`、模型未登记或缺少凭据时，工具调用都会返回明确的工具错误。

两个工具共用同一请求与响应实现：回答正文、引用收集、Responses 错误处理，以及 JSON 和 SSE 响应支持。页面提取在任何模型、凭据或网络动作之前验证 URL 协议为 HTTP 或 HTTPS；网页访问由模型完成，扩展不直接抓取目标 URL。

## 开发

```bash
cd projects/omp-codex-web-access
bun install
bun run typecheck
bun test
```

运行时导入只限一个对等依赖：`@oh-my-pi/pi-coding-agent`。

## 许可证

MIT。
