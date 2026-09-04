# 数据模型与持久化

[English](./data-model.md)

## 项目和 Task 根目录

项目配置位于 `.agents/tk_config.toml`。配置是相对默认值的稀疏 TOML：

```toml
task_root = ".tk"
subtasks_dir = ""
git_policy = "none"
creation_policy = "strict"
metadata_mode = "split"
```

默认值不会写入配置文件。全部使用默认值时可以不存在配置文件。

- `task_root` 是项目相对路径，默认为 `.tk`。
- `subtasks_dir` 是每个父 Task 下新建子 Task 的可选默认相对目录，不限制发现范围。
- `git_policy` 为 `track`、`ignore` 或 `none`。
- `creation_policy` 为 `strict` 或 `permissive`。
- `metadata_mode` 为 `split` 或 `embed`，作用于整个项目。

`init --force` 可以忽略无法解析的旧项目配置，使用本次显式参数和默认值写入新的稀疏配置。它不读取、迁移、移动、删除或改写 Task 数据，也不处理单个 Task 的 `tk.toml`。

## Task 目录

顶层 Task 使用以下形状：

```text
<task-root>/YYYY/MM/DD-NN--slug/
```

新建子 Task 使用稳定的 `NN--slug` 目录，直接位于父 Task 下或配置的 `subtasks_dir` 下。已有子 Task 可以位于更深的普通材料目录下。最近的有效祖先 Task 定义父级，因此目录拓扑仍表示父子关系，元数据不保存 `parent`。

Task 根目录没有永久索引或缓存。发现过程按需从文件系统构建一份内存任务图，所有全项目调用方都使用这份图。

## 元数据 schema

当前初始 schema 版本是 1。元数据只包含：

| 字段 | 合同 |
| --- | --- |
| `schema_version` | 必填正整数 |
| `id` | 必填 UUIDv7，创建后不可变 |
| `name` | 必填规范化名称，只有 rename 可修改 |
| `status` | `planning`、`open` 或 `closed` |
| `created_at` | 必填、带时区的 RFC 3339 时间戳，创建后不可变 |
| `depends_on` | 同一 Task 根目录内的 UUID 集合 |
| `related_to` | 同一 Task 根目录内的 UUID 集合 |
| `extra` | 可选、可在 JSON 与 TOML 间无损表示的结构化值 |

schema 不包含 `parent`、`branch`、`updated_at`、最后关闭原因、`paused`、`archived`、安装时间或会话状态。

未知字段、错误类型、缺失版本和不支持的版本均无效。普通内容即使看起来像 Task 元数据，也不会成为候选项。

## split 和 embed

split 表示：

```text
Task/
├── tk.toml
└── TASK.md
```

`tk.toml` 保存全部元数据，`TASK.md` 保存正文。

embed 表示：

```text
Task/
└── TASK.md
```

`TASK.md` 以受限 YAML frontmatter 保存全部元数据，结束分隔符之后是正文。运行时拒绝 YAML tag、重复键、未知字段、未闭合 frontmatter 和超过上限的 frontmatter。

修改 embed 元数据时，运行时逐字节保留正文。表示切换作用于整个项目，不允许按 Task 混用。

## 候选识别

顶层 Task 发现要求规范的 `YYYY/MM/DD-NN--slug` 拓扑，包括固定序号宽度、`--` 分隔符、合法日历日期、非空 slug，以及与 slug 一致的元数据名称。发现有效顶层 Task 后，运行时递归扫描其下的真实目录。普通材料目录可以继续向下遍历，因为子 Task 可能位于其中。

后代目录首先需要当前项目 `metadata_mode` 对应的明确标记：

- split 模式以常规 `tk.toml` 为标记。有效 Task 还必须具有常规的配对 `TASK.md`；
- embed 模式只有在常规 `TASK.md` 以 tk YAML 分隔符和 `schema_version` 头开始时才视为标记，随后必须完整通过 frontmatter 严格校验。

带标记目录只有在载体、schema、UUIDv7 身份、表示和项目路径全部通过校验后才成为 Task。生成式 `NN--slug` 子 Task 还要求元数据名称匹配 slug；非生成式子 Task 没有路径与名称一致性要求。普通发现不会返回带标记但无效的目录，`check` 会报告它们。无关 `TASK.md` 和普通 YAML frontmatter 仍是材料。

最近的有效祖先 Task 是发现出的父级。无效标记目录和普通材料目录不会替换该祖先。符号链接、特殊文件、WAL 目录、`.tk-tmp`、清理数据和 Task 根目录外路径不参与发现。

