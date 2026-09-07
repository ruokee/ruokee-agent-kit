# tk

[English](./README.md) | 中文

tk 是一个持久化任务管理工具。它把任务进度、共识和支撑材料保存在普通项目文件中，让工作能够跨上下文压缩、跨会话以及跨 Agent 继续。

Task 是值得保留的项目内临时性努力。创建 Task 不代表已经承诺执行或完成。

## 接入方式

同一个 Rust 运行时提供 `tk` CLI、stdio MCP 服务器，以及 Pi 和 OMP 原生工具集成。组件支持 Codex、Claude Code、Pi 和 OMP，可选择 tools 或 CLI 模式，以及英文或中文 Skill。CLI Skill 也可以安装到其他 Skill 根目录，不依赖特定 Harness 集成。

运行时负责 Task 规则和持久化。Harness 组件提供操作入口，不实现第二套规则。

## 开始使用

从[用户指南](./docs/guide.zh.md)开始，安装运行时和组件、初始化项目，再创建或继续一个 Task。运行时与 Harness 组件分开安装。

各 Harness 支持的组件形式见 [Harness 集成](./docs/design/harnesses.zh.md)，组件的安装、更新和卸载规则见[安装](./docs/design/installation.zh.md)。

## 文档

- [用户指南](./docs/guide.zh.md)：安装和日常工作流。
- [CLI 参考](./docs/design/cli-reference.zh.md)：命令、参数和退出行为。
- [设计索引](./docs/design/README.zh.md)：架构、数据模型、运行时、工具合同、Skill 和组件生命周期。
- [验证](./docs/design/validation.zh.md)：验收标准与验证要求。
