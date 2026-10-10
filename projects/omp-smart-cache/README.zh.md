# omp-smart-cache

[English](./README.md)

`@ruokee/omp-smart-cache` 是一个优化 OMP 缓存的拓展。它力求避免请求出现意料之外的缓存未命中，同时保持普通请求与原生请求路径不变。

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
```

| 设置 | 默认值 | 接受值 | 作用 |
| --- | --- | --- | --- |
| `compactionCacheEnabled` | `false` | boolean | 启用远端对齐。 |
| `compactionCacheProvider` | `""` | string | 已配置 Provider 的精确名称，空值保持不可用。 |
| `compactionCacheMode` | `"hooks"` | `standard`、`hooks` | 选择复用合同；启用对齐还需要开关和精确的 Provider 名称。 |

OMP 将项目覆盖合并到用户设置之上。每次激活只读取和验证一次设置，修改后需要重启 OMP；导航不刷新快照，子会话使用自己的实际模型、工具、提示词和会话身份。缺失键采用默认值。显式 `null`、错误类型、未知键或不受支持的模式会使本能力不可用，诊断只报告固定原因，不输出被拒绝的值。两个模式的说明见[设计](./docs/design.zh.md#模式)。

## 远端压缩对齐

远端压缩会重新发送会话内容，其中相当一部分此前已由普通请求发送过。本项在最终发送边界改写已经完整证明的目标请求，使用户选定 Provider 的这次压缩沿用同一次普通请求已确认的处理结果，正文与已经发送过的内容保持一致。触发、准备、裁剪、凭据、重试、回退、投机采用、历史提交和续接仍由 OMP 负责，普通请求原样到达传输层。

只有普通主循环 dispatch 的源、完成的准备、既有回调和实际出站 payload 属于同一次 dispatch，并原样到达传输层时，它才成为参照。标题、预热、advisor 与 Handoff 属于副请求，各自保留正文。未知字段、显式策略差异、模型或工具失配、身份歧义、缺失参照、操作取消、外部包装或不可用接口会使整条请求保持原生。改写只覆盖非 Codex 的 Responses V2 远端压缩路径，适用于主会话以及原生 task、Eval 子会话。

关闭设置，或移除本包并重启 OMP，即可恢复原生请求路径。对齐在客户端改写实际发出的请求体，客户端对齐、原生可用性与真实 Provider 收益是彼此独立的三个结果。[设计](./docs/design.zh.md)记录完整机制。

## 状态

`/smart-cache` 不启动模型 turn，报告当前会话状态：

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

## 许可

MIT。