遍历顺序固定。一次扫描最多接受 100,000 个真实目录和 256 层后代。超过任一上限或遇到必要 I/O 失败时，运行时返回 `task_discovery_limit_exceeded` 或对应存储错误，不返回部分任务图。`check` 把这类扫描报告为不完整。

`subtasks_dir` 只控制新子 Task 的写入位置。序号分配检查所有已发现的直接子 Task，只统计叶子目录具有有效生成式 `NN--slug` 的 Task，取最大序号且不填补空洞。新名称继续使用两位序号。序号 `99` 已存在时，创建会在写入前失败。

## 身份、名称和关系

UUIDv7 是权威身份。路径是定位符，rename 可以改变路径。名称使用 NFKC、受限字符和 32 个终端显示列规则规范化。

`depends_on` 和 `related_to` 只能指向同一 Task 根目录中的 Task。Task 不能引用自身，`depends_on` 不能形成环。关系按 UUID 排序并去重。

## 生命周期

| 当前状态 | 目标状态 | 要求 |
| --- | --- | --- |
| `planning` | `open` | 允许，自动追加 WAL |
| `planning` | `closed` | 非空原因、当前授权、关闭检查 |
| `open` | `closed` | 非空原因、当前授权、关闭检查 |
| `closed` | `open` | 非空原因、当前授权、没有已关闭祖先 |

普通关闭要求所有后代和依赖目标已关闭。强制关闭只绕过后代和依赖检查，不绕过授权、原因、schema、路径、Git 或关系验证。

closed Task 默认只读。read、search 和 check 仍可读取它。

## 创建授权

- `strict` 项目的顶层 Task 只有在用户当前明确要求或确认时才能创建。
- `permissive` 项目允许 Agent 为值得持久保存的工作创建 Task，不要求已经承诺执行。
- 创建 `planning` Task 需要用户明确表达保存早期想法、调查或计划的意图。
- 创建默认状态是 `open`，需要 `planning` 时显式传入。
- open Task 树中的普通子 Task 不需要新的顶层授权。

## 项目发现

Git 项目使用 Git 根和项目配置定位。

非 Git 精确路径使用 Task 目录结构定位：

1. 从 Task、受管文件或材料路径向上寻找符合 `DD-NN--slug` 的祖先目录；
2. 父目录必须符合 `MM`，再上一层必须符合 `YYYY`；
3. `YYYY` 的父目录是候选 Task 根；
4. 只再检查最多两个祖先目录，用于匹配项目配置和 Task 根关系；
5. 加载按载体发现的任务图，并要求精确路径位于已发现 Task 内；
6. 两层内无法确认项目时失败，不继续遍历到文件系统根目录。

普通上下文目录使用有界的就近项目发现。精确绝对已发现 Task 路径、受管载体或材料路径会先定位其所属项目，因此调用方可以从项目 A 的 cwd 读取项目 B 的绝对引用。

## Git 策略

Git 策略只在持久写入前检查：

- `track` 要求 Task 受管文件没有被忽略；
- `ignore` 要求 Task 根目录被忽略；
- `none` 不调用 Git 策略命令。

read、search 和纯诊断不会因为 Git 策略被拒绝。tk 永远不修改 `.gitignore`、索引、Git 配置、提交或历史。

## Search 可见性

省略状态过滤器或传入空数组时，搜索 `planning`、`open` 和 `closed` 全部状态。非空状态数组才缩小结果集。文件系统遍历不会在 closed 父 Task 处停止，结果会报告 closed 祖先。

