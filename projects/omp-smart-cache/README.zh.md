# omp-smart-cache

[English](./README.md)

`@ruokee/omp-smart-cache` 将已确认普通请求的处理结果复用于用户选定 Provider 的原生非 Codex Responses V2 远端压缩。覆盖主会话和原生 task、Eval 子会话。版本：`0.0.2`。

只在最终发送边界改写已经完整证明的目标请求。触发、准备、裁剪、凭据、重试、回退、投机采用、历史提交和续接仍归 OMP。普通请求不变。对齐不等于 Provider 缓存命中或收益。

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
| `compactionCacheEnabled` | `false` | boolean | 启用 remote 对齐。 |
| `compactionCacheProvider` | `""` | string | 已配置 Provider 的精确名称，空值保持不可用。 |
| `compactionCacheMode` | `"hooks"` | `standard`、`hooks` | 选择复用合同，不启用对齐。 |

OMP 将项目覆盖合并到用户设置上。每次激活只读取并验证一次设置，修改后重启 OMP。导航不刷新快照；子会话使用自己的实际模型、工具、提示词和会话身份。缺失键采用默认值。显式 `null`、错误类型、未知键或非法模式使本能力不可用。诊断只使用固定原因，不输出被拒绝的值。

### 模式

两种模式都对齐已识别的原生共同内容，包括有效工具 schema 准备、提醒、重放语义和隐式工具选择默认值。V2 保留自己的输出上限或缺省。

- `standard` 只接受已识别的原生准备差异，不推定通用 handler 投影。
- `hooks` 还复用已经证明且实际发送的处理结果。完整保留范围支持合法插入、重排、恢复、跨范围合并、图片和既有后置 payload 转换。不再次调用有状态 handler。

先证明完整源范围，再做局部匹配。重复源消息不会使已经成立的完整结果证明失效。只保留部分历史时，仅复用依赖保持不变的独立已发送单元。原生改写的工具输出保持改写状态，不补回被删除的依赖。新增普通、工具及图片尾部、opaque 历史、调用配对和 trigger 保持原生边界。

不可分结果的依赖发生变化时，整条请求保持原生，报告 `projection-dependency-changed`。来源或单元边界未知时报告 `projection-unconfirmed`。两种拒绝都计入未对齐，不计为对齐成功。不提供冻结纯投影协议，也不重新执行黑盒 handler。

## 资格与失败行为

只有普通主循环 dispatch 的源、完成的准备、既有回调和实际出站 payload 被确认为同一次 dispatch，才成为参照。标题、预热、advisor、Handoff 等副请求不能成为参照。每个原生操作冻结最初参照，包括缺失参照状态；后续在线工作和认证、传输重试不替换它。

实现从 `session_start` 之前观察原生 CLI/SDK 发布，并持续核对原 agent、runner 和 stream 身份。这不是认证任意已构造 Agent 的 API。未被观察或被更换的处理链仍可保留完整范围证明，但不能通过长度或输出相等取得局部原生独立性。具有历史依赖的图片准备和后续日期/cwd 提醒，在未建立局部依赖证明时也需要完整范围证明。

未知字段、显式策略差异、模型或工具失配、身份歧义、缺失参照、操作取消、外部包装或不可用接口使整条请求保持原生。Codex、V1、其他 API 和其他 Provider 不变。不读取凭据内容，不增加参照请求或认证请求。

switch、branch、tree 导航前撤销旧 epoch。原生转换结算后，新的普通发送恢复资格，成功、取消及失败均适用。子会话结束或替换只释放自身登记。清理只恢复本包仍持有的包装，不接管竞争包装。最后一个登记结束时释放共享资源。只保留当前参照及仍可从活跃原生操作访问的快照。

关闭开关或移除本包并重启 OMP，恢复原生请求路径。更新时不向现存进程转移在途参照。本包不安装压缩否决钩子，不绕过其他扩展的否决，不改变 Handoff 行为。

## 状态

`/smart-cache` 不启动模型 turn，报告当前会话状态：

| 状态 | 含义 |
| --- | --- |
| `disabled` | 显式开关关闭。 |
| `unavailable` | 配置、接口、身份或包装所有权不可用。 |
| `awaiting-reference` | 新操作尚无可用的已确认普通参照。 |
| `already-aligned` | 有效候选与原生正文相同，不重新序列化。 |
| `rewritten` | 已委派完整验证后的候选。 |
| `rejected` | 证明失败，目标原样委派。 |

分别显示在线确认、操作绑定、候选验证和发送阶段。局部 dispatch、operation、reference 编号不是持久会话标识。逻辑操作、物理发送、重试、对齐、改写和拒绝分别采用有界计数。拒绝仍保留在总数中。后续原生提交不会把已委派改写变成 Provider 命中结论。

状态不包含消息正文、opaque 字节、凭据、原始端点或私密路径。不提供采样日志、试验环境变量或特殊采样命令。

## 宿主兼容与源码基线

**OMP 维护下限：`18.5.0`。** 没有上界或激活版本白名单。宿主开发依赖锁定此下限，peer 不收窄；缺少接口时保守失败。

源码基线为发布的 `@oh-my-pi/pi-agent-core`、`pi-ai`、`pi-coding-agent` `18.5.0`，当前受维护宿主核对使用 `18.8.3`。相关宿主包源码路径为 `src/sdk.ts`、`src/registry/agent-registry.ts`、`src/session/session-maintenance.ts`、`src/session/date-cwd-reminder.ts`、`src/session/messages.ts`、`src/compaction/compaction.ts` 和 `src/providers/openai-shared.ts`。

导入使用编译宿主公开的入口。源编码保持使用 `buildResponsesInput`。其经过模型适配及 hoist 的输出传给 `buildOpenAiNativeHistory`，不传原始消息，以执行原生 V2 重放规范化。opaque 来源比较通过同一原生编码器处理单条 compaction record，要求唯一匹配，并在规范化之前恢复原 record。局部图片资格通过原生 `images.urls.enabled` handle 读取当前会话设置，包括子会话覆盖；缺失 handle 不视为关闭。

两版实际原生 CLI 覆盖完整范围复用、工具输出裁剪后的局部复用、主会话/task/Eval 归属、并行子会话隔离、子会话 revive/取消及 switch/branch/tree 恢复。受控合成 HTTP 保留原生 serializer、调度和 maintenance。合成 usage 不是真实 Provider 测量，源码核对也不是运行验证。

编译版 `18.8.3` 检查还覆盖上述导入、opaque 身份、必需局部复用，以及原生 task、Eval 子会话的 false/true 图片设置覆盖。没有独立单元合同的 context 或 provider-request handler 阻止局部证明，完整范围复用仍可用。这些受控检查不证明缓存收益。

受维护原生接口在所需路径提供等价配置、隔离、复用安全及失败行为后，以行为验证为依据替换本适配。

## 开发

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
```

## 许可

MIT。
