# OMP 状态栏

[English](./usage.md)

一个常驻的 OMP 状态栏扩展：一个 `belowEditor` Widget Host 加六个内置 Provider，显示 token 指标、缓存命中率和上下文用量，并带投机压缩区间指示。

属于 [projects/omp-status-bar](../README.zh.md)，作者为 Ruokee。

## 安装

Package 尚未发布。克隆本仓库，安装锁定版本的依赖，再把 Package 链接到 OMP：

```bash
cd projects/omp-status-bar
bun install
omp plugin link "$(pwd)" --scope user
```

OMP 会读取 `package.json` 中的 `omp.extensions` 并加载 `src/extension.ts`，不需要手动设置 Extension 路径。

支持的 OMP 范围为 `>=18.1.8 <19`。自动化类型检查和测试同时覆盖 OMP 18.1.8 与 18.2.3，真实 TUI 验证覆盖 OMP 18.2.3。

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

内置 ID 固定为 `total`、`input`、`cache`、`output`、`cache-hit`、`context`。不保留旧的 `tokens` 或 `cost` ID，也不提供别名。

### 指标公式

五个 token 指标读取同一个每 tick 快照（来自 `getUsageStatistics()`）：

```text
input = input + cacheWrite          (I)
cacheRead = cacheRead               (C)
total = input + cacheWrite + cacheRead + output   (T)
output = output                     (O)
hitRate = C / (I + C)               (H)
```

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

## context Provider

`context` 接受一个 option：

| option | 值 | 默认值 | 输出例子 |
| --- | --- | --- | --- |
| `mode` | `percent`、`absolute` | `percent` | `ctx 12%`、`14.7K` |

未知 option 或其他 `mode` 值使当前条目失效。

数据来自 `ctx.getContextUsage()`。数据不存在或 `contextWindow <= 0` 时，该 Provider 不发布片段。`percent` 使用整数四舍五入；`absolute` 只用共享 token formatter 格式化当前 token 数。context window 仍用于数据校验和投机区间计算，但不显示。

投机压缩图标位于上下文文本左侧。两者属于同一个 ProviderFragment，中间用一个普通空格连接，不经过顶层 separator。

## 投机压缩区间指示

### 含义

该图标只表示当前上下文大概进入了 OMP 的投机压缩区间。它不是 OMP 内部的 `idle`、`running` 或 `armed` 状态，也不能证明压缩任务正在运行或已经完成。

图标使用 Nerd Font 字形 `U+F0068`，与 pi-moon 和 OMP 的 `icon.auto` 相同。终端字体不支持该字形时不提供回退字符。

### 区间计算

每次采样从 `ctx.getContextUsage()` 读取当前 token 和 window，从 `ctx.model` 读取模型，从 `Settings.instance.getGroup("compaction")` 读取压缩配置。阈值和方法选择复用 OMP 导出的函数：

```ts
import { resolveSpeculationMethod } from "@oh-my-pi/pi-coding-agent/session/compaction-methods";
import { resolveSpeculationLeadTokens } from "@oh-my-pi/pi-coding-agent/session/speculation-lead";
import { resolveThresholdTokens } from "@oh-my-pi/pi-agent-core/compaction";
```

```text
lead = min(32000, max(8192, floor(threshold * 0.125)))
start = max(0, threshold - lead)
speculationBand = [start, threshold)
```

`resolveSpeculationMethod()` 返回 `remote`、`handoff` 或 `soft`，按 `methodOrder` 选择第一个可用方法，并把 `snapcompact` 和 `shake` 排除在首个可用方法之外。

该估计无法观察 OMP 当前是否已经在压缩、是否正在生成 handoff，以及 `session_before_compact` handler 是否阻止了投机任务。OMP 的真实压缩判定还可能使用内部 stored-conversation estimate，把 token 抬高到 `ctx.getContextUsage()` 报告值之上。因此指示可能提前、延后，或在实际不会投机时出现；界面不会声称真实的运行状态。

### 状态机

内部状态：

- `hidden`：未启用自动压缩、未启用异步压缩、没有可投机方法，或阈值数据无效；
- `normal`：图标常亮弱化显示；
- `indicating`：图标闪烁。