搜索排序和匹配方式由[工具 API](./tool-api.zh.md#搜索) 定义。

## WAL

每个 Task 的 WAL 位于 `wal/YYYY-MM-DD.md`，条目格式为：

```markdown
## 2026-08-31T12:34:56+08:00 · actor

Message

Optional body
```

只有完整匹配 RFC 3339 时间戳、分隔符和 actor 的 `## ` 行才开始新条目。普通 Markdown H2 属于正文。

WAL 是普通辅助 Markdown 记录，不参与领域操作正确性。它不提供重复检测、事务保证或特殊行转义。正文恰好伪装成完整条目头属于极小概率事件，tk 不为此增加长度前缀或新格式。

actor 是单行归因信息，不是身份认证或授权。只有实际追加 WAL 的 update、log 和 rename 请求接受 actor。

元数据先提交，自动 WAL 后追加。WAL 追加失败会返回警告，不回滚已经提交的元数据。

## 单文件写入

单文件受管更新使用同目录临时文件和原子替换：

1. 严格读取当前状态；
2. 完成领域验证；
3. 执行写入前 Git 策略检查；
4. 写入并关闭完整临时文件；
5. 原子替换目标；
6. 删除临时内容。

普通写入不使用锁、租约、比较交换或自动合并。同一文件的并发完整替换由最后完成者决定。

## 多目标操作

批量创建、schema 迁移、表示切换、rename 和 Harness 组件操作遵循同一失败边界：

1. 首次写入前完成全部领域校验；
2. 按确定顺序逐项提交；
3. 普通 I/O 错误发生时立即停止；
4. 返回已完成项、未完成项和原始错误；
5. 不自动回滚，不创建续跑状态，不在进程退出后继续操作。

相同请求可以在调用方确认当前状态后重新执行。每次调用都重新构建发现任务图，并根据当前受管文件重新规划。

批量创建可以跳过已经存在且与请求匹配的项目。schema 迁移跳过已经处于目标版本的载体。

## schema 迁移

正式发布的 schema 版本使用逐级迁移器，例如 1→2、2→3。迁移总是按顺序执行到目标版本。

- 每个已发布版本的迁移器长期保留；
- split 和 embed 都支持逐级迁移并保留正文；
- 首次写入前完成全部选中载体的读取、验证和转换规划；
- 不支持降级；
- 未正式发布的开发格式不构成旧 schema；
- 初始 schema 是 1。

迁移器可以实现为 Rust 模块，也可以作为构建时嵌入的资源文件。代码组织不改变逐级迁移合同。

## 表示切换

表示切换在 split 和 embed 之间转换整个项目：

1. 读取并校验全部已发现 Task；
2. 为每个 Task 生成目标载体；
3. 按确定顺序提交 Task；
4. 最后更新项目配置；
5. 中途失败时报告已完成和未完成 Task，不自动回滚。

切换不追加 Task WAL。

## rename

rename 只修改 Task 自身的名称、适用时的生成式目录，以及元数据：

1. 唯一解析已发现 Task 及其最近有效父级；
2. 规范化新名称。非生成式子 Task 保持目录不变；其他 Task 保留生成序号并计算新的 slug 路径；
3. 验证需要移动时目标不存在、关系有效且 Git 策略允许写入；
4. 扫描 Markdown 引用，并返回解析出的父级、旧路径、目标路径和引用列表；
5. 生成式目录无覆盖移动；非生成式子 Task 跳过本步；
6. 更新元数据；
7. 追加 WAL。

运行时不自动改写引用。`git_policy=track` 时扫描 Git 跟踪的整个项目 Markdown；`ignore` 或 `none` 时扫描 `task_root` 下的普通 Markdown。split 和 embed 的 Task 正文都在扫描范围内，受管 frontmatter、WAL 和临时内容不参与。

## 最小清理清单

每个需要登记临时内容的操作使用最小清理清单，只记录：

- 清单格式版本；
- 操作进程身份；
- 创建时间；
- tk 创建的临时文件和目录路径。

清单只承担临时内容清理职责，不记录领域状态、内容摘要或提交阶段。

会修改多个项目目标的命令在首次写入前创建活动操作标记。标记记录操作 ID、项目范围、Linux boot ID、PID 和进程启动时间。

- 操作进程仍在运行时，其他项目写操作返回 `operation_in_progress`。
- 操作进程退出后，写操作仍拒绝并提示先运行 GC。
- read、search 和纯诊断不受阻塞。
- 单文件原子替换不创建项目级活动操作标记。
- 两个进程恰好同时创建标记的竞争按极小概率事件处理，不增加锁。

## GC

GC 只处理 tk 临时内容：

- 仍在运行的操作进程对应的清单和路径全部保留；
- 操作进程退出后，对应清单按记录路径清理；
- 路径逃逸、symlink、无法解析的清单和无法证明属于 tk 的内容保留并报告；
- 开发阶段旧清理格式视为未知内容，不解析、不迁移；
- GC 不继续、完成或回滚领域操作；
- GC 不修改 Task 元数据、正文、WAL、项目配置或 Harness 配置。

删除期间发生 I/O 错误时停止并报告已删除和未删除路径。

## check

check 严格检查项目配置、带标记 Task 载体、schema、表示一致性、生成式名称与路径一致性、UUID 唯一性、直接子 Task 序号唯一性、关系、WAL、活动操作标记和临时清单。逻辑同级序号冲突会报告解析出的父级路径。

必要目录或文件读取失败，或发现过程超过资源上限时，check 立即返回不完整检查，不继续收集后续诊断。完整读取后发现标记载体、格式或领域错误时，检查是完整但失败。check 不修改任何内容。
