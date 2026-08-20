# 函数式核心，命令式外壳（Functional Core, Imperative Shell）

## 什么是函数式核心，命令式外壳

函数式核心、命令式外壳（Functional Core, Imperative Shell）是一种由 Gary Bernhardt 推广的架构。它将程序分为两个具有不同规则的层。*核心*包含纯决策逻辑：给定输入数据，计算输出数据，不产生任何副作用——没有 I/O、没有时钟读取、没有随机性、没有网络、没有数据库、没有全局变更。*外壳*是与外部世界通信的薄命令式层：它读取输入，调用核心来决定应该发生什么，然后执行核心请求的副作用。

其洞察是：使代码难以测试和推理的几乎从来不是算术或分支——而是对环境的依赖。一个决定订单*是否*可以发货的函数很容易测试；一个决定并同时扣款、写数据库行和发送电子邮件的函数则不然。将环境推到边缘，有趣的逻辑就变得纯、完全且易于测试。

这不是一个官方的 Python 概念，但它自然地与 Python 的多范式风格以及 [imperative.md](./imperative.md) 中描述的入口点边界规范相结合。

## 底层假设

- 系统中测试成本高的部分是其副作用和环境耦合，而不是其计算。
- 一旦副作用被推到边界，核心就可以用纯数据输入、纯数据输出进行测试——无需模拟、无需固件、无需修补时钟。
- 外壳仍然需要真正的设计工作，因为事务、重试、错误处理、日志记录和资源生命周期都生活在那里。

## 优势

- **可测试性。** 核心测试是基于示例的：传入数据，断言返回的数据。没有 I/O 设置，没有模拟框架，快速且确定性。这是最大的收益。
- **可推理性。** 纯函数的行为完全由其参数决定。你可以在隔离中理解它，而无需追踪它触及了什么全局状态或外部服务。
- **可组合性。** 纯函数组合得很干净——一个的输出馈入下一个，没有隐藏的顺序约束。外壳一次性显式地编排不纯的步骤。

## 何时应用

在有趣的决策可以与执行行为分离的任何地方应用它：

- 领域规则：定价、资格、权限检查、状态转换（参见 [state-machine.md](./state-machine.md)，其中 `(state, event) -> new_state` 归约器是教科书式的函数式核心）。
- 输入在接触持久化之前的验证和规范化。
- 数据转换管道，其中转换规则是纯的，只有读/写端点是不纯的。
- CLI 和请求处理器：外壳解析参数或 HTTP、组装依赖、调用纯规划器；核心返回决策或要完成的工作描述。

一个有用的模式是让核心返回一个副作用的*描述*（一系列命令、一个事件、一个类型化结果），并让外壳执行它们。核心决策；外壳执行。

```python
# 核心：纯函数，无 I/O——用数据输入数据输出即可轻松测试
def plan_discount(cart: Cart, customer: Customer) -> DiscountPlan:
    if customer.tier == "gold" and cart.total > 100:
        return DiscountPlan(percent=15, reason="gold-large-order")
    return DiscountPlan(percent=0, reason="none")


# 外壳：命令式，拥有 I/O、事务、日志
def apply_discount(cart_id: str, customer_id: str) -> None:
    cart = repo.load_cart(cart_id)          # I/O
    customer = repo.load_customer(customer_id)  # I/O
    plan = plan_discount(cart, customer)    # 纯决策
    repo.save_discount(cart_id, plan)       # I/O
    logger.info("applied %s", plan.reason)  # I/O
```

`plan_discount` 的测试构造一个 `Cart` 和 `Customer`，调用函数，并断言返回的 `DiscountPlan`——没有数据库，没有模拟，没有修补时钟。折扣规则的每个分支都可以通过单行设置来覆盖。相比之下，外壳通过少量集成测试进行测试，或者薄到可以通过阅读来验证。

## 何时严格纯函数适得其反

- **I/O 密集型胶水代码。** 其全部工作就是在两个系统之间移动字节的代码几乎没有可提取的纯决策。强行将函数式核心套用到它上面会产生一个空洞的核心和一个隐藏了真实复杂性的臃肿外壳。
- **简单的 CRUD。** 当操作是"读取行、更新字段、写入行"时，没有有意义的决策需要隔离。直接的命令式函数比人为的拆分更清晰。
- **复制成本高昂的数据。** 严格纯函数禁止变更，因此天真的核心可能会重复复制大型结构。当该成本占主导地位时，允许在原本纯的函数内部进行局部变更，或者在该接缝处放宽纯性。
- **贫血核心。** 如果拆分后留下了一堆不再说领域语言的小型纯函数，那么你就用教条换来了清晰。保持核心以领域术语表达。

需要注意的失败模式是外壳太薄，以至于事务、错误处理和可观测性无处容身，从而泄漏回框架回调中。外壳是一个真实的层，而不是一个包装器。

## 边界在哪里

画好这条线是整个技能。接缝正好位于基于已有数据做出决策的地方。先把决策所需的所有内容*读取*进来，在核心中做决策，然后根据决策执行操作——不要将读取和决策交织在一起，因为每次将读取拉到逻辑中间都会把环境拖回核心。

一个常见的改进是让核心返回*描述*效果的数据，而不是一个裸值：

```python
# 核心返回应该发生什么的描述——仍然是纯函数
def plan_effects(order: Order, now: datetime) -> list[Effect]:
    if order.is_overdue(now):
        return [ChargeLateFee(order.id), NotifyCustomer(order.id, "overdue")]
    return []


# 外壳解释这些描述——唯一实际触发效果的地方
def process(order_id: str) -> None:
    order = repo.load(order_id)
    for effect in plan_effects(order, datetime.now(tz=UTC)):
        execute(effect)
```

现在，就连*选择*执行哪些效果也是可测试的，而无需实际执行它们：断言返回的列表即可。外壳缩小为一个愚蠢的解释器，所有有趣的分支都在核心中。这与 [state-machine.md](./state-machine.md) 归约器返回 `(next_state, actions)` 时的形状相同。

时钟 `datetime.now(tz=UTC)` 在外壳中读取，并作为 `now` *传入*核心。这一举措就是保持时间相关规则纯且确定性可测试的原因。

## 在 Python 中

- 入口层可以使用 argparse、Click、Typer、FastAPI 或 Django，但核心业务函数不应依赖框架对象——跨边界传递纯数据。
- 在边界处使用 `dataclass`、`TypedDict`、Pydantic 模型或普通字典承载数据，根据项目的复杂性选择（参见 [data-oriented.md](./data-oriented.md)）。
- 将不稳定的依赖项——时钟、随机性、文件系统、HTTP 客户端、数据库会话——作为函数参数、构造函数参数、小型 `Protocol` 或通过组合根注入，而不是在核心内部获取它们。
- 核心应接受纯数据并返回纯数据；外壳拥有 `with`/`async with` 资源生命周期（参见 [resource-lifecycle.md](./resource-lifecycle.md)）。

## 与其他范式的交互

- 直接建立在 [imperative.md](./imperative.md) 之上：外壳*就是*命令式编排层，有意保持薄薄的一层。
- 纯核心是 [data-oriented.md](./data-oriented.md) 思维发挥价值的地方——纯数据输入，纯数据输出。
- 对于生命周期逻辑，核心中的纯归约器加上执行效果的外壳是构建 [state-machine.md](./state-machine.md) 最清晰的方式。
