# omp-smart-context

[English](./omp-smart-context.md) | 中文

## 目标

在 `projects/omp-smart-context` 维护自包含原生 OMP 包 `@ruokee/omp-smart-context`，以独立开关模块提供既有远端及 Handoff 对齐、压缩请求用量补记和可选模型提示词规则。保留各能力的范围、所有权、状态及失败边界。会话历史和维护执行归 OMP。

替换独立 smart-cache 组件及 QoL 迁出实现，不保留代理、重复所有者或跨组件运行时依赖。QoL 留存调整的行为、设置、默认值及校验保持不变。

## 非目标

- 新压缩策略、策略框架、额外重试，或改变原生调度和采用。
- 额外模型、observer、角色指令或自动上下文维护策略。
- 保证缓存驻留、命中率或 Provider 收益。
- 四种既有 soft/Handoff purpose 之外的用量补记、猜测请求身份或自行定价。
- 替换宿主模板、增加规则匹配维度或搜索路径、缓存规则、逐请求或轮内回退刷新，以及新的旁路注入入口。
- 自动安装、修改用户配置或重写既有会话 journal。

## 公共接口

[配置](../../projects/omp-smart-context/README.zh.md#配置)和原生 manifest 维护设置键、默认值及命令。远端对齐默认关闭，精确 Provider 默认为空，模式为 `hooks`；Handoff 默认关闭；用量补记默认开启；模型规则默认关闭。没有总开关。

使用用户设置及项目覆盖读取一次 OMP 原生激活快照。缺失键取默认值。模块键错误只停用所属模块；未知键、非对象根或 getter 失败拒绝整个组件配置。设置修改重启生效，规则文件在下个受覆盖 turn 独立刷新。旧包设置不是配置来源。

`/smart-context` 分别报告对齐阶段及计数、实时用量状态和模型规则状态，不启动模型 turn，不泄露正文、opaque 数据、凭据、原始端点、私密路径或动态私密标识。

- [对齐设计](../../projects/omp-smart-context/docs/design.zh.md)维护参照捕获、证明、请求改写及失效细节。
- [用量补记](../../projects/omp-smart-context/docs/usage.zh.md)维护请求身份、遥测、会话归属、成本处理及上游退出条件。
- [模型提示词规则](../../projects/omp-smart-context/README.zh.md#模型提示词规则)维护文件发现、格式、匹配、排序、诊断、刷新及信任合同。
- [迁移](../../projects/omp-smart-context/docs/migration.zh.md)维护注册替换及有效配置保留方法。

## 不变量

### 请求对齐

1. 只有已确认的普通主循环 dispatch 提供参照。普通及非目标请求不变。标题、advisor、预热及 Handoff 不建立普通参照；准备请求没有工具集时不能建立 Handoff 参照。
2. 每个实际会话保留自己的模型、工具、提示词、持久及 Provider 身份、epoch、dispatch、参照和计数。文字、模型、端点、缓存键或时序相同不能证明归属。主会话、原生 task 和 Eval 保留既有覆盖及隔离。
3. 操作参照不可变，缺失参照亦然。导航、分支、模型、工具、历史变化、取消、压缩提交及释放按既有合同使参照失效。晚到响应、重试或恢复旧值不能恢复失效操作。依赖条件允许时，新的已确认普通工作恢复资格。
4. 完整保留来源证明优先于局部匹配。局部复用需要可独立提取的已发送单元，保留其依赖及处理条件。仅输出或 provenance 相同不足以证明。不能重跑 handler 重建证明；opaque、裁剪、已删除历史、调用配对和新增尾部保持原生边界。
5. 远端对齐面向精确配置 Provider 的非 Codex `openai-responses` V2 请求。`standard` 处理已识别原生修复，`hooks` 还复用已证明的处理结果。两者都不改变原生输出限制或编造显式工具选择。
6. Handoff 独立支持 `openai-completions` 和 `openai-responses`。Chat Completions 还原既有 system、reasoning 和 tool-choice 轴；Responses 恢复有来源证明的缺失 system，保留原生 none、reasoning、配置变化及兼容重试。侧指令、历史、缓存键、路由、side session 和取消保持原生。
7. 一条物理请求最多一个改写模块。完整候选在最终传输处校验并原子替换。相同候选记为已对齐；证明不足时以固定原因保留整条原生请求，不阻断、延迟或丢弃。一项对齐失败不关闭另一项。
8. 触发、准备、裁剪、投机、凭据、重试、回退、采用、提交和续接归 OMP。对齐不新增压缩入口或 `session_before_compact` handler。包装保留原生参数、receiver、结果、异常、信号和仍持有的属性形状，不接管外部包装或旧所有者。

### 用量补记

- 只记录 `compaction:summary`、`compaction:short-summary`、`compaction:turn-prefix`、`compaction:handoff`。范围内完成且报告 token 的请求向所属活动会话分支写一条原生 `model_usage`，宿主统计计入。零 token 和其他 purpose 不写入。
- 记录解析出的实际 api、Provider、model、Provider token、停止原因及所提供分项成本。保留身份解析和数据缺失行为：身份无法解析时跳过，成本缺失时记零并计数，不猜身份或价格。
- 保留用户遥测配置、tracer 行为、回调和子会话继承，不重复包装。不读取或保存请求正文、摘要、交接文档，不改请求、时序或路由。
- 一个进程所有者服务已登记会话；切换 journal 后移除旧会话身份。配置被拒、owner 停止、外部访问器和原生 `compactionRequestUsage` 保留文档规定的拒绝及释放行为。宿主原生记账时停用补偿，防止双记。
- 上游 PR #15034 合并后复核原生记账及会话统计，确认原生行为能替代后才移除补偿。退休不移除两类对齐能力或历史用量条目。

### 模型提示词规则

- 关闭时不注册注入 handler，不读取目录或文件，不诊断未使用文件。开关独立于对齐和用量。
- 每个受覆盖 turn 从当前 profile 用户 agent 目录及当前项目 `.omp/model-prompts` 发现直接子项中的非隐藏、小写 `.md` 普通文件。保留 exact/model/contains/regex 的大小写敏感匹配及或关系只注入一次。
- 每个命中文件作为独立块追加，用户目录先于项目，同目录按文件名排序。保留传入块和正文的字节及顺序，排除 frontmatter 和开头 BOM。不包装、裁剪、渲染、改写历史或累积前一 turn 正文。
- 对运行 `before_agent_start` 的普通主、子 turn 按当前有效模型匹配，子 Agent 保留自身模型和角色。Handoff、plan-mode 子 Agent、标题、分类及其他旁路不新增注入入口。
- 文件和目录错误保持局部；无模型、规则或命中时输入不变。handler 意外异常保留传入块和更早 handler 结果。诊断使用固定原因并按会话去重，不泄露私密正文或路径。

### 组件归属

源码、manifest、检查和双语文档均在组件内。宿主 peer 不收窄版本范围。保持独立状态和失败边界，不增加共享上下文存储或模块框架。各能力 ADR 拥有自己的合同；未改变共同合同的模块增删，不要求反转包级 ADR 或无关能力决定。

迁移删除旧包，并从用户及项目配置中删除 QoL 两个迁出键。保留原 `enabled && 模块开关` 的结果及所有无关设置。迁出键遗留时拒绝整个 QoL 配置，不设兼容例外。既有规则文件和会话记录保持有效。

## 宿主下限

遵循共同维护下限 `18.5.0` 及[兼容声明](../../projects/omp-smart-context/README.zh.md#兼容性)。开发依赖锁定下限，host peer 保持 `*`。按能力接口检查，不增加版本白名单、上限或安装门槛。

## 验收标准

- 实际候选入口通过自身依赖和原生配置加载。迁入能力各有一个所有者，QoL 不安装、停止或注入这些能力。
- 既有行为检查保留对齐正例及拒绝、API 特定字段、普通请求不变、操作归属、失效、会话隔离、局部证明及 handler 不重复。两项独立关闭状态保持原生请求。
- 用量检查覆盖四种 purpose、请求身份及会话归属、零 token 和范围外跳过、成本及缺失数据、用户遥测、继承、journal 切换和原生替代退出。统计与条目一致，不重复记账。
- 规则检查覆盖默认及关闭零访问、发现、匹配、字节保真、顺序、刷新、失败隔离、诊断、子上下文和不累积。
- 本地受控运行加载实际候选及锁定宿主库，读取实际原生设置，用确定传输响应驱动普通请求及原生压缩准备和序列化，观察对齐、用量和规则组合结果。直接调用已注册状态处理器证明只读行为，不声称 TUI 绘制验证。
- 用户及项目覆盖和激活快照保留设置仅重启生效、规则文件逐 turn 刷新的区别。模块局部错误不影响无关能力。迁移保留 QoL 其余行为和有效启用意图。
- 组件检查、变更选择器、完整聚合、双语公共文档、现行 Spec 和后继 ADR 一致。记录候选、条件、观察及边界。验收采用自动检查和受控原生库运行，真实模型、Provider 收益测量及完整 CLI/TUI 矩阵不是前提。历史证据保留原候选及范围。

## 相关 ADR

- [上下文包](../adr/decision/2026/10/12-smart-cache.zh.md)
- [请求对齐](../adr/decision/2026/10/22-request-alignment.zh.md)
- [远端对齐](../adr/decision/2026/10/10-remote-alignment.zh.md)
- [Handoff 对齐](../adr/decision/2026/10/12-handoff-alignment.zh.md)
- [压缩用量](../adr/decision/2026/10/13-compaction-usage.zh.md)
- [模型提示词规则](../adr/decision/2026/09/14-model-prompt-rules.zh.md)
- [QoL 边界](../adr/decision/2026/09/20-omp-qol.zh.md)
- [宿主维护](../adr/decision/2026/09/28-host-maintenance.zh.md)
- [组件自包含](../adr/decision/2026/08/24-component-self-containment.zh.md)
