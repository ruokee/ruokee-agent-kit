# 生成器（Builder）

## 意图（Intent）

将复杂对象的构造与其最终表示分离，使相同的构造过程可以逐步驱动、在过程中验证，或复用以产生不同的输出。

## 解决的问题

某些对象很难通过单个构造函数调用创建：大量可选参数、分阶段进行的构造、来自多个来源的输入，或依赖于字段组合的验证。将所有内容塞入一个构造函数会产生长长的参数列表、伸缩构造函数，以及验证逻辑与赋值纠缠在一起。生成器为组装过程提供了自己的命名空间，使其可测试、可复用。

## 结构和参与者

经典形式有一个**导演（director）**，它对**生成器（builder）**接口驱动一系列步骤；**具体生成器（concrete builders）**积累状态并生成**产品（product）**。在实践中，导演通常坍缩为一个普通函数，而生成器就是积累部分状态的任何东西。

## 何时使用

- 对象有许多可选参数或几种有效的构造形态。
- 构造分阶段进行，阶段间有中间验证。
- 相同的构造过程必须产生不同的表示（HTML、PDF、JSON）；这是生成器的经典理由。
- 组装逻辑本身值得独立于产品进行命名、测试和复用。

## 何时不使用

- 带命名字段和默认值的记录类型已经说得很清楚了。在简单的值对象上使用流式生成器纯粹是仪式感。
- schema 或模型类型已经提供了从原始数据经过验证的构造。
- 生成器埋藏了大量可变状态，调用顺序很重要却未强制；这比单个构造函数更难推理。

## 失败模式

- 流式生成器如果在必需步骤运行之前调用了 `build()`，可能产生半初始化的产品。在 `build()` 中验证，或将必需字段作为构造函数参数。
- 生成器的可变状态在产品之间共享或复用，导致一次构建泄露到下一次。
- 生成器复制了产品的不变约束，而不是委托给产品自身的验证，导致两者偏离。

## Rust 示例

在 Rust 中，生成器可以通过消费 `self` 的链式方法逐步积累构造选项，再由 `build()` 生成最终值：

```rust
struct RequestBuilder {
    endpoint: String,
    timeout_ms: u64,
    retries: u8,
}

impl RequestBuilder {
    fn new(endpoint: impl Into<String>) -> Self {
        Self {
            endpoint: endpoint.into(),
            timeout_ms: 1_000,
            retries: 0,
        }
    }

    fn timeout_ms(mut self, value: u64) -> Self {
        self.timeout_ms = value;
        self
    }

    fn retries(mut self, value: u8) -> Self {
        self.retries = value;
        self
    }

    fn build(self) -> Request {
        Request {
            endpoint: self.endpoint,
            timeout_ms: self.timeout_ms,
            retries: self.retries,
        }
    }
}

let request = RequestBuilder::new("https://example.com")
    .timeout_ms(2_000)
    .retries(3)
    .build();
```

## 与其他模式的关系

[factory.md](./factory.md) 一步决定*创建哪个*类；生成器分多步处理复杂的*如何组装*。[abstract-factory.md](./abstract-factory.md) 常用生成器来构造其单个产品。原型方法（Prototype approach），克隆模板并修改少数字段，是一种替代方案，适用于主要需要从现有对象产生小差异，而非全新的分步构造。
