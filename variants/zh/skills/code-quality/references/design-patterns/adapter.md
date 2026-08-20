# 适配器（Adapter）

## 意图（Intent）

将现有对象的接口转换为调用方期望的接口，使两个本非为协作设计的事物可以在任何一方不做修改的情况下协同工作。

## 解决的问题

你依赖一个类，第三方 SDK、遗留模块、外部服务客户端、原始数据库行，它的接口与你代码所需的不匹配。你可以重写调用方以适应外来接口，但这会将依赖散布到各处，并将你的领域耦合到一个你无法控制的形态。适配器将不匹配限制在一个包装对象中。调用方看到的是你拥有的稳定接口；适配器负责翻译。

这是依赖反转原则（Dependency Inversion Principle）的运行时表达：高层代码依赖它定义的抽象，适配器使具体的外部事物满足该抽象。

## 结构和参与者

- **目标（Target）**：客户想要使用的接口（在 Python 中，通常是一个 `Protocol` 或非正式的鸭子类型约定）。
- **适配者（Adaptee）**：具有不兼容接口的现有对象。
- **适配器（Adapter）**：实现 Target 并把调用转发给 Adaptee 的对象，在边界处翻译数据和错误。
- **客户（Client）**：使用 Target 且从未看到 Adaptee 的代码。

经典的区分是**对象适配器**与**类适配器**。对象适配器*持有*适配者作为属性并委托给它；类适配器*继承*目标和适配者两者。对象适配器几乎总是被优先选择，因为它们通过组合而非纠缠继承，能与非你创建的适配者实例一起工作，并且可以适配多个适配者。类适配器需要多重继承，并在定义时绑定到适配者的类。在 Python 中，优先选择对象适配器；只有当你确实需要成为适配者的子类型时才使用继承。

## Python 惯用实现

持有适配者并在边界处翻译：

```python
class PaymentGateway(Protocol):
    async def charge(self, order: Order) -> PaymentResult: ...


class StripeGateway:
    def __init__(self, client: StripeClient) -> None:
        self._client = client

    async def charge(self, order: Order) -> PaymentResult:
        try:
            response = await self._client.create_charge(order.total_cents)
        except StripeError as exc:
            raise PaymentDeclined(order.id) from exc
        return PaymentResult.from_stripe(response)
```

适配器不必是类。将外部字典映射到领域 `dataclass` 的薄函数也是一个适配器。鸭子类型也消除了许多适配器的需求：如果一个对象已经拥有你需要的方法，你不需要仅仅为了满足名义上的接口而包装它。

## 何时使用

- 隔离第三方 SDK、遗留 API 或外部服务，使其余代码依赖你的接口而非它们的接口。
- 将多个不同后端（支付提供商、存储驱动、通知渠道）标准化为统一契约。
- 在系统边界处转换数据表示，线格式、ORM 行、协议消息，为领域类型。

## 何时不使用

- 接口已经匹配，或者鸭子类型使对象可以直接使用。只重命名方法的包装器纯粹是开销。
- 你实际上需要的是围绕你的需求设计*新的*接口，而不是翻译现有接口；那就直接编写该接口，而不是包装旧接口。
- 适配者是你自己的且你可以修改它。修复源头而不是永久包装它。

## 失败模式

- **泄漏的或透传的适配器**：一对一转发调用而没有任何翻译，增加了无谓的跳转和文件浏览。
- **过度隐藏**：吞掉适配者的错误、重试、超时和性能特征，使调用方无法正确反应。适配器应翻译失败语义，而非擦除它们：将 `StripeError` 映射到领域中的 `PaymentDeclined`，而不是返回 `None`。
- **臃肿的适配器**：积累了业务逻辑。适配器负责翻译；一旦它开始做决策，它就变成了别的东西，应相应重新命名。

## 与其他模式的关系

适配器改变接口而不改变行为；[decorator.md](./decorator.md) 保持接口并添加行为；[facade.md](./facade.md) 为多个对象定义新的更简单的接口而非翻译一个。适配器和 [strategy.md](./strategy.md) 经常一起出现：适配器满足的 `Protocol` 常常是策略所插入的同一个抽象。对于类型驱动的值转换，`functools.singledispatch` 可以作为轻量级的适配器分发。
