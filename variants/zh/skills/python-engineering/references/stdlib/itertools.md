# itertools

`itertools` 提供迭代器构建块，可组合成惰性数据管道。每个函数消费和产生迭代器，一次计算一个值，而不是物化中间列表。这使得内存在大序列或无限序列上保持平坦，并允许管道提前停止而不做多余工作。

## 惰性求值

itertools 管道在有人从中拉取值之前不做任何工作。链式调用 `map`、`filter` 和 itertools 函数描述了一个计算过程；迭代时逐个元素地运行它。回报是内存和短路：馈送给 `next()`、`any()` 或切片消费者的阶段永远不会处理超出消费者要求的元素。

```python
from itertools import islice

# 只读取需要的行，而不是整个文件。
first_errors = islice((ln for ln in log_file if "ERROR" in ln), 10)
```

代价是惰性很容易丢失。将阶段包装在 `list()`、`sorted()` 或 `len()` 中会强制完全求值；在确实需要具体集合的时刻有意识地这样做。

## 常用配方

- `chain(a, b, ...)` 和 `chain.from_iterable(iterables)` 连接可迭代对象而不构建组合列表——对于展平一层很有用。
- `islice(it, start, stop, step)` 对迭代器进行切片。与列表切片不同，它不能反向索引，但适用于无限和流式源。
- `groupby(it, key)` 对共享键的*连续*元素进行分组。输入必须已按该键排序，否则分组会分散。这常常困扰期望 SQL 风格分组的新手。
- `product`、`permutations`、`combinations` 惰性生成组合序列——对于测试矩阵和参数扫描很方便，但增长是指数级的，因此要限制输入大小。
- `pairwise(it)`（3.10+）产生重叠的相邻对 `(s0,s1), (s1,s2), ...`，比手动的索引导出更清晰，用于差值和窗口。
- `starmap(func, arg_tuples)` 将函数应用于预分组的参数元组——当参数已经打包时使用 `map`。
- `batched(it, n)`（3.12+）产生最多 `n` 个项的元组，是分块流以进行分页请求或批量写入的标准方式。在 3.12 之前，基于 `islice` 的辅助工具扮演相同角色。
- `accumulate`、`takewhile`、`dropwhile`、`count`、`cycle`、`repeat`、`tee`、`zip_longest`、`compress`、`filterfalse` 涵盖了运行总计、条件切片和流对齐。

## 何时有助 vs 混淆

itertools 在命名一个公认操作时提高清晰度：`batched` 表示"分块"，`pairwise` 表示"相邻窗口"，`chain` 表示"连接"。熟悉这些词汇的读者理解意图的速度比理解手动的索引运算更快。当数据不适合内存或源是无界的时，itertools 也很重要——此时惰性管道是唯一合理的形式。

当普通的推导式或循环更直接时，itertools 会带来混淆。深层堆叠的 `chain`/`filter`/`starmap`/`takewhile` 可能将实际转换隐藏在组合之下；一个带有清晰主体的 `for` 循环通常更好。在 itertool 消除记账工作而非在简单逻辑上增加间接层时使用它。

## 多次消费陷阱

迭代器在一次遍历后就被耗尽。这是最常见的 itertools 错误：

```python
results = map(transform, records)   # 是一个迭代器，不是列表
total = sum(r.size for r in results)
for r in results:                   # 为空——已被 sum() 消费
    save(r)
```

如果必须两次遍历数据，请一次性物化它（`results = list(map(...))`）或使用 `itertools.tee` 复制迭代器。注意 `tee` 会缓冲从一个分支消费但尚未从另一个分支消费的所有内容，因此两个分支差距较大时可能会使用与列表一样多的内存——`tee` 仅在分支大致保持同步时才有帮助。相同的单次遍历规则适用于 `groupby`：其组迭代器仅在推进到下一组之前有效，因此如果需要稍后使用组的内容，请在继续之前捕获它。
