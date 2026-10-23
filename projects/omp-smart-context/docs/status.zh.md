# 状态

[English](./status.md)

运行 `/smart-context` 查看能力状态，不启动模型轮次。Remote 与 Handoff 分别显示，之后列用量、模型规则及 Pin。报告不含消息或规则正文、不透明历史、凭据、原始端点或私密路径。

## 对齐状态

- `disabled`：该能力开关关闭。
- `unavailable`：配置、必要宿主接口、会话身份或扩展接口占用冲突导致不可用，查看固定原因。
- `awaiting-reference`：没有已确认且符合条件的普通请求。再次压缩或 Handoff 前先发送普通提示词。
- `already-aligned`：原生请求已与可用对齐结果一致，无需改写。
- `rewritten`：已校验的对齐请求发送至原生传输。
- `rejected`：无法验证对齐，请求原样发送，未被阻断、延迟或丢弃。

模型、工具集合、历史、分支变化或取消可使早前普通请求失效。新普通工作可恢复未来操作资格，不改变已在进行的压缩。

## 对齐字段

- `mode`：Remote 选择的 `standard` 或 `hooks` 模式。
- `online`：普通请求是否已确认，以及可用或不可用原因。
- `binding`：当前压缩或 Handoff 是否关联到符合条件的会话请求。
- `candidate`：可能的改写结果是否通过检查。
- `sending`：原生传输收到改写正文还是原始正文。
- `dispatch`、`operation`、`reference`：分别标识普通发送、操作及其普通请求参照的局部计数，不是模型或提供方身份。

## 计数

- `operations`：逻辑压缩或 Handoff 操作数。
- `sends`：实际传输发送数，包含重试。
- `retries`：操作内的额外发送数。
- `aligned`：已对齐或成功改写的发送数。
- `rewritten`：正文发生改变的发送数。
- `rejected`：对齐检查失败后保持原生的发送数，仍计入总数。
- `reused`、`retained`：最近一次 Remote 发送的复用和保留计数，不是累计总数。
- `axes`、`unprojected`：Handoff 已恢复或保留原生值的修复维度。

计数有上限。对齐成功说明发送了什么请求，与 OMP 是否采用压缩结果、提供方是否报告缓存命中是不同结果。

## 其他能力

`compactionUsage`、`modelPrompts`、`pin` 分别报告自身状态及可选固定 `reason`。一项关闭、配置无效或接口不兼容，本身不会停用其他项。用量还报告实时进程登记、条目、成本缺失及身份未解析计数，见[用量](./usage.zh.md#查看结果)。

设置或扩展注册变化后重启 OMP。读取状态不重新加载配置，也不接管其他扩展占用的接口。
