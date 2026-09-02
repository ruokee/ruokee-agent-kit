# 术语表

## Task

值得持久保存的项目内临时性努力。创建 Task 不代表已经承诺执行或完成。

## Task 元数据

运行时管理的 schema 版本、身份、名称、生命周期状态、创建时间、关系和可选 extra，保存在 `tk.toml` 或 embed `TASK.md` frontmatter 中。

## Task 正文

`TASK.md` 中的普通 Markdown 内容，不包括受管 embed frontmatter。

## 元数据载体

按照项目配置的模式保存规范 Task 元数据的文件。split 模式使用 `tk.toml`，embed 模式使用 `TASK.md`。

## Task 引用

精确操作接受的完整 UUIDv7、绝对 Task 目录、绝对规范载体路径或项目相对 Task 路径。

## Harness

围绕模型、使模型能够作为 Agent 运行的软件环境，包括交互循环、提示、上下文、工具、权限和 hooks。当前支持 Codex、Claude Code、Pi 和 OMP。

## 组件

为一个 Harness 组装和安装的 tk 自包含单元。

## 适配器

把 Pi 或 OMP 原生工具调用映射到公开 tk 进程接口的代码。

## 清理清单

只记录格式版本、操作进程身份、创建时间和 tk 创建的临时路径的最小清单。

## 活动操作标记

多目标操作期间阻止其他项目写入，并在成功清理或 GC 前保留的进程标记。

## 部分提交

多目标操作因错误或取消而只完成部分目标的事实。

## WAL

保存不属于 Task 当前状态的持久事件的普通、仅追加 Markdown 工作活动日志。

## 干净卸载

让 Harness 恢复为从未安装过 tk，同时保留无关内容的卸载结果。
