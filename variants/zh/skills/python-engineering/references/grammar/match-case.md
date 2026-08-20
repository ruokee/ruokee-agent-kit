# 结构化模式匹配

`match`/`case`（Python 3.10+，[PEP 634](https://peps.python.org/pep-0634/)）根据值的*形状*（shape）解构值，并从匹配的部分中绑定名称。它是一种声明式的方式来拆解结构化数据，而不是 `if`/`elif` 的修饰性替代品。

## 它是什么

`match` 语句将一个主体值（subject）与一系列模式（pattern）进行比较。第一个匹配的模式执行其代码块；模式中的名称绑定到主体值的对应部分。与许多语言中的 `switch` 不同，case 不是常量标签——它们是可以同时检查类型、结构和内容的模式。

```python
match command:
    case "quit":
        stop()
    case ["move", direction]:
        move(direction)
    case {"action": action, "target": target}:
        dispatch(action, target)
```

模式不会穿透（fall through）。恰好只有一个代码块执行，如果没有匹配且没有通配符，则一个也不执行。

## 语法形式

字面量模式（Literal pattern）通过相等性匹配常量（`case 0:`、`case "quit":`、`case None:`）。`True`、`False` 和 `None` 通过身份（identity）匹配。

捕获模式（Capture pattern）是一个裸名称；它始终匹配并绑定主体（`case x:`）。裸的 `case _:` 是通配符（wildcard）——它匹配任何内容但不绑定任何内容，充当默认分支。

值模式（Value pattern）使用点号名称，使得命名常量被读取而非重新绑定：`case Color.RED:`。普通名称会捕获；点号使其成为比较。

序列模式（Sequence pattern）按长度和位置匹配列表和元组，`*rest` 吸收中间或尾部：`case [first, *rest]:`。它匹配任何 `Sequence`，但不包括 `str`、`bytes` 和 `bytearray`。

映射模式（Mapping pattern）匹配选定的键并忽略其余部分：`case {"action": action}:`。`**rest` 捕获剩余的键值对。缺失的键会使匹配失败。

类模式（Class pattern）匹配类型和属性：`case Point(x=0, y=y):`。像 `Point(0, y)` 这样的位置子模式依赖类的 `__match_args__`；关键字子模式则不需要。

OR 模式从左到右尝试替代项：`case "y" | "yes":`。每个替代项必须绑定相同的名称。

守卫（Guard）添加一个布尔条件，仅在模式结构匹配之后才运行：`case [x, y] if x == y:`。守卫失败则继续下一个 case。

模式可以自由嵌套，因此 `case Response(status=200, body={"items": [first, *_]}):` 在一次表达式中匹配类型、属性值、嵌套映射键和非空序列。

## 何时优于 if/elif

当分支依赖于数据的*结构*而非单个标量值时，`match` 才有用武之地：

- 解析或遍历异构树（AST 节点、JSON 类文档、协议消息）。
- 根据结果的形状进行分发：一种长度与另一种长度的元组、包含某些键的映射、一个类的实例与另一个类的实例。
- 代数风格的处理，其中每个变体是一个不同的数据类，每个 case 提取不同的字段。

在这些情况下，替代方案是一堆 `isinstance` 检查加上手动索引和 `.get()` 调用。`match` 将类型测试、结构测试和提取合并为一个可读的代码块，并且仅在有效的分支上绑定名称。

## 何时不适用

`match` 被误用的频率比看起来更高。在以下情况中请使用更简单的方式：

- 分发基于单一值且结果集已知。使用将键映射到处理函数的字典（`handlers[key]()`）更清晰、可在运行时扩展且可独立测试。用它代替一长串字面量 case 的 `match`。
- 逻辑是一个简单的布尔决策。两三个普通条件用 `if`/`elif` 表达更易读；`match` 增加了仪式感却没有结构可挖掘。
- 你在建模一个状态机。转换表（transition table）——`(state, event) -> next_state`——将状态和转换作为数据保存，你可以枚举、验证和绘制图表。`match` 将这些转换埋藏在控制流中，使你无法看到完整的图。参见[状态机建模](skills/code-quality/references/programming-paradigms/state-machine.md)了解显式转换的重要性。

经验法则：如果没有结构需要解构，`match` 很可能是错误的选择。

## 穷尽性

Python 在运行时并不强制穷尽性（exhaustiveness）——未匹配的主体只是穿透而不报错，这可能会隐藏错误。两种习惯用法可以解决这个问题：

- 添加显式的 `case _:`，当意外值到达时抛出异常，将静默穿透转变为显式失败。
- 让类型检查器推断穷尽性。当对封闭集合（如 `Enum` 或数据类的联合体）进行匹配时，检查器可以标记遗漏的 case。在默认分支中配合使用 `assert_never(unreachable)`，使预期的穷尽性显式化，并让检查器验证它。

这种配对——封闭类型加 `assert_never`——将 `match` 从便利工具转变为可检查的契约。

## 典型用途

好：将解析后的消息解构为命令变体；处理小型 AST 的每种节点类型；匹配 `(status, payload)` 结果形状；使用映射和序列模式解包嵌套的配置结构。

差：替换字典查找；表达双向布尔逻辑；编码状态转换；仅为了调用对象本可以多态暴露的方法而匹配值的运行时类型。

一个微妙的代价：`case` 中绑定的名称在 `match` 块之后仍保留在作用域中，因此过宽的捕获模式可能泄漏令人意外的绑定。优先使用特定模式和关键字子模式而非位置子模式，除非位置顺序是该类型契约中稳定且文档化的部分。
