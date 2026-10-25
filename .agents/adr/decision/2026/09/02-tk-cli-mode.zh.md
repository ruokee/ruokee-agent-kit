# tk CLI 接入

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [tk CLI 模式](../../../archived/2026/09/02-r2-tk-cli-mode.zh.md)

[English](./02-tk-cli-mode.md) | 中文

## 动机

全部任务操作使用公开 `tk` CLI。

唯一命令接口让人、脚本和 Agent 使用同样的任务行为。各语言的完整 Skill 说明该接口，不需要按接入方式分支。

## 决定

CLI 是 tk 唯一接入接口。`tk-cli` 和 `tk-cli-zh` 是自包含普通 Skill，分别提供对应语言的完整现行命令、授权、错误处理和任务材料指导。

安装必须且只能选择 `--harness` 或 `--skill-root`，语言可选。Harness 选择只映射到其普通 Skill 根目录。两种目标都写入所选 Skill、删除另一种语言，并保留根目录和全部无关子项。卸载删除两个 CLI Skill。

固定 `$HOME/.local/bin/tk` 可执行文件是外部前提。生命周期命令不读取 Harness 配置或调用宿主命令，不维护安装历史或其他接入选择。

[Skill 语言](./02-tk-language.zh.md)负责两个身份，[分发](../08/28-tk-distribution.zh.md)负责打包和生命周期，[Harness 集成](../08/28-tk-harness.zh.md)负责根目录映射及发现职责。

## 考虑过的替代方案

无

## 结果

Agent 自行选择 CLI 子命令和选项。参数校验发生在 tk 内，Harness 不在调用前约束其结构。

普通 Skill 发现取决于 Harness 及其根目录配置。Harness 不扫描安装目录时，即使文件存在也不会加载 Skill。
