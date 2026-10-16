# omp-smart-cache

[English](./README.md)

`@ruokee/omp-smart-cache` 是一个优化 OMP 缓存的扩展。它力求避免请求出现意料之外的缓存未命中，同时保持普通请求与原生请求路径不变。

包内的各个优化项各自成节。

## 文档

- [设计](./docs/design.zh.md) 说明参照如何确认、哪些内容可以复用、请求何时保持原生。
- [验证](./docs/verification.zh.md) 列出本包依赖的宿主接口与已经核对过的场景。

## 安装

在本组件目录中执行：

```bash
omp install . --scope user
```

## 配置

通过 OMP 原生插件管理器安装本包。manifest 声明扩展和设置，不需要另加扩展入口或设置文件。

```bash
omp plugin config list @ruokee/omp-smart-cache
omp plugin config set @ruokee/omp-smart-cache compactionCacheProvider example-provider
omp plugin config set @ruokee/omp-smart-cache compactionCacheEnabled true
omp plugin config set @ruokee/omp-smart-cache handoffCacheEnabled true
```

| 设置 | 默认值 | 接受值 | 作用 |
| --- | --- | --- | --- |
| `compactionCacheEnabled` | `false` | boolean | 启用远端对齐。 |
| `compactionCacheProvider` | `""` | string | 已配置 Provider 的精确名称，空值保持不可用。 |
| `compactionCacheMode` | `"hooks"` | `standard`、`hooks` | 选择远端复用合同；启用远端对齐还需要开关和精确的 Provider 名称。 |
| `handoffCacheEnabled` | `false` | boolean | 启用 Handoff 对齐。只需要本开关，不需要 Provider 名称和模式。 |

