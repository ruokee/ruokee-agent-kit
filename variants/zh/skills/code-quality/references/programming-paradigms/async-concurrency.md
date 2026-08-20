# 异步与并发（Async and Concurrency）

并发（Concurrency）让程序同时推进多件事情。Python 中的异步并发（`async`/`await`、`asyncio`）是几种模型之一——它通过在 `await` 点挂起，在单线程上交错执行许多 I/O 密集型任务。它不是并行，也不是免费的：它将你的代码分割成一个彩色世界，异步函数只能从其他异步函数中等待。核心设计问题不是"如何让这个变成异步"，而是"每个并发任务是否有清晰的所有者、生命周期和错误处理策略。"

## 结构化并发

现代异步设计中最重要的思想是结构化并发（Structured Concurrency）：一组相关任务共享一个作用域，该作用域在所有任务完成之前不会退出。`asyncio.TaskGroup`（Python 3.11+）是规范工具——也是 Trio 中"nurseries"的结构类比。

```python
async def fetch_all(urls: list[str]) -> list[Response]:
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch(u)) for u in urls]
    return [t.result() for t in tasks]
```

`async with` 块在所有子任务完成之前不会完成。如果任何任务抛出异常，组会取消其余任务并传播错误。这给并发代码带来了与普通块相同的保证：当你离开作用域时，你启动的任何东西都不会在后台继续运行。任务有清晰的所有者（组）和清晰的生命周期（块）。

## 取消和超时

取消以 `CancelledError` 的形式在其下一个 `await` 处抛入任务内部。它是控制流机制的一部分，而不是可以吞没的普通错误。如果你捕获它进行清理，之后重新抛出——抑制它会破坏超时、`TaskGroup` 关闭和整个系统的取消传播。

```python
try:
    await do_work()
except asyncio.CancelledError:
    await cleanup()
    raise  # 总是重新抛出
```

超时通过 `asyncio.timeout()`（3.11+）或 `wait_for` 表达，它们在截止时间过去时取消被包装的操作。设计长时间运行的操作，使它们定期到达 `await` 点，否则取消无法生效。

## 错误传播

在 `TaskGroup` 中，多个任务可以同时失败，因此错误以 `ExceptionGroup` 的形式出现。使用 `except*` 处理它们：

```python
try:
    async with asyncio.TaskGroup() as tg:
        ...
except* ValueError as eg:
    ...
```

对于普通的线性流程，你不需要 `except*`——单个等待的协程正常地抛出单个异常。只有在真正的并发失败可能发生时，才使用异常组。

## 背压

当生产者超过消费者时，无界排队会变成无界的内存增长。背压（Backpressure）是减缓生产者使其适应消费者速度的机制。使用有界队列（`asyncio.Queue(maxsize=...)`）使满的队列阻塞生产者，或使用信号量来限制并发进行中的工作。设计背压是将优雅降级与耗尽内存或下游连接限制区分开来的关键。

```python
sem = asyncio.Semaphore(10)  # 最多同时进行 10 个请求


async def fetch_limited(url: str) -> Response:
    async with sem:
        return await fetch(url)


async def fetch_all(urls: list[str]) -> list[Response]:
    async with asyncio.TaskGroup() as tg:
        tasks = [tg.create_task(fetch_limited(u)) for u in urls]
    return [t.result() for t in tasks]
```

如果没有信号量，100,000 个 URL 的列表会同时打开 100,000 个套接字，耗尽文件描述符或远程服务器的限制。上限将"一次性全部"变成了"一次十个"，这就是背压带给你的。

## 异步资源所有权

在任务内部获取的资源只有在任务完成或被正常取消时才会被释放，因此异步资源必须使用 `async with` 拥有，并且也在取消路径上进行清理。持有资源的异步生成器需要 `contextlib.aclosing()` 来保证其终结，因为挂起的生成器可能永远不会恢复。这是 [resource-lifecycle.md](./resource-lifecycle.md) 的异步表现。

## 何时异步有帮助，何时有害

异步是处理具有大量并发操作的 I/O 密集型工作的正确工具：网络请求、数据库查询、许多同时连接、向多个服务扇出。单线程花时间等待 I/O，异步让它可以重叠这段等待。

当工作是 CPU 密集型时，异步增加了成本却没有收益——繁重的计算阻塞了单个事件循环，使每个其他任务都挨饿；对此应使用进程或线程。对于简单的顺序脚本，它也是开销：如果没有并发可挖掘，异步只会增加彩色函数约束和一个需要管理的运行时。不要因为异步很时髦就让代码库异步；让它异步是因为它有真正的 I/O 并发需要挖掘。

## 常见错误

- **触发后遗忘。** 调用 `create_task()` 而不保留引用且不使用组。任务可能会在半途中被垃圾回收，其异常消失。每个任务都需要一个所有者。
- **未处理的任务异常。** 裸任务的异常从未被检索并被静默忽略。`TaskGroup` 通过设计解决了这个问题；单独的任务需要显式的 `add_done_callback` 处理或等待。
- **阻塞事件循环。** 在协程内部调用同步阻塞 I/O（`requests.get`、`time.sleep`、阻塞的数据库驱动）会冻结每个其他任务。使用异步等价物，或使用 `asyncio.to_thread()` 将阻塞调用推送到线程。
- **吞没 `CancelledError`**，如上所述——它会悄悄地破坏整个取消系统。

主线：当每个任务都有所有者和作用域时，并发是可控的。结构化并发、诚实的取消和背压是你在"同时做很多事"不至于变成"很多你无法再追踪的事"的方式。
