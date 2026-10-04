# OMP 状态栏

[English](./usage.md)

一个常驻的 OMP 状态栏扩展：一个 `belowEditor` Widget Host 加内置 Provider，显示 token 指标、缓存命中率、上下文用量，以及本次会话已回答的模型请求次数。

属于 [projects/omp-status-bar](../README.zh.md)，作者为 Ruokee。

## 安装

Package 尚未发布。克隆本仓库，安装锁定版本的依赖，再把 Package 链接到 OMP：

```bash
cd projects/omp-status-bar
bun install
omp plugin link "$(pwd)" --scope user
```

OMP 会读取 `package.json` 中的 `omp.extensions` 并加载 `src/extension.ts`，不需要手动设置 Extension 路径。

最低维护 OMP 版本为 `18.5.0`，见[组件 README 的兼容性小节](../README.zh.md)。该下限只表达维护责任：不限制安装、激活或运行，也不是已验证版本的清单。自动化检查针对 OMP 18.5.0 运行，`bun test` 与 `tsc --noEmit` 均通过。这些属于针对宿主包安装副本的包级检查，不是真实宿主运行。真实 TUI 验证覆盖 OMP 18.2.3、18.2.8、18.4.3 与 18.5.1。

## 配置

Host 在 `session_start` 读取一个文件：

```text
<agentDir>/omp-status-bar.yml
```

`agentDir` 使用 `@oh-my-pi/pi-coding-agent` 导出的 `getAgentDir()` 取得，因此配置跟随当前 OMP profile。不支持热加载，修改在下一个 OMP 会话生效。

在同一进程中新建、恢复或分叉会话时会重新读取配置。旧 Host 完成停止后，新 Host 才绑定数据源并挂载 Widget。关闭会话也会中断尚未完成的 Provider 启动。

完整示例：

```yaml
version: 1
separator: slash
tight: false
statuses:
  - id: total
    options:
      label: compact
  - id: input
    options:
      label: word
  - id: cache
  - id: output
  - id: cache-hit
    options:
      label: word
  - id: context
    options:
      mode: percent
  - id: turn
```

### 顶层字段

| 字段 | 必填 | 合同 |
| --- | --- | --- |
| `version` | 是 | 当前只接受整数 `1` |
| `separator` | 否 | `space`、`slash`、`dot`、`pipe`，默认 `slash` |
| `tight` | 否 | `false` 在非空输出前加一个 ASCII 空格，`true` 则不加；默认 `false` |
| `statuses` | 是 | 有序数组，同时表达启用项和显示顺序 |

不设置 Package 自己的 `enabled` 字段，整体启用和停用由 OMP Plugin 管理。

配置文件缺失时 Package 静默不显示。顶层无效（YAML 解析失败、字段类型错误、schema 版本不对、separator 非法或未知顶层字段）时，本次会话不启动任何 Provider，并记录一条有界诊断。空 `statuses` 数组合法，但不挂载 Widget。

每个 `statuses` 条目包含非空字符串 `id` 和可选的 `options` 映射（缺省 `{}`）。条目中出现 `id` 和 `options` 之外的字段会使该条目无效。同一个 Provider ID 可以出现多次，每一项创建独立实例。Provider 不存在、合同版本不兼容或 options 无效时只跳过对应条目，其他条目继续启动。

### 分隔符

| 值 | 字形 |
| --- | --- |
| `space` | 一个 ASCII 空格 |
| `slash` | `/` |
| `dot` | `·` |
| `pipe` | `\|` |

`slash`、`dot` 和 `pipe` 会在字形两侧各带一个 ASCII 空格；`space` 只有一个 ASCII 空格。Widget 用弱化样式渲染整个 separator。Provider 不输出 separator。

## 内置 Provider

内置 ID：`total`、`input`、`cache`、`output`、`cache-hit`、`context`、`turn`。不保留旧的 `tokens` 或 `cost` ID，也不提供别名。

### 指标公式

