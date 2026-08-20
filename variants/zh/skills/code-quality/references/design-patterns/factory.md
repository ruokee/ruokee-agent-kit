# 工厂方法（Factory Method）

## 意图（Intent）

将对象创建与使用该对象的代码解耦。调用方按意图请求产品（"给我一个解析这种格式的解析器"），而不指明具体类名或了解其组装方式。

## 解决的问题

构造逻辑往往会泄露到调用方中：选择哪个具体类、如何验证输入、如何装配依赖、应用什么默认值。当相同的 `if kind == ...: return SomeClass(...)` 块出现在多个地方时，更改构造就意味着要编辑每个调用点。工厂方法将这一决策集中在一个地方并赋予其名称。

## 结构（Structure）

在经典的 GoF（Gang of Four）形式中，`Creator`（创建者）声明一个返回 `Product`（产品）的工厂方法，子类覆盖它以决定具体产品。参与者包括抽象创建者、具体创建者、产品接口和具体产品。

在 Python 中，这种完整的层次结构很少是合适的形式。"创建者"通常是一个普通函数、`classmethod` 或注册表查找。仅在框架将创建步骤定义为扩展点，且你的子类确实需要覆盖它时，子类覆盖方法的形式才有价值。

## Python 惯用实现

优先使用普通工厂函数：

```python
def make_parser(kind: str) -> Parser:
    match kind:
        case "json":
            return JsonParser()
        case "yaml":
            return YamlParser()
        case _:
            raise UnknownParserError(kind)
```

对于配置驱动或插件驱动的创建，注册表使工厂保持可扩展性，无需编辑分发逻辑：

```python
_PARSERS: dict[str, Callable[[], Parser]] = {}

def register_parser(kind: str, factory: Callable[[], Parser]) -> None:
    _PARSERS[kind] = factory

def make_parser(kind: str) -> Parser:
    try:
        return _PARSERS[kind]()
    except KeyError as exc:
        raise UnknownParserError(kind) from exc
```

`classmethod` 替代构造函数（`Model.from_dict`、`datetime.fromtimestamp`）是 Python 中最常见的工厂形式：类拥有命名的自我构建方式。

## 何时使用

- 具体类型取决于运行时值：文件格式、协议名称、配置条目、插件名。
- 构造过程涉及验证、依赖装配或默认策略选择，你不希望在调用点重复这些逻辑。
- 当前存在多个实际实现，或已确认的扩展点（插件、入口点）。

## 何时不使用

- 只有一个实现且构造过程很简单——直接调用构造函数即可。
- 一行 `if` 或直接实例化就能解决。将其包装在抽象创建者层次结构中，没有变化却增加了间接性。
- 所有构建对象的代码都被命名为 `Factory`，导致概念被稀释到毫无意义。

## 失败模式

- Java 风格的抽象创建者/具体创建者树，而函数就能解决问题，迫使读者穿过多层子类找到一条 `return`。
- 工厂函数静默地忽略未知类型并返回默认值，隐藏了配置错误。应抛出清晰的领域错误。
- 工厂长出副作用（日志、I/O、注册），导致构造不再纯净或可预测。

## 与其他模式的关系

[abstract-factory.md](./abstract-factory.md) 将此思想扩展到必须一起变化的整个产品族。[builder.md](./builder.md) 处理复杂的分步构造，而非选择哪个类。当产品由某个运行时值选择，而该值也驱动后续行为时，选择可能属于 [strategy.md](./strategy.md)。当创建因参数类型而变化时，`functools.singledispatch` 是一种相关的 Python 机制。
