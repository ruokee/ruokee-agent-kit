# Skill 语言变体

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol

[English](./20-skill-variants.md) | 中文

## 动机

把每个 Skill 的英文基础版本放在 `skills/<name>/`，中文变体放在 `variants/zh/skills/<name>/`，安装时不带该前缀。

打包后的 Skill 必须保持自包含，能被 Agent Harness 发现，不依赖仓库的打包细节。来源仓库把 Skill、Plugin manifest、marketplace 元数据、Package 文档和语言覆盖层放在一起，照搬这种布局就会让 Skill 依赖这些打包细节。

语言 variant 还会产生另一项歧义。源码路径需要标识所选 variant，但安装后的 Skill 必须使用 Agent Harness 预期的路径。链接如果带有仅在源码中存在的 variant 前缀，安装后就会失效。

## 决定

英文基础 Skill 放在 `skills/<name>/`，中文 variant 放在 `variants/zh/skills/<name>/`。对应文件集合和主题内容在同一变更中保持一致。

纯 Skill 只包含发现、理解和使用该 Skill 所需的材料，可以包括 `SKILL.md`、workflow、reference、example 和 glossary。不把 Plugin manifest、marketplace 元数据、`meta.toml`、宿主专用 Agent 定义、Plugin changelog 或 Package 级 README 复制进 Skill 目录。

安装所选语言 variant 时，使用正常的宿主 Skill 路径，不保留 `variants/zh/` 前缀。因此每种 variant 引用其他 Skill 时，都使用安装后的 `skills/<name>/...` 形式。

每个 Skill 必须可以独立理解。跨 Skill 链接可以提供相关资料，但不能要求另一个 Skill 解释本 Skill 自己的术语或运行规则。

## 考虑过的替代方案

无

## 结果

英文 Skill 位于 `skills/<name>/`，中文 variant 位于 `variants/zh/skills/<name>/`。纯 Skill 目录不包含 Plugin manifest、marketplace 元数据、Package changelog 或宿主专用 Agent 定义。

安装路径链接不带 variant 源码前缀。因此源码路径和安装路径有意不同，验证必须检查 variant 选中后的实际链接，不能只检查仓库文件树。

每个 variant 都保持完整，并能与对应版本核对。翻译需要时可以采用语言专用解释，但任何一侧都不能悄悄省略可观察能力或必需指令。

导入时保留正文含义，并区分路径适配与编辑修改。每个 Skill 都能独立说明自己的领域，无需加载另一个 Skill 才能使用。

## 变更

### 2026-09-02 tk 语言 Skill 名称

tk 使用可独立发现的 `tk`、`tk-zh`、`tk-cli` 和 `tk-cli-zh`。它们是不同的 Skill 身份，不属于同名语言 variant，因此四者都位于 `projects/tk/skills/<name>/`。其他 Skill 的同名 variant 规则保持不变。

### 2026-10-22 项目组件内的 Skill

以独立项目形式维护的组件，其包含的 Skill 位于 `projects/<component>/skills/<name>/`。布局按组件归属确定，不按名称逐项列举例外。组件可以为不同语言的 Skill 设置可独立发现的身份。每种语言 Skill 都保持完整、自包含，指令等价、版本一致，并在同次变更中维护。普通 Skill 布局及同名变体规则保持不变。
