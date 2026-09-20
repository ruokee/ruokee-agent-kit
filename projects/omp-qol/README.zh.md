# omp-qol

[English](./README.md)

一个扩展提供三项可独立开关的 OMP 行为调整：hub `wait` 在总期限内持续等待、模型错误后的受限续跑，以及实验性的单个压缩期限延长。每项调整所依附的 OMP 源码、对应的宿主版本、边界与已验证内容见[调整项](./docs/adjustments.zh.md)。

扩展本身不执行工作。任务、消息、进程、模型轮次和压缩都归 OMP；扩展只改变既有机制停止的时机，其余调用原样委派。三项调整都可关闭，当某项调整发现宿主与它编写时所依据的版本不同，它会保持不生效并报告原因。

## 调整项

| 调整项 | 默认 | 效果 |
| --- | --- | --- |
| [持续等待 hub](./docs/adjustments.zh.md#持续等待-hub) | 开 | 原生窗口没有新信息时，一次 `hub` `wait` 调用继续等待，默认最长 20 分钟，而不是每 5 秒把空结果交给模型。 |
| [上游错误后续跑](./docs/adjustments.zh.md#上游错误后续跑) | 开 | 以可续跑的上游错误结束的轮次在同一会话内继续，首次等待 1 秒并按倍增延长至上限 8 秒，每条失败链最多 8 次续跑。 |
| [延长单个压缩期限](./docs/adjustments.zh.md#延长单个压缩期限) | **关** | 在一个压缩窗口内，命中的 `AbortSignal.timeout` 调用获得更长期限，使超过原生 5 分钟的远端压缩不被中断。进程级生效，实验性质。 |

三项调整本身不改动模型、请求体、工具 schema、历史记录或会话文件。错误恢复会启动模型轮次，等待调整会重复模型已经发出的调用，因此两者在模型运行时都会消耗服务额度。

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
| `waitEnabled` | `true` | boolean | 注册接管 `hub` 工具名的包装。 |
| `waitContinueEmptyWindows` | `true` | boolean | 原生窗口没有新信息时，在同一次调用内继续等待。关闭时立刻按原生结果返回第一个窗口。 |
| `waitJobsSeconds` | `1200` | 数字 `0.05`–`3600` | 任务或混合等待的默认总期限。 |
| `waitMessagesSeconds` | `1200` | 数字 `0.05`–`3600` | 纯消息等待的默认总期限。 |
| `waitProcessSeconds` | `1200` | 数字 `0.05`–`3600` | 填入命名进程等待的缺省 `timeout`。命名进程等待本身仍按原生含义解释该参数。 |

### 恢复

| 键 | 默认 | 取值 | 效果 |
| --- | --- | --- | --- |
| `recoveryEnabled` | `true` | boolean | 注册 `session_stop` 处理器。 |
| `recoveryMode` | `knownTransient` | `knownTransient`、`unclassified` | 可续跑的错误范围：宿主判定为瞬时或超时的错误，或另外包含未分类且不属于排除类型的错误。 |
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

### 校验

- 缺失的键取默认值。
- `null`、类型错误、非有限数字、需要整数却不是整数、超出上述范围，或枚举值不在 manifest 中：只停用拥有该键的模块，其他模块照常注册。
- 未知键、设置根不是对象，或设置 getter 失败：停用全部模块。
- 诊断只写被拒绝的键与规则，不回显取值，例如 `wait.jobsSeconds=range`。每个原因在一次激活中通过宿主日志报告一次，宿主提供 UI 时也报告一次。

## 状态

`/qol` 打印当前状态，不做任何修改。它不启动模型轮次，也不读取设置 schema 之外的值。

```
@ruokee/omp-qol 0.1.2
activation cwd: /home/me/project
refresh: restart OMP; settings are read once per activation
settings: ok
wait: enabled — enabled=true continueEmptyWindows=true jobsSeconds=1200 messagesSeconds=1200 processSeconds=1200
recovery: enabled — enabled=true mode=knownTransient maxAttempts=8 backoffBaseMs=1000 backoffMaxMs=8000 notify=true
compaction: disabled (compaction-disabled) — enabled=false timeoutMs=900000 floorMs=300000 windowGuardMs=3600000 notify=true
```

`pending` 表示该进程尚未执行过会话启动。`disabled`、`invalid`、`incompatible` 和 `unavailable` 各自带原因码；设置对象只被部分接受时，`problems:` 列出被拒绝的键。设置对象整体被拒绝时，每个模块行替换为拒绝原因，报告末尾列出导致拒绝的键。

## 限制

每项调整自身的限制见[调整项](./docs/adjustments.zh.md)。简要说明：

- **等待。** 包装只在该会话存在 source 为 builtin 的 `hub` 工具、其描述包含原生等待窗口句子的情况下注册，并要求参数本身是 schema。它转发该工具的审批等级、可中断标记和 schema，不新增操作。等待到期只结束等待，后台任务与进程继续运行。
- **恢复。** 固定排除清单优先于配置的模式，续跑次数上限为 8，宿主另有独立计数。一条失败链可以跨多次 agent 运行，因此计数跟随该链而不是单次提交的提示；自行正常结束的轮次、配置范围之外的错误与取消的结束都会终止链。续跑会重新运行轮次，因此失败轮次中的工具调用可能再次执行。等待发生在宿主给单个 `session_stop` 处理器的 30 秒预算内。
- **压缩。** 实验对整个进程替换 `AbortSignal.timeout`，因此窗口内任何传入命中数值的调用都会得到更长期限，不只是压缩请求。它只能延长、不能缩短期限。窗口重叠、属于其他会话，或事件顺序无法识别时，该进程内的实验会被停用并报告原因。注册 `session_before_compact` 钩子还会在 OMP `18.2.4` 中关闭投机压缩，因此启用实验后压缩可能改为在前台等待；默认关闭时不注册该钩子。同一进程中的第二次激活会停止已安装的补丁，而不是共用它；设置无法读取或被整体拒绝的激活同样会停止该补丁，并且不会因此开启任何模块。

## 兼容性

包的 `package.json` 声明 peer 范围为 `>=18.2.4 <19`。自动检查针对 OMP `18.2.4`（`can1357/oh-my-pi` 提交 `1c0303b1f2ec515cbf4b44a9a49d68a029531aac`，tag `v18.2.4`）运行，这也是各项调整记录的源码基线。该范围只是元数据：它不带运行时检查，也不表示其中每个版本都可用。每项调整会读取自己需要的宿主接口，接口缺失或无法识别时保持不生效并给出原因，因此更新的宿主版本会退化为原生行为而不是报错。

[调整项](./docs/adjustments.zh.md)按项记录已执行的验证与仍标记为未验证的内容。

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

测试套件用一个小型记录宿主替代宿主，同时保留真实的包边界：来自已安装 `@oh-my-pi/pi-coding-agent` 的设置 getter、来自已安装 `@oh-my-pi/pi-ai` 的错误分类器，以及原生与已替换两种状态的 `AbortSignal.timeout`。覆盖范围包括激活与校验、等待期限循环与空窗识别、恢复的分类矩阵与续跑链，以及压缩模块的安装顺序、窗口生命周期与还原路径。

## 许可证

MIT。
