# 材料模式

这些模式用于组织普通 Task 文件。它们不会增加运行时状态、schema 字段、生命周期值或自动索引。项目指令的优先级高于这些模式。

仅在材料确有需要时选择相应模式。不要预先创建空结构。

## 临时记事区

使用临时记事区记录短期笔记，不要将其作为最终交付物。

```text
scratchpad.md
```

当其中有用的信息已移入 `TASK.md` 或持久材料后，删除或替换该文件。

## 研究材料包

当工作需要保留来源、证据、论断边界和未解决的问题时使用。

```text
research/
├── sources.md
├── findings.md
└── open-questions.md
```

记录来源位置，并明确区分观察到的事实和推断。

## 设计修订

当多个设计依次取代彼此，并且读者需要一个当前入口时使用。

```text
design/
├── README.md
├── revision-1.md
└── revision-2.md
```

README 应指出当前修订，并说明旧修订的状态。`TASK.md` 应链接到当前入口，而不是复制设计内容。

## 审查记录

当需要保留独立审查意见、分歧和处置事项时使用。

```text
records/
├── reviewer-a.md
├── reviewer-b.md
└── disposition.md
```

将审查者的观察与最终处置结论分开记录。处置结论应说明哪些发现改变了最终结果。

## 验证证据

当验收依赖可重复执行的命令、环境详情、观察结果以及通过或失败的判断时使用。

```text
validation/
├── environment.md
├── commands.md
└── results.md
```

只记录复现该判断所需的证据。不要将常规命令输出作为永久材料保存。
