# 运行时架构

[English](./runtime.md)

## 分层

Rust 运行时按职责分层：

| 层 | 负责 |
| --- | --- |
| 接入层 | CLI、MCP、生成的工具 schema、文本与 JSON 输出 |
| 应用层 | 请求编排、项目和 Task 定位、预检、提交顺序和结果汇总 |
| 领域层 | Task 身份、名称、生命周期、关系、搜索等级和授权规则 |
| 持久化层 | split/embed 解码编码、路径安全、原子替换和 WAL |
| 维护层 | schema 迁移、表示切换、rename、check、GC 和组件生命周期 |
| Harness 适配器 | Pi 和 OMP 的原生工具映射与加载错误隔离 |

依赖方向从接入层指向应用与领域层，再指向持久化。Harness 适配器只依赖生成合同和公开进程接口，不依赖 Rust 私有模块。

## 进程模型

以下命令使用短生命周期进程：

- Task 读写与搜索；
- 项目初始化和检查；
- schema 迁移与表示切换；
- rename 和 GC；
- Harness 组件安装、更新和卸载；
- schema 生成和版本输出。

MCP 服务器只服务一个 stdio 连接。它可以保留不可变的工具定义，但每次调用都重新解析 cwd、项目和 Task。运行时不缓存项目图，不建立后台索引。

Pi 和 OMP 的每次原生工具调用启动公开 `tk` 可执行文件。适配器不通过 shell，也不调用隐藏子命令。

## 请求上下文

项目请求的 cwd 按以下顺序选择：

1. 请求显式 cwd；
2. Harness 提供的会话目录；
3. 运行时进程目录。

完整绝对 Task 路径或材料路径可以定位自己的项目，不强制属于 cwd 的项目。

actor 只属于会追加 WAL 的 update、log 和 rename 请求。CLI 直接调用默认使用 `cli`。原生适配器优先使用可用的模型信息，否则使用 Harness 名称。

上下文从不持久化为 Task 状态。

## 项目发现和 Git

项目发现与 Git 策略检查分离。

read、search 和 check 只定位项目并读取状态。写操作在首次持久写入前调用统一的 Git 策略检查。`git_policy=none` 不要求安装 Git。

精确绝对路径先通过 Task 目录结构和有界祖先检查定位项目。Git 项目使用 Git 根。非 Git 项目不会无界遍历到文件系统根目录。

## 内存边界

search 逐项处理候选，只保留产生最终结果所需的最多 100 个最佳项。`search_body=false` 时不读取正文。

check、关系图、schema 迁移和表示切换在确实需要全项目信息时允许 O(Task 数量) 内存。运行时不宣称所有项目操作使用常量内存。

进程 stdout、stderr、工具 schema、WAL 读取和协议帧使用明确字节或条目上限。

每个子进程输出流和每个 MCP JSON 载荷的上限都是 1 MiB。MCP 输入超限时关闭 stdio 传输；输出超限时传输失败，不发送残缺帧。

## 写入和取消

单文件写入在原子替换前响应取消。开始原子替换后完成当前替换，再返回结果。

多目标命令在每个提交点之间响应取消。首次写入前取消时没有持久变更。部分提交后取消与普通 I/O 失败使用相同结果边界：报告已完成和未完成项，不自动回滚。

普通 Task 写入不使用锁、租约、CAS 或自动合并。活动操作标记只阻止未清理的项目级多目标写入，不承担通用并发控制。

## 失败边界

预期错误使用稳定错误码、类别、消息和结构化详情。消息面向人类，调用方不能解析消息判断类型。

- 请求、上下文、配置、策略、解析、受管文件、不变量、冲突、存储、兼容性和环境错误属于可预期失败。
- panic、不可能状态和内部编码失败属于 internal。
- 已完成部分写入的错误必须携带已完成和未完成项。
- WAL 追加失败不回滚已经提交的元数据。
- check 的必要 I/O 失败表示扫描不完整。

退出码沿用当前实现映射。0 表示成功，非 0 表示失败或拒绝。具体原因由错误码和类别表达，而不是把每种错误绑定成新的数字合同。

## 可执行文件检查

Linux 上的固定运行时和 Harness 官方命令必须：

- 路径存在；
- 是常规文件；
- 至少设置一个执行位。

实际进程启动失败时保留操作系统错误，并归入 environment 类别。

## Harness 适配器

Pi 和 OMP 适配器在首次注册工具前完成：

1. 固定运行时检查；
2. version JSON 解码；
3. native 工具合同解码；
4. `runtime_compat` 与组件声明一致性检查；
5. 六个工具名称和 schema 完整性检查。

适配器不解析语义版本范围。Rust 在组件安装时负责兼容范围判断。

扩展入口捕获运行时缺失、不可执行、输出无效、合同冲突、工具缺失和注册错误，输出一条有界错误并正常结束加载，不能终止 Harness 会话。

首次注册前的验证失败保证注册数为零。某次 `registerTool` 中途失败时，Harness API 已经接受的前缀工具允许保留，不伪造回滚保证。

OMP 把 search、read、create、update 和 log 设置为 essential，exec 为 discoverable。Pi 不设置不存在于其公开 API 的 `loadMode`。

## 组件构建和运行时来源

Cargo 构建使用唯一的 Rust 组装逻辑，从四个 Skill 目录和各 Harness 源码生成十六份自包含载荷。生成过程只写 Cargo `OUT_DIR` 和 Cargo 自身目标目录。

运行时通过 `include_bytes!` 使用内嵌归档和清单。安装不访问网络，不启动 `curl`，不接受本地归档路径。

## 版本维度

| 版本 | 含义 |
| --- | --- |
| runtime version | 可执行文件包版本 |
| CLI contract version | CLI、MCP 和原生工具合同版本 |
| Task schema version | 当前 Task 元数据版本 |
| component format version | 内嵌 Harness 组件归档格式版本 |
| cleanup manifest version | 最小清理清单格式版本 |

`tk --version --output json` 使用 `runtime_version`、`cli_contract_version`、`task_schema_version` 和 `component_format_version`。

设置 `TK_SOURCE_REVISION` 时，组件清单使用该值。否则使用 `package-v<CARGO_PKG_VERSION>`。构建脚本不调用 Git。
