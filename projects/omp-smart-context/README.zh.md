# omp-smart-context

[English](./README.md)

`@ruokee/omp-smart-context` 提供可独立开关的上下文能力：远端压缩对齐、Handoff 对齐、压缩请求用量补记和模型提示词规则。会话历史和压缩执行仍由 OMP 负责。

## 文档

- [设计](./docs/design.zh.md) 说明参照如何确认、哪些内容可以复用、请求何时保持原生。
- [验证](./docs/verification.zh.md) 列出本包依赖的宿主接口与已经核对过的场景。
- [用量](./docs/usage.zh.md)说明请求记账、所有权及原生替代后的退出条件。
- [迁移](./docs/migration.zh.md)说明替换旧实现时如何保留设置。

## 安装

在本组件目录中执行：

```bash
omp install . --scope user
```

## 配置

通过 OMP 原生插件管理器安装本包。manifest 声明扩展和设置，不需要另加扩展入口或设置文件。

```bash
omp plugin config list @ruokee/omp-smart-context
omp plugin config set @ruokee/omp-smart-context compactionCacheProvider example-provider
omp plugin config set @ruokee/omp-smart-context compactionCacheEnabled true
omp plugin config set @ruokee/omp-smart-context handoffCacheEnabled true
omp plugin config set @ruokee/omp-smart-context modelPromptsEnabled true
```

- `compactionCacheEnabled`：默认 `false`，取值 boolean。启用远端对齐。
- `compactionCacheProvider`：默认 `""`，取值 string。已配置 Provider 的精确名称，空值保持不可用。
- `compactionCacheMode`：默认 `"hooks"`，取值 `standard` 或 `hooks`。选择远端复用合同；启用远端对齐还需要开关和精确的 Provider 名称。
- `handoffCacheEnabled`：默认 `false`，取值 boolean。启用 Handoff 对齐。只需要本开关，不需要 Provider 名称和模式。
- `compactionUsageEnabled`：默认 `true`，取值 boolean。宿主未自行记账时记录四种 soft/Handoff 请求 purpose。
- `modelPromptsEnabled`：默认 `false`，取值 boolean。追加命中的规则正文。关闭时不注册注入 handler，不读取规则文件，不诊断未使用文件。

