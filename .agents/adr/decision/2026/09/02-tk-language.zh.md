# tk Skill 语言

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [tk Skill 语言](../../../archived/2026/09/02-r1-tk-language.zh.md)

[English](./02-tk-language.md) | 中文

## 动机

通过普通安装生命周期选择一种 CLI Skill 语言。

语言由 install 选择，让用户通过同一操作完成安装、切换和所选身份的检查。

## 决定

`tk install` 接受 `--language <en|zh>`，默认 `en`。英文选择 `tk-cli`，中文选择 `tk-cli-zh`。两者位于 `projects/tk/skills/`，使用各自独立发现名称，安装保留这些身份。

两个 Skill 提供等价行为，各自包含完整参考资料。Harness 和自定义根目录目标使用相同选择及默认值。install、dry-run、text 输出和 JSON 输出报告最终语言与 Skill。

安装替换所选身份，并从同一根目录删除另一种语言。卸载没有语言选择项，删除两个身份，结果省略语言和 Skill。[分发](../08/28-tk-distribution.zh.md)负责受限生命周期。

## 考虑过的替代方案

无

## 结果

一个所选根目录在安装后保留一种语言。两种语言分别打包和发现，保持语义一致需要一同维护。