五个 token 指标读取同一个每 tick 快照。该快照保存对话自身的用量，按当前分支汇总：assistant 消息的 usage 与 `task` 工具结果的 usage 计入，带外的 `model_usage` 条目不计入。OMP 的 `getUsageStatistics()` 把这两类合并成一个会话总数，读取它会把 Find 判定级联当对话流量：该级联的 `cacheRead` 恒为 0，会让命中率在整个会话里被压低。由于汇总来自分支，树导航与分叉对它的影响与 `turn` 一致。

```text
input = input + cacheWrite          (I)
cacheRead = cacheRead               (C)
total = input + cacheWrite + cacheRead + output   (T)
output = output                     (O)
hitRate = C / (I + C)               (H)
```

其中 `input`、`cacheWrite`、`cacheRead`、`output` 是该分支的对话计数。

T、I、C、O 使用共享的十进制 token formatter：

1. 非有限值和非正数显示 `0`。
2. 小于 `1000` 时显示四舍五入后的整数。
3. 以 `1000` 为进位，依次使用 `K`、`M`、`G`、`T`。
4. 缩放值小于 `99.95` 时保留一位小数，去掉结尾 `.0`。
5. 缩放值不小于 `99.95` 时显示整数。
6. 缩放值达到 `999.5` 时提升到下一个单位，避免出现 `1000K`。

H 默认保留一位小数，末尾补零，例如 `H 82.0%` 或 `Hit 82.0%`。当 `I + C` 为零时，该 Provider 不发布片段。

### 标签 option

`total`、`input`、`cache`、`output` 和 `cache-hit` 接受 `label` option。`cache-hit` 还接受 `decimalPlaces`。

```yaml
options:
  label: compact
```

| 值 | `total` | `input` | `cache` | `output` | `cache-hit` |
| --- | --- | --- | --- | --- | --- |
| `compact`（默认） | `T` | `I` | `C` | `O` | `H` |
| `word` | `Total` | `Input` | `Cache` | `Output` | `Hit` |

标签按 Provider 实例生效，允许混用。Widget 不会因为终端变窄把 `word` 降级成 `compact`。

### 缓存命中率精度

`cache-hit` 接受 `decimalPlaces` option：

```yaml
options:
  decimalPlaces: 2
```

该值必须是 `0` 到 `2` 的整数。默认值为 `1`，Provider 按该位数渲染百分比，末尾补零。设为 `0` 时不显示小数，例如 `Hit 82%`。上限取 `2`，因为 `0.01` 个百分点已经是状态栏百分比能有效传达的最细粒度。

### 固定配色

标签、标签后的空格和数值共用同一个颜色 span。颜色不开放配置：

| Provider | 颜色 |
| --- | --- |
| `total` | `#5fafaf` |
| `input` | `#00afff` |
| `cache` | `#af87ff` |
| `output` | `#ff5faf` |
| `cache-hit` | `#8787af` |
| `turn` | `#87d7af` |

## turn Provider

`turn` 显示本次会话中有多少次模型请求得到了成功响应。它不接受任何 option：出现任何 option key 都会使该条目失效。

```yaml
statuses:
  - id: turn
```

数值为会话累计值，但始终跟随会话当前持有的分支。绑定会话时按该分支上已经成功结束的 assistant 响应计数，此后每次成功响应使数值前进；沿会话树导航或新建分支时会按新的前台分支重新取值，回退到较早的位置会让数值下降。恢复会话或切换会话则继续前台的会话计数，而不是从零开始。

只有成功的响应才使数值前进。失败的请求、被中断的响应，以及在模型调用前就被拦下的请求都不改变它。

Provider 把固定标签 `Turn`、一个空格和数值渲染为同一个 `#87d7af` 颜色的 span。有轮次进行中时数值使用强调样式，其余情况使用弱化样式。数值为零时不发布内容。

`turn` 跟随会话的轮次生命周期，不读取依赖快照的内置 Provider：它不读取用量或上下文数据，也不注册 timer。因此只配置 `turn` 的会话不启动内部数据源。

## context Provider

`context` 接受一个 option：

| option | 值 | 默认值 | 输出例子 |
| --- | --- | --- | --- |
| `mode` | `percent`、`absolute` | `percent` | `U+F0068 ctx 12%`、`U+F0068 14.7K` |

未知 option 或其他 `mode` 值使当前条目失效。

