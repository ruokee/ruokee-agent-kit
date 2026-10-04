# ADR 提案：共享 tk Skill 参考文件源码

Draft owner: Ruokee
Draft writer: OMP Claude Opus 5.5

[English](./2026-10-04-share-tk-skill-reference-sources.md) | 中文

## 动机

同一语言的 tools Skill 与 CLI Skill 中内容相同的 tk 参考文件，源码只保留一份，由构建复制到该语言的每个 Skill。

每种语言的 tools Skill 和 CLI Skill 都带有 6 个内容逐字节相同的参考文件：`catchup.md`、`patterns.md`、`project-storage.md`、`subtask.md`、`task-concept.md` 和 `wal.md`。因此四个 Skill 源码目录共有 24 个文件副本，只承载 12 份不同文本，即 6 份英文和 6 份中文。每次修改都要在同语言的两个 Skill 目录里重复一遍；只改到其中一个目录时，tools Skill 和 CLI Skill 会向 Agent 给出不同的规则。

[tk 使用模式决定](../decision/2026-09-11-align-tk-usage-patterns.zh.md)要求四个 Skill 源码目录各自保留完整的模式参考，因此这项改动需要反转该条款。

## 提议

### 源码布局

6 个共享参考文件按语言各保留一份，位于 `projects/tk/skills/shared/en/` 和 `projects/tk/skills/shared/zh/`。四个 Skill 目录 `projects/tk/skills/tk/`、`tk-zh/`、`tk-cli/` 和 `tk-cli-zh/` 保留 `SKILL.md`、各自模式专用的参考文件和 Agent 元数据。tk 构建在组装分发载荷时，把某种语言的每个共享参考文件复制到该语言每个 Skill 的 `references/` 目录。共享文件与 Skill 专用文件组装到同一路径时，构建失败。

`SKILL.md` 继续按安装路径链接 `./references/<file>.md`。这些链接在组装后的载荷和每个已安装 Skill 中都能解析，构建也已会拒绝载荷中目标缺失的 Markdown 链接。在源码树中，指向共享参考的链接在 Skill 目录内无法解析。

### 保持不变的部分

按照[组件自包含决定](../decision/2026-08-24-keep-components-self-contained.zh.md)，每个已安装 Skill 仍然自包含：其文件只引用已安装 Skill 内部的文件，内容（包括每个共享参考文件）与原先四份独立源码副本产生的结果逐字节相同。源码仍位于 tk 组件目录 `projects/tk/` 内。同语言 tools 与 CLI 的参考内容仍然相同，中英文语义仍然对应。模式合同、其归属页面，以及合同与 Skill 参考同步修改的规则都不变。

### 需要反转的决定

**[统一 tk 使用模式](../decision/2026-09-11-align-tk-usage-patterns.zh.md)。** 生效条款：「Skill 与合同归属」中的「四个权威 Skill 目录分别是 tk、tk-zh、tk-cli 和 tk-cli-zh。每个目录都自包含，并保留完整的模式参考文件」；以及结果部分的「四份自包含 Skill 参考……保持它们一致需要同时维护四个 Skill 目录」。提议的选择：四个 Skill 源码目录加上 `projects/tk/skills/shared/<语言>/` 共同构成权威源码，每个共享参考文件每种语言只有一份源码，自包含要求适用于组装后和安装后的 Skill。两者不能同时成立：该决定要求每个源码目录保留完整的模式参考，本提案删除了各目录中的副本。后继决定保留该决定的其余全部规则，包括四种模式的定义、采用和维护规则、合同归属、公开文档集合和双语规则。

## 考虑过的替代方案

**在每个 Skill 源码目录中保留每个共享参考文件的完整副本。** 这是现行规则。每个源码目录都能解析自己的链接，但每次修改共享内容仍要在每种语言的两个目录中重复，tools 与 CLI Skill 之间的偏差只能靠审查发现。

## 验收标准

1. 6 个共享参考文件在 `projects/tk/skills/shared/` 下每种语言各有一份，任何 Skill 源码目录中都没有副本。
2. 每个组装后的 tools 和 CLI 载荷中，每个 Skill 的 `references/` 目录都包含该语言的 6 个参考文件，与共享源码逐字节相同，载荷中的每个 Markdown 链接都能解析。
3. 安装四个 Skill 中任意一个，得到的文件和内容与改动前相同。
4. tk Skill 设计页的中英文版本都说明共享源码目录和已安装 Skill 的自包含性质。
5. 使用模式决定归档，并有通过 `Reverses` 和 `Reversed by` 链接的完整后继决定，本提案删除。

## 风险

在 Skill 源码目录中浏览的读者或 Agent 点击指向共享文件的 `./references/` 链接会找不到文件，因为该文件只在组装后存在。没有读过 Skill 设计的人修改源码树时，可能因此重新建一份本地副本，重新引入重复源码；构建会因路径冲突失败，但那时副本已经写入。
