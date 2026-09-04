# ADR 决定：将 Skill 语言选择集成到 tk install

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol, Ruokee

[English](./2026-09-02-select-tk-skill-language.md) | 中文

## 动机

手动安装的中文 Skill 位于 Harness 组件生命周期之外。用户必须单独安装和切换，tk 也无法把所选语言作为组件状态报告或更新。

模式和语言是两个独立选择。命令合同应直接表达这两个维度，不要求用户记住四个 Skill 名称。

## 决定

`tk install` 接受 `--language <en|zh>`，默认 `en`。语言与 `--mode <tools|cli>` 共同选择一个可独立发现的 Skill：

| 模式 | 语言 | Skill |
| --- | --- | --- |
| `tools` | `en` | `tk` |
| `tools` | `zh` | `tk-zh` |
| `cli` | `en` | `tk-cli` |
| `cli` | `zh` | `tk-cli-zh` |

四个 Skill 使用各自的独立发现名称，全部位于 `projects/tk/skills/`。安装时把所选目录放入正常 Harness Skill 根目录，不改写其身份。

同一模式的英文与中文 Skill 提供等价行为。install、dry-run、text 输出和 JSON 输出报告最终语言与 Skill。[Harness 组件与自定义根目录 CLI Skill 分发](./2026-09-03-distribute-custom-cli-skills.zh.md)负责切换和卸载行为。

## 考虑过的替代方案

**使用 `--skill <tk|tk-zh|tk-cli|tk-cli-zh>`。** 四值选项会隐藏模式与语言这两个独立维度，并在命令合同中重复 Skill 身份。

**每次都要求显式语言。** 这会破坏现有安装命令。默认英文可以保持原有行为。

**让中文 Skill 继续位于 tk install 之外。** 所选语言仍不受管理，也可能与当前组件发生偏差。

## 结果

每项 Harness 安装最终选择四个 Skill 身份之一。切换语言与切换模式使用同一组件更新生命周期。

同一模式的两个语言实现必须保持语义对应，但每个目录都独立打包和发现。

## 变更

### 2026-09-03：把语言选择用于自定义根目录

自定义根目录 install 使用相同的 `--language <en|zh>` 选择和 `en` 默认值。自定义根目录 uninstall 没有语言选择项，并删除两个已知 CLI Skill 身份。
