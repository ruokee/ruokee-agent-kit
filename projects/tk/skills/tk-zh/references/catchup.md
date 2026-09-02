# 掌握 Task 上下文

当用户要求 catchup、交接上下文或总结现有 Task 时，使用本参考。

## 先解析 Task

完整 UUIDv7 或准确的 Task 路径可以直接 read。名称、UUID 前缀、分支线索、文本、regex 或材料路径必须通过 search 解析。如果仍有多个合理候选项，列出这些候选项并请用户选择。

首先使用 `view = "summary"`。如果只需了解受管状态，使用 metadata。只有在需要完整正文或限定范围的 WAL 时，才使用 detailed。detailed read 使用 `wal_max_entries` 和 `wal_max_length`。应报告截断情况，不要将旧 WAL 复制到 `TASK.md` 中。

## 重建当前上下文

报告：

1. 目标；
2. 当前状态和 closed 祖先；
3. 仍然适用的约束和决定；
4. 会影响下一步行动的依赖项和相关工作；
5. 阻碍因素和未解决的问题；
6. 材料入口；
7. 下一项具体行动。

将 `TASK.md` 视为当前事实，将 WAL 视为历史证据。后续修正优先于较早的 WAL 条目。不要仅仅因为旧计划曾被记录，就把已经失效的旧计划当作当前计划。

从 `TASK.md` 中的链接或目录 README 开始，逐步 read 普通材料。不要递归枚举整个 Task 目录。

## 只读边界

catchup 本身不得 create、update、log、rename、migrate、close、reopen 或编辑文件。read closed Task 并不代表获准 reopen。

如果用户还要求执行后续工作，先完成 catchup，然后按照常规的 create、update、log 和授权规则继续。
