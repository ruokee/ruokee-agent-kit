# 命令式/过程式编程（Imperative / Procedural Programming）

## 什么是命令式编程

命令式编程（Imperative Programming）将计算描述为一系列改变状态的语句：读取输入、改变变量、调用外部系统、处理错误、写入输出。过程式编程（Procedural Programming）是同一模型，但将逻辑组织成按顺序调用的过程（函数）。这是表达程序最古老、最直接的方式，与机器的实际执行方式紧密对应。

人们很容易将命令式代码视为低级或不成熟。这是一个错误。现实世界充满了有序的副作用——打开文件、读取内容、转换内容、写回文件、提交事务——而命令式风格是表达这种序列的诚实且可读的方式。目标不是消除命令式代码，而是将其放在它所属的地方，并阻止业务规则与之纠缠在一起。

## 底层假设

- 某些逻辑本质上是顺序的：每一步都依赖于前一步的效果。
- 副作用应该是*可见的*，按顺序排列，而不是隐藏在抽象层之后。
- 对于短脚本、入口点和胶水层，直接的线性流程通常比过早的架构更易于维护。

## 何时适用

- CLI 入口点、一次性脚本、迁移、运维工具。
- 应用程序启动：依赖注入、配置加载、日志初始化。
- I/O 编排：协调事务、按需顺序调用多个外部系统、安排读写顺序。
- 几乎任何程序的外层——那些实际上要在世界中*执行*操作的部分。

一个健康的命令式入口点读起来像一份食谱——每个步骤命名一个阶段，副作用按顺序可见：

```python
def main(argv: Sequence[str] | None = None) -> int:
    args = parse_args(argv)
    config = load_config(args.config_path)
    configure_logging(config.log_level)
    client = build_client(config)
    try:
        result = run_job(client, config)  # 决策逻辑在这里，接收纯数据
    except JobError as exc:
        logging.getLogger(__name__).error("job failed: %s", exc)
        return 1
    write_report(result, args.output)
    return 0
```

注意入口点*没有*做什么：它自己不计算结果。它编排 I/O 并将实际决策委托给 `run_job`，后者可以在没有真实客户端的情况下测试。

## 何时成为问题

- 核心业务规则与 I/O 交织在一个长函数中，导致没有数据库、时钟或网络就无法测试规则。
- 复杂的状态变更没有边界，通过全局变量或传递到各处的可变字典泄漏到每一层。
- 错误处理分散在流程中，无法作为一个整体重用或推理。
- 函数已经膨胀到读者无法在脑中容纳，唯一的组织就是从上到下的顺序。
- "再加一个标志"的参数不断累积，直到过程有十几个布尔值来控制隐藏的分支——这是不同的操作被合并到一个序列中的迹象。

当你看到这些迹象时，问题通常不是"过于命令式"，而是"命令式放在了错误的地方"——那些本应被提取到可测试位置的决策逻辑。修复方法很少是让代码整体上不那么命令式；而是将*决策*的部分与*执行*的部分分开。

考虑一个交织了两者的函数：

```python
def process(order_id: int) -> None:
    row = db.fetch_order(order_id)          # I/O
    if row.status == "paid" and row.total > 100:   # 决策
        discount = row.total * 0.1          # 决策
        db.apply_discount(order_id, discount)   # I/O
        mailer.send(row.email, "discount applied")  # I/O
```

规则（已支付的订单超过 100 享受 10% 折扣）在没有数据库和邮件服务的情况下无法测试。将决策提取出来，它就变成一个纯函数，可以用普通值进行测试，而命令式外壳只保留 I/O：

```python
def compute_discount(order: Order) -> Decimal:   # 纯函数，易于测试
    if order.status == "paid" and order.total > 100:
        return order.total * Decimal("0.1")
    return Decimal(0)

def process(order_id: int) -> None:              # 薄命令式外壳
    order = db.fetch_order(order_id)
    discount = compute_discount(order)
    if discount:
        db.apply_discount(order_id, discount)
        mailer.send(order.email, "discount applied")
```

## 过程式分解

过程式风格不仅仅是"一个长函数"。它的规范是将流程分解为命名过程，每个过程处于单一的抽象层级。一个好的过程读起来是一系列调用，其名称本身就讲述了故事；你可以理解流程而无需深入任何一个过程。当你发现自己添加注释来标记一个代码块（`# now validate the records`）时，这个代码块通常应该变成一个命名函数（`validate_records(...)`）。注释会腐化；函数名每次都会被读者检查。

保持每个过程在单一的抽象层级。在同一个函数中混合高层编排（`run_job`）和底层字节操作，迫使读者不断切换视角。将细节推入它们自己的过程，让调用者保持可读的摘要。

## 与函数式核心/命令式外壳的关系

最清晰的解决方案是保持命令式风格，但将其限制在一个薄的外层。这就是 [functional-core.md](./functional-core.md) 中的命令式外壳：外壳编排 I/O、事务、重试和日志记录；核心接收纯数据，应用规则，返回纯数据。外壳特意保持命令式——那是有序副作用所在的地方。你移出的是决策制定，而不是编排。

这也与 [data-oriented.md](./data-oriented.md)（外壳传递给核心的数据）和 [resource-lifecycle.md](./resource-lifecycle.md)（外壳如何获取和释放它编排的资源）相关联。

## 在 Python 中

- 在显式的入口点中承载命令式胶水代码，例如 `main(argv: Sequence[str] | None = None) -> int`，并通过 `if __name__ == "__main__":` 将其隔离。
- 让入口层解析参数、加载配置、配置日志、构建依赖，并将异常转换为退出码。核心逻辑接收显式参数，并保持可导入和可测试。
- 对外部资源使用 `with`/`async with`，而不是依赖垃圾回收来释放它们——参见 [resource-lifecycle.md](./resource-lifecycle.md)。
- 当一个过程增长到难以阅读时，按阶段将其拆分为命名步骤（`load_config()`、`build_client()`、`run_job()`），而不是直接引入框架。线性的、命名良好的步骤是一种特性，而不是坏味道。
- 抵制将简单的三行序列包装到类或管道抽象中的冲动；直截了当的命令式代码通常就是 KISS 正确的答案。
