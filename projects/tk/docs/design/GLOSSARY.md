# Glossary

[简体中文](./GLOSSARY.zh.md)

This glossary includes only terms that have a special meaning in tk, require fixed capitalization, or are easy to confuse. General technical terms and implementation-specific details remain in the relevant design documents.

## Products

- Task: Chinese form `任务`. A temporary effort within a project that is worth preserving. Creating a Task does not imply a commitment by the user or an Agent to execute or complete it.
- Harness: Chinese form `Harness`. The software environment around a model that enables it to operate as an Agent, including loops, prompts, context, tools, permissions, and hooks.
- Skill: Chinese form `Skill`. Agent behavior instructions and reference materials discoverable by a Harness.
- component: Chinese form `组件`. A self-contained tk distribution unit.
- payload: Chinese form `载荷`. The self-contained set of files installed from a component archive.
- runtime: Chinese form `运行时`. The fixed user-level `tk` executable and its Rust behavior.

## CLI contract

- exact resolution: Chinese form `精确解析`. Resolving a complete reference to exactly one Task without using search ranking.
- actor: Chinese form `发起者`. WAL call attribution information. It does not represent identity, authorization, or Task assignment.
- result envelope: Chinese form `统一结果`. A structured result containing `ok`, `data`, `warnings`, or `error`.
- error code: Chinese form `错误码`. A stable `code` value used for machine branching.

## Task data

- Task root: Chinese form `任务根目录`. A configured path within a project that stores a top-level Task tree.
- metadata mode: Chinese form `元数据模式`. The project-wide choice of `split` or `embed`.
- metadata representation: Chinese form `元数据表示`. The physical representation of metadata in split `tk.toml` or embed frontmatter.
- metadata carrier: Chinese form `元数据载体`. The managed `tk.toml` or embed `TASK.md` that stores Task metadata.
- frontmatter: Chinese form `frontmatter`. The restricted YAML metadata block at the beginning of an embed `TASK.md`.
- managed file: Chinese form `受管文件`. A project file whose format and change rules are governed by tk.
- material: Chinese form `材料`. An ordinary file that supports a Task and is not indexed by the runtime.
- lifecycle: Chinese form `生命周期`. The meanings of planning, open, and closed and the rules for transitions between them.
- relation: Chinese form `关系`. `depends_on` or `related_to`.
- WAL: Chinese form `WAL`. Ordinary, append-only Markdown activity records stored by day.
- schema migration: Chinese form `schema 迁移`. A stepwise forward conversion from one officially released metadata version to another.
- representation switch: Chinese form `表示切换`. A project-wide conversion between split and embed.
- rename: Chinese form `重命名`. Changing a Task's own name, directory, and metadata, and reporting external references.

## Operations

- atomic replacement: Chinese form `原子替换`. Replacing one canonical file with a complete temporary file without exposing partial content.
- partial commit: Chinese form `部分提交`. The condition in which some targets have completed when a multi-target operation encounters an error.
- cleanup manifest: Chinese form `清理清单`. A minimal manifest that records only the format version, producer process identity, creation time, and tk temporary paths.
- activity marker: Chinese form `活动操作标记`. A process marker that blocks other write operations during a multi-target project write.
- garbage collection: Chinese form `GC`. A maintenance operation that identifies and removes tk temporary content and completed activity markers.
- runtime compatibility: Chinese form `运行时兼容范围`. The `runtime_compat` declared by a component and evaluated by Rust.
- clean uninstall: Chinese form `干净卸载`. Removing both CLI Skills completely from the selected root while preserving the root and all unrelated content.

## Materials

- Records: Chinese form `记录`. An optional material pattern that preserves the context, actions, evidence, and conclusions of a local date with substantive activity.
- Deep research: Chinese form `深度调研`. An optional material pattern that preserves sources, evidence for key claims, conflicts, the limits of conclusions, and unresolved points.
- Iterative design: Chinese form `迭代设计`. An optional material pattern that keeps each major design revision self-contained and exposes only the current revision as the entry point.
- Scratchpad: Chinese form `草稿纸`. An optional material pattern for temporary ordinary materials that still need retention and are not yet finalized.

## Fixed Chinese forms

- managed: 受管
- scratchpad: 草稿纸
- human-readable: 人类可读
- clean cutover: 直接切换
- supported subcommands: 支持的子命令
- review: use "审查" or "评审" according to context
