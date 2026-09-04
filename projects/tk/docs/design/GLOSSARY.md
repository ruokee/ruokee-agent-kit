# Glossary

[简体中文](./GLOSSARY.zh.md)

This glossary includes only terms that have a special meaning in tk, require fixed capitalization, or are easy to confuse. General technical terms and implementation-specific details remain in the relevant design documents.

## Products and integrations

|Term|Chinese form|Meaning|
|-|-|-|
|Task|Task|A temporary effort within a project that is worth preserving. Creating a Task does not imply a commitment to execute or complete it.|
|Harness|Harness|The software environment around a model that enables it to operate as an Agent, including loops, prompts, context, tools, permissions, and hooks.|
|Skill|Skill|Agent behavior instructions and reference materials discoverable by a Harness.|
|Plugin|Plugin|A self-contained component form loaded through a Harness's native Plugin mechanism.|
|Package|Package|A component form installed and loaded through Pi or OMP's native mechanism.|
|component|组件|A self-contained tk unit assembled and installed for a Harness.|
|adapter|适配器|Code that maps native Pi or OMP tool calls to the public tk process interface.|
|payload|载荷|The self-contained set of files installed from a component archive.|
|runtime|运行时|The fixed user-level `tk` executable and its Rust behavior.|

## Tool contract

|Term|Chinese form|Meaning|
|-|-|-|
|logical tool|逻辑工具|A transport-independent search, read, create, update, log, or exec operation.|
|protocol tool name|协议工具名称|A tool name in the MCP namespace.|
|native tool name|原生工具名称|A `tk_*` tool name registered by Pi or OMP.|
|schema type|schema 类型|The `mcp` or `native` selection used when generating a tool contract.|
|exact resolution|精确解析|Resolving a complete reference to exactly one Task without using search ranking.|
|actor|发起者|WAL call attribution information. It does not represent identity, authorization, or Task assignment.|
|result envelope|统一结果|A structured result containing `ok`, `data`, `warnings`, or `error`.|
|error code|错误码|A stable `code` value used for machine branching.|

## Task data

|Term|Chinese form|Meaning|
|-|-|-|
|Task root|Task 根目录|A configured path within a project that stores a top-level Task tree.|
|metadata mode|元数据模式|The project-wide choice of `split` or `embed`.|
|metadata representation|元数据表示|The physical representation of metadata in split `tk.toml` or embed frontmatter.|
|metadata carrier|元数据载体|The managed `tk.toml` or embed `TASK.md` that stores Task metadata.|
|frontmatter|frontmatter|The restricted YAML metadata block at the beginning of an embed `TASK.md`.|
|managed file|受管文件|A project file whose format and change rules are governed by tk.|
|material|材料|An ordinary file that supports a Task and is not indexed by the runtime.|
|lifecycle|生命周期|The meanings of planning, open, and closed and the rules for transitions between them.|
|relation|关系|`depends_on` or `related_to`.|
|WAL|WAL|Ordinary, append-only Markdown activity records stored by day.|
|schema migration|schema 迁移|A stepwise forward conversion from one officially released metadata version to another.|
|representation switch|表示切换|A project-wide conversion between split and embed.|
|rename|重命名|Changing a Task's own name, directory, and metadata, and reporting external references.|

## Operations and maintenance

|Term|Chinese form|Meaning|
|-|-|-|
|atomic replacement|原子替换|Replacing one canonical file with a complete temporary file without exposing partial content.|
|partial commit|部分提交|The condition in which some targets have completed when a multi-target operation encounters an error.|
|cleanup manifest|清理清单|A minimal manifest that records only the format version, producer process identity, creation time, and tk temporary paths.|
|activity marker|活动操作标记|A process marker that blocks other write operations during a multi-target project write.|
|garbage collection|GC|A maintenance operation that identifies and removes tk temporary content and completed activity markers.|
|runtime compatibility|运行时兼容范围|The `runtime_compat` declared by a component and evaluated by Rust.|
|clean uninstall|干净卸载|Restoring a Harness to the state it would have had if tk had never been installed, while preserving all unrelated content.|

## Documentation and materials

|Term|Chinese form|Meaning|
|-|-|-|
|scratchpad|临时记事区|Short-lived ordinary material that is not part of the final deliverable.|
|research package|研究材料包|A material pattern that preserves sources, evidence, the boundaries of conclusions, and unresolved questions.|
|design revisions|设计修订|A material pattern that preserves multiple superseding design iterations and the current entry point.|
|review records|评审记录|A material pattern that preserves multi-party reviews, disagreements, and resolution decisions.|
|validation evidence|验证证据|A material pattern that preserves repeatable commands, environments, results, and acceptance decisions.|

## Fixed Chinese forms

- managed: 受管
- scratchpad: 临时记事区
- human-readable: 人类可读
- clean cutover: 直接切换
- supported subcommands: 支持的子命令
- review: use "审查" or "评审" according to context