OMP 将项目覆盖合并到用户设置之上。扩展每次激活只读取一次原生设置快照，修改后重启 OMP。导航不刷新快照，子会话仍使用自己的实际模型、工具、提示词和会话身份。缺失键取默认值，模块键错误只停用所属能力。未知键、根不是对象或 getter 失败会拒绝整个组件配置。诊断只报告固定原因，不输出被拒绝的值。没有总开关，也不回读旧包配置。规则文件仍在每个受覆盖 turn 刷新。两个远端模式见[设计](./docs/design.zh.md#模式)。

## 远端压缩对齐

远端压缩会重新发送会话内容，其中相当一部分此前已由普通请求发送过。本项在最终发送边界改写已经完整证明的目标请求，使用户选定 Provider 的这次压缩沿用同一次普通请求已确认的处理结果，正文与已经发送过的内容保持一致。触发、准备、裁剪、凭据、重试、回退、投机采用、历史提交和续接仍由 OMP 负责，普通请求原样到达传输层。

对齐在客户端改写实际发出的请求体，客户端对齐、原生可用性与真实 Provider 收益是彼此独立的三个结果。[设计](./docs/design.zh.md)记录完整机制。

## Handoff 对齐

Handoff 依据当前会话生成文档或摘要，并把这项工作作为副请求发送，其中重复了普通主循环 dispatch 已发送的共同内容。本项在最终传输边界恢复已证明的普通系统提示词，保留副请求指令、新增历史、缓存键、独立 side session、取消信号和其余原生选项。

`openai-completions` 和 `openai-responses` 会话均可使用 Handoff 对齐。Responses 的原生 Handoff 与 V2 压缩分别由 Handoff 和远端能力处理，一条请求最多一个改写方。Handoff 只由自己的开关控制，不依赖远端开关、Provider 选择或模式。其他 API 保持原生。

[设计](./docs/design.zh.md#handoff-对齐)记录边界条件、还原的轴以及参照失效方式。

## 压缩请求用量

完成且报告 token 的 soft summary、short-summary、turn-prefix 和 Handoff 请求，各向所属会话分支追加一条 `model_usage`。条目保留解析出的请求身份、Provider token 数、停止原因及可用分项成本，宿主统计计入这些条目。其他 purpose 和零 token 请求不补记。该进程级补偿保留用户遥测回调，宿主导出 `compactionRequestUsage` 时停用。[用量](./docs/usage.zh.md)说明身份解析、成本缺失、所有权和退出条件。

## 模型提示词规则

每个受覆盖 turn 读取当前 profile 用户 agent 目录下的 `model-prompts`，由 `getAgentDir()` 解析，以及 `getProjectAgentDir(ctx.cwd)` 下的同名目录，即 `<cwd>/.omp/model-prompts`。只处理直接子项中以小写 `.md` 结尾的非隐藏普通文件。忽略文件符号链接和子目录，不向祖先目录或资源根目录搜索。目录缺失视为空集。

每个目录内按文件名的 JavaScript 字符串顺序排序，用户正文先于项目正文。项目文件不遮蔽同名用户文件，不同文件的相同正文仍分别贡献块。读取完成顺序不能改变该顺序。

### 规则文件

```markdown
---
metadata: optional, ignored
match:
  - exact: example-provider/example-model-1.0
  - model: another-model-1.0
  - contains: example-model
  - regex: ^example-provider/example-model-1\.0
---

Text appended to the system prompt.
```

UTF-8 Markdown 开头可有一个 BOM。分隔行须恰好为 `---`，支持 LF 和 CRLF。`match` 是必需的非空数组，每个条目恰好有下列一个键，值为非空白字符串：

- `exact` 比较完整的 `${model.provider}/${model.id}`。
- `model` 比较完整的 `model.id`，包括 id 自身包含的 `/`。
- `contains` 测试 `${model.provider}/${model.id}` 的字面子串。
- `regex` 以不带 flags 的 JavaScript `RegExp` 测试同一字符串。

条目之间是“或”的关系，一个文件命中多个条目仍只贡献一次。匹配区分大小写，按文本比较，不解析别名、角色、家族、显示名、传输名或思考等级后缀，不增加 glob 或模型列表语法。frontmatter 顶层额外键被忽略且永不注入；条目内未知键或多个键使整个文件无效。

每个匹配文件向传入的 turn 数组末尾贡献一个块。正文从闭合分隔行的行尾之后开始，逐字节保留标题、空行、LF/CRLF、缩进、HTML 注释、模板形似文本和末尾换行。frontmatter 和开头 BOM 不注入。不添加包装、标题、裁剪、模板渲染、上下文改写、消息或历史条目，既有块保持字节与顺序。

### 规则加载

每个受覆盖 turn 重新读取规则与有效模型。新增、编辑、删除和修复在下一 turn 生效，无需重启；失败文件不沿用旧正文。没有模型、没有规则或没有命中时，传入提示词不变。OMP 的 turn 级 override 在轮内重建时保留，下一 turn 从宿主基础提示词开始，因此正文不累积。设置仍采用激活快照，修改需重启。

无效文档在第一个失败点整文件跳过，原因包括 `frontmatter-missing`、`frontmatter-invalid`、`match-missing`、`match-empty`、`entry-shape`、`entry-key`、`entry-value`、`regex-invalid` 和 `body-blank`。`file-unreadable` 只影响一个文件，`directory-unreadable` 只影响一个目录，其他有效来源继续处理。handler 异常报告 `unexpected-error`，保留传入提示词，包括更早 handler 的结果。

规则诊断包含固定原因与作用域相对来源，例如 `project/20-rules.md`，按会话、来源和原因去重。每个 turn 使用自己的当前 UI 通知通道，无 UI 时使用宿主 logger。不报告正文、绝对目录、解析错误、正则源码或对话内容。新建或分叉会话有独立历史，返回已访问会话时保留本次激活的记录。开关类型错误只停用本模块，设置对象整体被拒绝时沿用整组件拒绝规则。`/smart-context` 显示状态和原因，不显示模型身份或规则正文。

### 覆盖

覆盖运行 `before_agent_start` 的普通主 turn 和普通子 turn。子 Agent 按自身有效模型匹配，保留角色、独立块及宿主协议。plan-mode 子 Agent、Handoff、标题生成与难度分类不新增注入入口，旁路请求沿用宿主对当前 Agent 提示词的处理。这是 turn 级合同，不在每次 Provider 请求、回退或临时模型切换时独立刷新。后续 handler 可以覆盖结果，模块不重排扩展，也不声称最终 Provider 优先权。

### 信任

启用后，项目规则会成为系统指令，不增加项目信任门槛或安全隔离。JavaScript 正则没有沙箱或执行超时，匹配正文没有大小或额度限制，因此大文件会占用提示词空间，缓慢目录会拖慢 turn 装配。个人规则放用户目录，启用前检查项目规则。

### 上游复核

OMP 通过 [issue #6739](https://github.com/can1357/oh-my-pi/issues/6739) 或等价机制提供模型级指令后，重新核对匹配维度、替换或追加的组合及块位置、刷新时机、目录发现及优先级和顺序。判断保留本能力、只补宿主缺失部分或移除，并记录对应版本变化。宿主模板本身不能证明模型规则行为等价。

## 状态

`/smart-context` 不启动模型 turn，分别报告远端和 Handoff 对齐，再显示独立的用量及模型规则状态。对齐状态如下：

- `disabled`：显式开关关闭。
- `unavailable`：配置、接口、身份或包装所有权不可用。
- `awaiting-reference`：新操作尚无可用的已确认普通参照。
- `already-aligned`：有效候选与原生正文一致，不重新序列化。
- `rewritten`：已委派完整验证后的候选。
- `rejected`：证明失败，目标原样委派。

分别显示在线确认、操作绑定、候选验证和发送阶段。局部 dispatch、operation、reference 编号是会话内计数器。逻辑操作、物理发送、重试、改写和拒绝分别使用有界计数，拒绝仍计入总数。用量显示实时注册表状态，以及条目、成本缺失和身份未解析计数。模型规则显示启用、关闭、配置无效或接口不兼容状态及固定原因。报告不包含消息正文、opaque 字节、凭据、原始端点、私密路径或规则正文。

## 兼容性

最低维护 OMP 版本为 `18.5.0`，不设置维护版本上限。这是维护责任，不是安装或运行门槛，低于下限的宿主仍可能运行本包。验证记录实际运行过的版本和条件，不代表下限以上每个版本都已验证。

本包将 `@oh-my-pi/pi-agent-core`、`@oh-my-pi/pi-ai`、`@oh-my-pi/pi-coding-agent` 和 `@oh-my-pi/pi-utils` 声明为不限制版本的宿主 peer（`*`），并把开发依赖锁定在 `18.5.0`。缺少接口时停用所属能力。已核对的接口与场景见[验证](./docs/verification.zh.md)。

## 开发

```bash
bun install --frozen-lockfile
bun run typecheck
bun test
```

## 更新

### 0.1.0

`@ruokee/omp-smart-context` 首次交付。提供远端及 Handoff 对齐、压缩请求用量补记和可选模型提示词规则。以一次原生激活快照和 `/smart-context` 接管 smart-cache 及 QoL 迁出模块。重启前按[迁移](./docs/migration.zh.md)处理配置。

## 许可

MIT。
