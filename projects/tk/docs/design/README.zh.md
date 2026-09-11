# tk 设计

[English](./README.md)

这些页面定义 tk 当前的公开合同，只描述现行行为。评审历史、任务本地材料和未发布的替代设计不进入公开文档。

[用户指南](../guide.zh.md)介绍安装和日常使用。[CLI 参考](./cli-reference.zh.md)统一定义命令语法、选项、默认值和退出状态。

## 架构与数据

- [系统架构](./system.zh.md)定义产品范围、系统组成、任务与 Harness 边界和全局不变量。
- [数据模型与持久化](./data-model.zh.md)定义任务 schema、表示、发现、WAL、写入、迁移、rename、清理和 check 行为。
- [运行时架构](./runtime.zh.md)定义分层、进程、请求上下文、失败边界、适配器和版本维度。

## 接口

- [工具 API](./tool-api.zh.md) 定义六个逻辑工具、请求、统一结果和稳定错误。
- [CLI 参考](./cli-reference.zh.md)定义完整命令树和公开拼写。
- [Harness 集成](./harnesses.zh.md)定义 Codex、Claude Code、Pi 和 OMP 组件、原生适配器和构建期组装。

## 安装与 Agent 行为

- [安装](./installation.zh.md)定义内嵌组件、安装、更新、干净卸载和兼容性。
- [Skill 行为](./skill.zh.md)定义 Agent 何时使用 tk、授权、任务导航、WAL 记录和材料组织。

## 维护

- [验证](./validation.zh.md)定义可观察的验收合同。
- [文档](./documentation.zh.md)定义公开文档归属、双语维护、链接和当前状态写法。
- [术语表](./GLOSSARY.zh.md)定义产品特殊术语和固定中文形式。

每项行为只有一个主要归属页面。其他页面链接到该页面，不维护第二份合同。
