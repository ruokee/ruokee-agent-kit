# 运行时架构

[English](./runtime.md)

## 分层

Rust 运行时按职责分层：

- 接入层：CLI、MCP、生成的工具 schema、文本与 JSON 输出。
- 应用层：请求编排、项目和任务定位、预检、提交顺序和结果汇总。
- 领域层：任务身份、名称、生命周期、关系、搜索等级和授权规则。
- 持久化层：split/embed 解码编码、路径安全、原子替换和 WAL。
- 维护层：schema 迁移、表示切换、rename、check、GC 和组件生命周期。
- Harness 适配器：Pi 和 OMP 的原生工具映射与加载错误隔离。

依赖方向从接入层指向应用与领域层，再指向持久化。Harness 适配器只依赖生成合同和公开进程接口，不依赖 Rust 私有模块。

## 进程模型

以下命令使用短生命周期进程：

- 任务读写与搜索；
- 项目初始化和检查；
- schema 迁移与表示切换；
- rename 和 GC；
- Harness 组件安装、更新和卸载；
- schema 生成和版本输出。

MCP 服务器只服务一个 stdio 连接。它可以保留不可变的工具定义，但每次调用都重新解析 cwd、项目和任务。运行时不缓存项目图，不建立后台索引。

Pi 和 OMP 的每次原生工具调用启动公开 `tk` 可执行文件。适配器不通过 shell，也不调用隐藏子命令。

## 请求上下文

项目请求的 cwd 按以下顺序选择：

1. 请求显式 cwd；
2. Harness 提供的会话目录；
3. 运行时进程目录。

完整绝对任务路径或材料路径可以定位自己的项目，不强制属于 cwd 的项目。

actor 只属于会追加 WAL 的 update、log 和 rename 请求。CLI 直接调用默认使用 `cli`。原生适配器优先使用可用的模型信息，否则使用 Harness 名称。

上下文从不持久化为任务状态。

## 项目定位

项目发现与 Git 策略检查分离。

read、search 和 check 只定位项目并读取状态。写操作在首次持久写入前调用统一的 Git 策略检查。`git_policy=none` 不要求安装 Git。

精确绝对路径先通过规范顶层任务目录和有界祖先检查定位项目。随后，运行时要求该路径属于按载体发现的任务图中的任务。Git 项目使用 Git 根。非 Git 项目不会无界遍历到文件系统根目录。

## 内存边界

发现过程构建一份内存任务图，可以使用 O(任务数量) 内存。search 最多保留 100 个最佳结果项，`search_body=false` 时不读取正文。

[数据模型](./data-model.zh.md#候选识别)定义单次扫描的目录数与层级上限、跳过的内容以及返回的失败。

check、关系校验、schema 迁移和表示切换复用发现任务图。运行时不宣称项目操作使用常量内存。

进程 stdout、stderr、工具 schema、`tk read` WAL 返回、frontmatter 和协议帧使用明确的字节或条目上限。每个子进程输出流和每个 MCP JSON 载荷的上限都是 1 MiB。MCP 输入超限时关闭 stdio 传输；输出超限时传输失败，不发送残缺帧。`tk check` 另行流式读取完整 WAL，不设置固定的总文件数、总字节数或总条目数上限。

## 写入行为

单文件写入在原子替换前响应取消。开始原子替换后完成当前替换，再返回结果。

多目标命令在每个提交点之间响应取消。首次写入前取消时没有持久变更。部分提交后取消与普通 I/O 失败使用相同结果边界：报告已完成和未完成项，不自动回滚。

活动操作标记只阻止未清理的项目级多目标写入，不承担通用并发控制。

## 失败边界

预期错误使用稳定错误码、类别、消息和结构化详情。消息面向人类，调用方不能解析消息判断类型。

- 请求、上下文、配置、策略、解析、受管文件、不变量、冲突、存储、兼容性和环境错误属于可预期失败。
- panic、不可能状态和内部编码失败属于 internal。
- 已完成部分写入的错误必须携带已完成和未完成项。
- WAL 追加失败不回滚已经提交的元数据。
- check 期间发生必要 I/O 失败或取消时，扫描不完整；存在 I/O 失败路径时一并报告。

退出码沿用当前实现映射。0 表示成功，非 0 表示失败或拒绝。具体原因由错误码和类别表达，而不是把每种错误绑定成新的数字合同。

## 可执行文件检查

Linux 上的固定运行时和 Harness 官方命令必须：

- 路径存在；
- 是常规文件；
- 至少设置一个执行位。

实际进程启动失败时保留操作系统错误，并归入 environment 类别。

## Harness 适配器

扩展入口的预检、失败行为、注册与回滚保证见 [Harness 集成](./harnesses.zh.md#适配器加载)。各适配器的加载标记见其 [OMP](./harnesses.zh.md#omp) 与 [Pi](./harnesses.zh.md#pi) 小节。

## 组件组装

构建期组装见 [Harness 集成](./harnesses.zh.md#构建时组装)，内嵌载荷见[安装](./installation.zh.md#内嵌载荷)。

## 版本维度

- runtime version：可执行文件包版本。
- CLI contract version：CLI、MCP 和原生工具合同版本。
- Task schema version：当前任务元数据版本。
- component format version：内嵌 Harness 组件与独立 CLI Skill 归档格式版本。
- cleanup manifest version：最小清理清单格式版本。

`tk --version --output json` 使用 `runtime_version`、`cli_contract_version`、`task_schema_version` 和 `component_format_version`。
