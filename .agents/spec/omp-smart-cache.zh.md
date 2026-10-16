# omp-smart-cache

[English](./omp-smart-cache.md) | 中文

## 目标

在 `projects/omp-smart-cache` 维护一个自包含原生 OMP 包 `@ruokee/omp-smart-cache`，力求避免 OMP 请求出现意料之外的缓存未命中，同时保持普通请求与原生请求路径不变。本包携带 remote 对齐与 Handoff 对齐两项独立能力，各有自己的开关、状态与验收。复用实际已发送的普通请求结果，对齐用户选定 Provider 的非 Codex Responses V2 远端压缩，覆盖主会话及原生 task、Eval；并把 Handoff 侧请求对齐到此前已发送的同一普通请求。客户端对齐、原生可用性、真实 Provider 收益分别判定。

## 非目标

不修改宿主或 Provider，不替换原生维护，不新增转换合作协议。缓存驻留、固定命中率及保证收益不属于本合同。

## 公共接口

原生 manifest 暴露 remote 的显式启用开关、一个精确 Provider 名称、两个固定模式，以及一个 Handoff 显式启用开关 `handoffCacheEnabled`（默认 `false`）。默认值和配置命令由 [projects/omp-smart-cache/README.zh.md](../../projects/omp-smart-cache/README.zh.md#配置) 维护。

OMP 原生用户设置及项目覆盖是唯一配置源。验证一次激活快照，修改后重启。模式不启用能力，空 Provider 保持不活跃。缺失键采用默认值；null、错误类型、未知键和非法模式以固定原因失败，不输出私密值。配置只来自本组件自己的设置；QoL 设置回退、热读、第二 reader、Provider 列表，以及 Handoff 的 Provider 键或模式不在本合同范围内。Handoff 开关只启用本能力，不新增 Provider 列表或模式，并与 remote 设置在同一份激活快照中读取。

`standard` 只覆盖已识别的原生修复。`hooks` 还复用已经证明的处理结果，包括合法插入、重排、恢复、跨范围合并、图片和后置 payload 转换。没有 handler 改变上下文时，两种模式仍保留通用原生对齐。两种模式都只调用 handler 一次，只识别本组件自己的名称和格式。

## 不变量

1. 只有已确认的普通主循环 dispatch 提供参照，标题、advisor、预热和 Handoff 不能；普通及非目标请求不变，不含工具集的准备请求不提供 Handoff 参照。
2. 每个实际 AgentSession 保留自身登记、参照、实际模型、工具、提示词、持久身份与 Provider 身份、epoch 和 dispatch；模型相同、端点、缓存键、时序及文字都不能确定身份。一组进程分发与每个实际模型 registry 的单次包装服务并发会话。
3. 参照对其所属操作不可变，缺失参照亦然；后续在线工作、handler 状态、刷新、重试及晚解析的信号 ancestry 都不升级它，也不恢复已失效、已取消或歧义的操作。switch、branch、tree 导航、压缩提交与会话释放清空参照并使该会话的 epoch 失效；导航结算后新的普通发送恢复资格，不靠重启或计时器，替换会话取得自身的新参照。
4. 复用时优先取得完整保留范围证明再做局部匹配，重复源不使该证明失效，完整结果可改变数量和顺序。局部结果必须为可独立提取的已发送单元，全部依赖及相关处理条件保持有效；输出、长度、索引或 provenance 相同不足以证明独立性。依赖变化时以 `projection-dependency-changed` 保留整条请求，来源或单元边界未知时以 `projection-unconfirmed` 保留整条请求，拒绝不满足正例对齐要求。
5. 原生工具输出改写、删除历史、新增普通/工具/图片尾部、调用配对、opaque 替换数据及 trigger 保持原生边界；不重建 opaque、不补回旧依赖、不重算结果、不改变原生裁剪依据。
6. 一条经过校验的候选原子替换请求，V2 保留自身 `max_output_tokens` 或缺省，只有证明在线无显式选择时才规范化隐式 `auto`，任何未分类或冲突的差异使整条请求保持原生；相同候选记 `already-aligned`，不重新序列化。
7. Handoff 只在已证明的共同边界内改写，先证明完整操作归属、系统前缀、源历史对应、工具与新增尾部边界，并在原生 payload hook 之后、每次实际发送校验后原子替换候选。Chat Completions 逐轴还原 system、`reasoning_effort` 与既有 `tool_choice`；Responses 只恢复有来源证明的缺失 system，保留原生 none、已有兼容重试、嵌套 reasoning 与原生配置更新，不恢复普通 auto。边界之外的请求原样发送并给出固定原因，`rejected` 只表示没有改写，任何请求都不被阻断、延迟或丢弃；侧指令、新增历史、缓存键、路由、side session、取消与其余选项不变。
8. 包装保留原生参数、receiver、Promise、凭据结果、异常、信号及取消原因，只恢复仍持有的函数及属性形状；外部覆盖或混装不授权接管。失败保持局部，最后登记结束释放共享资源，只保留当前参照及仍可从活跃操作访问的快照。
9. Handoff 支持 `openai-completions` 和 `openai-responses`，适用性不依赖 Provider 清单，Responses 会话按已证明的实际请求种类分派；其他 API 两项能力都不适用。一条物理请求最多由一项能力改写，两项开关独立，两项能力各自独立证明资格，不共享协议规则、载荷形状规则、原因码或收益证据，一项拒绝或接口缺失不影响另一项。
10. OMP 保留调度、准备、投机、等待、重试、模型与方法回退、采用、提交、续接与文档生成；两项能力都不新增入口、不注册 `session_before_compact`、不否决请求、不替换手动压缩、不新增凭据请求、不伪造摘要、不添加重试、不修改设置。非 V2 回退与宿主自身的失败语义保持原生，不计为成功。
11. `/smart-cache` 不启动模型 turn，报告每项能力自身的状态、分阶段原因与有界计数，不输出正文、opaque 字节、凭据、端点、私密路径或动态私密键。
12. 本包有自身源码、原生 manifest、检查、双语文档及不收窄的 host peers，开发依赖遵循共同维护下限 `18.5.0`，按接口能力检查而不用版本白名单，且不导入其他组件的运行时或设置读取器。

remote 与 Handoff 性质的完整规则与理由见 [remote 对齐决定](../adr/decision/2026/10/10-remote-alignment.zh.md) 与 [Handoff 对齐决定](../adr/decision/2026/10/12-handoff-alignment.zh.md)。

## 宿主下限

遵循共同维护下限及组件的[宿主兼容声明](../../projects/omp-smart-cache/README.zh.md#兼容性)。缺少接口时保持原生路径。

## 验收标准

- 原生插件发现确认唯一来源/版本，以及实际默认值、两种模式、关闭/空值、非法值、用户/项目优先级、运行中激活保持和重启行为。
- 实际原生出站请求证明完整范围和独立局部正例、重复源优先、有状态 handler 不重复、图片、既有后置转换、裁剪、工具 schema、提醒、replay、隐式默认、无工具及合法输出限制差异。不可分依赖变化和未知证明缺口分别归因并整条保留原样。
- 首次、再次及独立恢复进程的 V2 提交保留 opaque 历史并可正常续接。各宿主/会话类别提供的手动、自动、轮内及投机路径保留原生调度和直接采用。更新在线工作及认证/传输重试保留旧操作快照。
- 主会话、task、Eval 覆盖并行兄弟、父子交错、同模型不同历史、不同目标模型、非目标邻居、结束、取消、revive，以及 switch/branch/tree 成功/取消/失败全部终态。在途旧 epoch 保持失效。
- 缺失参照、未知字段/转换、显式 tool choice、身份歧义、模型/工具失配、混装、包装失去、旧代次、取消、退出、原生错误及回退保持原生行为。普通及非目标正文不变，最后清理不覆盖外部函数。
- 真实 TUI 命令准确显示逐会话阶段，不发模型请求或输出敏感值。原生迁移从所有适用用户/项目层移除三项旧 QoL 键，保留有效启用意图及无关设置，每个请求仅一个 owner。旧 QoL 误装共存保守拒绝，其余 QoL 模块和已安装扩展不退化。
- 组件检查、完整聚合、变更选择映射、选择回归、双语公共文档、现行 Spec 和完整后继 ADR 一致。下限及当前受维护宿主必须有原生 CLI/TUI 和最终 wire 证据。源码核对及合成 usage 只覆盖机制。
- 另行获授权的可比真实 Provider 运行重复降低未缓存输入，同时保持正确性及可用性。按会话类别及适用生命周期报告目标、对齐、未对齐组，包括全部拒绝；逻辑操作与物理请求分开。每组列出请求、有效 usage 样本、总/缓存/未缓存输入、零命中占比及 token 加权命中率。失败、取消、429、回退、缺失 usage 明确保留，不承诺固定命中率、驻留或收益。
- 开关关闭时所有请求保持原生。启用后，实际最终 Handoff body 在宿主 payload hook 之后携带按 API 恢复的共同系统内容。Chat Completions 保留既有 reasoning 和工具选择还原；Responses 的 instructions 或有来源的前置 developer 正确，历史 developer 保留原位，原生 none、reasoning、配置更新及兼容重试不变。必要证明不足时完整原生发送，连续 Handoff 使用各自已确认普通参照。
- 边界之外的 Handoff 请求以固定原因原样发送，无关字段差异不影响可还原轴完成还原，任何请求都不被阻断、延迟或丢弃，连续两次 Handoff 不串用上一次的侧请求 body。
- `/smart-cache` 报告 Handoff 段落自身状态、分阶段原因与有界计数且不启动模型 turn；Handoff 设置缺失或非法时所有请求保持原生。
- 本机试验扩展在本能力通过自身验收、随后获得安装授权后由本包替换并停用；试验扩展仍被自动发现期间，本包报告保守的包装冲突而不抢占包装，切换通过重启相关进程完成。

## 相关 ADR

- [smart-cache](../adr/decision/2026/10/12-smart-cache.zh.md)
- [Remote 归属及复用合同](../adr/decision/2026/10/10-remote-alignment.zh.md)
- [Handoff 对齐合同](../adr/decision/2026/10/12-handoff-alignment.zh.md)
- [保留的 QoL 合同](../adr/decision/2026/09/20-omp-qol.zh.md)
- [共同 OMP 维护下限](../adr/decision/2026/09/28-host-maintenance.zh.md)
- [组件自包含](../adr/decision/2026/08/24-component-self-containment.zh.md)

安装组件的使用及兼容声明见 [projects/omp-smart-cache/README.zh.md](../../projects/omp-smart-cache/README.zh.md)。
