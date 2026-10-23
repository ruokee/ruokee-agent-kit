# 更新记录

[English](./CHANGELOG.md)

## 0.1.0

`@ruokee/omp-smart-context` 首次交付：

- 在一个自包含包中提供 Remote 及 Handoff 请求对齐、压缩请求用量补记、可选模型提示词规则和可选 Pin。
- 保留独立开关和失败边界。Pin、模型规则默认关闭，用量补记默认开启。
- 使用一次原生激活快照，以 `/smart-context` 提供只读状态。保留 `/ctx-pin`、`ctx_pin`、既有规则文件及受支持 Pin 日志记录。
- 替换 smart-cache、独立 context-pin 和 QoL 迁出模块。按[迁移说明](./docs/migration.zh.md)处理，包括在两级配置中将 `compactionCacheProvider` 迁至 `compactionCacheProviderFilter`。筛选不选择模型或路由，旧键不是别名。
