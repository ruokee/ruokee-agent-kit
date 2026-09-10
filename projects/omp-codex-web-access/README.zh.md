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

扩展使用 OMP 的原生插件设置。用户级设置通过 OMP 插件 CLI 写入；项目设置从 `.omp/plugin-overrides.json` 读取，并在当前项目中覆盖同名的用户级值。

### 五个设置

| 设置 | 类型 | 默认值 | 作用 |
| --- | --- | --- | --- |
| `model` | 字符串 | `""` | `provider/model-id` 形式的 OMP 模型选择器；空值会在调用工具时失败 |
| `searchEnabled` | 布尔值 | `true` | 注册 `codex_web_search` |
| `searchLoadMode` | `essential` 或 `discoverable` | `essential` | OMP 如何呈现 `codex_web_search` |
| `fetchEnabled` | 布尔值 | `true` | 注册 `codex_web_fetch` |
| `fetchLoadMode` | `essential` 或 `discoverable` | `discoverable` | OMP 如何呈现 `codex_web_fetch` |

manifest 与运行时校验使用同一组五个键、类型、枚举值和默认值。缺失键使用这些默认值。显式 `null`、未知键、错误类型和无效枚举值会使完整设置对象无效，因此两个工具都不会注册。

### 用户级设置

使用 OMP CLI 设置用户级值：

```bash
omp plugin config set @ruokee/omp-codex-web-access model provider/model-id
omp plugin config set @ruokee/omp-codex-web-access searchEnabled true
omp plugin config set @ruokee/omp-codex-web-access searchLoadMode essential
omp plugin config set @ruokee/omp-codex-web-access fetchEnabled true
omp plugin config set @ruokee/omp-codex-web-access fetchLoadMode discoverable

omp plugin config list @ruokee/omp-codex-web-access
omp plugin config get @ruokee/omp-codex-web-access model
omp plugin config delete @ruokee/omp-codex-web-access model
```

`delete` 会删除用户级键；同名的项目覆盖仍然有效，只有用户值和项目值都不存在时，运行时才会应用默认值。模型选择器不是凭据。模型标识、端点、请求头和凭据仍由 OMP 的模型登记与凭据 API 提供。

### 项目覆盖

在项目中放置 `.omp/plugin-overrides.json`。添加本包设置时，保留对象中其他插件及其设置：

```json
{
  "settings": {
    "@other/plugin": {
      "keepThisSetting": true
    },
    "@ruokee/omp-codex-web-access": {
      "searchEnabled": false,
      "fetchLoadMode": "essential"
    }
  }
}
```

OMP 会将项目包条目合并到用户包条目之上。项目覆盖缺失时，用户设置保持不变。OMP loader 负责文件解析：用户运行时 JSON 缺失时产生空的用户设置，用户运行时 JSON 损坏时公开 getter 会拒绝；项目候选文件缺失或损坏时会跳过并继续检查其他候选目录。如果没有有效项目候选文件，则不存在项目覆盖。扩展只校验 `getPluginSettings` 返回的对象，不解析 OMP 文件来恢复已被 OMP 吞掉或拒绝的文件错误。getter 失败时不注册任何工具，并输出有界诊断，不转储原始异常或配置值。

### 激活与设置快照

扩展 factory 只安装 `session_start` 处理器，加载 factory 时不读取设置也不注册工具。第一次 `session_start` 会等待 `getPluginSettings(PACKAGE_NAME, ctx.cwd)`，校验一份完整有效的设置对象，再根据这份快照注册启用的工具。同一次激活中的重复或并发 `session_start` 共享一个 Promise，不刷新设置，也不重复注册工具。下一次扩展激活才会重新读取；激活期间修改文件不是热重载。初始化错误会使本次激活失败，同一次激活不会重试。

OMP 模式会在第一次 prompt 前等待扩展初始化。直接 OMP SDK 调用方必须显式初始化 OMP 扩展运行时，在调用 `prompt` 前发出 `session_start` 并等待该事件处理器完成。扩展不增加独立初始化 API，注册阶段也不会发起模型请求。

### 启用与发现

旧文件中的 `enabled: false` 映射到对应的原生 `*Enabled: false` 键。工具不会注册，顶层工具和 `xd://` 都不能调用它。`essential` 与 `discoverable` 只影响已启用的工具。`essential` 让工具保持在 OMP 顶层呈现中；`discoverable` 注册工具供 OMP 发现，在 OMP 传输可用时可能通过 `xd://` 使用。发现不可用时，OMP 可以回退到顶层呈现。`discoverable` 不表示禁用。

### 从旧 YAML 手工迁移

扩展不读取、导入、删除或重写 `omp-codex-web-access.yml`。使用原生设置前手工转移值：

| 旧 YAML 字段 | 原生设置 |
| --- | --- |
| `model` | `model` |
| `tools.codex_web_search.enabled` | `searchEnabled` |
| `tools.codex_web_search.loadMode` | `searchLoadMode` |
| `tools.codex_web_fetch.enabled` | `fetchEnabled` |
| `tools.codex_web_fetch.loadMode` | `fetchLoadMode` |

单独保留旧 YAML 不会影响行为。将值迁移到原生设置后，重启 OMP 进程，让扩展重新激活并读取新值。同一进程中新建或切换 session 不会刷新设置快照；初始化失败时，同一次激活不会重试。没有原生值时，两个工具使用默认值，模型选择器为空；配置有效的 OMP 模型选择器后才能成功调用。

## 模型执行

两个工具均通过配置模型的 `openai-responses` API 使用原生网页搜索，所选模型必须支持该能力。原生设置保存模型选择器，不保存凭据。模型键缺失、显式为空的原生 `model` 字符串、模型未登记或缺少凭据时，工具调用会返回明确错误。

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
