# 维护

对 `check`、rename、schema 迁移、表示切换和 GC 使用公开命令。这些操作报告当前事实，不提供回滚或续跑令牌。

## Check

`tk check` 是只读操作。它会验证项目配置、规范 Task 载体、schema、表示方式、路径、UUID、关系、WAL、活动操作标记和清理清单。

必要的 I/O 失败会停止扫描并返回不完整结果。完成所有必要读取后发现的格式或领域诊断，会产生完整但失败的 check 结果。check 不会修复文件。

## Rename

```sh
tk rename <task_ref> <name> --dry-run
tk rename <task_ref> <name>
```

rename 会规范化名称，计算一个不会覆盖现有内容的目标路径，报告 Markdown 引用，移动目录，更新元数据，并追加 WAL。它绝不会重写引用。对已经满足的 rename 重复执行时，不会产生任何变更。

## Schema 迁移

```sh
tk metadata migrate [--file <carrier>]... [--to <version>] [--dry-run]
```

迁移会通过每个相邻转换器，将已发布的 schema 逐步向前迁移。它会拒绝降级、缺失版本、未知版本和缺失转换器。迁移会预先验证所有选中的载体，保留 split 和 embed 正文，按确定性顺序提交，并跳过已经达到目标版本的载体。

## 表示切换

```sh
tk metadata switch --to split|embed [--dry-run]
```

切换操作会验证并规划每个 Task，按确定性顺序提交 Task，然后更新项目配置。它不会追加 Task WAL。

## 部分失败

迁移、切换、rename、批量创建和组件生命周期操作，会在遇到第一个普通 I/O 错误或取消点时停止。检查 `completed`、`uncompleted` 和原始错误。在重新发出新的完整命令之前，先 read 或 check 规范状态。不要假定操作已经回滚，也不要假定领域操作状态得到了保留。

## GC

```sh
tk gc --dry-run
tk gc
```

GC 只会删除最小清理清单中记录的 tk 临时路径，而且仅在创建这些路径的进程已经结束后才会删除。对于仍在活动的进程、逸出范围的路径、符号链接、未知清单，以及无法证明属于 tk 的内容，GC 都会予以保留。

GC 不会继续、完成、回滚或修复任何 Task、迁移、rename、安装、update 或卸载操作。它不会修改 Task 元数据、正文、WAL、项目配置或 Harness 配置。
