# 验证

[English](./validation.md)

本文定义实现 tk 当前合同时需要证明的可观察合同。验证不能替代设计，也不能因为实现方便而降低合同。

## 仓库边界

验证以下静态事实：

- 一个 Cargo package 生成 `tk` 可执行文件；
- Rust 是唯一组件组装器；
- 组件组装只有一条 Rust 产物路径；
- 多份载荷覆盖各 Harness、模式和语言选择，且不引用其他组件目录；
- 两份独立 CLI Skill 载荷只包含 `tk-cli` 或 `tk-cli-zh`，不含 Harness 字段；
- 四个 Skill 身份与 tools 或 CLI 模式、英文或中文准确对应；
- CLI 载荷不包含 tk 操作注册，tools 载荷包含所选 Harness 集成；
- 评审记录和 Task 材料不进入产品产物。

## 数据模型测试

覆盖 split 和 embed：

- schema 1 的严格解码、稳定编码和正文保留；
- 未知字段、缺失版本、未知版本、错误类型和受限 YAML；
- 规范顶层发现和后代的模式专用载体标记；
- 直接位于父 Task 下的子 Task、配置目录下的子 Task 以及普通材料目录下嵌套的子 Task，父级为最近有效祖先；
- 带标记无效载体、符号链接、运行时自有路径、发现上限、重复身份和逻辑同级序号；
- UUIDv7、生成式名称与路径一致性、关系去重、跨根引用和依赖环；
- 改变 `subtasks_dir` 后的子 Task 编号、不填补空洞和 `99` 耗尽；
- 非生成式子 Task 重命名不移动目录，生成式重命名保持序号；
- planning、open、closed 转换和关闭约束；
- strict 与 permissive 创建；
- create 把 `--body` 作为未知 CLI 参数拒绝，并在 create 请求与子 Task item 上把 `body` 作为未知字段拒绝；
- 运行时在 split 和 embed 模式创建 Task 时写入恰为 `# <规范化名称>` 的初始正文；
- 子 Task 重试只匹配 create 拥有的字段，正文被改写后重试返回无变更且不产生重复；
- Git `track`、`ignore` 和 `none` 只在写入前预检；
- 绝对已发现 Task、载体和材料路径反向定位项目；
- 非 Git 发现的有界祖先检查。

## 搜索测试

覆盖：

- 默认包含 planning、open 和 closed；
- 显式 status 缩小结果；
- 完整 UUID、明确 Task 路径、材料路径、regex 和 string 的解释顺序；
- 查询类型确定后不回退；
- 最少 8 位 UUID 前缀；
- 匹配类别、`created_at` 降序和 ID 升序；
- `match` 返回 `uuid`、`path`、`regex` 或 `string`；
- 默认 20、最大 100 和有界结果集；
- `search_body=false` 不读取正文。

## WAL 测试

覆盖正常条目编码和解析、actor、消息、正文与预算。WAL 故障不能回滚已经提交的元数据。

不为正文恰好伪装成完整条目头增加转义格式或专项测试合同。

## 写入和并发测试

覆盖：

- 单文件同目录临时文件和原子替换；
- 最后完成的完整替换决定最终字节；
- 多目标操作首次写入前完成全部领域预检；
- 每个提交点注入 I/O 失败，并准确报告完成和未完成项；
- 不自动回滚，不生成续跑状态；
- 批量创建重试跳过已经存在且匹配的项目；
- 仍在运行的操作进程阻止其他项目写入；
- 操作进程退出后，活动操作标记仍阻塞写入直到 GC；
- read、search 和纯诊断不受活动操作标记阻塞；
- 单文件更新不创建项目活动操作标记。

## 迁移和表示切换

当存在多个正式 schema 时，每条相邻迁移器分别测试，组合链也测试。当前初始版本是 1。

覆盖 split 和 embed 的逐级向前迁移、正文保留、全部目标预检、跳过当前版本、未知版本、缺失转换和拒绝降级。

表示切换覆盖 split→embed、embed→split、配置最后提交、中途故障的完成与未完成项，以及不追加 WAL。

## rename

覆盖名称和路径更新、重复相同 rename 返回无变化、WAL 警告、目标冲突和引用扫描：

- `git_policy=track` 扫描 Git 跟踪的项目 Markdown；
- `ignore` 和 `none` 扫描 task_root 普通 Markdown；
- split 和 embed 正文均参与；
- 引用只报告，不自动修改；
- 带引用的 dry-run 成功并返回完整计划；
- 带引用的路径移动执行在首次写入前以稳定错误码 `broken_reference_conflict`、`conflict` 类别和退出码 3 停止，details 包含 `old_path`、规范化 `new_name`、绝对 `target_path` 和全部引用路径与行号；
- `--ignore-brokenlinks` 让移动完成，引用文件逐字节保持原样，结果中仍包含引用；
- 无引用的路径移动正常完成。非生成式子 Task 改名不会移动目录，重复相同 rename 返回无变化；这两种情况都不返回 `broken_reference_conflict`。

