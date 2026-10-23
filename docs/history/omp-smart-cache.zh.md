# omp-smart-cache 版本记录

[English](./omp-smart-cache.md) | 中文

以下版本属于已退出的 `@ruokee/omp-smart-cache` 组件。保留的请求对齐能力由 `@ruokee/omp-smart-context` 维护，新组件首次交付版本为 `0.1.0`。

## 版本

### 0.1.7

允许宿主在普通 dispatch 后补写 assistant 的 `completedAt` 和 `contextSnapshot` 记账字段。Responses Handoff 的来源证明仍严格比较其余字段，并保留完整原生 input。

### 0.1.6

在会话导航期间观察到普通 Responses context 时报告 `navigation-unsettled`，导航结束前不采集参照。

### 0.1.5

支持独立启用的 Responses Handoff，对齐已确认普通 dispatch 的系统提示词。保留 instructions 与前置 developer 表达、历史顺序、原生 none、reasoning 和配置更新；与 V2 分别验证和计数。普通来源取自同次准备 dispatch，不依赖尚未同步的 Agent state。

### 0.1.4

阻止晚到普通响应和相同 body 的重试恢复失效 Handoff 参照或操作。Handoff 方法要求可信原生构造基线，保留外部包装，只在最终传输执行投影及发送计数。原生工具 schema 通过宿主的 wire-schema 转换冻结。

### 0.1.3

将原生隐藏 Eval 状态上下文视为准备阶段的投影，不把它当作 journal 历史依赖。两种模式在该投影重建后仍可使用完整源复用。用户消息、其他 custom 消息及构造来源未确认的会话保留原有源依赖。

### 0.1.2

修复自动压缩在普通工具 run 内增加 epoch 后，remote 参照无法恢复的问题。新的普通 dispatch 独立证明凭据绑定，不替换较早压缩操作的不可变参照，也不恢复该操作。
