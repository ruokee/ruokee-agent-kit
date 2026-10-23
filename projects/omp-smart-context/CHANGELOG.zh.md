# 更新记录

[English](./CHANGELOG.md)

## 0.1.2

- 澄清 Pin 保留指引，不再仅因信息存续时间短就排除它。

## 0.1.1

- 按信息对后续行动的用途，明确 Agent 何时主动固定、更新、删除或保持不变。
- 容量拒绝针对实际超限原因，要求缩短过大的正文或清理分支中的失效内容，保留有效信息，并在重试前复核整个活跃集合。

## 0.1.0

`@ruokee/omp-smart-context` 首次交付：

- 在一个自包含包中提供 Remote 及 Handoff 请求对齐、压缩请求用量补记、可选模型提示词规则和可选 Pin。
- 保留独立开关和失败边界。Pin、模型规则默认关闭，用量补记默认开启。
- 使用一次原生激活快照，以 `/smart-context` 提供只读状态。保留 `/ctx-pin`、`ctx_pin`、既有规则文件及受支持 Pin 日志记录。
- 替换 smart-cache、独立 context-pin 和 QoL 迁出模块。按[迁移说明](./docs/migration.zh.md)处理，包括在两级配置中将 `compactionCacheProvider` 迁至 `compactionCacheProviderFilter`。筛选不选择模型或路由，旧键不是别名。
