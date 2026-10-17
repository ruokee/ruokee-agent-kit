# omp-context-pin

[English](./omp-context-pin.md) | 中文

[projects/omp-context-pin](../../projects/omp-context-pin/README.zh.md) 的规格。

## 目标

- 让钉住的文本在当前会话分支后续的每个普通模型请求中逐字可用，直到被更新、取消钉住或分支上下文被重置。压缩不会结束钉住。
- 给用户提供 `/ctx-pin` 命令，给 Agent 提供 `ctx_pin` 工具，作为两个入口。
- 钉住内容的规范记录保存在会话 journal 中；变更消息和工具结果是它的投影。

## 非目标

- 读取文件、抓取 URL、监视钉住的内容，或在没有操作的情况下改变条目。
- 把自然语言解析为钉住操作。
- 写入 journal 文件、调用宿主私有方法、创建第二个会话，或为强制保存而发起一轮对话。持久化由宿主负责。
- 迁移早期不受支持格式写入的记录。

## 公共面

- 命令、工具动作和确认的写入：[用法](../../projects/omp-context-pin/README.zh.md#用法)。
- 记录格式、revision 和编号：[记录模型](../../projects/omp-context-pin/README.zh.md#记录模型)。
- 重置行为：[重置](../../projects/omp-context-pin/README.zh.md#重置)。
- 大小上限：[上限](../../projects/omp-context-pin/README.zh.md#上限)。
- 持久化与缓存行为：[持久化](../../projects/omp-context-pin/README.zh.md#持久化)和[缓存行为](../../projects/omp-context-pin/README.zh.md#缓存行为)。

## 不变量

- 组件只注册一个斜杠命令 `/ctx-pin` 和一个工具 `ctx_pin`。
- 入口决定来源：`/ctx-pin` 写入用户条目，`ctx_pin` 写入 Agent 条目，条目保留其创建来源。
- 条目编号是单个会话内的正整数，永不复用。
- 两个入口都在任何状态变化前检查单条和单分支的大小上限。
- Agent 的写入在下一轮送达，从不发起模型轮次。
- 提交压缩后，钉住快照由分支自身的记录重建，钉住状态未变时逐字节相同。没有已提交的边界时不生成快照。
- 公开工具 schema 接受 `list`、`get`、`show`、`create`、`update` 和 `delete`。`update` 和 `delete` 只取目标 id，不取 revision；它们作用于执行时的当前条目。revision 仍是内部记录和显示值。
- `show` 只读：返回全部活跃条目的完整正文、元数据、总活跃字节和分支上限，不改变条目、revision、活跃用量、journal 或投影。
- 未知、损坏或无效的记录使受影响的范围不可用：读取报告该状态，写入被拒绝，记录保留。
- 组件不声称宿主未确认的持久化。
- 组件不保留只为 OMP 18.5.0 以前宿主存在的代码路径，包括激活前的宿主成员探测、`getEntries` 能力探测，以及用户消息缺少 `timestamp` 时的计数回退。

## 宿主下限

OMP `18.5.0`，声明在[兼容性](../../projects/omp-context-pin/README.zh.md#兼容性)。`@oh-my-pi/*` 开发依赖锁定为 `18.5.0`，测试以该宿主的行为为基线。通用规则见 [.agents/spec/host-compatibility.zh.md](./host-compatibility.zh.md)。

## 验收标准

- 在组件目录运行 `bun run typecheck` 和 `bun test` 通过。
- `show` 返回条目数、全部活跃条目的完整正文、id、来源、revision 和 UTF-8 字节数，以及总活跃字节和分支上限。空分支明确说明没有固定正文。它不追加记录，不改变 revision 或活跃用量。
- 在使用真实模型的真实 OMP CLI 会话中，扩展能加载，六个动作都能通过工具工作，包括不带 revision 的 `update` 和 `delete` 以及完整 `show`；手动压缩后剩余的钉住条目仍然生效。
- 验证 Pin 对缓存的影响时，比较 Provider 可见的有效上下文；宿主发送链式增量时纳入前序请求；单独归因宿主自身的变化；检查 Pin 是否引入可避免的前缀改写。
- 源码中没有以 OMP 18.5.0 以前宿主为条件的分支。

## 相关 ADR

- [omp-context-pin](../adr/decision/2026/09/15-omp-context-pin.zh.md)
- [Context Pin 工具契约](../adr/decision/2026/10/17-context-pin-tool-contract.zh.md)
- [宿主维护](../adr/decision/2026/09/28-host-maintenance.zh.md)
- [组件自包含](../adr/decision/2026/08/24-component-self-containment.zh.md)
