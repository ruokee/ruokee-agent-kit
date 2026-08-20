# 术语表（Glossary）

以下术语在本技能中有明确含义。需要精确语法、配置或示例时，使用 [SKILL.md](./SKILL.md) 中的路由表选择对应文档。

## 翻译对照

- Struct：结构体
- Field：字段
- Default factory：默认值工厂
- Tagged union：标签联合
- Tag field：标签字段
- Serialization protocol：序列化协议
- Encoder：编码器
- Decoder：解码器
- Typed decoding：类型化解码
- Encoding hook：编码钩子
- Decoding hook：解码钩子
- Conversion：转换
- Attribute conversion：属性转换
- Constraint：约束
- Validation error：验证错误
- Post-init validation：初始化后验证

`UNSET`、`Meta`、`enc_hook`、`dec_hook` 等 API 名称保留原文，不翻译标识符。

## 数据模型

**结构体（Struct）**

通过继承 `msgspec.Struct` 定义的类型化数据结构。类型注解描述用于构造、编码、类型化解码和转换的字段。

**字段（Field）**

Struct 中具有名称和类型注解的值。`msgspec.field` 可以配置默认值、默认值工厂或编码后的名称。

**默认值工厂（Default factory）**

为每个 Struct 实例创建新默认值的无参数可调用对象。内置空集合会被视为对应默认值工厂的简写。

**`UNSET`**

区分字段缺失与字段显式设为 `None` 的单例值。编码时会省略值为 `UNSET` 的字段。

**标签联合（Tagged union）**

各 Struct 变体带有判别标签的联合。解码器可以借此消除歧义并选择具体变体。

**标签字段（Tag field）**

标签 Struct 编码后的判别字段。默认名称为 `type`，可以通过 `tag_field` 修改。

## 序列化与转换

**序列化协议（Serialization protocol）**

编码和解码数据所用的传输或文本格式。msgspec 为 JSON、MessagePack、YAML 和 TOML 提供 API。

**编码器（Encoder）**

将受支持的 Python 值转换为某种序列化格式的配置对象。复用编码器可以避免每次操作都重新构建配置。

**解码器（Decoder）**

解析序列化输入的配置对象。类型化解码器还会根据目标类型验证并转换结果。

**类型化解码（Typed decoding）**

指定目标类型进行解码，使 msgspec 验证输入并构造该类型，而非只返回通用 Python 容器。

**编码钩子（Encoding hook，`enc_hook`）**

将 msgspec 原本不支持的 Python 对象映射为可编码值的回调。

**解码钩子（Decoding hook，`dec_hook`）**

将已解码的受支持值映射为指定自定义类型的回调。

**转换（Conversion）**

使用 `msgspec.convert` 将内存中的值转换为目标类型，无需先编码为字节再解码。

**属性转换（Attribute conversion）**

使用 `from_attributes=True` 的转换。它从对象属性而不是映射键读取源值。

## 验证

**约束（Constraint）**

通过 `typing.Annotated` 和 `msgspec.Meta` 附加到类型的规则，例如数值边界、长度限制或字符串模式。

**`Meta`**

附加到注解类型的元数据。它可以定义验证约束，以及标题、描述等模式信息。

**验证错误（Validation error）**

类型化解码或转换无法满足目标类型及其约束时抛出的 `msgspec.ValidationError`。

**初始化后验证（Post-init validation）**

在 `__post_init__` 中实现的自定义检查。直接构造 Struct，以及 msgspec 在解码或转换过程中构造 Struct 后，都会运行这些检查。