数据来自 `ctx.getContextUsage()`。数据不存在或 `contextWindow <= 0` 时，该 Provider 不发布片段。`percent` 使用整数四舍五入；`absolute` 只用共享 token formatter 格式化当前 token 数。context window 只用于上述校验，不显示。

片段以 Nerd Font 字形 `U+F0068` 开头，后接一个普通空格和用量文本，例如 `U+F0068 ctx 12%`。该图标是静态的：不闪烁，也不随用量变化。图标以 `#5fafaf` 弱化显示，用量文本使用终端默认前景色。图标与文本属于同一个 ProviderFragment，因此顶层 separator 不会落在两者之间。终端字体不支持该字形时不提供回退字符。

## 数据刷新

第一个依赖快照的内置 Provider 启动时，内部数据源立即采样，并启动一个共享的 OMP 托管 interval，每 `600 ms` 采样一次。依赖快照的内置 Provider 读取同一个不可变快照；T、I、C、O、H 不会各自聚合一次分支造成每 tick 五次汇总。`turn` 由事件驱动：它不读取数据源，不注册 timer，也不会启动共享 interval。

存在 TICO 或 H 订阅时，每个 tick 最多聚合一次分支。`getContextUsage()` 只在 `context` 有订阅时读取。只配置第三方 Provider 或只配置 `turn` 时不启动内部数据源。

同一进程只持有一组绑定数据源。`session_start` 会为当前处于前台的会话重新绑定，`session_shutdown` 再释放。无 UI 的会话两件事都不做，因此同一进程内的子代理会话不会改绑它所共享的 UI 会话数据源。轮次计数遵循同一条规则：无 UI 的会话忽略自己的轮次事件，不会改变前台会话的数值。

快照只在字段变化时增加 revision。Provider 只在自己的标准化 fragment 变化时发布。

最后一个依赖快照的内置 Provider 停止时清除共享 interval。第三方 Provider 通过公开 Provider context 使用自己的 OMP 托管 timer。

第一方 Provider 不公开 `refreshMs` option；固定采样周期是内部实现，不属于 schema version 1。

## 失败行为

- 只有 `ctx.hasUI` 为真时才读取配置、启动内置数据源并挂载 Widget。无 UI 的会话不绑定任何数据源，也不持有清理状态，因此不会替换、采样或解绑 UI 会话绑定的内容。
- 一个配置项创建一个 Provider 实例；`create()` 或 `start()` 失败只停用并清理该实例。
- 所有 interval 和 timeout 都通过 OMP 托管 timer 创建。
- Provider callback、发布、启动和停止的错误不会终止 OMP 会话。
- 诊断按内容去重并限制数量。
- shutdown 之后 Host 拒绝新 timer、新发布和迟到的 callback。
- shutdown 与未完成的 start 竞争时以 shutdown 为准：不重新挂载，不发布。

## 发布门槛

自动化测试全部无头运行，无法证明终端布局正确。打发布标签之前，必须在目标 OMP 版本上启动一个启用本扩展的真实 OMP TUI 会话，并确认：

- 状态栏在编辑器下方渲染一行持久显示；
- 请求运行期间 token 指标和上下文用量持续更新；
- 轮次计数对每次已回答的请求前进一次，轮次之间保持变暗，失败或被中断的请求不改变数值，恢复会话后继续原有计数，树回退或新建分支后跟随新的前台分支；
- 实时调整终端宽度后仍保持单行，并在可用列宽内截断；
- 状态栏与 OMP 原生 status line、终端标题 spinner 和子代理卡片共存，无闪烁或布局跳动；
- 切换会话和退出后不留下重复 Widget 或 timer。

OMP 18.2.3 兼容性使用组件锁定依赖与 `pro-20x/gpt-5.6-luna` 模型完成验证。真实 TUI 覆盖了 48 到 100 列的实时宽度调整、请求期间指标更新、会话切换、SGR 鼠标输入、子代理 Task 卡片、终端标题 spinner 帧和正常退出。验证时通过临时覆盖降低 recent-token 保留阈值，使手动 `/compact` 执行远端压缩；OMP 显示 `remote-compacted · 20K→19K`，状态栏在压缩后仍保持挂载并更新。本次无需修改运行时代码或公开 Provider 合同。

