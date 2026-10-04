# omp-status-bar

[English](./omp-status-bar.md) | 中文

[projects/omp-status-bar](../../projects/omp-status-bar/README.zh.md) 的规格。

## 目标

- 在 OMP 编辑器下方显示一行常驻状态，按用户配置的顺序由各 Provider 组成。
- 随包提供 token 计数、缓存命中率、上下文用量和已回答请求数等内置 Provider。
- 允许其他扩展通过公开的 Provider 合同增加 Provider。
- 在上下文状态旁用静态字形标识上下文窗口。

## 非目标

- 注册或替换原生 statusline 片段。
- 金额、费用或高级请求次数读数。
- 包级 `enabled` 字段。启用或禁用 OMP 插件是唯一开关。
- 配置热重载。
- 读取 compaction 设置或估算投机压缩区间。

## 公共面

- Provider 合同与注册：[projects/omp-status-bar/docs/provider-contract.zh.md](../../projects/omp-status-bar/docs/provider-contract.zh.md) 和 [projects/omp-status-bar/docs/provider-dev.zh.md](../../projects/omp-status-bar/docs/provider-dev.zh.md)。
- 配置文件和字段：[配置](../../projects/omp-status-bar/docs/usage.zh.md#配置)。
- 内置 Provider、公式、标签和配色：[内置 Provider](../../projects/omp-status-bar/docs/usage.zh.md#内置-provider)。
- `turn` 和 `context` Provider：[turn Provider](../../projects/omp-status-bar/docs/usage.zh.md#turn-provider) 和 [context Provider](../../projects/omp-status-bar/docs/usage.zh.md#context-provider)。
- 刷新与失败行为：[数据刷新](../../projects/omp-status-bar/docs/usage.zh.md#数据刷新)和[失败行为](../../projects/omp-status-bar/docs/usage.zh.md#失败行为)。

## 不变量

- `context` 状态的文本左侧固定显示 Nerd Font 字形 `U+F0068`，作为上下文窗口的标识。字形与文本属于同一个状态片段，以一个普通空格分隔，分隔符不会落在两者之间。
- 字形不闪烁、不随上下文用量变化，也不显示窗口大小。
- 组件不读取任何 compaction 设置，也不估算投机压缩区间，不包含这类区间的状态机、采样、诊断、文档或测试。
- 没有用量数据或 `contextWindow <= 0` 时，`context` 状态不发布任何内容。
- token 指标和缓存命中率只统计当前分支上对话自身的用量，带外的模型用量不计入。
- Provider 发布结构化片段。组件的 Host 端是清洗、着色、组合和截断片段的唯一位置。无效片段只清除该 Provider 实例。
- 配置在会话开始时读取一次。文档格式错误时不启动任何内容；无效条目被跳过，有效条目照常运行。
- 组件只在扩展上下文支持 UI 时工作，无界面会话中保持空闲。
- 组件不保留只为 OMP 18.5.0 以前宿主存在的代码路径，包括通过 `Settings.getGroup` 读取 compaction 设置的路径。

## 宿主下限

OMP `18.5.0`，声明在[兼容性](../../projects/omp-status-bar/README.zh.md#兼容性)。`@oh-my-pi/*` 开发依赖锁定为 `18.5.0`，测试以该宿主的行为为基线。通用规则见 [.agents/spec/host-compatibility.zh.md](./host-compatibility.zh.md)。

## 验收标准

- 在组件目录运行 `bun run typecheck` 和 `bun test` 通过。
- 在 OMP 18.5.0 或更新的宿主上，有上下文用量数据时，`context` 状态文本左侧显示静态的 `U+F0068`。
- 组件源码中没有对 compaction 设置的读取。
- 每次发布前通过[发布门槛](../../projects/omp-status-bar/docs/usage.zh.md#发布门槛)中的真实终端检查。

## 相关 ADR

- [以静态上下文字形维护 OMP 状态栏](../adr/decision/2026-10-04-show-static-context-glyph.zh.md)
- [宿主内组件按共同的 OMP 下限维护](../adr/decision/2026-10-04-raise-omp-host-floor.zh.md)
- [保持可分发组件自包含](../adr/decision/2026-08-24-keep-components-self-contained.zh.md)
