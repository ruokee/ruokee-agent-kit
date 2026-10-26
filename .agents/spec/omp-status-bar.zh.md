# omp-status-bar

## 目标

在 OMP 编辑器下方显示一行常驻状态。各 Provider 独立配置，按用户顺序组合，包含对话 token 计数、缓存命中率、上下文用量和已回答请求数。其他扩展能通过带版本的公开合同增加 Provider。

## 非目标

- 注册或替换原生 statusline 片段。
- 金额、费用、高级请求次数，以及旧的 `tokens`、`cost` Provider ID。
- 包级 `enabled` 开关、配置热重载或可配置刷新间隔。
- 读取 compaction 设置或估算投机压缩区间。
- 终端字体缺少上下文字形时提供替代字形。

## 公共面

### 配置

OMP 插件启用状态控制组件。配置为 `<agentDir>/omp-status-bar.yml` 中的 YAML，`agentDir` 是活动 OMP profile 的 Agent 目录。创建、恢复或 fork 会话时，为该会话读取一次配置。修改在下次会话开始时生效。

顶层字段如下：

- `version`，必填整数 `1`。
- `statuses`，必填有序数组，决定启用项及显示顺序。空数组有效，不显示 widget。
- `separator`，取 `space`、`slash`、`dot`、`pipe`，默认 `slash`。
- `tight`，boolean，默认 `false`。为 false 时在非空行前增加一个 ASCII 空格，为 true 时不增加。

每个状态条目有非空字符串 `id` 和可选的 `options` 映射，后者默认 `{}`。额外字段使该条目无效。重复 ID 创建独立实例，可以使用不同选项。

缺少配置时静默不显示。YAML 错误、顶层类型错误、未知顶层键、不支持的版本或错误分隔符使本会话不启动任何 Provider，并报告有界诊断。无效条目、未知 Provider ID、不支持的 Provider 合同版本或被拒绝的选项只跳过该条目。

`space` 用一个 ASCII 空格分隔可见片段。`slash`、`dot`、`pipe` 分别使用 `/`、`·`、`|`，字形两侧各带一个 ASCII 空格，整个分隔符变暗。空片段不产生分隔符。

### 显示

有 UI 且至少一个 Provider 成功启动的会话，在编辑器下方有一行常驻状态。更新只改变内容，不创建另一个 widget。没有可见内容时占零行，之后仍能显示新发布内容。

严格按配置顺序组合片段。按可见终端宽度计量，不把转义序列算作列宽；必要时从右侧截断，并以一个省略号结尾。保留前部内容，不为适应宽度重排、选择性丢弃条目或把 `word` 标签改成简写。

该行补充原生 statusline，不依赖 `statusLine.showHookStatus` 或自定义 preset 的 `status` 片段。受维护宿主的全部内建 Composer 形态使用相同的编辑器下方位置。

### Token 指标

内置 ID 为 `total`、`input`、`cache`、`output`、`cache-hit`、`context`、`turn`，没有别名。前五项使用当前分支对话自身用量的同一个一致快照。计入 assistant 消息用量及 `task` 结果用量，排除带外 `model_usage`。树导航与分支变化使总量随活动分支改变。

对分支计数器 `input`、`cacheWrite`、`cacheRead`、`output`：

```text
I = input + cacheWrite
C = cacheRead
T = I + C + output
O = output
H = C / (I + C)
```

指标自身数据缺失时不发布内容。`I + C` 为零时，`cache-hit` 也不发布。

Token 数使用按 1000 缩放的十进制单位 `K`、`M`、`G`、`T`。非有限值或非正值显示 `0`。小于 1000 时显示四舍五入整数。缩放后小于 `99.95` 时保留一位小数并去掉末尾 `.0`，否则显示整数。达到 `999.5` 时升到下一个可用单位，避免出现 `1000K`。

`total`、`input`、`cache`、`output`、`cache-hit` 接受 `label: compact|word`，默认 `compact`。未知选项或非法值使条目无效。`cache-hit` 还接受整数 `decimalPlaces`，范围 0 至 2，默认 1。百分比严格保留该位数，包括尾零，后接 `%`。

| Provider | 简写标签 | 单词标签 | 颜色 |
| --- | --- | --- | --- |
| `total` | `T` | `Total` | `#5fafaf` |
| `input` | `I` | `Input` | `#00afff` |
| `cache` | `C` | `Cache` | `#af87ff` |
| `output` | `O` | `Output` | `#ff5faf` |
| `cache-hit` | `H` | `Hit` | `#8787af` |

标签、后面的一个空格和数值共用指定固定颜色。颜色不可配置。

### 回答计数

`turn` 不接受任何选项键，出现任意键只使该条目无效。它统计当前会话分支中成功结束的 assistant 回复，包括绑定或恢复会话时已有的回复。之后每次成功回复增加一次。失败、中断或模型调用前停止的请求不改变计数。回退或切分支可以降低计数；切换会话后使用当前会话的历史。

正数显示为 `Turn`、一个空格及数值，颜色为 `#87d7af`。运行期间强调，轮间变暗。零值不发布。配置只有 `turn` 时，不需要 token 或上下文采样。

### 上下文用量

`context` 只接受 `mode: percent|absolute`，默认 `percent`。未知选项或其他 mode 使条目无效。缺少上下文用量或 `contextWindow <= 0` 时，不发布内容。

