# omp-smart-cache 规格

[English](./omp-smart-cache.md)

## 目标

在 `projects/omp-smart-cache` 维护一个自包含原生 OMP 包 `@ruokee/omp-smart-cache`，力求避免 OMP 请求出现意料之外的缓存未命中，同时保持普通请求与原生请求路径不变。本包携带 remote 对齐与 Handoff 对齐两项独立能力，各有自己的开关、状态与验收。复用实际已发送的普通请求结果，对齐用户选定 Provider 的非 Codex Responses V2 远端压缩，覆盖主会话及原生 task、Eval；并把 Handoff 侧请求对齐到此前已发送的同一普通请求。客户端对齐、原生可用性、真实 Provider 收益分别判定。

## 非目标

不修改宿主或 Provider，不替换原生维护，不新增转换合作协议。缓存驻留、固定命中率及保证收益不属于本合同。

## 公共接口

原生 manifest 暴露 remote 的显式启用开关、一个精确 Provider 名称、两个固定模式，以及一个 Handoff 显式启用开关 `handoffCacheEnabled`（默认 `false`）。默认值和配置命令由 [projects/omp-smart-cache/README.zh.md](../../projects/omp-smart-cache/README.zh.md#配置) 维护。

OMP 原生用户设置及项目覆盖是唯一配置源。验证一次激活快照，修改后重启。模式不启用能力，空 Provider 保持不活跃。缺失键采用默认值；null、错误类型、未知键和非法模式以固定原因失败，不输出私密值。配置只来自本组件自己的设置；QoL 设置回退、热读、第二 reader、Provider 列表，以及 Handoff 的 Provider 键或模式不在本合同范围内。Handoff 开关只启用本能力，不新增 Provider 列表或模式，并与 remote 设置在同一份激活快照中读取。

`standard` 只覆盖已识别的原生修复。`hooks` 还复用已经证明的处理结果，包括合法插入、重排、恢复、跨范围合并、图片和后置 payload 转换。没有 handler 改变上下文时，两种模式仍保留通用原生对齐。两种模式都只调用 handler 一次，只识别本组件自己的名称和格式。

## 不变量

1. 只有已确认普通主循环 dispatch 提供参照。原始历史、准备、既有回调结果和实际出站 payload 属于同一次 dispatch，原样到达传输。标题、advisor、预热和 Handoff 不能成为参照。普通及非目标请求不变。
2. 每个实际 AgentSession 有独立登记、实际模型/工具/提示词、持久身份、Provider 身份、epoch 和 dispatch。一组进程分发及每个实际模型 registry 的单次包装服务并发会话；模型相同、端点、缓存键、时序及文字不能代替身份。
3. 每个原生根绑定不可变初始快照，包括缺失参照。后续在线工作、handler 状态、认证刷新、传输重试及晚解析的信号 ancestry 不升级旧操作。取消、失效 epoch、歧义根和旧代次不能恢复资格。
4. 完整保留范围证明优先于局部匹配，重复源不使完整证明失效。完整结果可改变数量和顺序；局部结果必须为可独立提取的已发送单元，全部依赖及相关处理条件保持有效。输出、长度、索引或 provenance 相同不足以证明独立性。
5. 原生工具输出改写、删除历史、新增普通/工具/图片尾部、调用配对、opaque 替换数据及 trigger 保持原生边界。不重建 opaque、不补回旧依赖、不重算结果、不改变原生裁剪依据。
6. 不可分结果依赖变化时整条请求原样发送，报告 `projection-dependency-changed`。来源或单元边界未知时整条原样发送，报告 `projection-unconfirmed`。拒绝保留在总体和未对齐分母，不满足正例对齐要求。
7. 原子替换前验证 system/提醒、原生工具 schema、reasoning/replay、默认表达、策略和完整候选。V2 保留自身 `max_output_tokens` 或缺省；只有证明在线无显式选择时才规范化隐式 `auto`。未知差异、显式策略、模型/工具失配、缺失证明或未知传输使整条保持原生。相同候选记 `already-aligned`，不重新序列化。
8. switch、branch、tree 前撤销该会话旧 epoch。成功、取消及失败结算后，以新普通发送恢复，不靠重启或计时器。子会话结束、取消或 revive 不停用有效邻居，替换会话取得自身新参照。
9. 包装保留原生参数、receiver、Promise、凭据结果、异常、信号及取消原因。只恢复仍持有的函数及属性形状。外部覆盖和混装不授权接管。最后登记结束释放共享资源，仅保留当前参照及仍可从活跃操作访问的快照。
10. OMP 拥有调度、准备、投机、等待、重试、模型/方法回退、采用、提交和续接。禁止 `session_before_compact`、隐藏否决、替换手动压缩、新增凭据请求及修改设置。非 V2 回退不记 V2 成功。
11. `/smart-cache` 不启动模型 turn，区分 disabled、unavailable、awaiting-reference、already-aligned、rewritten、rejected。在线、绑定、候选和发送原因分开。逻辑操作、物理发送、重试、对齐和拒绝采用独立有界计数。不输出正文、opaque 字节、凭据、端点、私密路径或动态私密键。Handoff 在独立段落中报告自身状态、分阶段原因与有界计数。
12. 本包有自身源码、原生 manifest、检查、双语文档及不收窄的 host peers。开发依赖遵循共同维护下限 `18.5.0`，按接口能力检查，不用版本白名单。本包自包含：不导入其他组件的运行时或设置读取器。
13. Handoff 支持 `openai-completions` 和 `openai-responses`，适用性不依赖 Provider 清单。Responses 会话按已证明的实际请求种类分派：原生 Handoff 侧请求由 Handoff 处理，合格 V2 由 remote 处理。其他 API 两项能力都不适用。一条物理请求最多由一项能力改写，两项开关独立，remote 关闭、Provider 未选中或模式不同时不阻止 Handoff 建立合格参照。
14. 只有已确认的普通主循环 dispatch 提供 Handoff 参照，且须在其 HTTP 响应确认发送之后；本能力对齐的调用永远不会成为参照。每个会话保留自己的参照，以及随参照一并取得的归属：Provider、模型身份、API、system 提示词、thinking 状态与工具集。不含工具集的准备请求不提供参照，因此从不发送工具的会话保持原生。
15. Handoff 参照对其所属操作不可变。更新的在线工作、认证刷新、传输重试与 handler 状态推进都不能移动它，重试也不能取得更新的参照。switch、branch、tree 导航、压缩提交与会话释放清空参照并使该会话的 epoch 失效；新的普通发送在不重启进程的前提下恢复资格。
16. 改写 Handoff 前证明完整操作归属、系统前缀、共同源历史与已发送内容的对应、工具及新增尾部边界。Chat Completions 保留 system、`reasoning_effort` 和既有 `tool_choice` 逐轴还原。Responses 只恢复有来源证明的缺失 system，支持 `instructions` 文本前缀或唯一前置 developer 边界，不提升历史 developer；保留完整 input、原生 none 与已有兼容重试、嵌套 reasoning 和原生配置更新，不恢复普通 auto。候选在原生 payload hook 之后、每次实际发送校验后原子替换。侧指令、新增历史、缓存键、路由、side session、取消与其余选项不变。
17. Handoff 投影逐轴还原：无法还原的轴只跳过并计数，任一无关字段差异都不放弃整条改写。这些轴之外的已知缓存敏感字段与参照比对，不同则计数。
18. 边界之外的 Handoff 请求原样发送并给出固定原因：操作已失效、参照未确认、参照取得的归属发生变化，或 system 前缀与历史投影发生变化。`rejected` 只表示本能力没有改写该请求。任何请求都不被阻断、延迟或丢弃；候选与原请求相同则报告为已对齐，不重新序列化。
19. Handoff 不复用 remote Responses V2 规则。两项能力共享本包、进程协调器、逐会话登记、每个原生方法的一层包装，以及同次普通 dispatch 的不可变观察事实；各自独立解释并证明资格，不共享协议规则、载荷形状规则、原因码或收益证据。一项拒绝或接口缺失不影响另一项。
20. OMP 保留 Handoff 文档生成、调度、触发、取消、重试、模型与方法回退、结果校验、历史提交与续接。本能力不新增入口，不注册 `session_before_compact`，不替换手动压缩，不伪造摘要，不添加重试，并保持宿主自身的失败语义。

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
