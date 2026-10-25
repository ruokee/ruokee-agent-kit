# tk

[English](./README.md) | 中文

tk 是一个持久化任务管理工具。它把任务进度、共识和支撑材料保存在普通项目文件中，让工作能够跨上下文压缩、跨会话以及跨 Agent 继续。

## 接入方式

同一个 Rust 运行时通过 `tk` CLI 提供任务操作，负责任务规则和持久化。Agent 使用自包含的 `tk-cli` 或 `tk-cli-zh` Skill。两种语言都可以安装到 Codex、Claude Code、Pi、OMP 的普通 Skill 根目录，或自定义根目录。

## 弃用说明

MCP 和原生 tools 接入已移除，tk 仅支持 CLI。安装更新由用户自行处理。

## 分发

运行时是 `$HOME/.local/bin/tk` 下的一个可执行文件。`tk install` 把两种内嵌 CLI Skill 中的一种写入所选根目录。运行时安装和 Skill 安装相互独立，[用户指南](./docs/guide.zh.md)说明当前安装合同。

## 文档

- [用户指南](./docs/guide.zh.md)：运行时的安装、组件选择、初始化和日常工作流。
- [CLI 参考](./docs/design/cli-reference.zh.md)：命令、参数和退出行为。
- [设计索引](./docs/design/README.zh.md)：架构、数据模型、运行时、CLI、安装、Skill 和验证。
- [验证](./docs/design/validation.zh.md)：验收标准与验证要求。
