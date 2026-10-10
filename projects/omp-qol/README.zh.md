# omp-qol

[English](./README.md)

一个扩展提供可独立开关的 OMP 行为调整。每项调整的宿主源码、边界与已观察证据见[调整项](./docs/adjustments.zh.md)。

任务、消息、进程、模型轮次与压缩都由 OMP 管理。每项调整均可关闭；宿主接口、结构或归属无法识别时，对应调整保持不生效并报告原因。

## 调整项

| 调整项 | 默认 | 效果 |
| --- | --- | --- |
| [持续等待](./docs/adjustments.zh.md#持续等待) | 开 | `wait` 调用在全部任务仍运行的快照之间持续到同一个总期限，默认 20 分钟，而不是每个空的原生窗口都返回。 |
| [上游错误后续跑](./docs/adjustments.zh.md#上游错误后续跑) | 开 | 以可续跑的上游错误结束的轮次在同一会话内继续，首次等待 1 秒并按倍增延长至上限 8 秒，每条失败链最多 8 次续跑。可续跑的判据包括：分类器判定为瞬时或超时、宿主标记为流中途中断，以及既无状态也无分类结论的错误。 |
| [延长单个压缩期限](./docs/adjustments.zh.md#延长单个压缩期限) | **关** | 在一个压缩窗口内，命中的 `AbortSignal.timeout` 调用获得更长期限，使超过原生 5 分钟的远端压缩不被中断。进程级生效，实验性质。 |
| [恢复会话时沿用原生历史](./docs/adjustments.zh.md#恢复会话时沿用原生历史) | 开 | 恢复会话的首次请求沿用上一个进程结束时的原生提供方条目，而不是按通用内容重建对话，使基于该形式的提示缓存可以服务这次请求。进程级生效，只设置一个标志，不改写请求体。 |
| [模型提示词规则](#模型提示词规则) | **关** | 向每个受覆盖 turn 的系统提示词追加命中的用户 Markdown 正文，无需模板或其他组件。 |

等待调整新增可选 `timeout`，重放选择已存的原生条目。两者均不改模型、缓存键、已存历史或会话文件。恢复启动模型轮次，等待重复模型已经发出的调用，模型运行时会消耗服务额度。

## 配置

配置存放于 OMP 为 `@ruokee/omp-qol` 保存的插件设置中。`package.json` 中的 manifest 声明了每个键的类型、默认值和说明，OMP 会把项目级覆盖合并到全局值之上。

```bash
omp plugin config list @ruokee/omp-qol
omp plugin config set @ruokee/omp-qol waitJobsSeconds 1800
```

设置每次激活只读取一次。修改后需重启 OMP。运行中的进程沿用启动时读到的值，在同一进程内新开会话也不会重新读取。

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

### 模型提示词

| 键 | 默认 | 取值 | 效果 |
| --- | --- | --- | --- |
| `modelPromptsEnabled` | `false` | boolean | 追加按模型匹配的规则正文，总开关 `enabled` 也须开启。 |

```bash
omp plugin config set @ruokee/omp-qol modelPromptsEnabled true
```

修改开关后重启 OMP。既有规则文件无需迁移路径或格式。两个开关都开启时才注册 handler、读取规则并诊断未使用文件。

### 校验

- 缺失的键取默认值。
- `null`、类型错误、非有限数字、需要整数却不是整数、超出上述范围，或枚举值不在 manifest 中，只停用拥有该键的模块，其他模块照常注册。
- 未知键、设置根不是对象，或设置 getter 失败，停用全部模块。
- 诊断只写被拒绝的键与规则，不回显取值，例如 `wait.jobsSeconds=range`。每个原因在一次激活中通过宿主日志报告一次，宿主提供 UI 时也报告一次。

## 状态

`/qol` 打印当前状态，不做任何修改。它不启动模型轮次，也不读取设置 schema 之外的值。

```
@ruokee/omp-qol 0.5.5
activation cwd: /home/me/project
refresh: restart OMP; settings are read once per activation
settings: ok
wait: enabled (entry=wait effectiveDefaultSeconds=1200 messageContinuation=not-applicable processWait=not-applicable serviceContinuation=not-applicable) — enabled=true continueEmptyWindows=true
recovery: enabled — enabled=true mode=knownTransient maxAttempts=8 backoffBaseMs=1000 backoffMaxMs=8000 notify=true
compaction: disabled (compaction-disabled) — enabled=false timeoutMs=900000 floorMs=300000 windowGuardMs=3600000 notify=true
replay: enabled (rewrites=0) — enabled=true
modelPrompts: disabled (model-prompts-disabled) enabled=false
```

`pending` 表示该进程尚未执行过会话启动。`disabled`、`invalid`、`incompatible` 和 `unavailable` 各自带原因码；设置对象只被部分接受时，`problems:` 列出被拒绝的键。设置对象整体被拒绝时，每个模块行替换为拒绝原因，报告末尾列出导致拒绝的键。

## 模型提示词规则

每个受覆盖 turn 读取当前 profile 用户 agent 目录下的 `model-prompts`，由 `getAgentDir()` 解析，以及 `getProjectAgentDir(ctx.cwd)` 下的同名目录，即 `<cwd>/.omp/model-prompts`。只处理直接子项中以小写 `.md` 结尾的非隐藏普通文件。忽略文件符号链接和子目录，不向祖先目录或资源根目录搜索。目录缺失视为空集。

每个目录内按文件名的 JavaScript 字符串顺序排序，用户正文先于项目正文。项目文件不遮蔽同名用户文件，不同文件的相同正文仍分别贡献块。读取完成顺序不能改变该顺序。

### 格式与匹配

```markdown
---
metadata: optional, ignored
match:
  - exact: example-provider/example-model-1.0
  - model: another-model-1.0
  - contains: example-model
  - regex: ^example-provider/example-model-1\.0
---

Text appended to the system prompt.
```

UTF-8 Markdown 开头可有一个 BOM。分隔行须恰好为 `---`，支持 LF 和 CRLF。`match` 是必需的非空数组，每个条目恰好有下列一个键，值为非空白字符串：

- `exact` 比较完整的 `${model.provider}/${model.id}`。
- `model` 比较完整的 `model.id`，包括 id 自身包含的 `/`。
- `contains` 测试 `${model.provider}/${model.id}` 的字面子串。
- `regex` 以不带 flags 的 JavaScript `RegExp` 测试同一字符串。

条目之间是“或”的关系，一个文件命中多个条目仍只贡献一次。匹配区分大小写，按文本比较，不解析别名、角色、家族、显示名、传输名或思考等级后缀，不增加 glob 或模型列表语法。frontmatter 顶层额外键被忽略且永不注入；条目内未知键或多个键使整个文件无效。

每个匹配文件向传入的 turn 数组末尾贡献一个块。正文从闭合分隔行的行尾之后开始，逐字节保留标题、空行、LF/CRLF、缩进、HTML 注释、模板形似文本和末尾换行。frontmatter 和开头 BOM 不注入。不添加包装、标题、裁剪、模板渲染、上下文改写、消息或历史条目，既有块保持字节与顺序。

### 刷新与失败

每个受覆盖 turn 重新读取规则与有效模型。新增、编辑、删除和修复在下一 turn 生效，无需重启；失败文件不沿用旧正文。没有模型、没有规则或没有命中时，传入提示词不变。OMP 的 turn 级 override 在轮内重建时保留，下一 turn 从宿主基础提示词开始，因此正文不累积。设置仍采用激活快照，修改需重启。

无效文档在第一个失败点整文件跳过，原因包括 `frontmatter-missing`、`frontmatter-invalid`、`match-missing`、`match-empty`、`entry-shape`、`entry-key`、`entry-value`、`regex-invalid` 和 `body-blank`。`file-unreadable` 只影响一个文件，`directory-unreadable` 只影响一个目录，其他有效来源继续处理。handler 异常报告 `unexpected-error`，保留传入提示词，包括更早 handler 的结果。

规则诊断包含固定原因与作用域相对来源，例如 `project/20-rules.md`，按会话、来源和原因去重。每个 turn 使用自己的当前 UI 通知通道，无 UI 时使用宿主 logger。不报告正文、绝对目录、解析错误、正则源码或对话内容。新建或分叉会话有独立历史，返回已访问会话时保留本次激活的记录。开关类型错误只停用本模块，设置对象整体被拒绝时沿用既有整组件拒绝规则。`/qol` 显示状态、有效开关及原因，不显示模型身份或规则正文。

### 覆盖与信任

覆盖运行 `before_agent_start` 的普通主 turn 和普通子 turn。子 Agent 按自身有效模型匹配，保留角色、独立块及宿主协议。plan-mode 子 Agent、Handoff、标题生成与难度分类不新增注入入口，旁路请求沿用宿主对当前 Agent 提示词的处理。这是 turn 级合同，不在每次 Provider 请求、回退或临时模型切换时独立刷新。后续 handler 可以覆盖结果，模块不重排扩展，也不声称最终 Provider 优先权。

启用后，项目规则会成为系统指令，不增加项目信任门槛或安全隔离。JavaScript 正则没有沙箱或执行超时，匹配正文没有大小或额度限制，因此大文件会占用提示词空间，缓慢目录会拖慢 turn 装配。个人规则放用户目录，启用前检查项目规则。

### 上游复核

OMP 通过 [issue #6739](https://github.com/can1357/oh-my-pi/issues/6739) 或等价机制提供模型级指令后，重新核对匹配维度、替换或追加的组合及块位置、刷新时机、目录发现及优先级和顺序。判断保留本能力、只补宿主缺失部分或移除，并记录对应版本变化。宿主模板本身不能证明模型规则行为等价。

## 限制

每项调整自身的限制见[调整项](./docs/adjustments.zh.md)。简要说明：

- [等待](./docs/adjustments.zh.md#持续等待)。只有非空、全部任务仍运行的快照会继续。不提供纯消息续接、命名进程等待或纯 service 续接。期限只结束本次调用，不取消后台工作。
- [恢复](./docs/adjustments.zh.md#上游错误后续跑)。安全排除条件与宿主的独立上限仍适用，每条失败链最多续跑 8 次。续跑可能重复工具副作用，并消耗提供方额度。
- [压缩](./docs/adjustments.zh.md#延长单个压缩期限)。实验对整个进程包装 `AbortSignal.timeout`，可能延长窗口内无关调用的期限。在 OMP `18.5.0` 上启用会关闭投机压缩。生命周期冲突或 owner 关闭可能使补丁停止，重启后才恢复。
- [重放](./docs/adjustments.zh.md#恢复会话时沿用原生历史)。进程级 `Map.prototype.set` 包装只覆盖 `openai-responses` 状态。若服务端拒绝存储的原生条目，恢复后的请求可能失败。宿主变化可能使包装静默失效。

## 兼容性

最低维护 OMP 版本为 `18.5.0`，不设置维护版本上限。本小节声明维护责任，不作为安装或运行条件。更早的宿主仍可能运行本包，但不因此获得维护承诺。这一声明不保证后续版本继续可用，也不表示下限及以上的每个版本都已验证。

包的 peer 以无限制的范围 `*` 声明 `@oh-my-pi/pi-ai`、`@oh-my-pi/pi-coding-agent` 与 `@oh-my-pi/pi-utils`。该声明只列出组件导入的宿主包，不构成维护范围，不带运行时检查，也不表示任何宿主版本可用。

自动化类型检查与测试套件针对 OMP `18.5.0` 运行。源码基线按路径区分：上游错误后续跑、压缩期限与原生历史重放引用最初阅读这些机制时的 `18.2.8`，持续等待引用 `18.5.0`。[调整项](./docs/adjustments.zh.md)分别记录源码基线、实际检查或 CLI 运行，以及未经测试的场景。

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

之后重启 OMP。运行中的进程沿用启动时加载的扩展代码。扩展不保存自身状态，更新不会改动会话、消息或任务。

### 卸载

卸载包并重启 OMP。除你自行设置的配置外没有其他写入内容，可用 `omp plugin config delete @ruokee/omp-qol <key>` 删除这些键。

## 开发

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
```

测试套件用一个小型记录宿主替代宿主，同时保留真实的包边界：来自已安装 `@oh-my-pi/pi-coding-agent` 的设置 getter、来自已安装 `@oh-my-pi/pi-ai` 的错误分类器，以及原生与已替换两种状态的 `AbortSignal.timeout` 与 `Map.prototype.set`。覆盖范围包括激活与校验、`wait` 注册及其模型可见参数、结构化续接规则与期限竞态、恢复的分类矩阵与续跑链、压缩模块的安装顺序与窗口生命周期与还原路径，以及重放包装的改写与转发矩阵、归属与释放路径、各类拒绝与 `/qol` 行。

模型规则检查覆盖发现、匹配、正文保真、下一 turn 刷新、故障隔离、配置边界及会话级诊断。真实 CLI/TUI 观察及其边界见[模型提示词规则](./docs/adjustments.zh.md#模型提示词规则)。

## 许可证

MIT。
