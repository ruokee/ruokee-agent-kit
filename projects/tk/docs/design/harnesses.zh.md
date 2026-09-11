# Harness 集成

[English](./harnesses.md)

## Harness 定义

Harness 是围绕模型、使模型能够作为 Agent 运行的软件环境，包括模型交互循环、系统提示、上下文管理、工具、权限和 hooks。

当前支持 Codex、Claude Code、Pi 和 OMP。新增 Harness 需要定义自包含组件、安装与卸载路径、加载验证和隔离测试，不需要修改 Harness 的产品定义。

## 组件

Harness 组件是针对一个 Harness、模式和语言选择组装并安装的 tk 自包含单元。Skill 映射为：

| 模式 | 语言 | Skill |
| --- | --- | --- |
| `tools` | `en` | `tk` |
| `tools` | `zh` | `tk-zh` |
| `cli` | `en` | `tk-cli` |
| `cli` | `zh` | `tk-cli-zh` |

tools 模式组件包含所选 Skill 和该 Harness 的 tk 集成。cli 模式组件包含所选 CLI Skill。Claude Code、Pi 和 OMP 还会保留加载该 Skill 所需的原生 manifest；Codex 不需要 manifest。cli 模式组件不包含 MCP 配置或原生工具 extension。组件不包含运行时可执行文件、其他 Harness 内容、评审材料或产品源码。

组件目录内部的文件只能互相引用。它不能在安装后依赖仓库目录布局。

## Codex

tools 模式安装所选 `tk` 或 `tk-zh` Skill，并注册指向固定用户级 `tk mcp` 的 MCP。cli 模式安装 `tk-cli` 或 `tk-cli-zh`，并确保 tk MCP 注册不存在。

Skill 和可选 MCP 注册可以位于不同的 Harness 官方目标中，两者共同组成所选 Codex 组件。

## Claude Code

Claude Code 使用符合原生规则的自包含 Plugin。tools 模式包含所选 tools Skill 和指向固定运行时的 MCP 配置。cli 模式包含所选 CLI Skill，并省略 MCP 配置。两种模式都使用官方 Plugin 生命周期。

## Pi

Pi 使用自包含 Package。tools 模式包含所选 tools Skill 和原生扩展。cli 模式包含所选 CLI Skill，不注册扩展。

tools 扩展注册：

- `tk_search`
- `tk_read`
- `tk_create`
- `tk_update`
- `tk_log`
- `tk_exec`

每次调用都直接启动固定 `tk` 可执行文件，不经过 shell。请求没有 cwd 时使用 Pi 会话目录。actor 只为 update、log 或 exec rename 注入。

Pi 不设置 `loadMode`。

## OMP

OMP 使用独立的自包含 Package，模式与语言选择和 Pi 相同。tools 扩展提供同样六项操作。

OMP 通过公开 API 把 search、read、create、update 和 log 设为 essential，只有 exec 为 discoverable。

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

适配器不实现任务验证、名称规范化、授权、路径解析、迁移、GC、兼容范围解析或安装逻辑。

## 构建时组装

Cargo 构建使用 Rust 组装逻辑生成多份 Harness 组件载荷、两份与 Harness 无关的 CLI Skill 载荷、一个确定性 `tar.zst` 归档和一份清单。Harness 选择覆盖四个 Harness、两种模式和两种语言。相同输入必须产生相同路径、文件字节、归档字节和清单。

Harness 组装只读取所选 Harness 源码和四个自包含 Skill 目录之一。独立载荷只读取 `tk-cli` 或 `tk-cli-zh`。发布、安装和验证使用同一套 Rust 产物。

Rust 组装产物是发布、安装和验证的唯一组件输入。

## Skill 选择

Harness 安装生命周期负责选择、更新和卸载四个 Skill 身份。自定义根目录生命周期只选择 `tk-cli` 与 `tk-cli-zh`。语言选择属于 `tk install`，不是独立的手工复制流程。

## 验证要求

所有 Harness 选择都必须在隔离环境中完成安装、加载和卸载。tools 模式验证注册或原生扩展加载，cli 模式验证没有 tk 操作注册。OMP tools 模式还必须完成一次真实 tk 调用。

两份独立 CLI Skill 载荷必须在隔离环境中完成自定义根目录 install、update、语言切换、no_change 和 uninstall。该路径验证文件和所有权边界，不验证真实 Harness 加载。Codex、Claude Code 和 Pi 的真实 Harness 验证到加载成功为止，不要求通过模型会话调用 tk。