## check 和 GC

check 测试完整有效项目、领域诊断和必要 I/O 快速失败。必要读取失败后不能继续输出看似完整的诊断集合。

GC 测试：

- 最小清理清单的版本、进程身份、时间和临时路径；
- 活动进程内容保留；
- 已结束进程内容和标记清理；
- 路径逃逸、symlink、未知清单和无法证明属于 tk 的内容保留；
- 开发阶段旧清理格式不解析、不迁移；
- 不修改 Task、WAL、项目配置或 Harness 配置；
- 删除错误时报告已删除和未删除项。

## 工具和 CLI

生成合同测试覆盖六个 MCP 工具和 Pi、OMP native 工具，确认名称、字段、默认值、联合类型和 OMP 专用 `loadMode`。

CLI 测试覆盖：

- 命令树、help、version、文本与 JSON 输出；
- stdout 和 stderr 分离；
- 当前退出码映射；
- actor 只出现在 update、log 和 rename；
- search 全部默认状态；
- init force 不读取 Task 数据；
- Harness install 默认 tools 模式和英文，接受全部模式与语言值，并报告最终 Skill；
- 自定义根目录 install 要求显式 CLI 模式，并拒绝 tools 模式；
- install 与 uninstall 必须且只能选择 Harness 或 Skill 根目录；
- 组件命令没有本地 source，并拒绝全局 cwd；
- 拒绝未知命令和不属于当前合同的选项。

MCP 测试覆盖 initialize、list、六次调用、取消、协议 stdout 和正常关闭。

## 适配器

Pi 和 OMP 的单元与进程测试覆盖：

- 固定运行时不存在、不是常规文件或没有执行位；
- version 和 native schema 解码；
- Rust 兼容范围结果，不在 TypeScript 复制 semver；
- 全部预检失败时注册数为零；
- registerTool 中途失败后停止，已注册前缀允许保留；
- 入口只输出一条有界错误并正常结束；
- Pi 不设置 `loadMode`；
- OMP 的 essential 和 discoverable 分类；
- cwd、actor、取消、直接进程调用和输出上限。

## 组件组装

重复构建必须产生同一组 Harness 载荷、两份独立 CLI Skill 载荷，以及相同的文件字节、`tar.zst` 字节和清单。验证目标类型、适用时的 Harness、模式、语言、Skill 身份、路径、权限、摘要、缺失项、多余项和 `runtime_compat`。

`TK_SOURCE_REVISION` 有值和无值两种构建均验证。构建脚本不能调用 Git，也不能写出 Cargo 管理目录以外的生成物。

## 安装和卸载

隔离测试覆盖所有 Harness、模式和语言选择：

- install、update、选择切换、no_change 和 uninstall；
- 内嵌归档，无网络和本地来源；
- text 和 JSON install 结果中的最终 `mode`、`language` 和 `skill`；
- 官方 Harness API 优先；
- tools 模式注册，以及 CLI 模式不存在 tk 操作注册；
- 共享配置解析失败时原文件不变；
- 共享配置只删除 tk 项；
- 卸载完整删除当前及已知残留 tk 专用目录，包括修改和额外内容；
- 无关 Harness 内容和后续修改保留；
- 中途 I/O 失败报告完成和未完成项；
- GC 只清理组件临时内容，不继续生命周期操作。

自定义根目录测试覆盖两种独立语言载荷、相对与绝对根目录、创建缺失父目录、完整载荷收敛、语言切换、dry-run、no_change 和 uninstall。测试证明只管理 `tk-cli` 与 `tk-cli-zh`，无关子项和根目录保持不变，不要求 Harness 可执行文件，结果使用 `skill_root` 而不是 `harness`。自定义根目录 uninstall 报告 CLI 模式，并省略语言和 Skill。

## 真实 Harness 验证

| Harness | 必需验证 |
| --- | --- |
| Codex | 隔离环境真实安装、加载和卸载 |
| Claude Code | 隔离环境真实安装、加载和卸载 |
| Pi | 隔离环境真实安装、加载和卸载 |
| OMP | 隔离环境真实安装、加载、一次真实工具调用和卸载 |

每个 Harness 都验证四种模式与语言选择。OMP tools 模式还执行上表所列的真实操作调用。

真实测试必须观察 Harness 的实际加载结果和卸载后状态，不能只检查组装文件。

## Skill 和文档

Skill 场景覆盖 strict/permissive 创建、planning/open 选择、Task 解析、catchup、WAL、人工修复授权、close/reopen、五类材料模式、tools 路由不通过直接 CLI 重试，以及 CLI-only 命令使用。

公开文档检查英文和中文页面的语言链接、语义对应、术语和自然度。使用仓库现有检查和人工审查，不增加自定义文档结构检查器。
