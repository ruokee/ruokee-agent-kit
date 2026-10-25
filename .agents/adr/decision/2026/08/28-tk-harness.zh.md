# tk Harness 集成

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol, Ruokee
Reverses: [tk Harness 集成](../../../archived/2026/08/28-r3-tk-harness.zh.md)

[English](./28-tk-harness.md) | 中文

## 动机

通过普通 Skill 和公开 CLI 命令把 tk 接入 Harness。

只要 Agent 能加载 Skill 并执行 `tk`，就能使用同样的任务行为。根目录放置是 tk 唯一需要处理的 Harness 专属职责，领域校验和持久化留在运行时。

## 决定

`tk-cli` 和 `tk-cli-zh` 提供完整 CLI 指导。Harness 发现所选 Skill，提供命令工作目录及可用模型信息，执行命令并呈现结果。Agent 传入真实授权，在适用时显式传入 actor 归因。

`--harness` 把 Codex 映射到 `$CODEX_HOME/skills`，默认 `~/.codex/skills`；Claude Code 映射到 `~/.claude/skills`；Pi 映射到 `~/.pi/agent/skills`；OMP 映射到 `~/.omp/agent/skills`。`--skill-root` 接受其他普通 Skill 根目录。

两种目标共用同一受限文件生命周期。tk 只管理所选根目录的直接子项 `tk-cli` 和 `tk-cli-zh`，不读取 Harness 配置，也不调用 Harness 命令。固定 `$HOME/.local/bin/tk` 是外部前提。

Rust 负责任务校验、存储、搜索排序、schema 迁移、兼容判断和安装。Skill 说明用法和授权，不重复强制执行。CLI 失败结果、取消和部分完成保留运行时语义。

[安装设计](../../../../../projects/tk/docs/design/installation.zh.md)、[CLI 参考](../../../../../projects/tk/docs/design/cli-reference.zh.md)和 [CLI Skill](../../../../../projects/tk/skills/tk-cli-zh/SKILL.md) 提供独立可用的指导，[tk 规格集合](../../../../spec/README.zh.md#tk)表达完整行为和验收。

## 考虑过的替代方案

无

## 结果

根目录映射不需要宿主可执行文件或配置解析器。运行时缺陷影响全部调用者，Skill 发现仍取决于 Harness 扫描所选根目录，文件安装本身不代表已经完成发现。