轮次计数在 OMP 18.2.8 上使用组件锁定依赖与 `pro-20x/gpt-6-luna` 模型完成验证，运行在带独立状态栏配置的临时 OMP profile 下。状态栏在 token 和上下文读数之后渲染 `Turn`，数值对每次已回答的模型请求前进一次，工具运行期间保持在前一个数值，被中断的请求不改变它，恢复会话后在发出新请求之前就显示分支历史，子代理运行也不会改变前台会话的数值。用 `/tree` 回退到更早的条目、或从更早的消息新建分支后，数值都降到当时前台分支的计数，下一次已回答请求再从新数值前进。本次验证中，数值在请求之间显示为弱化样式，请求运行期间使用强调样式。

状态栏在 OMP 18.4.3 上使用组件锁定依赖与临时 Agent 目录中的回环 OpenAI 兼容 Provider（`u05mock/u05-mock-1`，200000 token window，`u05mock/u05-mock-2`，50000 token window，每个请求 15000 prompt token）完成验证。启动后渲染 `ctx 4%`。第一个请求进行中该行保持这一读数，回答到达后的帧显示 `ctx 4% / Turn 1`，随后一次采样补上 token 读数成为 `T 15K / ctx 8% / Turn 1`。下一个请求由 Provider 挂起保持进行中，期间该行保持 `T 15K / ctx 8% / Turn 1`，native statusline 显示工作中的 spinner；该回答结束后轮次先变化（`T 15K / ctx 8% / Turn 2`），token 总量在下一次采样跟上（`T 30K / ctx 8% / Turn 2`）。`/hotkeys` 打开 Keyboard Shortcuts 面板期间，帧的底部仍带有 native statusline 和状态栏行 `T 15K / ctx 8% / Turn 1`；按 ESC 关闭面板后，下一个提示作为 `Turn 2` 得到回答。用仅对当前会话生效的模型切换切到 `u05mock/u05-mock-2` 后，native statusline 变为 `U05 Mock Two` 与 50000 token window，同样的 15000 token 变为 `ctx 30%`，轮次计数不受切换影响，只在随后一次已回答请求时前进（`T 30K / ctx 30% / Turn 2`）。

对话口径的 token 数据源在 OMP 18.4.4 上使用组件锁定依赖与 `pro-20x/gpt-5.6-luna` 模型完成验证，插件目录独立且继承宿主 agent 配置。一次针对大型仓库的 Find 读取 20 个文件并计费 16 次判定请求（68,368 输入 token，`cacheRead: 0`），其间该行显示 `Total 17.7K / Cache 7.7K / I 10K / O 79 / Hit 43.5% / Turn 2`，与对话自身 assistant 消息的用量逐项一致（9,968 输入、7,680 cache read、79 输出），命中率也与由此得到的 43.5% 一致；若读取会话聚合，读数会是 `I 78K` 与 `Hit 8.9%`。该轮未重跑实时终端宽度调整、会话切换、`/tree` 回退、请求中断和子代理卡片。

静态上下文图标在 OMP `18.5.1` 上使用组件锁定依赖与 `pro-20x/gpt-5.6-luna` 模型完成验证，只加载本扩展并沿用现有 agent 配置，其中 `context` 使用 `absolute` 模式，排在 token 指标和 `turn` 之前。启动后渲染 `U+F0068 11.8K`，图标以 `#5fafaf` 弱化显示，与读数之间隔一个空格。一次请求得到回答后，该行显示 `U+F0068 10.3K / Total 10.3K / Cache 0 / I 10.3K / O 5 / Hit 0.0% / Turn 1`；间隔约 350 ms 截取的六帧逐字节一致，图标没有闪烁。percent 模式、实时终端宽度调整、会话切换、`/tree` 回退、请求中断和子代理卡片未在 OMP 18.5.1 上重跑。

实时终端宽度调整、会话切换、`/tree` 回退、请求中断和子代理卡片未在 OMP 18.4.3 上重跑；这些检查仍以 OMP 18.2.3 与 18.2.8 的记录为准。

这些证据适用于本文档对应的组件源码。后续若修改可能影响渲染或生命周期的源码，需要重新执行真实 TUI 检查。
