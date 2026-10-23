# omp-qol

[English](./README.md)

一个扩展提供可独立开关的 OMP 行为调整。每项调整的宿主源码、边界与已观察证据见[调整项](./docs/adjustments.zh.md)。

任务、消息、进程、模型轮次与压缩都由 OMP 管理。每项调整均可关闭；宿主接口、结构或归属无法识别时，对应调整保持不生效并报告原因，行为回到宿主自身。

## 调整项

- [持续等待](./docs/adjustments.zh.md#持续等待)：默认开启。`wait` 调用在全部任务仍运行的快照之间持续到同一个总期限，默认 20 分钟，而不是每个空的原生窗口都返回。
- [上游错误后续跑](./docs/adjustments.zh.md#上游错误后续跑)：默认开启。以可续跑的上游错误结束的轮次在同一会话内继续，首次等待 1 秒并按倍增延长至上限 8 秒，每条失败链最多 8 次续跑。可续跑的判据包括：分类器判定为瞬时或超时、宿主标记为流中途中断，以及既无状态也无分类结论的错误。
- [延长单个压缩期限](./docs/adjustments.zh.md#延长单个压缩期限)：默认**关闭**。在一个压缩窗口内，命中的 `AbortSignal.timeout` 调用获得更长期限，使超过原生 5 分钟的远端压缩不被中断。进程级生效，实验性质。
- [恢复会话时沿用原生历史](./docs/adjustments.zh.md#恢复会话时沿用原生历史)：默认开启。恢复会话的首次请求沿用上一个进程结束时的原生提供方条目，而不是按通用内容重建对话，使基于该形式的提示缓存可以服务这次请求。进程级生效，只设置一个标志，不改写请求体。
- [任务参数清理](./docs/adjustments.zh.md#任务参数清理)：默认开启，仅在内建 task schema 暴露 seance 专用字段 `sourceSession` 时生效。在宿主校验前从非 seance 任务项删除该字段与 `model`；只有普通 `model` 选择器的 schema 保持不变。
- [复制最后回复](./docs/adjustments.zh.md#复制最后回复)：默认开启。在交互式会话按 `alt+shift+a`，把最后一条 assistant 回复的文本块写入系统剪贴板。思考、工具调用与工具输出不会进入剪贴板；回复仍在流式输出或没有文本时，剪贴板保持不变。

等待调整新增可选 `timeout`，重放选择已存的原生条目。两者均不改模型、缓存键或已存历史。恢复启动模型轮次，等待重复模型已经发出的调用，模型运行时会消耗服务额度。任务参数清理改写事件输入，不改变 task schema；宿主会把改写后的参数持久化到当前 assistant 消息。复制快捷键只读取活动分支并写入系统剪贴板，不新增会话条目，也不发送请求。

## 配置

配置存放于 OMP 为 `@ruokee/omp-qol` 保存的插件设置中。`package.json` 中的 manifest 声明了每个键的类型、默认值和说明，OMP 会把项目级覆盖合并到全局值之上。

```bash
omp plugin config list @ruokee/omp-qol
omp plugin config set @ruokee/omp-qol waitJobsSeconds 1800
```

设置每次激活只读取一次。修改后需重启 OMP。运行中的进程沿用启动时读到的值，在同一进程内新开会话也不会重新读取。

### 通用

- `enabled`：默认 `true`，取值 boolean。总开关。关闭时任何模块的处理器都不动作。固定复制快捷键仍在工厂阶段注册，因此键位继续被占用，处理器不动作。

### 等待

- `waitEnabled`：默认 `true`，取值 boolean。扩展已识别的内建 `wait`。
- `waitContinueEmptyWindows`：默认 `true`，取值 boolean。遇到全部任务仍运行的快照时，在同一次调用内继续。关闭时返回第一个原生窗口。
- `waitJobsSeconds`：默认 `1200`，取值数字 `0.05`–`3600`。单次 `wait` 调用的默认总期限。显式 `timeout` 覆盖它。
- `waitMessagesSeconds`：默认 `1200`，取值数字 `0.05`–`3600`。照常接受并校验；受支持的宿主没有纯消息等待入口，该项不起作用。
- `waitProcessSeconds`：默认 `1200`，取值数字 `0.05`–`3600`。照常接受并校验；受支持的宿主没有命名进程等待入口，该项不起作用。进程控制使用宿主的 `proc://` 接口。

### 恢复

- `recoveryEnabled`：默认 `true`，取值 boolean。注册 `session_stop` 处理器。
- `recoveryMode`：默认 `knownTransient`，取值 `knownTransient` 或 `unclassified`。可续跑的错误范围。`knownTransient` 接受宿主判定为瞬时或超时的错误、宿主标记为流中途中断的错误，以及既无 HTTP 状态也无分类结论的错误；`unclassified` 在相同安全排除与终止性客户端状态检查后接受宿主判定为瞬时或超时的错误，以及全部未分类错误，不论是否带 HTTP 状态。
- `recoveryMaxAttempts`：默认 `8`，取值整数 `1`–`8`。一条失败链请求的续跑轮次上限。
- `recoveryBackoffBaseMs`：默认 `1000`，取值整数 `1`–`10000`。首次续跑前的等待时间。
- `recoveryBackoffMaxMs`：默认 `8000`，取值不小于 `recoveryBackoffBaseMs` 的整数，上限 `10000`。倍增等待的上限。
- `recoveryNotify`：默认 `true`，取值 boolean。每次续跑显示一行提示，包含次数与等待时间。

### 压缩超时

- `compactionTimeoutEnabled`：默认 `false`，取值 boolean。安装进程级的 `AbortSignal.timeout` 包装。默认关闭。
- `compactionTimeoutMs`：默认 `900000`，取值大于 `compactionTimeoutFloorMs` 的整数，上限 `3600000`。命中调用获得的期限，单位毫秒。
- `compactionTimeoutFloorMs`：默认 `300000`，取值整数 `300000`–`3599999`。实验提高期限的最低值。专家项：若下限之上没有空间，该模块会被拒绝；下限高于原生 `300000` ms 请求期限时，压缩请求本身不再命中，`/qol` 会说明这一点。
- `compactionWindowGuardMs`：默认 `3600000`，取值不小于 `compactionTimeoutMs`、上限 `14400000` 的整数。一个压缩窗口的最长存活时间，从打开窗口的事件开始计算。
- `compactionTimeoutNotify`：默认 `true`，取值 boolean。窗口内首次改写期限时显示一行提示。

### 重放

- `replayEnabled`：默认 `true`，取值 boolean。安装进程级包装，使恢复会话的首次请求沿用提供方的原生历史。默认开启；未携带已存条目的会话不受影响。

### 任务参数

- `taskArgsEnabled`：默认 `true`，取值 boolean。内建 task schema 暴露 seance 专用字段 `sourceSession` 时，在宿主校验前从非 seance 任务项删除该字段与 `model`。注册的处理器会关闭推测启动和实验性的推测读取。只有普通 `model` 选择器的 schema 会报告 `unavailable` 且不注册 handler。重启生效。

### 复制

- `copyEnabled`：默认 `true`，取值 boolean。把 `alt+shift+a` 绑定为复制最后一条 assistant 回复的文本块。总开关 `enabled` 也须开启。快捷键在扩展工厂执行时注册，因此本开关关闭或设置被拒绝时，键位仍被占用，处理器不动作。重启生效。

### 校验

- 缺失的键取默认值。
- `null`、类型错误、非有限数字、需要整数却不是整数、超出上述范围，或枚举值不在 manifest 中，只停用拥有该键的模块，其他模块照常注册。
- 未知键、设置根不是对象，或设置 getter 失败，停用全部模块。
- 诊断只写被拒绝的键与规则，不回显取值，例如 `wait.jobsSeconds=range`。每个原因在一次激活中通过宿主日志报告一次，宿主提供 UI 时也报告一次。

## 状态

`/qol` 打印当前状态，不做任何修改。它不启动模型轮次，也不读取设置 schema 之外的值。

```
@ruokee/omp-qol 0.5.10
activation cwd: /home/me/project
refresh: restart OMP; settings are read once per activation
settings: ok
wait: enabled (entry=wait effectiveDefaultSeconds=1200 messageContinuation=not-applicable processWait=not-applicable serviceContinuation=not-applicable) — enabled=true continueEmptyWindows=true
recovery: enabled — enabled=true mode=knownTransient maxAttempts=8 backoffBaseMs=1000 backoffMaxMs=8000 notify=true
compaction: disabled (compaction-disabled) — enabled=false timeoutMs=900000 floorMs=300000 windowGuardMs=3600000 notify=true
replay: enabled (rewrites=0) — enabled=true
taskArgs: enabled (rewrites=0) — enabled=true
copy: enabled — enabled=true shortcut=alt+shift+a
```

`pending` 表示该进程尚未执行过会话启动。`disabled`、`invalid`、`incompatible` 和 `unavailable` 各自带原因码；设置对象只被部分接受时，`problems:` 列出被拒绝的键。设置对象整体被拒绝时，每个模块行替换为拒绝原因，报告末尾列出导致拒绝的键。

## 限制

每项调整自身的限制见[调整项](./docs/adjustments.zh.md)。

## 兼容性

最低维护 OMP 版本为 `18.5.0`，不设置维护版本上限。本小节声明维护责任，不作为安装或运行条件。更早的宿主仍可能运行本包，但不因此获得维护承诺。这一声明不保证后续版本继续可用，也不表示下限及以上的每个版本都已验证。

包的 peer 以无限制的范围 `*` 声明 `@oh-my-pi/pi-agent-core`、`@oh-my-pi/pi-ai` 与 `@oh-my-pi/pi-coding-agent`。该声明只列出组件导入的宿主包，不构成维护范围，不带运行时检查，也不表示任何宿主版本可用。

自动化类型检查与测试套件针对 OMP `18.5.0` 运行。源码基线按路径区分：上游错误后续跑、压缩期限与原生历史重放引用最初阅读这些机制时的 `18.2.8`，持续等待引用 `18.5.0`；任务参数清理引用 `18.11.3`，即读取 seance task schema 的版本；复制引用 `18.5.0` 的快捷键注册表与剪贴板导出，原生动作表则在已安装的 `18.11.3` 上检查。

这些检查只覆盖各模块实际查看的内容，不覆盖入口自身的导入，也不覆盖没有任何模块检查的差异，因此无法识别的宿主变化也可能在不被停用的情况下改变行为。

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

之后重启 OMP。运行中的进程沿用启动时加载的扩展代码。扩展不保存自身状态，更新不会改动会话、消息或任务。

### 卸载

卸载包并重启 OMP。除你自行设置的配置外没有其他写入内容，可用 `omp plugin config delete @ruokee/omp-qol <key>` 删除这些键。

## 开发

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
```

测试套件用一个小型记录宿主替代宿主，同时保留真实的包边界：来自已安装 `@oh-my-pi/pi-coding-agent` 的设置 getter、来自已安装 `@oh-my-pi/pi-ai` 的错误分类器，以及原生与已替换两种状态的 `AbortSignal.timeout` 与 `Map.prototype.set`。各调整项的检查覆盖记录在[调整项](./docs/adjustments.zh.md)。

## 更新

### 0.5.10

压缩请求用量和模型提示词规则归属 `@ruokee/omp-smart-context`。从用户级和项目级 QoL 设置中删除 `compactionUsageEnabled`、`modelPromptsEnabled`，任一遗留键都会导致 QoL 整体拒绝配置。删除前，把每项能力原 `enabled && 模块开关` 的有效结果保存为新包的独立设置，包括项目覆盖。保留其余所有 QoL 设置及既有规则文件。替换旧注册和配置后重启 OMP。QoL 不安装或停止迁出的模块。

## 许可证

MIT。
