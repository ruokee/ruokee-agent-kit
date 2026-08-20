# 依恋情结（Feature Envy）

## 什么是依恋情结

依恋情结是一个方法似乎对另一个对象比对自己所属的对象更感兴趣。它深入到另一个对象中，取出其若干数据，并做本应由该对象自己完成的计算。该方法"嫉妒"它正在操作的类的特性。经典的形态是 `A` 上的一个方法调用 `b.x`、`b.y`、`b.z` 并组合它们，而几乎不碰 `A` 自己的状态。

这个坏味之所以重要，是因为它将行为放在了错误的位置。逻辑依赖于另一个对象的内部，因此当那些内部变化时，这个远方的方法也会被破坏：本不应存在的耦合。而拥有数据的对象则变得贫血，成为一个装字段的袋子，而属于它的操作却在别处。这是行为应与其所需数据共存这一原则的逆反（参见 [tell-dont-ask](variants/zh/skills/code-quality/references/design-principles/tell-dont-ask.md) 和 GRASP 的信息专家，[grasp](variants/zh/skills/code-quality/references/design-principles/grasp.md)）。

## 信号

审视一个方法，数一数它触碰了谁的数据。如果它访问另一个对象的字段和方法比自己对象的多，那就是依恋。一个可靠的具体信号是一系列 `other.a`、`other.b`、`other.c` 馈入一个计算，尤其是当这些访问是[得墨忒耳定律](variants/zh/skills/code-quality/references/design-principles/law-of-demeter.md)的火车残骸链时，调用方穿过它不应知道的结构进行访问。

```python
# Envious: the method lives on Order but is all about customer.address
class Order:
    def shipping_label(self) -> str:
        c = self.customer
        return f"{c.address.street}, {c.address.city} {c.address.postal_code}"
```

计算完全关于地址；它想住在 `Address`（或 `Customer`）上，而不是 `Order`。

## 该怎么做

通常的补救措施是 [move-function.md](./move-function.md)：将方法移动到它所嫉妒的数据所在的对象上。如果只有部分方法是依恋的，先使用 [extract-function.md](./extract-function.md) 隔离那部分，然后移动提取出来的片段。移动后，原始调用点请求正确的对象来完成工作（`address.formatted()`），对内部结构的依赖消失了。

指导问题是信息专家问题：哪个对象持有此逻辑所需的数据？将逻辑放在那里。结果通常是更少的耦合、更丰富的对象，以及读起来像请求而不是审问的调用点。

## 何时可接受

依恋情结是一个启发式，不是一条法则。以下几种合法模式看起来像依恋，应保持不变：

- **工具函数和纯函数。** 一个函数的工作就是操作传递给它的数据，格式化器、序列化器、对值对象的计算，它*应该*使用那些数据。将其移到数据类上并不总是更好，尤其是在功能风格中，行为存在于接受数据作为输入的命名函数中。函数核刻意将数据与操作数据的函数分离。
- **横切关注点。** 日志、指标、授权和事务处理必然接触其他对象的数据来完成工作。这是它们的本质，不是错位。
- **数据传输和映射。** 一个从对象 `A` 读取并构建对象 `B` 的映射器将不可避免地访问很多 `A` 的字段。这是映射器的意义所在；这不是依恋。
- **数据是一个透明记录。** 从一个没有不变量的 `dataclass` 或 DTO 中取出字段是可以的；没有行为被遗弃，因为这个记录从来就不打算拥有行为。Tell-Don't-Ask 对读模型和 DTO 的例外在此适用。
- **移动会产生更糟的耦合。** 如果"拥有"对象是一个稳定的第三方类型或你不想由于一个调用方的关注点而使其膨胀的类，将逻辑留在原地可能是较小的代价。

判断在于行为是依赖于另一个对象的*内部*（移动它）还是仅仅*消费其公共数据作为输入*（通常没问题）。基本类型偏执模式常常隐藏依恋：当行为嫉妒一个无法拥有方法的基本类型时，真正的修复是引入一个可以拥有方法的值对象：参见 [primitive-obsession.md](./primitive-obsession.md)。
