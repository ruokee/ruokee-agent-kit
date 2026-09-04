# 术语表

[English](./GLOSSARY.md)

本表只保留 tk 中有特殊含义、需要固定大小写或容易混淆的词。普通技术词和只属于一个实现章节的细节留在对应设计文档中。

## 产品和集成

|术语|中文形式|含义|
|-|-|-|
|Task|Task|值得持久保存的项目内临时性努力，不要求创建时已经承诺执行或完成|
|Harness|Harness|围绕模型、使模型能够作为 Agent 运行的软件环境，包括循环、提示、上下文、工具、权限和 hooks|
|Skill|Skill|Harness 可发现的 Agent 行为说明和参考材料|
|Plugin|Plugin|由 Harness 原生 Plugin 机制加载的自包含组件形式|
|Package|Package|Pi 或 OMP 原生安装和加载的组件形式|
|component|组件|为一个 Harness 组装和安装的 tk 自包含单元|
|adapter|适配器|把 Pi 或 OMP 原生工具调用映射到公开 tk 进程接口的代码|
|payload|载荷|组件归档内要安装的自包含文件集合|
|runtime|运行时|固定用户级 `tk` 可执行文件及其 Rust 行为|

## 工具合同

|术语|中文形式|含义|
|-|-|-|
|logical tool|逻辑工具|与传输无关的 search、read、create、update、log 或 exec 操作|
|protocol tool name|协议工具名称|MCP 命名空间内的工具名称|
|native tool name|原生工具名称|Pi 或 OMP 注册的 `tk_*` 工具名称|
|schema type|schema 类型|生成工具合同时选择的 `mcp` 或 `native`|
|exact resolution|精确解析|不使用搜索排名，把完整引用解析为恰好一个 Task|
|actor|发起者|WAL 的调用归因信息，不表示身份、授权或任务分配|
|result envelope|统一结果|包含 `ok`、`data`、`warnings` 或 `error` 的结构化结果|
|error code|错误码|用于机器分支的稳定 `code` 值|

## Task 数据

|术语|中文形式|含义|
|-|-|-|
|Task root|Task 根目录|一个项目内保存顶层 Task 树的配置路径|
|metadata mode|元数据模式|项目统一选择的 `split` 或 `embed`|
|metadata representation|元数据表示|元数据在 split `tk.toml` 或 embed frontmatter 中的物理表达|
|metadata carrier|元数据载体|保存 Task 元数据的受管 `tk.toml` 或 embed `TASK.md`|
|frontmatter|frontmatter|embed `TASK.md` 开头的受限 YAML 元数据块|
|managed file|受管文件|tk 对格式和变更规则具有规范权的项目文件|
|material|材料|支持 Task 的普通文件，不由运行时建立索引|
|lifecycle|生命周期|planning、open 和 closed 的含义及转换规则|
|relation|关系|`depends_on` 或 `related_to`|
|WAL|WAL|按日保存的普通、仅追加 Markdown 活动记录|
|schema migration|schema 迁移|从一个正式发布的元数据版本逐级向前转换|
|representation switch|表示切换|在整个项目范围内转换 split 和 embed|
|rename|重命名|修改 Task 自身名称、目录和元数据，并报告外部引用|

## 操作和维护

|术语|中文形式|含义|
|-|-|-|
|atomic replacement|原子替换|用完整临时文件替换单个规范文件，不暴露部分内容|
|partial commit|部分提交|多目标操作发生错误时，部分目标已经完成的事实|
|cleanup manifest|清理清单|只记录格式版本、操作进程身份、创建时间和 tk 临时路径的最小清单|
|activity marker|活动操作标记|多目标项目写入期间阻止其他写操作的进程标记|
|garbage collection|GC|识别并删除 tk 临时内容和操作进程退出后留下的活动操作标记的维护操作|
|runtime compatibility|运行时兼容范围|组件声明并由 Rust 判断的 `runtime_compat`|
|clean uninstall|干净卸载|Harness 恢复为从未安装过 tk，同时保留全部无关内容|

## 文档和材料

|术语|中文形式|含义|
|-|-|-|
|scratchpad|临时记事区|不作为最终交付的短期普通材料|
|research package|研究材料包|保存来源、证据、结论边界和未解决问题的材料模式|
|design revisions|设计修订|保存多轮相互替代设计及当前入口的材料模式|
|review records|评审记录|保存多方审查、分歧和处理结论的材料模式|
|validation evidence|验证证据|保存可重复命令、环境、结果和验收判断的材料模式|

## 固定中文形式

- managed：受管
- scratchpad：临时记事区
- human-readable：人类可读
- clean cutover：直接切换
- supported subcommands：支持的子命令
- review：按语境使用“审查”或“评审”
