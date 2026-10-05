# omp-qol

[English](./README.md)

一个扩展提供五项可独立开关的 OMP 行为调整：持续等待、模型错误后的受限续跑、实验性的压缩期限延长、原生历史重放，以及可选择启用的远端压缩缓存对齐。每项调整的宿主源码、边界与已观察证据见[调整项](./docs/adjustments.zh.md)。

任务、消息、进程、模型轮次与压缩都由 OMP 管理。每项调整均可关闭；宿主接口、结构或归属无法识别时，对应调整保持不生效并报告原因。

## 调整项

| 调整项 | 默认 | 效果 |
| --- | --- | --- |
| [持续等待](./docs/adjustments.zh.md#持续等待) | 开 | `wait` 调用在全部任务仍运行的快照之间持续到同一个总期限，默认 20 分钟，而不是每个空的原生窗口都返回。 |
| [上游错误后续跑](./docs/adjustments.zh.md#上游错误后续跑) | 开 | 以可续跑的上游错误结束的轮次在同一会话内继续，首次等待 1 秒并按倍增延长至上限 8 秒，每条失败链最多 8 次续跑。可续跑的判据包括：分类器判定为瞬时或超时、宿主标记为流中途中断，以及既无状态也无分类结论的错误。 |
| [延长单个压缩期限](./docs/adjustments.zh.md#延长单个压缩期限) | **关** | 在一个压缩窗口内，命中的 `AbortSignal.timeout` 调用获得更长期限，使超过原生 5 分钟的远端压缩不被中断。进程级生效，实验性质。 |
| [恢复会话时沿用原生历史](./docs/adjustments.zh.md#恢复会话时沿用原生历史) | 开 | 恢复会话的首次请求沿用上一个进程结束时的原生提供方条目，而不是按通用内容重建对话，使基于该形式的提示缓存可以服务这次请求。进程级生效，只设置一个标志，不改写请求体。 |
| [远端压缩缓存对齐](./docs/adjustments.zh.md#远端压缩缓存对齐) | **关** | 为有明确归属的非 Codex Responses V2 压缩复用已确认的在线请求前缀。需选择提供方，保留原生投机压缩。 |

等待调整新增可选 `timeout`，重放选择已存的原生条目，缓存对齐只改变已识别的压缩请求前缀和工具定义。它们均不改模型、缓存键、已存历史或会话文件。恢复启动模型轮次，等待重复模型已经发出的调用，模型运行时会消耗服务额度。

## 配置

配置存放于 OMP 为 `@ruokee/omp-qol` 保存的插件设置中。`package.json` 中的 manifest 声明了每个键的类型、默认值和说明，OMP 会把项目级覆盖合并到全局值之上。

```bash
omp plugin config list @ruokee/omp-qol
omp plugin config set @ruokee/omp-qol waitJobsSeconds 1800
```

设置每次激活只读取一次。修改后需重启 OMP：运行中的进程沿用启动时读到的值，在同一进程内新开会话也不会重新读取。

### 通用

| 键 | 默认 | 取值 | 效果 |
| --- | --- | --- | --- |
| `enabled` | `true` | boolean | 总开关。关闭时任何模块都不注册。 |

### 等待

| 键 | 默认 | 取值 | 效果 |
| --- | --- | --- | --- |
| `waitEnabled` | `true` | boolean | 扩展已识别的内建 `wait`。 |
| `waitContinueEmptyWindows` | `true` | boolean | 遇到全部任务仍运行的快照时，在同一次调用内继续。关闭时返回第一个原生窗口。 |
| `waitJobsSeconds` | `1200` | 数字 `0.05`–`3600` | 单次 `wait` 调用的默认总期限。显式 `timeout` 覆盖它。 |
| `waitMessagesSeconds` | `1200` | 数字 `0.05`–`3600` | 照常接受并校验；受支持的宿主没有纯消息等待入口，该项不起作用。 |
| `waitProcessSeconds` | `1200` | 数字 `0.05`–`3600` | 照常接受并校验；受支持的宿主没有命名进程等待入口，该项不起作用。进程控制使用宿主的 `proc://` 接口。 |

### 恢复

| 键 | 默认 | 取值 | 效果 |
| --- | --- | --- | --- |
| `recoveryEnabled` | `true` | boolean | 注册 `session_stop` 处理器。 |
| `recoveryMode` | `knownTransient` | `knownTransient`、`unclassified` | 可续跑的错误范围。`knownTransient` 接受宿主判定为瞬时或超时的错误、宿主标记为流中途中断的错误，以及既无 HTTP 状态也无分类结论的错误；`unclassified` 在相同安全排除与终止性客户端状态检查后接受宿主判定为瞬时或超时的错误，以及全部未分类错误，不论是否带 HTTP 状态。 |
| `recoveryMaxAttempts` | `8` | 整数 `1`–`8` | 一条失败链请求的续跑轮次上限。 |
| `recoveryBackoffBaseMs` | `1000` | 整数 `1`–`10000` | 首次续跑前的等待时间。 |
| `recoveryBackoffMaxMs` | `8000` | 不小于 `recoveryBackoffBaseMs` 的整数，上限 `10000` | 倍增等待的上限。 |
| `recoveryNotify` | `true` | boolean | 每次续跑显示一行提示，包含次数与等待时间。 |

### 压缩超时

| 键 | 默认 | 取值 | 效果 |
| --- | --- | --- | --- |
| `compactionTimeoutEnabled` | `false` | boolean | 安装进程级的 `AbortSignal.timeout` 包装。默认关闭。 |
| `compactionTimeoutMs` | `900000` | 大于 `compactionTimeoutFloorMs` 的整数，上限 `3600000` | 命中调用获得的期限，单位毫秒。 |
| `compactionTimeoutFloorMs` | `300000` | 整数 `300000`–`3599999` | 实验提高期限的最低值。专家项：若下限之上没有空间，该模块会被拒绝；下限高于原生 `300000` ms 请求期限时，压缩请求本身不再命中，`/qol` 会说明这一点。 |
| `compactionWindowGuardMs` | `3600000` | 不小于 `compactionTimeoutMs`，上限 `14400000` 的整数 | 一个压缩窗口的最长存活时间，从打开窗口的事件开始计算。 |
| `compactionTimeoutNotify` | `true` | boolean | 窗口内首次改写期限时显示一行提示。 |

### 重放

| 键 | 默认 | 取值 | 效果 |
| --- | --- | --- | --- |
| `replayEnabled` | `true` | boolean | 安装进程级包装，使恢复会话的首次请求沿用提供方的原生历史。默认开启；未携带已存条目的会话不受影响。 |

### 压缩缓存

| 键 | 默认 | 取值 | 效果 |
| --- | --- | --- | --- |
| `compactionCacheEnabled` | `false` | boolean | 为主会话启用进程归属的缓存调整，不注册会否决投机压缩的钩子。 |
| `compactionCacheProvider` | `""` | string | 已配置提供方的准确名称。空值保持模块不生效；只有 `openai-responses` V2 请求可以匹配。 |
| `compactionCacheMode` | `"hooks"` | `standard`、`hooks` | `standard` 保留已识别的宿主修复；`hooks` 还复用经过证明的宿主钩子处理结果，支持插入、重排和恢复上下文。两种模式均不自动开启模块。 |

为已配置的提供方启用时，把 `your-provider` 替换为其名称：

```bash
omp plugin config set @ruokee/omp-qol compactionCacheProvider your-provider
omp plugin config set @ruokee/omp-qol compactionCacheEnabled true
```

选择该提供方的模型并重启 OMP。`/qol` 应显示 `cache: enabled`；`rewrites=0` 只表示尚未改写符合条件的请求，不代表提供方已经命中缓存。关闭设置并重启可移除 hook 与包装。停止的 owner 不会在同一进程内恢复。

默认 `hooks` 模式观察所属会话的上下文处理结果，不重复调用处理器，也不依赖配套扩展。没有相关处理器时执行通用修复。`standard` 对未知钩子差异保持原生请求；选择该模式时，将 `compactionCacheMode` 设为 `standard` 并重启。两种模式都要求传输原样确认及整条请求校验。投影或请求差异无法确认时，完整请求保持原样。`/qol` 显示有效 `mode`。

### 校验

- 缺失的键取默认值。
- `null`、类型错误、非有限数字、需要整数却不是整数、超出上述范围，或枚举值不在 manifest 中：只停用拥有该键的模块，其他模块照常注册。
- 未知键、设置根不是对象，或设置 getter 失败：停用全部模块。
- 诊断只写被拒绝的键与规则，不回显取值，例如 `wait.jobsSeconds=range`。每个原因在一次激活中通过宿主日志报告一次，宿主提供 UI 时也报告一次。

## 状态

`/qol` 打印当前状态，不做任何修改。它不启动模型轮次，也不读取设置 schema 之外的值。

```
@ruokee/omp-qol 0.5.3
activation cwd: /home/me/project
refresh: restart OMP; settings are read once per activation
settings: ok
wait: enabled (entry=wait effectiveDefaultSeconds=1200 messageContinuation=not-applicable processWait=not-applicable serviceContinuation=not-applicable) — enabled=true continueEmptyWindows=true
recovery: enabled — enabled=true mode=knownTransient maxAttempts=8 backoffBaseMs=1000 backoffMaxMs=8000 notify=true
compaction: disabled (compaction-disabled) — enabled=false timeoutMs=900000 floorMs=300000 windowGuardMs=3600000 notify=true
replay: enabled (rewrites=0) — enabled=true
cache: disabled (cache-disabled) enabled=false providerSelected=false mode=hooks
```

`pending` 表示该进程尚未执行过会话启动。`disabled`、`invalid`、`incompatible` 和 `unavailable` 各自带原因码；设置对象只被部分接受时，`problems:` 列出被拒绝的键。设置对象整体被拒绝时，每个模块行替换为拒绝原因，报告末尾列出导致拒绝的键。

## 限制

每项调整自身的限制见[调整项](./docs/adjustments.zh.md)。简要说明：

- **等待。** 模块为已识别的无参数内建 `wait` 重新注册一个带可选总期限 `timeout` 的定义；委派只向原生工具发送 `{}`，且只有非空、全部任务仍运行的快照会继续。消息、已结束或不存在的任务、错误、中断、取消与 service 帧都作为原生结果返回。模块不提供纯消息续接、命名进程等待与纯 service 续接。期限只结束本次调用，后台任务与进程继续运行。
- **恢复。** 固定排除清单优先于配置的模式，续跑次数上限为 8，宿主另有独立计数。一条失败链可以跨多次 agent 运行，因此计数跟随该链而不是单次提交的提示；自行正常结束的轮次、配置范围之外的错误与取消的结束都会终止链。续跑会重新运行轮次，因此失败轮次中的工具调用可能再次执行。等待发生在宿主给单个 `session_stop` 处理器的 30 秒预算内。中断标记与无状态条件都是不带兼容承诺的宿主细节，宿主某次发布可能在不报告的情况下收窄或放宽接受的集合。
- **压缩。** 实验对整个进程替换 `AbortSignal.timeout`，因此窗口内任何传入命中数值的调用都会得到更长期限，不只是压缩请求。它只能延长、不能缩短期限。窗口重叠、属于其他会话，或事件顺序无法识别时，该进程内的实验会被停用并报告原因。一次压缩操作回退到下一个方法时沿用同一个 signal，扩展把该 signal 的再次出现视为同一次操作而不是重叠；同一窗口内出现第二个活跃 signal 仍会停用实验。注册 `session_before_compact` 钩子还会在 OMP `18.5.0` 中关闭投机压缩，因此启用实验后压缩可能改为在前台等待；默认关闭时不注册该钩子。同一进程中的第二次激活在包版本与配置快照都一致时保留已安装的补丁，并报告 `incompatible` 与 `patch-owned-elsewhere`；它不注册窗口事件，因此只有安装补丁的激活会打开窗口，该会话在窗口关闭期间使用原生期限。快照或版本不同、总开关或本模块开关关闭、键无效的第二次激活仍会停止已安装的补丁；设置无法读取或被整体拒绝的激活同样会停止该补丁，并且不会因此开启任何模块。安装补丁的激活结束会话后，补丁停止改写，该进程在 OMP 重启前一直使用原生期限；此后 `/qol` 报告 `compaction: incompatible (owner-stopped)`。
- **重放。** 包装对整个进程替换 `Map.prototype.set` 并检查每次写入，实测每次字符串键调用约 2 ns。它只决定一个宿主标志：恢复会话的首次请求重放上一个进程存下的条目，其前提是响应这次请求的服务端仍可重放它们——这也是上一个进程结束时已经作出的假设。若服务端拒绝这些条目，该次请求会失败，而原生路径会重建后继续。它只覆盖 `openai-responses` 的提供方状态；codex responses、Anthropic 与 completions 各自保留原有规则。它依赖 `openai-responses:` 状态键前缀、`nativeHistoryReplayWarmed` 字段，以及状态通过 `Map` 写入存放，因此宿主改名其中之一或以其他方式构造状态时，包装会静默失效而不报错，`/qol` 中的改写次数是唯一信号。包装没有窗口，也不订阅事件，安装它的激活结束后仍保持安装，只有激活的生效配置关闭该项、激活完全没有可用配置，或进程结束时才被取回。

- **缓存。** 只有所属主会话中，选定提供方的已识别 V2 请求可以改写。未知差异原样传递。进程级传输与信号包装观察所属模型注册表实例；配置匹配的后续激活报告 `patch-owned-elsewhere`，配置冲突、导航、owner 关闭或函数被覆盖会停止改写，重启后才恢复。每个有明确归属的根信号在重试间保留同一份已确认在线参照，不妨碍新的在线工作推进。缓存模块不注册压缩前钩子，也不禁用投机压缩；其他扩展或单独启用的期限模块仍可能否决投机压缩。参照只保留在内存中，不写正文日志。是否命中缓存仍由提供方决定。

## 兼容性

最低维护 OMP 版本为 `18.5.0`，不设置维护版本上限。本小节声明维护责任，不作为安装或运行条件。更早的宿主仍可能运行本包，但不因此获得维护承诺。这一声明不保证后续版本继续可用，也不表示下限及以上的每个版本都已验证。

包的 peer 以无限制的范围 `*` 声明 `@oh-my-pi/pi-ai` 与 `@oh-my-pi/pi-coding-agent`。该声明只列出组件导入的宿主包，不构成维护范围，不带运行时检查，也不表示任何宿主版本可用。

自动化类型检查与测试套件针对 OMP `18.5.0` 运行。源码基线按路径区分：上游错误后续跑、压缩期限与原生历史重放引用最初阅读这些机制时的 `18.2.8`，持续等待引用 `18.5.0`，缓存对齐引用 `18.5.1`。宿主没有缓存对齐所需的主会话身份时，该模块保持不生效。[调整项](./docs/adjustments.zh.md)分别记录源码基线、实际检查或 CLI 运行，以及未经测试的场景。

每项调整会检查它所依赖的宿主接口、结构或归属，检查不成立时保持不生效并给出原因，该调整因而停留在宿主自身的行为上。这些检查只覆盖各模块实际查看的内容，不覆盖入口自身的导入，也不覆盖没有任何模块检查的差异，因此无法识别的宿主变化也可能在不被停用的情况下改变行为。

在更新后的宿主上信任本扩展之前，重新阅读各项调整引用的上游源码并复核其适配点。

## 安装

克隆仓库、安装锁定依赖，然后安装到 OMP：

```bash
git clone https://github.com/ruokee/ruokee-agent-kit.git
cd ruokee-agent-kit/projects/omp-qol
bun install --frozen-lockfile
omp install "$(pwd)" --scope user
```

`omp install` 是 `omp plugin install` 的别名，`omp plugin link "$(pwd)" --scope user` 注册同一目录。OMP 从 `package.json` 读取 `omp.extensions` 并加载 `src/extension.ts`，无需手工设置扩展路径。

### 更新

注册指向该检出目录，安装会一直从该目录读取包及其依赖。

```bash
cd /path/to/ruokee-agent-kit
git pull
cd projects/omp-qol
bun install --frozen-lockfile
```

之后重启 OMP：运行中的进程沿用启动时加载的扩展代码。扩展不保存自身状态，更新不会改动会话、消息或任务。

### 卸载

卸载包并重启 OMP。除你自行设置的配置外没有其他写入内容，可用 `omp plugin config delete @ruokee/omp-qol <key>` 删除这些键。

## 开发

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
```

测试套件用一个小型记录宿主替代宿主，同时保留真实的包边界：来自已安装 `@oh-my-pi/pi-coding-agent` 的设置 getter、来自已安装 `@oh-my-pi/pi-ai` 的错误分类器，以及原生与已替换两种状态的 `AbortSignal.timeout` 与 `Map.prototype.set`。覆盖范围包括激活与校验、`wait` 注册及其模型可见参数、结构化续接规则与期限竞态、恢复的分类矩阵与续跑链、压缩模块的安装顺序与窗口生命周期与还原路径，以及重放包装的改写与转发矩阵、归属与释放路径、各类拒绝与 `/qol` 行。

## 许可证

MIT。
