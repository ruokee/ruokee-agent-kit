# omp-smart-cache 规格

[English](./omp-smart-cache.md)

## 目标

在 `projects/omp-smart-cache` 维护一个自包含原生 OMP 包 `@ruokee/omp-smart-cache`。复用实际已发送的普通请求结果，对齐用户选定 Provider 的非 Codex Responses V2 远端压缩，覆盖主会话及原生 task、Eval。客户端对齐、原生可用性、真实 Provider 收益分别判定。Handoff 不属于本合同。

## 非目标

不修改宿主或 Provider，不替换原生维护，不新增转换合作协议，不集成 Handoff。缓存驻留、固定命中率及保证收益不属于本合同。

## 公共接口

原生 manifest 提供一个显式启用开关、一个精确 Provider 名称及两个固定模式。默认值和配置命令由 [projects/omp-smart-cache/README.zh.md](../../projects/omp-smart-cache/README.zh.md#配置) 维护。

OMP 原生用户设置及项目覆盖是唯一配置源。验证一次激活快照，修改后重启。模式不启用能力，空 Provider 保持不活跃。缺失键采用默认值；null、错误类型、未知键和非法模式以固定原因失败，不输出私密值。不提供 QoL 设置回退、热读、第二 reader、Provider 列表或 Handoff 占位。

`standard` 支持已识别的原生修复，不提供通用 handler 投影。`hooks` 还复用已经证明的处理结果，包括合法插入、重排、恢复、跨范围合并、图片和后置 payload 转换。没有 handler 改变上下文时，两种模式仍保留通用原生对齐。不重复 handler，不识别其他组件名称或私有格式。

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
11. `/smart-cache` 不启动模型 turn，区分 disabled、unavailable、awaiting-reference、already-aligned、rewritten、rejected。在线、绑定、候选和发送原因分开。逻辑操作、物理发送、重试、对齐和拒绝采用独立有界计数。不输出正文、opaque 字节、凭据、端点、私密路径或动态私密键。
12. 本包有自身源码、原生 manifest、检查、双语文档及不收窄的 host peers。开发依赖遵循共同维护下限 `18.5.0`，按接口能力检查，不用版本白名单。不导入其他组件，不替换 Handoff 原型。

## 宿主下限

遵循共同维护下限及组件的[宿主兼容声明](../../projects/omp-smart-cache/README.zh.md#宿主兼容与源码基线)。缺少接口时保持原生路径，不启用猜测性适配。

## 验收标准

- 原生插件发现确认唯一来源/版本，以及实际默认值、两种模式、关闭/空值、非法值、用户/项目优先级、运行中激活保持和重启行为。
- 实际原生出站请求证明完整范围和独立局部正例、重复源优先、有状态 handler 不重复、图片、既有后置转换、裁剪、工具 schema、提醒、replay、隐式默认、无工具及合法输出限制差异。不可分依赖变化和未知证明缺口分别归因并整条保留原样。
- 首次、再次及独立恢复进程的 V2 提交保留 opaque 历史并可正常续接。各宿主/会话类别提供的手动、自动、轮内及投机路径保留原生调度和直接采用。更新在线工作及认证/传输重试保留旧操作快照。
- 主会话、task、Eval 覆盖并行兄弟、父子交错、同模型不同历史、不同目标模型、非目标邻居、结束、取消、revive，以及 switch/branch/tree 成功/取消/失败全部终态。在途旧 epoch 保持失效。
- 缺失参照、未知字段/转换、显式 tool choice、身份歧义、模型/工具失配、混装、包装失去、旧代次、取消、退出、原生错误及回退保持原生行为。普通及非目标正文不变，最后清理不覆盖外部函数。
- 真实 TUI 命令准确显示逐会话阶段，不发模型请求或输出敏感值。原生迁移从所有适用用户/项目层移除三项旧 QoL 键，保留有效启用意图及无关设置，每个请求仅一个 owner。旧 QoL 误装共存保守拒绝，其余 QoL 模块和已安装扩展不退化。
- 组件检查、完整聚合、变更选择映射、选择回归、双语公共文档、现行 Spec 和完整后继 ADR 一致。下限及当前受维护宿主必须有原生 CLI/TUI 和最终 wire 证据。源码核对及合成 usage 不是真实服务证明。
- 另行获授权的可比真实 Provider 运行重复降低未缓存输入，同时保持正确性及可用性。按会话类别及适用生命周期报告目标、对齐、未对齐组，包括全部拒绝；逻辑操作与物理请求分开。每组列出请求、有效 usage 样本、总/缓存/未缓存输入、零命中占比及 token 加权命中率。失败、取消、429、回退、缺失 usage 明确保留，不承诺固定命中率、驻留或收益。

## 相关 ADR

- [Remote 归属及复用合同](../adr/decision/2026-10-10-use-smart-cache-remote.zh.md)
- [保留的 QoL 合同](../adr/decision/2026-10-10-maintain-qol-without-remote.zh.md)
- [共同 OMP 维护下限](../adr/decision/2026-10-04-raise-omp-host-floor.zh.md)
- [组件自包含](../adr/decision/2026-08-24-keep-components-self-contained.zh.md)

安装组件的使用及兼容声明见 [projects/omp-smart-cache/README.zh.md](../../projects/omp-smart-cache/README.zh.md)。
