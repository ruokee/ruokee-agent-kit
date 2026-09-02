# Harness 集成

[English](./harnesses.md)

## Harness 定义

Harness 是围绕模型、使模型能够作为 Agent 运行的软件环境，包括模型交互循环、系统提示、上下文管理、工具、权限和 hooks。

当前支持 Codex、Claude Code、Pi 和 OMP。新增 Harness 需要定义自包含组件、安装与卸载路径、加载验证和隔离测试，不需要修改 Harness 的产品定义。

## 组件

Harness 组件是按一个 Harness 组装和安装的 tk 自包含单元。每个组件可以包含：

- 权威英文 tk Skill；
- MCP、Plugin、扩展或 Package 所需的原生清单；
- Pi 或 OMP 原生适配器；
- Harness 要求的静态配置。

组件不包含运行时可执行文件、中文 Skill、其他 Harness 的内容、评审材料或产品源码。

组件目录内部的文件只能互相引用。它不能在安装后依赖仓库目录布局。

## Codex

Codex 组件安装：

- 一份英文 tk Skill；
- 指向固定用户级 `tk mcp` 的 MCP 注册。

Skill 和 MCP 注册可以位于不同的 Harness 官方目标，但共同构成 Codex 组件。

## Claude Code

Claude Code 组件是符合 Claude Code 原生规则的自包含 Plugin，包含英文 Skill 和指向固定运行时的 MCP 配置。组件通过官方 Plugin 生命周期安装和卸载。

## Pi

Pi 组件是自包含 Package，包含英文 Skill 和原生扩展。

扩展注册六个工具：

- `tk_search`
- `tk_read`
- `tk_create`
- `tk_update`
- `tk_log`
- `tk_exec`

每次调用直接启动固定 `tk` 可执行文件，不使用 shell。请求没有 cwd 时使用 Pi 会话目录。actor 仅在 update、log 或 exec rename 中注入。

Pi 不设置 `loadMode`。

## OMP

OMP 组件是自包含 Package，包含英文 Skill 和原生扩展。六个工具与 Pi 相同。

OMP 按公开 API 设置：

- read、create、update、log 为 essential；
- search 和 exec 为 discoverable。

只有 OMP 使用 `loadMode`。适配器把 OMP 取消信号传给运行时。

## MCP

Codex 和 Claude Code 使用 `tk mcp`。Pi 与 OMP 可以由用户另外配置 MCP，但原生组件不安装或管理这份外部 MCP 配置。

MCP server 公开六个协议工具：`search`、`read`、`create`、`update`、`log` 和 `exec`。schema 由 Rust 请求类型生成。

## 原生 schema

Pi 和 OMP 使用 `tk schema generate --type native --harness <pi|omp>` 的生成结果。生成合同负责：

- 工具名称和描述；
- JSON schema 类型和默认值；
- Harness 专用的 schema 包装；
- OMP 的 `loadMode`。

适配器不能维护手写的第二份 schema，也不能把 `oneOf` 等结构扁平化为不同语义。

## 适配器加载

扩展入口在第一次工具注册前完成全部预检：

1. 固定运行时路径存在；
2. 路径是常规文件并具有 Unix 执行位；
3. version JSON 可解析；
4. Rust 判断运行时版本满足组件 `runtime_compat`；
5. native schema 可解析；
6. 六个工具名称、请求 schema 和 Harness 专用字段完整。

运行时缺失、不可执行、版本不兼容、清单无效、schema 无效或映射错误时，入口捕获错误，输出一次有界诊断并结束加载。它不能终止 Harness 会话。

预检失败时注册工具数为零。某次 `registerTool` 中途失败时停止后续注册并报告错误。Harness 已接受的前缀工具允许保留，不伪造回滚保证。

## 工具调用

适配器按以下顺序调用：

1. 按请求、会话目录、进程目录选择 cwd；
2. 只为会写 WAL 的请求选择 actor；
3. 把逻辑请求机械映射为公开 CLI argv；
4. 直接启动 `tk`，不经过 shell；
5. 并发读取受限 stdout 和 stderr；
6. 解码统一 JSON 结果；
7. 把进程或输出故障作为传输错误报告。

适配器不实现 Task 验证、名称规范化、授权、路径解析、迁移、GC、兼容范围解析或安装逻辑。

## 构建期组装

Cargo 构建使用 Rust 组装逻辑为四个 Harness 生成组件树、确定性 `tar.zst` 和清单。相同输入必须产生相同路径、文件字节、归档字节和清单。

组装只读取当前组件自身源码和权威英文 Skill。发布、安装和验证使用同一套 Rust 产物。

Rust 组装产物是发布、安装和验证的唯一组件输入。

## Skill 语言

内嵌组件只安装英文 Skill。中文 Skill 是完整、语义对应的替代版本，用户可以按 Harness 官方方式手动安装。tk 不选择、更新或卸载这份外部中文 Skill。

## 验证要求

四个 Harness 都必须在隔离环境中完成真实安装、加载和卸载。当前只要求 OMP 再完成一次真实工具调用。

Codex、Claude Code 和 Pi 的真实验证到加载成功为止，不要求通过真实模型会话调用 tk。
