# QoL 错误恢复

## 目标

不经新用户消息，继续符合条件的主会话中断工作。本调整遵循组件共同的配置、激活、状态和隔离要求。

## 非目标

- 改变轮内原生重试、提供方选择、宿主错误分类器或子代理恢复。
- 匹配提供方错误正文、恢复全部错误、工具恰好执行一次、回滚或幂等续跑。

## 公共面

### 配置

| 键 | 默认值 |
| --- | --- |
| `recoveryEnabled` | `true` |
| `recoveryMode` | `knownTransient` |
| `recoveryMaxAttempts` | `8` |
| `recoveryBackoffBaseMs` | `1000` |
| `recoveryBackoffMaxMs` | `8000` |
| `recoveryNotify` | `true` |

`recoveryMode` 只接受 `knownTransient` 和 `unclassified`。`recoveryMaxAttempts` 是 1 至 8 的整数。

`recoveryBackoffBaseMs` 是 1 至 10000 的整数。`recoveryBackoffMaxMs` 是大于基值且不超过 10000 的整数。

### 状态

`/qol` 的恢复行显示模式、次数上限、基值、封顶值和通知开关。

### 错误恢复

只恢复最后一条 assistant 消息为 `stopReason: "error"` 的主会话运行，包括原生重试结束后仍存在的错误。成功输出引用错误文字仍是普通输出。缺少必要恢复接口或开关关闭时保留原生行为。不得改动原始 assistant 错误。

`knownTransient` 接受宿主分类为 `Transient` 或 `Timeout` 的错误、`stopDetails.type` 为 `stream_interrupted_after_content` 的错误，以及同时没有 HTTP 状态和分类结论的错误。未分类指宿主错误 ID 为零或在其 class mask 之外。无状态未分类错误不需要中断标记。`unclassified` 接受瞬时、超时和全部未分类错误，受相同排除规则约束；中断标记不扩大该模式范围。

两种模式都排除内容阻断、用户中断、abort、silent abort、认证失败、OAuth 过期、用量限制、账户策略、上下文溢出、payload 拒绝、grammar 拒绝、不支持的模式、thinking loop、过时的 responses item 和确定性工具 JSON 错误。HTTP 4xx 中除 408 与 429 外均为终止状态。排除项和终止状态优先于模式及中断标记。

使用默认开关与模式时，下列 assistant 错误根据宿主字段符合恢复条件，除非取消、排除项、终止状态或任一上限阻止续跑：

```text
Error: Upstream provider closed the connection before the response completed: stream ended without terminal event or completed response
```

不经新用户消息，在同一主会话继续。尝试次数从 1 开始，每次等待 `min(base × 2^(attempt - 1), max)` 毫秒。每链预算与退避跨模型运行保留。宿主独立的每链 8 次续跑上限仍生效。只有本模块实际请求的续跑计入次数。同一运行和轮次的重复停止事件不增加等待或续跑。

正常完成、范围外错误或取消结束当前链。之后的独立链使用新预算。其他 stop hook 的续跑不继承本模块已经耗尽的预算。新运行、会话切换、关闭或原链失效阻止旧延迟触发续跑。延迟期间按 Esc 取消，不消耗尝试次数。通知启用时，每次续跑显示一次包含次数和延迟的警告。

使用以下固定续跑文本，不携带提供方错误正文、命令或工具输出：

```text
The previous turn was interrupted by an upstream transport error, so its work may be incomplete. Check what already exists and what side effects already happened, then continue the task from there. Do not redo work that is already done.
```

这是新续跑轮次，不是逐字节重发失败请求。它重新发送对话上下文并消耗提供方配额。已完成副作用保留且可能重复；此前未执行的调用可能执行。OMP 继续负责历史、调度和审批。历史保留原错误，续跑使用宿主隐藏上下文，不新增用户请求。

## 验收标准

- 在受维护的真实 OMP CLI 主会话中，默认恢复设置在符合条件的上游流错误后、不经用户消息自动续跑。原生重试或状态显示启用不能代替该证据。相同故障下关闭恢复不产生 QoL 续跑。真实 TUI 显示尝试次数和延迟，取消能阻止续跑。
- 两种模式都根据错误的宿主字段判断资格，排除条件和终止状态优先。有标记及无标记的无状态错误按各模式资格处理，不匹配报错措辞。
- 同一失败链跨运行的续跑遵守独立上限和配置退避。重复事件不增加延迟或续跑，后续独立失败链取得新预算。
- 关闭恢复或延迟已失效时不产生续跑。开启通知时显示尝试次数和延迟；续跑保留原始错误，仅使用上述固定上下文。