百分比模式显示 `ctx `、四舍五入为整数的当前用量百分比及 `%`。绝对值模式只按上述 token 格式显示当前 token 数。不显示窗口大小。

文本前固定放置 Nerd Font 字形 `U+F0068` 和一个普通空格。字形以 `#5fafaf` 变暗显示，文本使用终端默认前景色。字形与文本属于同一片段，配置分隔符不能插在二者之间。字形静态、不闪烁，也不随用量变化。缺少字形时不提供替代。

### Provider API

公开导入路径为 `@ruokee/omp-status-bar/provider`，导出值为 `1` 的 `PROVIDER_CONTRACT_VERSION`、`registerProvider` 和以下类型。这些签名是扩展对外合同，不约束内部存储或渲染方式。

```ts
export type ProviderOptions = Readonly<Record<string, unknown>>;
export type ProviderDescription = Readonly<Record<string, unknown>>;

export interface ProviderSpan {
  text: string;
  color?: `#${string}`;
  dim?: boolean;
}
export interface ProviderFragment {
  spans: readonly ProviderSpan[];
}
export interface ProviderInstanceContext {
  readonly options: ProviderOptions;
  readonly config: ProviderDescription;
  publish(fragment: ProviderFragment): void;
  setInterval(callback: () => void, ms: number): unknown;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimer(timer: unknown): void;
}
export interface ProviderInstance {
  start(): void | Promise<void>;
  stop(): void | Promise<void>;
}
export interface ProviderDefinition {
  readonly id: string;
  readonly contractVersion: 1;
  describe(options: ProviderOptions): ProviderDescription;
  create(context: ProviderInstanceContext): ProviderInstance;
}
export declare function registerProvider(definition: ProviderDefinition): void;
```

在扩展激活期间、`session_start` 之前注册。注册在进程中持续有效。重复 ID 和不支持的版本被拒绝；创建实例前也拒绝不兼容定义。第三方不能占用内置 ID。扩展即使解析到包的不同副本，也参与同一个进程级注册集合。

每个配置条目的 `describe` 校验其选项，可抛出异常拒绝条目。实例上下文的 `options` 是该条目的原始映射，`config` 原样等于返回的 description，状态栏不解释其内容。`create` 返回独立生命周期；适用时分别等待一次 `start` 和 `stop`。创建或启动失败只停用并清理该实例。

Provider 通过上下文发布结构化片段，不产生分隔符，不调用 OMP UI 方法，也不能通过本合同访问 widget 或 theme。状态栏负责清洗、样式、组合和截断。

每次发布的规范化要求如下：

- `spans` 必须是数组，每项必须有字符串 `text`。
- 可选颜色只接受不区分大小写的 `#RRGGBB`。`dim` 默认 false，出现时必须为 boolean。颜色与变暗叠加；没有颜色时使用终端前景色变暗。
- 移除 ANSI 和 VT 转义，把 C0/C1 控制字符换成空格，折叠连续 ASCII 空格。
- 不自动在 span 之间增加空格。丢弃清洗后文本为空的 span。只去掉片段最外侧空格，保留相邻 span 边界处的空格。
- 空片段或清洗后消失的内容撤回该实例原有内容。结构无效也清除原有内容，并记录有界诊断。
- 发布对象之后被修改，不得改变已经显示的片段。

上下文定时器遵循宿主管理的生命周期。关闭时清理定时器，并拒绝新定时器、发布和迟到回调。

## 不变量

- 只在支持 UI 的会话工作。无 UI 会话不能替换、采样、解绑或停止 UI 会话的数据，也不能改变其回答计数。
- 请求运行期间更新指标和上下文。各 token 读数属于同一次观察，不为每个指标重复聚合。只有 context Provider 需要时读取上下文。只有第三方或 turn 的配置不启动内置采样。
- 启动下一会话前停止上一会话的 Provider 和资源。关闭优先于尚未完成的启动，不得迟到发布或重新挂载。
- Provider 回调、发布、启动和停止失败不结束 OMP 会话。诊断不得无界重复，无关 Provider 继续工作。
- 内容更新不创建重复 widget 或定时器。最后一个订阅者退出时释放对应采样资源。
- 行为不受 compaction 设置或投机区间估算影响。

## 宿主下限

最低受维护 OMP 版本为 `18.5.0`，没有维护上限。这是维护承诺，不是安装或运行门禁，也不认证所有后续版本。较早宿主可能运行，但不会因此获得维护承诺。不保留仅为较早宿主服务的行为。宿主依赖声明不设置维护上限。

## 验收标准

- 配置有效性、条目隔离、重复 ID、默认选项、标签、颜色、公式、取整阈值、缺少数据和分支变化符合上述合同。
- 第三方能通过公开路径注册，包括解析到另一包副本的情况。无效版本、重复 ID、无效片段和生命周期失败保持在规定范围内。
- 在受维护的真实 OMP TUI 中，状态行常驻编辑器下方；请求期间 token 和上下文更新；`turn` 每次成功回复增加一次，失败或中断不变，轮间变暗，并跟随恢复或回退后的历史。
- 在真实终端中，状态行随宽度变化保持显示，并从右侧截断至可用列宽。它与原生 statusline、终端标题 spinner 及子代理卡片共存，无闪烁或布局跳动。切换会话和关闭不留下重复 widget 或定时器。
- 有数据时按规定颜色和空格显示静态上下文字形，不读取任何 compaction 设置。无 UI 会话不影响 UI 会话。
