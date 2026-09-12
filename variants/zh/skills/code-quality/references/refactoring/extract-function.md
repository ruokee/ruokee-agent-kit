# 提取函数（Extract Function）

## 什么是提取函数

提取函数（Extract Function）将一段代码片段转变为它自己的命名函数，并用调用替换该片段。这是最常见的重构，也是 [long-function.md](./long-function.md) 的主要解药。Fowler 的指导原则是关于*意图*：如果你需要花费精力理解一段代码块在做什么，就将其提取为一个以*做什么*命名的函数，而不是*怎么做*。然后名称承载含义，函数体容纳机制。

```python
# before
def print_owing(invoice):
    outstanding = 0
    for order in invoice.orders:
        outstanding += order.amount
    print(f"name: {invoice.customer}")
    print(f"amount: {outstanding}")

# after
def print_owing(invoice):
    outstanding = calculate_outstanding(invoice)
    print_details(invoice, outstanding)
```

## 何时提取

- **一个连贯的阶段。** 一个执行更大序列中一个可识别步骤的代码块：验证输入、计算总计、格式化输出。提取每个阶段将一堵代码墙转化为可读的摘要。这配合拆分阶段（Split Phase）使用。
- **一个命名的概念。** 一个具有领域含义的条件或计算，值得命名：`is_overdue(invoice)` 比原始的日期比较更易读，并且名称变得可搜索。
- **一个策略。** 可能变化或复用的逻辑，评分规则、重试策略，作为可以传递或交换的函数受益。参见 `skills/code-quality/references/design-patterns` 中的策略模式（Strategy）。
- **混合的抽象层级。** 当高层意图和底层机制并排放置时，提取机制能恢复调用方中一致的层级。

## 命名提取的函数

名称是重构的点。根据结果或意图命名：`calculate_outstanding`，而不是 `loop_orders`。如果你找不到一个好名称，这表明该片段不是一个连贯的单元；要么你抓错了边界，要么代码在提取前需要重新思考。一个好的名称使调用点读起来像一个句子。

## 参数决策

传入函数需要的内容，返回它产生的内容。优先使用小的参数列表。如果你发现自己传递许多总是同时出现的值，那就是一个数据泥团（Data Clump）：考虑引入一个小对象（参见 `primitive-obsession.md`）而不是长的签名。避免传递一个使函数做两件事之一的标志；这通常意味着两个函数隐藏在一个之中。

## 保持行为不变

提取不得改变可观察行为。注意在片段内部被修改且之后被使用的变量；它们成为返回值，或者如果有多个，说明边界不对。注意在单独函数中不再有意义的早期返回、`break` 和 `continue`。提取后运行测试；参见 [safe-refactoring.md](./safe-refactoring.md)。IDE 的"提取方法"功能机械地且安全地处理了大部分工作。

## 何时不提取

- 代码内联时已经清晰，并且读起来处于单一抽象层级。
- 提取会产生一个[薄包装](./thin-wrapper-function.md)：一个名称仅仅复述一个表达式、只有一个调用方且没有边界的函数。
- 片段与周围状态纠缠在一起，使得提取后的签名会有许多参数和返回值。先解开纠缠，或重新考虑接缝。

提取是可逆的：如果后来的阅读表明提取反而模糊了，使用 [inline-function.md](./inline-function.md) 将其折叠回去。
