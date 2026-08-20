# msgspec 与其他数据建模工具的对比

应根据数据边界和所需行为选择工具，不要依据缺少上下文的整体性能倍数。实际性能取决于模式、协议、载荷、验证工作和基准测试方法。

## msgspec 与 Pydantic

当主要边界是类型化序列化或反序列化，并且应用需要 JSON、MessagePack、YAML 或 TOML API 时，可以选择 msgspec。`msgspec.Struct` 让数据模型贴近传输格式，类型化解码会在一个步骤中完成转换和验证。

当项目已经依赖 Pydantic 的模型 API、验证器、设置体系、框架集成或模式行为时，可以保留 Pydantic。迁移成本和框架约定通常比合成基准测试更影响项目决策。

两个库都支持 JSON Schema 和标签联合，但配置及验证模型不同。比较时应检查项目实际使用的具体能力。

## msgspec 与 dataclasses

`dataclasses` 属于 Python 标准库，适合普通的内存数据容器。它本身不提供序列化协议或类型化解码器。

msgspec 可以编码和解码 dataclass 实例。`msgspec.Struct` 还提供标签、编码名称规则、`UNSET`、`array_like` 和未知字段处理等专有选项。当这些行为属于数据边界时使用 Struct；更重视标准库互操作和自由定制类行为时保留 dataclass。

## 性能比较

以[官方基准测试](https://jcristharif.com/msgspec/benchmarks.html)作为可复现的起点，并用代表真实业务的负载重新测试。至少记录库版本、Python 版本、模式、载荷大小、协议、验证目标，以及是否复用编码器或解码器实例。

## 参考资料

- [msgspec 基准测试](https://jcristharif.com/msgspec/benchmarks.html)
- [msgspec 文档](https://jcristharif.com/msgspec/)
- [Pydantic 文档](https://docs.pydantic.dev/)
- [Python dataclasses 文档](https://docs.python.org/3/library/dataclasses.html)
