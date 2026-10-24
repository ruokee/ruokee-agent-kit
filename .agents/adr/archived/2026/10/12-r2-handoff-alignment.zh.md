# Handoff 对齐

Decision owner: Ruokee
Decision writer: OMP
Reverses: [前一决定](../../../archived/2026/10/12-r1-handoff-alignment.zh.md)
Archived: 2026-10-22
Reversed by: [Handoff 对齐](./12-r3-handoff-alignment.zh.md)

[English](./12-r2-handoff-alignment.md) | 中文

## 动机

把 Handoff 缓存对齐作为 `@ruokee/omp-smart-cache` 的独立能力维护。

Handoff 根据实际对话生成交接文档或压缩摘要，其侧请求会重复普通主循环已经发送的系统提示词、工具及历史。重建后的共同前缀不同，会使本可复用的输入失去缓存资格。Responses Handoff 不携带 V2 压缩 trigger，因此需要自己的协议投影，不能由 [remote 对齐](./10-r2-remote-alignment.zh.md)代为处理。[扩展决定](./12-r1-smart-cache.zh.md)记录本包、能力模型和共同维护下限。

本机试验扩展验证过 Chat Completions 的部分投影。宿主在每个准备缝合点只提供一个方法，另装第二层包装会破坏现有归属，因此两项能力由同一包协调。

## 分析

只有已确认的普通 dispatch 能证明内容实际发出。最终侧请求或中间上下文不能单独建立该事实。宿主从当前会话历史与基础系统提示词生成 Handoff，不直接提供请求归属或普通参照标记。适配必须将同次来源观察、准备结果、出站载荷和响应确认绑定，并在侧请求准备及最终发送时核对同一个操作。

Responses 与 Chat Completions 的系统提示词和 reasoning 表达不同。Responses 可以使用顶层 `instructions` 或前置 `developer` 片段，其文档生成使用原生 `none`，并可能携带 reasoning 配置更新。照搬 Chat Completions 的字段还原会改变生成策略，或使 reasoning 状态不一致。客户端投影和原生采用可以分别验证，Provider 收益仍需可比真实请求证明。

## 决定

### 公共配置

Handoff 对齐是 [smart-cache](./12-r1-smart-cache.zh.md) 的一项能力，拥有自己的开关、状态、计数和验收，不新增安装、包、设置读取器或扩展入口。

唯一 Handoff 设置为原生 boolean `handoffCacheEnabled`，默认 `false`。它只启用本能力，与 remote 设置一起读取为同一激活快照，变更后重启 OMP。关闭时所有请求保持原生。不新增 Provider 清单、模式或第二配置源。remote 的 `compactionCacheEnabled`、`compactionCacheProvider` 与 `compactionCacheMode` 不变。Handoff 依靠同会话、模型、API、提示词和工具归属保护参照，组件文档声明验证范围和缺口。

### 请求归属

Handoff 支持 `openai-completions` 和 `openai-responses`，不按 Provider 清单分流。在 Responses 会话中，已证明的原生 Handoff 侧请求交给 Handoff；符合 remote 资格的 V2 请求交给 remote。一条物理请求最多由一项能力改写。其他 API 不属于两项能力范围。

两项开关独立。remote 关闭、Provider 未选中或模式不同时，Handoff 仍能取得自己的合格普通参照。启用 Handoff 不启用 remote。

### 参照绑定

只有已确认的普通主循环 dispatch 提供参照。原始来源、准备结果、最终载荷和实际发送必须属于同次 dispatch，且在 HTTP 响应确认后才发布。标题、advisor、预热、Handoff 和其他侧请求不能成为参照。不含工具集的准备请求不提供 Handoff 参照。

每个实际 AgentSession 独立持有参照、持久身份、Provider 身份、epoch，以及 Provider、模型、API、system、thinking 和工具归属。模型相同、端点、缓存键、时序或文字相同不能替代身份。同次 dispatch 的原始来源不能由尚未同步的公开消息状态代替。

每个操作冻结初始快照，包括缺失参照。新普通工作、认证刷新、重试、handler 状态推进和晚解析的信号 ancestry 均不升级旧操作。每次物理发送与响应确认都重新核对完整归属、信号、epoch 和包装。操作一旦失效，恢复原值也不能恢复资格，晚到成功响应不能重新发布参照。

switch、branch、tree 导航、压缩提交与释放撤销该会话参照和旧 epoch。导航成功、取消或失败结算后，由新普通发送恢复后续资格，无需重启。子会话结束、取消或 revive 不停用有效邻居。

### 共同投影边界

改写前证明操作归属、系统前缀、源历史与已发送共同内容的对应、新增尾部边界及工具归属。缺少必要证明时整条原生请求保持不变。未知形状、歧义边界或显式生成策略冲突不通过宽松匹配处理。

