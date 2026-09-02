# 工具和 CLI 使用

## 六个逻辑工具

优先使用 Harness 原生形式或 MCP 形式：

| 操作 | MCP | Pi 和 OMP |
| --- | --- | --- |
| 搜索 | `search` | `tk_search` |
| 读取 | `read` | `tk_read` |
| 创建 | `create` | `tk_create` |
| 更新 | `update` | `tk_update` |
| 记录 | `log` | `tk_log` |
| 管理性 exec | `exec` | `tk_exec` |

`tk_exec` 仅接受 `--version`、`init`、`check` 和 `rename`。它不通过 shell，直接调用公共解析器。对于迁移、表示切换、GC、schema 生成、组件生命周期、帮助、MCP 启动以及白名单之外的其他命令，请直接使用 CLI。

## 上下文

项目发现存在歧义时，请明确指定 `cwd`。否则，适配器会依次使用 Harness 会话目录和运行时进程目录。完整的 Task 或材料绝对路径可以定位其他项目。

actor 仅可用于 update、log 和 exec rename。CLI 仅在 update、log 和 rename 上接受 `--actor`。

## 结果

工具成功时返回 `ok:true`，并包含 `data` 和可选的 warnings。预期内的失败返回 `ok:false`，并包含稳定的 `error.code`、`category`、人类可读的 `message` 和结构化的 `details`。

不要根据 message 文本进行分支判断。多目标操作失败时，请检查 `completed`、`uncompleted` 和原始错误。运行时不会提供续跑令牌或自动回滚状态。

请将传输失败与领域失败分开处理。进程被终止、stdout 格式错误、协议失败或输出限制错误，都不能伪装成 tk 结果。

## 取消

在首次持久化写入之前取消，不会产生任何领域变更。多目标命令会在各提交点之间响应取消。如果已有工作完成提交，结果会使用与 I/O 失败相同的 completed 和 uncompleted 边界。

## CLI 后备方案

如果 Harness 工具不可用，请使用公共 `tk` CLI；自动化需要结构化输出时，应加上 `--output json`。遵守 stdout 与 stderr 分离规则以及文档规定的退出码。

公共操作失败后，不得改用隐藏命令，也不得直接编辑受管元数据、清理清单或 Harness 配置。
