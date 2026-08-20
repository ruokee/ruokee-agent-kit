# 面向对象编程（Object-Oriented Programming）

## 什么是面向对象编程

面向对象编程（Object-Oriented Programming）将状态、行为和不变量组织到对象中，并通过对象的协作来表达系统行为。一个对象将数据与允许对该数据进行的操作捆绑在一起，并且理想情况下保证数据在所有公共操作中保持有效；其不变量得以维持。Python 完全支持 OO，但并非强制：函数、模块和纯数据是同样一流的选择。

OO 的价值最高的时候是当某个概念具有长期存在的身份、必须保持一致性的内部状态以及一组应当属于一起的操作时。其价值最低的时候是当你进行一次性计算或在不同形状之间传输数据时：此时，函数或纯记录更清晰。

## 底层假设

- 当一个概念具有持久的身份、内部状态、不变量和相关行为时，将其建模为对象可以将保护这些不变量的逻辑集中在一个地方。
- 对象的接口应该表达*含义*，而不是暴露其内部存储布局。
- 继承用于建模真正的子类型关系或框架扩展点；实现的重用更适合通过组合来实现。

## 何时适用

- 领域实体、值对象、资源对象、外部客户端、策略对象、插件对象。
- 必须维护不变量的对象：状态机、金额、时间范围、权限规则、有界缓冲区。
- 具有明显生命周期的对象：连接池、事务、缓存、任务运行器。
- 多态：一个接口后的多个实现，在运行时选择。不过在 Python 中，使用 `Protocol` 加普通函数通常可以用更少的仪式表达这一点。

判断"这应该是对象吗"的测试是：将数据与其操作捆绑是否*保护了一个否则将成为每个人责任的不变量*。一个拒绝添加两种不同货币的 `Money` 类型，或一个拒绝构造 `end < start` 的 `DateRange` 类型，因其保证集中在一处且没有任何调用者可以绕过而值得成为一个类：

```python
@dataclass(frozen=True)
class DateRange:
    start: date
    end: date

    def __post_init__(self) -> None:
        if self.end < self.start:
            raise ValueError("end must not precede start")

    def overlaps(self, other: "DateRange") -> bool:
        return self.start <= other.end and other.start <= self.end
```

系统中的每个 `DateRange` 在构造时就是有效的，重叠规则与它操作的数据共存。对比一个普通的字典 `{"start": ..., "end": ...}`，其有效性需要每个调用者重新检查。

## 常见错误

- **万物皆类。** 将简单的纯计算和数据转换强行塞入不持有任何状态的类。一个函数模块更清晰。
- **贫血模型。** `Manager`、`Service` 和 `Helper` 类吸收了所有行为，而"领域对象"被简化为一个公共字段的袋子。数据及其治理规则被分割开来：与 OO 的目的背道而驰。参见 [tell-dont-ask](variants/zh/skills/code-quality/references/design-principles/tell-dont-ask.md)。
- **深层继承。** 使用子类化来共享实现而不是替代行为。每一层增加了 MRO 复杂性和隐藏的耦合。优先使用组合；参见 [composition-over-inheritance](variants/zh/skills/code-quality/references/design-principles/composition-over-inheritance.md)。
- **套用 Java/C++ 的仪式。** 为每次协作引入接口、抽象基类和工厂层，而 Python 会使用函数、小型 `Protocol` 或 `dataclass`。

贫血模型陷阱值得具体看看。贫血版本将规则分散到每个调用者：

```python
# 贫血：规则"不能提取超过余额"存在于调用者中
@dataclass
class Account:
    balance: int

def withdraw(account: Account, amount: int) -> None:
    if amount > account.balance:      # 每个调用者都必须记住
        raise ValueError("insufficient funds")
    account.balance -= amount
```

封装版本拥有该规则，因此没有调用者可以违反它：

```python
@dataclass
class Account:
    _balance: int

    def withdraw(self, amount: int) -> None:
        if amount > self._balance:
            raise ValueError("insufficient funds")
        self._balance -= amount
```

区别不在于风格。在第一种形式中，忘记检查的新调用者会破坏余额；在第二种形式中，不变量无法被绕过。这就是 [tell-dont-ask](variants/zh/skills/code-quality/references/design-principles/tell-dont-ask.md) 原则的实践。

## Python 特定

- 对于简单的数据载体使用 `@dataclass`；当存在真正的不变量或需要管理的生命周期时，才使用普通类。参见 [data-oriented.md](./data-oriented.md)。
- 对于跨边界的可替代性，优先使用小的 `typing.Protocol`（结构类型化）而不是名义基类。协作者只需提供正确的方法。
- **数据模型（dunder 方法）** 是对象接入语言的方式：值对象使用 `__repr__`、`__eq__`、`__hash__`；容器使用 `__iter__`、`__len__`、`__contains__`；资源使用 `__enter__`/`__exit__`；可调用策略使用 `__call__`。只有当对象确实具有该语义时才实现它们：不要发明未文档化的 dunder。
- `property` 用于隐藏存储差异或暴露轻量级派生值，而不是用于隐藏昂贵的副作用，如 I/O、网络调用或数据库查询。
- **描述器（Descriptor）**（`property`、方法、ORM 字段、验证器背后的协议）集中化属性访问行为。它们功能强大且容易过度使用；将它们保留在框架/边界代码中，不要散布在业务逻辑中。对于普通字段验证，优先使用 `__post_init__`、Pydantic 或普通构造函数。
- 保持混入（mixin）小、无状态且命名清晰。多重继承会迅速将 MRO 变成隐式的复杂性。

## 与其他范式的关系

一个具有不变量且生命周期较长的对象，通常最好与 [state-machine.md](./state-machine.md) 配对以管理其生命周期。其方法内部的决策*逻辑*仍然可以是纯的，并推向 [functional-core.md](./functional-core.md)。"更面向对象"从来不是目标；目标是将状态、不变量和行为放在它们所属的边界处。