在已证明的边界内逐轴投影。不能还原的独立轴跳过并计数，无关字段差异不否决其余有效轴；已知缓存敏感差异独立计数。最终候选在宿主 payload hook 之后原子替换，每次实际发送重新验证。相同候选报告 `already-aligned`，不重新序列化。

Handoff 指令、新增历史、原生工具 schema 与调用配对、图片、reasoning replay、用户有效思考、缓存键、路由、独立 side session、取消信号和其他选项保持原生语义。不删除共同内容的依赖，不从其他操作取得替代参照。

### Chat Completions 投影

侧请求的 system 是普通 system 的前缀，普通非 system 历史是侧历史的严格前缀，且归属不变时，还原普通 system 段。参照持有 `reasoning_effort` 时还原该轴；普通参照没有显式工具选择时，按既有合同还原其 `tool_choice`。保留各轴不能还原时的计数。

### Responses 投影

只恢复已确认普通 system 中缺失且有来源证明的内容。顶层 `instructions` 允许已知文本前缀，包括同一系统片段内的缺失后缀。前置 `developer` 由普通准备时标定的系统片段及完整共同历史确认唯一边界，不把历史中的 developer 消息上移为 system。

普通原始来源必须是原生 Handoff 快照的完整前缀，共同 wire 历史必须对应，新增 Handoff 内容完整保留。只有比较视图可以识别原生 reasoning 配置更新；出站 input 不因比较而删除或移动这些项。

保留 Responses 原生 `none` 及宿主已有的 auto-only 兼容重试，不还原普通 auto。保留侧请求的嵌套 reasoning 与原生配置更新，不单独复制普通 effort 造成状态分离。这些未投影轴独立计数，不宣称它们与普通请求完全相同。

### 失败边界

无参照、证明不足、归属变化、取消、旧 epoch、歧义操作、未知包装基线、包装归属丢失及混装保持原生并报告固定原因。`rejected` 表示没有改写，不表示阻断、延迟或丢弃请求。后置 hook 的非投影选项保持不变。

只安装一层自有包装，保留原生参数、receiver、Promise、凭据结果、异常、信号及取消原因。外部包装不授权叠加或接管，释放只恢复仍持有的函数和属性形状。最后登记结束释放共享资源，只保留当前参照及活跃操作可达快照。

### 独立性

两项能力共享本包、协调器、逐会话登记、每个原生方法的一层包装，以及同次普通 dispatch 的不可变观察事实。每项能力独立解释事实并证明资格，不共享协议规则、载荷形状规则、原因码或收益证据。Handoff 不复用 remote V2 算法，一项拒绝或接口缺失不影响另一项。

`/smart-cache` 不启动模型 turn，分别显示两项能力的状态、在线确认、绑定、候选与发送原因，以及有界操作、物理发送、重试、对齐和拒绝计数。状态包含 disabled、unavailable、awaiting-reference、already-aligned、rewritten 和 rejected。诊断不输出正文、opaque、凭据、端点、私密路径或动态私密键。

### 原生职责

OMP 负责文档生成、调度、触发、投机、等待、取消、认证与传输重试、模型或方法回退、结果校验、采用、历史提交和续接。本能力不新增入口，不注册 `session_before_compact`，不替换手动压缩，不否决请求，不新增凭据或参照请求，不重跑处理器，不修改设置，不伪造或校验摘要结构，不增加重试。原生空结果、取消和回退保持宿主自身的失败及采用语义，不记作原生成功。

Chat Completions 还原工具选择可能使模型返回工具调用而不是文本，宿主随之得到空文档。本能力不执行该工具或补重试。Responses 保留原生文档生成工具选择。

受维护原生接口在所需路径提供等价结果、配置语义、隔离及失败行为后，以行为验证为依据替换适配，不以上游合入本身为证明。

### 试验扩展切换

本机试验扩展在本能力通过自身验收、随后获得安装授权后由本包替换并停用。本决定不执行安装切换。

## 考虑过的替代方案

无

## 结果

两项能力共享协调器会扩大共享改动的回归范围，发布前需分别验证普通、Handoff 和 remote 路径。混装或外部包装可能使适配不可用，保守冲突与重启切换保持原生请求可用。

宿主修改准备、系统表达或发送路径可能使来源证明失败并失去收益。过宽边界则可能恢复旧内容、重复 developer、跨会话复制或改变原生生成策略，因此不可变归属和完整候选证明不能省略。

请求对齐不保证 Provider 缓存驻留、命中率或收益。工具选择、reasoning 状态和服务端策略可能保留缓存差异，受控响应及合成 usage 不能替代真实收益验证。
