# tk 设计

[English](./README.md)

这些页面解释 tk 实现，并提供可独立使用的既定公开行为参考，遵循[文档规则](./documentation.zh.md)。规格包含完整要求和验收，组件文档不要求读者访问仓库规格。

[用户指南](../guide.zh.md)介绍安装和日常使用。[CLI 参考](./cli-reference.zh.md)列出命令语法、选项、默认值和退出状态。

## 架构

- [系统架构](./system.zh.md)定义产品范围、系统组成、任务与 Harness 边界和全局不变量。
- [数据模型](./data-model.zh.md)定义任务 schema、表示、发现、WAL、写入、迁移、rename、清理和 check 行为。
- [运行时架构](./runtime.zh.md)定义分层、进程、请求上下文、失败边界和版本维度。

## 接口

- [CLI 参考](./cli-reference.zh.md)定义完整命令树、请求、结果和稳定错误。

## 安装

- [安装](./installation.zh.md)定义内嵌组件、安装、更新、干净卸载和兼容性。

## Skill 行为

- [Skill 行为](./skill.zh.md)定义 Agent 何时使用 tk、授权、任务导航、WAL 记录和材料组织。

## 维护

- [验证](./validation.zh.md)说明验证方法和场景。
- [文档](./documentation.zh.md)定义公开文档归属、双语维护、链接和当前状态写法。
- [术语表](./GLOSSARY.zh.md)定义产品特殊术语和固定中文形式。
