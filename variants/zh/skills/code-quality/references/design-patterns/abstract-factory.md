# 抽象工厂（Abstract Factory）

## 意图（Intent）

创建必须一起使用的相关对象族，而不将调用方耦合到具体类。调用方选择一个工厂；该工厂生产的所有产品都保证属于同一匹配集合。

## 解决的问题

某些对象只有组合在一起才有意义。S3 读取器与 S3 写入器配对；暗色主题按钮与暗色主题菜单配对；PostgreSQL 连接与 PostgreSQL 方言和迁移运行器配对。如果调用方单独组装这些部件，没有什么能阻止它们混用 PostgreSQL 读取器和 SQLite 写入器。抽象工厂将族作为选择单位：一次选择后端，每个返回的产品都是一致的。

这是其区分性约束。[factory.md](./factory.md) 回答"我该构建哪一个具体类？"抽象工厂回答"我该构建哪一整套类，使它们能够协同工作？"

## 结构和参与者

- **抽象工厂（Abstract factory）**：为族中的每个产品声明创建方法（`make_reader`, `make_writer`）。
- **具体工厂（Concrete factories）**：每个族一个（`S3Storage`, `LocalStorage`），每个工厂生产自己变体的产品。
- **抽象产品（Abstract products）**：调用方依赖的接口（`Reader`, `Writer`）。
- **具体产品（Concrete products）**：特定族的实现。

调用方持有抽象工厂并调用其创建方法；从不命名具体产品。

## 何时使用

- 整套产品必须一起切换：UI 工具包主题、数据库后端、云提供商客户端、传输栈。
- 多个对象必须共享相同的配置、凭证或生命周期，混合使用变体会导致错误。
- 测试需要用整个依赖组（虚拟存储族）来替换真实的组。

## 何时不使用

- 只有一个产品或一个族。此时你只需要一个 [factory.md](./factory.md) 或普通构造函数。
- "族"约束不是真实的——产品实际上不需要匹配。分组除了增加仪式感，并不能防止任何错误。
- 它悄然演变为通用的服务定位器，按请求构建任何东西，失去了最初证明其合理性的族保证。

## Python 惯用实现

一个 `Protocol` 加上选择函数通常就能表达整个模式，无需接口森林：

```python
class StorageBackend(Protocol):
    def make_reader(self) -> Reader: ...
    def make_writer(self) -> Writer: ...


def build_storage(profile: StorageProfile) -> StorageBackend:
    if profile.kind == "s3":
        return S3Storage(profile)
    return LocalStorage(profile)
```

其他惯用形式：

- **模块即工厂**：一个 `s3_backend` 模块和一个 `local_backend` 模块，各自暴露 `make_reader`/`make_writer`，通过组合根模块中导入正确的模块来选择。
- **数据类配置（Dataclass profile）**：将族的共享配置打包到一个冻结对象中，传递给每个产品。
- **组合根（Composition root）**：在启动时一次性组装匹配集并注入，而不是散落工厂调用。

避免复制 Java 的抽象基类层级。鸭子类型和 `Protocol` 在结构上提供了相同的保证，而无需名义继承。

## 失败模式

- 为单一族构建了工厂对象、抽象产品和具体产品树——纯粹的开销。
- 族边界模糊，工厂累积了不相关的创建方法，变成上帝对象。
- 产品秘密地使用全局状态而不是工厂的共享配置，破坏了该模式要维护的一致性保证。

## 与其他模式的关系

抽象工厂是将 [factory.md](./factory.md) 从一个产品扩展到一个协调的族。当单个产品的构造复杂时，其产品通常通过 [builder.md](./builder.md) 配置。工厂选择常常与为整个子系统选择 [strategy.md](./strategy.md) 同时发生。当对象族还需要简化的组合入口点时，将其包装在 [facade.md](./facade.md) 后面。
