# 异常组

`ExceptionGroup`（异常组，Python 3.11+，PEP 654）允许单个 raise 同时携带*多个*不相关的异常，而 `except*` 允许处理程序选择并处理它关心的成员，同时让其余成员继续传播。这解决了普通异常无法解决的问题：当多个操作一起运行且不止一个失败时，普通的 `try`/`except` 只能暴露第一个失败，而丢失了其他失败信息。

## 它解决的问题

顺序代码一次只由一个原因失败，因此单个异常就足够了。并发和批处理代码则不同。如果五个下载一起运行，其中三个因不同错误而失败，就没有单一的"那个"异常——丢弃其中四个会隐藏真实信息。`ExceptionGroup` 将它们包装起来，使完整的集合沿着调用栈一起向上传播，每个异常保留自己的回溯。

## 语法

`ExceptionGroup` 是一个真正的异常，包含一条消息和一系列包含的异常：

```python
raise ExceptionGroup("download failures", [TimeoutError(...), ConnectionError(...)])
```

`except*` 按类型匹配组的*成员*。每个 `except*` 子句最多运行一次，接收匹配成员的一个子组；不匹配的成员继续传播：

```python
try:
    await fetch_all(urls)
except* TimeoutError as eg:
    schedule_retry(eg.exceptions)
except* ConnectionError as eg:
    report_unreachable(eg.exceptions)
```

与普通的 `except` 不同，一个组的多个 `except*` 子句可以触发，因为一个组可能包含多种类型。绑定的名称始终是一个组，而不是一个裸异常。

## 何时适用

自然的来源是 `asyncio.TaskGroup`（3.11+）：当多个子任务失败时，组会抛出一个包含它们错误的 `ExceptionGroup`。其他适用场景包括：希望收集每一个失败的批量操作（验证所有字段并一起报告、处理列表项并收集所有错误），以及关闭多个资源时多个清理过程可能失败的情况。

## 何时不使用

不要将单个顺序错误包装在组中。一次只由一个原因失败的线性流程应抛出和捕获普通异常——组在那里增加了一层不必要的解包。`except*` 也不是 `except` 的风格升级；在同一 `try` 上混用两者是语法错误，因此引入 `except*` 是一个刻意的承诺，表明此代码块处理聚合失败。

## 与现有处理程序的交互

普通的 `except SomeError` 并**不会**捕获隐藏在 `ExceptionGroup` 内部的 `SomeError`——组的类型是 `ExceptionGroup`，而不是 `SomeError`。采用 `TaskGroup` 的代码必须将其 `except` 子句转换为 `except*`，或显式捕获 `ExceptionGroup`，否则失败将不被捕获地通过。反之，`except*` 可以捕获 `ExceptionGroup` 本身，但该构造是为匹配成员类型而设计的。

## 嵌套行为

组可以嵌套。使用 `except*` 分割组会保留结构：匹配的成员以反映原始嵌套结构的组形式出现，未匹配的剩余部分以另一个组的形式传播，其结构和回溯保持完整。你很少手动构建嵌套组——它们会在组通过多个 `TaskGroup` 层传播时自然产生。`BaseExceptionGroup` 是可以持有 `BaseException` 子类（如 `KeyboardInterrupt`）的变体；`ExceptionGroup` 仅限于 `Exception`，是应用程序代码通常使用的类型。

要在组内为每个错误提供更丰富的上下文，请在抛出前使用 `add_note()` 为单个成员附加说明，这样每个成员除了自己的回溯外，还保留了自己的解释。