状态机为当前估计依据保存 fingerprint：模型 provider、模型 id、context window、解析后的方法、threshold 和 start。首次有效采样按下方首次采样规则判断。已有 fingerprint 变化时，状态机丢弃 previous token 和当前周期的进入许可，重新建立基线，并在该次采样保持 `normal` 或 `hidden`，不直接进入 `indicating`。

首次有效采样：

- token 位于 `[start, threshold)`：进入 `indicating`；
- token 小于 `start`：进入 `normal`，并允许后续进入指示区间；
- token 不小于 `threshold`：进入 `normal`；超过阈值不解释为"投机已经运行"。

从 `normal` 进入 `indicating` 需要 token 位于 `[start, threshold)`，且当前压缩周期允许进入。

进入 `indicating` 后状态锁存。即使 token 越过 `threshold`，图标继续闪烁。以下任一条件结束指示：

- 当前 token 小于上一次采样的 token；
- `compaction.enabled` 关闭；
- `compaction.asyncEnabled` 关闭；
- `resolveSpeculationMethod()` 不再返回可投机方法；
- 模型 provider、模型 id 或 context window 改变；
- 会话结束。

在 `indicating` 中检测到 token 下降时切回 `normal`。下降只说明"上下文变小"，分支切换或历史裁剪也可能触发。为避免仍在区间内时立即重新闪烁，状态机等 token 先回到 `start` 以下，才允许下一个周期进入 `indicating`。

模型、context window、解析后的方法、threshold 或 start 改变时建立新的采样基线，不沿用旧 fingerprint 的 previous token 或进入许可。新基线只有在 token 低于 `start` 之后，才允许进入下一次 `indicating`。

### 闪烁

- `normal` 使用固定弱化图标。
- 进入 `indicating` 后第一帧为强调状态。
- 之后每 `600 ms` 在强调和弱化之间切换。
- 离开 `indicating` 后立即停止动画，不保留后台 timer。

强调帧使用 `#5fafaf`。弱化帧使用相同颜色并设 `dim: true`。上下文文本本身使用终端默认前景色。

## 数据刷新

第一个内置 Provider 启动时，内部数据源立即采样，并启动一个共享的 OMP 托管 interval，每 `600 ms` 采样一次。所有已配置的内置 Provider 读取同一个不可变快照；T、I、C、O、H 不会各自调用 `getUsageStatistics()` 造成每 tick 五次调用。

存在 TICO 或 H 订阅时，每个 tick 最多调用一次 `getUsageStatistics()`。`getContextUsage()`、模型和压缩设置只在 `context` 有订阅时读取。只配置第三方 Provider 时不启动内部数据源。

同一进程只持有一组绑定数据源。`session_start` 会为当前处于前台的会话重新绑定，`session_shutdown` 再释放。无 UI 的会话两件事都不做，因此同一进程内的子代理会话不会改绑它所共享的 UI 会话数据源。

快照只在字段变化时增加 revision。Provider 只在自己的标准化 fragment 变化时发布；`indicating` 的闪烁相位变化也算 fragment 变化。

最后一个内置 Provider 停止时清除共享 interval。第三方 Provider 通过公开 Provider context 使用自己的 OMP 托管 timer。

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
- 实时调整终端宽度后仍保持单行，并在可用列宽内截断；
- 状态栏与 OMP 原生 status line、终端标题 spinner 和子代理卡片共存，无闪烁或布局跳动；
- 切换会话和退出后不留下重复 Widget 或 timer。

OMP 18.2.3 兼容性使用组件锁定依赖与 `pro-20x/gpt-5.6-luna` 模型完成验证。真实 TUI 覆盖了 48 到 100 列的实时宽度调整、请求期间指标更新、会话切换、SGR 鼠标输入、子代理 Task 卡片、终端标题 spinner 帧和正常退出。验证时通过临时覆盖降低 recent-token 保留阈值，使手动 `/compact` 执行远端压缩；OMP 显示 `remote-compacted · 20K→19K`，状态栏在压缩后仍保持挂载并更新。本次无需修改运行时代码或公开 Provider 合同，因此组件版本维持 `0.1.3`，对等依赖范围维持 `>=18.1.8 <19`。

这些证据适用于本文档对应的组件源码。后续若修改可能影响渲染或生命周期的源码，需要重新执行真实 TUI 检查。