OMP 将项目覆盖合并到用户设置之上。每次激活只读取和验证一次设置，修改后需要重启 OMP；导航不刷新快照，子会话使用自己的实际模型、工具、提示词和会话身份。缺失键采用默认值。显式 `null`、错误类型或未知键会使受影响的能力不可用，值属于远端键时只影响远端能力，不受支持的模式同样只使远端对齐不可用。诊断只报告固定原因，不输出被拒绝的值。两个远端模式的说明见[设计](./docs/design.zh.md#模式)。

## 远端压缩对齐

远端压缩会重新发送会话内容，其中相当一部分此前已由普通请求发送过。本项在最终发送边界改写已经完整证明的目标请求，使用户选定 Provider 的这次压缩沿用同一次普通请求已确认的处理结果，正文与已经发送过的内容保持一致。触发、准备、裁剪、凭据、重试、回退、投机采用、历史提交和续接仍由 OMP 负责，普通请求原样到达传输层。

只有普通主循环 dispatch 的源、完成的准备、既有回调和实际出站 payload 属于同一次 dispatch，并原样到达传输层时，它才成为参照。标题、预热、advisor 与 Handoff 属于副请求，各自保留正文。未知字段、显式策略差异、模型或工具失配、身份歧义、缺失参照、操作取消、外部包装或不可用接口会使整条请求保持原生。改写只覆盖非 Codex 的 Responses V2 远端压缩路径，适用于主会话以及原生 task、Eval 子会话。

关闭设置，或移除本包并重启 OMP，即可恢复原生请求路径。对齐在客户端改写实际发出的请求体，客户端对齐、原生可用性与真实 Provider 收益是彼此独立的三个结果。[设计](./docs/design.zh.md)记录完整机制。

## Handoff 对齐

Handoff 依据当前会话生成文档或摘要，并把这项工作作为副请求发送，其中重复了普通主循环 dispatch 已经发送过的系统提示词和工具定义。本项改写该副请求，使其复用已经确认的普通请求：在线系统段、参照中存在时的在线 `reasoning_effort`，以及参照没有显式选择时的在线 `tool_choice`。副请求的指令、新增历史、缓存键、取消信号和其余请求选项保持宿主构建时的状态，正文在宿主自身的 payload hook 之后替换一次。

适用范围取决于会话的 API。模型 API 为 `openai-completions` 的会话属于 Handoff 候选，API 为 `openai-responses` 的会话归远端对齐，其他 API 两项能力都不使用。一条请求最多由一项能力处理，启用其中一项不会启用另一项。不含工具集的准备请求不提供参照，因此从不发送工具的会话保持原生。

只有当副请求的系统段是参照系统段的前缀、参照的非系统历史是副请求历史的严格前缀，且捕获的 Provider、模型身份、API、系统提示词、思考状态和工具集合仍然一致时，本项才改写该副请求。边界之外的请求携带固定原因原样发送，`rejected` 只表示本能力没有改写它，任何请求都不会被阻塞、延迟或丢弃。投影按轴还原：无法还原的轴跳过并计数，而不是放弃整次改写；轴之外的已知缓存敏感字段在存在差异时计数。候选与原生正文一致时报告为已经对齐，不重新序列化。

只有已确认的普通主循环 dispatch 才提供参照，本能力对齐的请求永远不会成为参照。switch、branch、tree 导航、压缩提交和会话释放都会清除参照并使该会话的 epoch 失效，新的普通发送即可恢复资格，不需要重启 OMP。

确认时重新核对 dispatch 的 epoch、身份、信号及完整归属，因此晚到响应不能恢复失效参照。每次物理发送，包括 body 相同的重试，都在复用候选之前重新核对归属。payload 回调只标记准备完成，最终传输才执行投影并记录发送。未知的会话方法包装保持原样，并报告为不可用。

当本机试验扩展仍被自动发现时，本包已安装副本、候选与试验扩展可能在同一进程内加载。外部协调器版本会被报告为冲突而不被复用；本版本把激活快照缓存在自己的键下，因此不会读取其他版本的条目；切换通过重启相关进程完成；本能力通过自身验收、随后获得安装授权后，试验扩展会被替换并停用。[验证](./docs/verification.zh.md)记录已核对的路径、共存运行和仍然存在的空白。

## 状态

`/smart-cache` 不启动模型 turn，按能力分段报告：远端段保持原有措辞与字段，Handoff 段给出自己的状态、分阶段原因和有界计数。下表描述两段的共同状态：

| 状态 | 含义 |
| --- | --- |
| `disabled` | 显式开关关闭。 |
| `unavailable` | 配置、接口、身份或包装所有权不可用。 |
| `awaiting-reference` | 新操作尚无可用的已确认普通参照。 |
| `already-aligned` | 有效候选与原生正文一致，不重新序列化。 |
| `rewritten` | 已委派完整验证后的候选。 |
| `rejected` | 证明失败，目标原样委派。 |

分别显示在线确认、操作绑定、候选验证和发送阶段。局部 dispatch、operation、reference 编号是会话内计数器。逻辑操作、物理发送、重试、改写和拒绝分别使用有界计数，拒绝仍计入总数。报告只包含状态与有界计数，是本包唯一的输出。消息正文、opaque 字节、凭据、原始端点与私密路径保留在会话中，配置只来自上面的原生设置。

## 兼容性

最低维护 OMP 版本为 `18.5.0`，不设置维护版本上限。本小节记录维护责任；安装与运行遵循宿主自身规则。验证覆盖该下限及高于它的受维护宿主，低于下限的宿主仍可能运行本包。

本包将 `@oh-my-pi/pi-agent-core`、`@oh-my-pi/pi-ai` 和 `@oh-my-pi/pi-coding-agent` 声明为不限制版本的宿主 peer（`*`），并把开发依赖锁定在 `18.5.0`。缺少接口时保守失败，保持原生路径。已核对的接口与场景见[验证](./docs/verification.zh.md)。

## 开发

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
```

## 更新

### 0.1.4

阻止晚到普通响应和相同 body 的重试恢复失效 Handoff 参照或操作。Handoff 方法要求可信原生构造基线，保留外部包装，只在最终传输执行投影及发送计数。原生工具 schema 通过宿主的 wire-schema 转换冻结。

### 0.1.3

将原生隐藏 Eval 状态上下文视为准备阶段的投影，不把它当作 journal 历史依赖。两种模式在该投影重建后仍可使用完整源复用。用户消息、其他 custom 消息及构造来源未确认的会话保留原有源依赖。

### 0.1.2

修复自动压缩在普通工具 run 内增加 epoch 后，remote 参照无法恢复的问题。新的普通 dispatch 独立证明凭据绑定，不替换较早压缩操作的不可变参照，也不恢复该操作。

## 许可

MIT。
