# 薄包装（Thin Wrapper / Trivial Helper）

## 什么是薄包装

薄包装是这样一种函数：其整个函数体只是转发到另一个函数、重命名调用或包装单个表达式，而不增加任何语义价值。它没有隐藏复杂性、建立边界或执行不变量。它只是添加了一个名字和一层间接。

```python
def get_user_name(user):
    return user.name  # adds nothing the caller couldn't see

def fetch_data(url):
    return requests.get(url)  # renames one call, hides nothing
```

这个坏味不是"这个函数很短"。很多短函数是优秀的：一个命名良好的单行函数捕捉了一个领域概念（`is_eligible_for_refund`）就物有所值。坏味是*缺少新增的含义*：包装耗费了一个名字、一次跳转和一个栈帧，却没有回报任何东西。

这个坏味在代理生成的代码中大量出现，"消除重复"或"改善可读性"的冲动会产生一大堆单行辅助函数，每个只转发一个调用。结果是代码需要在许多定义之间跳转才能理解，而阅读原始的内联表达式本会更清晰。它与 `duplicated-code.md` 和 [`variants/zh/skills/code-quality/references/design-principles/dry.md`](../design-principles/dry.md) 中描述的错误 DRY 失败模式密切相关。

## 何时包装函数**有价值**

当包装函数做了转发之外的真正工作时，它才值得存在：

- **在不稳定实现上提供稳定接口。** 如果被包装的库、API 或内部模块可能变化，包装将该变化本地化到一处。这是适配器（Adapter）的思想，参见 `variants/zh/skills/code-quality/references/design-patterns`，这里一个看起来薄的包装实际上是一个小表面的深层模块。
- **测试接缝。** 一个存在以便调用方可以针对 fake 进行测试、或者依赖项可以被注入的函数，即使其主体是琐碎的，也提供了一个替换边界。参见 [`variants/zh/skills/code-quality/references/design-principles/dependency-inversion.md`](../design-principles/dependency-inversion.md)。
- **横切关注点。** 添加日志、重试、缓存、指标或事务边界的包装函数确实增加了行为。这些是装饰器，不是薄包装。
- **命名的领域概念。** `requires_tax_review(order)` 包装一个布尔表达式，使规则可搜索并有一个归属。名字*就是*价值。

## 何时它们是噪声

- 单一调用方且没有抽象边界：内联它。
- 包装函数名称是被包装调用的同义词（`fetch_data` 之于 `requests.get`），未增加领域含义。
- 它参数不变地转发给一个同样命名清晰的函数。
- 它存在只是因为一条风格规则说"提取函数"，而不是因为读者受益。

解决方法是 [inline-function.md](./inline-function.md)：将函数体折叠回调用方并删除包装函数。

## Python 特定说明

Python 中的函数调用不是免费的。每次调用构建一个栈帧，解释器为它做真正的工作。对大多数代码来说这无关紧要：清晰性胜出。但在热路径和紧循环中，围绕每个元素操作的一层薄包装可能在性能分析中显现出来。这是避免它们的次要原因，从来不是主要原因：主要成本始终是毫无回报的间接所带来的认知开销。

## 如何判断

问自己：如果我删除这个函数并将它的函数体内联到每个调用点，代码会变得更难理解或更难变更吗？如果答案是否，它是一个薄包装。如果删除它会将调用方暴露给不稳定的依赖项、散落一条领域规则或破坏一个测试接缝，那它在做真正的工作：保留它。检验标准是它所保护的边界，而不是它的行数。
