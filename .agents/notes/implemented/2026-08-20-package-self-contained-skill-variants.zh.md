# Agent Note: 将 Skill 打包为自包含语言变体

Status: implemented
Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

[English](./2026-08-20-package-self-contained-skill-variants.md) | 中文

## 动机

来源仓库把 Skill、Plugin manifest、marketplace 元数据、Package 文档和语言覆盖层放在一起。照搬这种布局会让宿主可发现的 Skill 依赖仓库打包细节。

语言 variant 还会产生另一项歧义。源码路径需要标识所选 variant，但安装后的 Skill 必须使用 Agent Harness 预期的路径。链接如果带有仅在源码中存在的 variant 前缀，安装后就会失效。

## 决定

英文基础 Skill 放在 `skills/<name>/`，中文 variant 放在 `variants/zh/skills/<name>/`。对应文件集合和主题内容在同一变更中保持一致。

纯 Skill 只包含发现、理解和使用该 Skill 所需的材料，可以包括 `SKILL.md`、workflow、reference、example 和 glossary。不把 Plugin manifest、marketplace 元数据、`meta.toml`、宿主专用 Agent 定义、Plugin changelog 或 Package 级 README 复制进 Skill 目录。

安装所选语言 variant 时，使用正常的宿主 Skill 路径，不保留 `variants/zh/` 前缀。因此每种 variant 引用其他 Skill 时，都使用安装后的 `skills/<name>/...` 形式。

每个 Skill 必须可以独立理解。跨 Skill 链接可以提供相关资料，但不能要求另一个 Skill 解释本 Skill 自己的术语或运行规则。

导入现有 Skill 时保留正文含义。只修改新布局要求的路径，不把导入和无关改写混在一起。不能因为目标将在后续变更中加入，就删除有效的跨 Skill 引用。

## 考虑过的替代方案

**把完整 Plugin 目录复制进 `skills/`。**这样会把宿主打包和仓库元数据混入 Skill 合同。

**安装 variant 时保留源码前缀。**Agent Harness 在正常 Skill 根目录发现能力，源码专用前缀会泄漏到链接和安装行为中。

**把语言 variant 放进基础 Skill 目录。**这样会模糊宿主选择和文件对应关系，也容易产生单文件混合语言。

**导入时删除尚未解析的跨 Skill 链接。**把链接改成普通文字会改变原文语义。保留规范安装路径可以保留引用意图，并在目标能力单独加入后生效。

**迁移时同时重构正文。**这样难以区分布局适配与编辑修改，也削弱审查证据。

## 结果

英文 Skill 位于 `skills/<name>/`，中文 variant 位于 `variants/zh/skills/<name>/`。纯 Skill 目录不包含 Plugin manifest、marketplace 元数据、Package changelog 或宿主专用 Agent 定义。

安装路径链接不带 variant 源码前缀。因此源码路径和安装路径有意不同，验证必须检查 variant 选中后的实际链接，不能只检查仓库文件树。

每个 variant 都保持完整，并能与对应版本核对。翻译需要时可以采用语言专用解释，但任何一侧都不能悄悄省略可观察能力或必需指令。

导入时保留正文含义，并区分路径适配与编辑修改。每个 Skill 都能独立说明自己的领域，无需加载另一个 Skill 才能使用。
