# omp-smart-context

[English](./README.md)

`@ruokee/omp-smart-context` 提供可独立开关的上下文能力。会话历史和压缩流程仍由 OMP 管理。

## 使用指南

- [对齐远端压缩请求](./docs/remote.zh.md)。
- [对齐 Handoff 请求](./docs/handoff.zh.md)。
- [补齐压缩请求用量记录](./docs/usage.zh.md)。
- [追加模型专用指令](./docs/model-prompts.zh.md)。
- [用 Pin 跨压缩保留文本](./docs/pin.zh.md)。
- [配置本包](#配置)、[查看状态](./docs/status.zh.md)、[迁移既有设置](./docs/migration.zh.md)或[核对兼容性](#兼容性)。
- [更新记录](./CHANGELOG.zh.md)。

## 安装

在组件目录运行：

```bash
omp install . --scope user
```

OMP 原生插件管理器加载扩展及其声明的设置，无需另加扩展入口或配置文件。替换 smart-cache、独立 Pin 或 QoL 迁出模块时，先按[迁移说明](./docs/migration.zh.md)处理，再重启。

## 配置

```bash
omp plugin config list @ruokee/omp-smart-context
omp plugin config set @ruokee/omp-smart-context compactionCacheProviderFilter example-provider
omp plugin config set @ruokee/omp-smart-context compactionCacheEnabled true
omp plugin config set @ruokee/omp-smart-context handoffCacheEnabled true
omp plugin config set @ruokee/omp-smart-context modelPromptsEnabled true
omp plugin config set @ruokee/omp-smart-context pinEnabled true
```

- `compactionCacheEnabled`：布尔值，默认 `false`，启用远端对齐。
- `compactionCacheProviderFilter`：字符串，默认 `""`。只有与当前模型的 Provider 名称精确相同时，才修复 Remote。它不选择模型或路由。空值使远端对齐不可用。
- `compactionCacheMode`：`standard` 或 `hooks`，默认 `hooks`。选择远端对齐可复用多少已完成的请求处理结果，见[模式](./docs/remote.zh.md#模式)。
- `handoffCacheEnabled`：布尔值，默认 `false`，独立于远端设置启用 Handoff 对齐。
- `compactionUsageEnabled`：布尔值，默认 `true`。宿主没有原生记录时补齐 soft/Handoff 用量。
- `modelPromptsEnabled`：布尔值，默认 `false`，追加匹配模型的指令。关闭时不读规则文件，也不报告未使用文件的错误。
- `pinEnabled`：布尔值，默认 `false`，启用 `/ctx-pin` 和 `ctx_pin`。关闭保留已有记录及历史。

### 配置来源

OMP 将项目覆盖合并到用户设置上，缺失键使用默认值。本包只读自身设置，没有总开关。

### 生效时机

修改设置或扩展注册后重启 OMP。导航或新建会话不会重新加载设置。模型规则文件不同，文件修改在下一受覆盖普通轮次生效，无需重启。

### 配置错误

某项能力的设置无效时，只停用该能力。未知键、非对象设置根或设置读取失败会拒绝整个包配置。`/smart-context` 报告固定原因，不打印被拒绝的值。

## 远端压缩对齐

OMP 准备 Remote 压缩和普通请求的方式不同。提示词、工具定义或历史的差异可能破坏共同前缀，导致缓存失配。远端对齐恢复符合条件的共同内容，让压缩有机会复用该前缀。

开启远端对齐，并将筛选值设为当前模型的精确 Provider 名称。OMP 仍须在支持 Remote 的模型上选择 Remote。范围限于非 Codex `openai-responses` V2，模型和原生路由不变。模式及限制见[远端指南](./docs/remote.zh.md)。

## Handoff 对齐

Handoff 请求可能遗漏普通请求已有的系统指令，并使用不同生成选项。这些差异可能破坏共同缓存前缀。Handoff 对齐恢复受支持的共同内容和选项。

使用独立且默认关闭的开关。原生生成、取消和回退仍归 OMP。当前协议、认证支持及限制见 [Handoff 指南](./docs/handoff.zh.md#支持范围)。

## 补齐压缩请求用量记录

补齐压缩请求在会话统计中缺失的用量。默认开启，安装宿主具备原生记账接口时自动停止。记录范围、成本、跳过条件及上游修复见[用量指南](./docs/usage.zh.md)。

## 模型提示词规则

为指定模型追加系统指令。受覆盖的普通主轮次及子轮次分别按自身当前模型匹配，文件修改在下一轮生效。不为所有旁路请求增加注入。目录、格式、错误及信任影响见[模型提示词规则](./docs/model-prompts.zh.md)。

## Pin

将选定文本保留在当前会话分支的后续普通请求中，包括压缩之后。启用后可使用用户命令 `/ctx-pin` 和 Agent 工具 `ctx_pin`。`get` 读取一条完整正文，`list` 和 `show` 读取全部活跃正文及元数据，保留空白和长文本。确认、更新、容量、重置及持久化风险见 [Pin 指南](./docs/pin.zh.md)。

## 状态

运行 `/smart-context` 查看各项能力，不启动模型轮次。远端和 Handoff 分别报告。`awaiting-reference` 表示等待符合条件的普通请求，`already-aligned` 和 `rewritten` 表示已完成对齐，`rejected` 表示没有改写但原生请求仍正常发送。全部状态和计数见[状态参考](./docs/status.zh.md)。

## 兼容性

最低维护 OMP 版本为 `18.13.3`，不设维护上限。这是维护责任，不是安装或运行门槛。缺少接口时停用所属能力。维护下限以上版本不等于每个宿主版本或扩展组合均已运行验证。

宿主 peer `@oh-my-pi/pi-agent-core`、`@oh-my-pi/pi-ai`、`@oh-my-pi/pi-coding-agent`、`@oh-my-pi/pi-tui`、`@oh-my-pi/pi-utils` 使用 `*`，开发依赖锁定在 `18.13.3`。即使请求对齐成功，缓存可用性和计费仍取决于提供方。

请求对齐支持原生 CLI/SDK 主会话、task 和 Eval 子会话，包括扩展延迟加载及进程恢复，绑定活跃会话和实际发送。手工构造 Agent 或替换私有准备函数不在本支持范围内。

## 开发

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
```

验证资料记录候选、宿主版本、输入、观察和限制。历史证据保留原归属及条件。区分源码检查、受控整合、真实宿主行为和提供方测量。

## 许可

MIT。
