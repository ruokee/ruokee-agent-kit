# 安装 Skill

[English](./installation.md) | 中文

本指南只覆盖本仓库的普通 Skill。拓展组件保留各自的安装与更新说明：

- [tk](../projects/tk/README.zh.md)
- [omp-status-bar](../projects/omp-status-bar/README.zh.md)
- [omp-system-prompt](../projects/omp-system-prompt/README.zh.md)
- [omp-codex-web-access](../projects/omp-codex-web-access/README.zh.md)
- [omp-context-pin](../projects/omp-context-pin/README.zh.md)

## 选择要安装的内容

[仓库 README](../README.zh.md#功能列表) 列出全部能力并链接每个 Skill。安装前先阅读该 Skill 的 `SKILL.md`；Skill 依靠 frontmatter 中的 description 被选中。

普通 Skill 是一个包含 `SKILL.md` 的目录，需要时还包含自己的 references、workflow 和 glossary。安装会复制整个目录。

| 语言 | 仓库中的来源 | 安装位置 |
| --- | --- | --- |
| 英文 | `skills/<name>/` | `<skill root>/<name>/` |
| 中文 | `variants/zh/skills/<name>/` | `<skill root>/<name>/` |

一个 Skill 根目录中每个名称只保留一份安装，因此同名 Skill 同时只使用一种语言。`check` 和 `install` 都会说明所比较来源的语言。`--language` 接受 `en` 或 `zh`，默认 `en`；`uninstall` 不需要语言，因为它只按名称移除一个目标。完整选项列表见 `sh scripts/skills.sh --help`。

## 前置条件

- 本仓库的本地克隆。在该克隆中执行 `git pull` 获取最新内容。
- POSIX shell：以下命令通过 `sh` 执行。
- `diff` 命令以及 Linux 和 macOS 系统均已提供的常见系统文件工具。目录比较使用 `diff -r -q`，其退出状态决定报告的状态。
- 不需要 Node、Bun、Python、`jq` 或 Rust。脚本不联网，也不需要仓库的开发依赖或构建步骤。
- Git 可选。当克隆是 Git 检出时，`check` 会显示比较依据的 `HEAD` 以及相关源码的未提交修改。

## 选择 Skill 根目录

`--target` 指定存放 Skill 的目录，而不是 Skill 目录本身。目标不存在时 `install` 会创建它。

在 OMP 中，用户级普通 Skill 目录是：

```text
$HOME/.omp/agent/skills
```

其他 Harness 从各自的路径加载 Skill。项目级根目录是 Harness 为当前项目读取的目录。安装前请在实际使用的 Harness 文档中确认该路径；脚本不猜测根目录，也无法验证 Harness 是否加载了它写入的内容。

## 检查已安装内容

```sh
sh scripts/skills.sh check --target "$HOME/.omp/agent/skills"
sh scripts/skills.sh check code-quality --language zh --target "$HOME/.omp/agent/skills"
```

不带 Skill 名称时，`check` 比较该根目录下已安装的每个 Skill，并把其余部分汇总为数量。带名称时，只比较指定 Skill，并报告指定但不存在的 Skill。

`check` 是只读操作，不创建目标、备份或状态文件。对每个 Skill，它输出源路径与目标路径、`SKILL.md` 中声明的版本（`metadata.version`，缺失时为 `unknown`）以及内容状态：

- `identical`；
- `differs`，随后是递归 `diff` 两个目录输出的差异行；
- `cannot compare` 及原因，表示其中一棵目录树无法读取；
- `not installed`；
- 失效符号链接，这类目标不会被当作已安装内容。

比较覆盖整个目录，因此参考文件被修改、新增文件、删除文件都能被发现。版本相同而内容不同同样算差异。无法读取的目录树属于失败，既不是差异也不是一致：`check` 绝不会把无法读取的目标报告为 `identical`，比较无法完成时退出状态为 `2`。

## 安装或更新

```sh
sh scripts/skills.sh install code-quality --language en --target "$HOME/.omp/agent/skills"
```

目标不存在时，`install` 复制完整的 Skill 目录。目标与来源一致时，报告 `no change` 并且不做任何写入。目标存在但内容不同时，它不做修改并停止，同时打印查看差异和替换的命令。

替换需要单独授权：

```sh
sh scripts/skills.sh install code-quality --language en --target "$HOME/.omp/agent/skills" --replace
```

`--replace` 先把当前目标复制到备份目录，再整体替换该目录。只存在于目标中的文件会随之被清除，这正是更新到更新版本所需要的行为。替换不会合并目录。命令会打印备份路径，并指向[恢复备份](#恢复备份)中的还原步骤。

操作失败会以非零状态停止，保留原有可用内容或完整备份，并说明未完成的部分。写入一半的 Skill 不会被报告为已安装。无法读取的目标会被保留，而不会被替换。

## 卸载

```sh
sh scripts/skills.sh uninstall code-quality --target "$HOME/.omp/agent/skills"
sh scripts/skills.sh uninstall code-quality --target "$HOME/.omp/agent/skills" --yes
```

第一条命令只打印准确的目标路径并停止。删除需要 `--yes`，它只确认该目标。

普通安装目录会先复制到备份目录，再从 Skill 根目录移除。目标是符号链接时只移除链接，不删除其指向的目录。相邻 Skill、Skill 根目录本身和仓库源码都不受影响。手工复制的 Skill 以同样方式处理，不需要迁移或登记。

卸载不依赖本仓库，本仓库也不要求安装记录。与 Skill 同名的目录只是比较候选，不能证明内容来源；删除前请先比较。

## 备份

经授权的替换或卸载会把原目标复制到按操作区分的目录下：

```text
${XDG_STATE_HOME:-$HOME/.local/state}/ruokee-agent-kit/skill-backups/
```

每次操作都会打印准确路径，同一秒内的操作也不会重名。该目录只保存副本，不是安装登记表。它不会位于任何 Skill 根目录内，也不会位于本仓库源码内，因此 Harness 不会加载它，备份也不会覆盖源码。

## 恢复备份

每次经授权的替换或卸载都会打印所写备份的路径，请使用该路径，不要自行推测：

```sh
backup='<命令打印的备份路径>'
root='<你传给 --target 的 Skill 根目录>'
name='<Skill 名称>'
```

备份路径位于 `${XDG_STATE_HOME:-$HOME/.local/state}/ruokee-agent-kit/skill-backups/` 之下，因此自定义 `XDG_STATE_HOME` 会改变它。备份目录中保存完整的 Skill 目录 `<name>/`；如果替换或移除的是符号链接，则只保存 `link-target.txt`。

恢复目录：

```sh
holding=$(mktemp -d "$backup/restore.XXXXXX") &&
  { { [ ! -e "$root/$name" ] && [ ! -L "$root/$name" ]; } || mv "$root/$name" "$holding/$name"; } &&
  mv "$backup/$name" "$root/$name"
```

恢复被替换或移除的链接：

```sh
holding=$(mktemp -d "$backup/restore.XXXXXX") &&
  { { [ ! -e "$root/$name" ] && [ ! -L "$root/$name" ]; } || mv "$root/$name" "$holding/$name"; } &&
  ln -s "$(cat "$backup/link-target.txt")" "$root/$name"
```

执行前先替换占位符。两条命令都先把当前安装的内容移入备份目录内新建的保存目录，该位置在 Skill 根目录之外。不删除任何内容：替换后新增到已安装 Skill 中的文件会保留在 `$holding/$name`，不会丢失，也不受系统临时目录清理影响。`&&` 链在第一步失败时即停止，避免覆盖尚未移开的内容。每次执行都新建独立的保存目录，因此重复恢复不会把 Skill 嵌套进另一份内容。不再需要保存目录中的内容时，自行删除该目录。

## 手工替代方式

手工复制与脚本安装效果相同：

```sh
mkdir -p "$HOME/.omp/agent/skills"
cp -R skills/code-quality "$HOME/.omp/agent/skills/"
```

对于会跟随链接的 Skill 根目录，顶层符号链接同样可用：

```sh
ln -s "$PWD/skills/code-quality" "$HOME/.omp/agent/skills/code-quality"
```

链接安装没有独立副本：内容就是检出目录，执行 `git pull` 后随之变化。Harness 是否跟随该链接、何时重新加载内容，取决于该 Harness 自身；脚本无法确认其中任何一点。`check` 会标注链接目标、比较其解析后的内容，并把失效链接视为差异。`uninstall` 只移除链接。

每次安装一个 Skill。脚本和本指南都不会默认安装全部 Skill。

## 退出状态

| 状态 | 含义 |
| --- | --- |
| `0` | 比较结果一致，或已安装、无需变更、已卸载。 |
| `1` | 未做变更：需要 `--replace` 或 `--yes`，已安装目标与来源不同，或指定的 Skill 尚未安装。 |
| `2` | 请求失败：参数、名称、路径、读取或文件操作失败；比较无法完成、写入仓库源码被拒绝、备份位置被拒绝时同样返回 `2`。 |

## 限制

- `check` 比较克隆中的来源与你指定的目标。缺少历史基准时，它无法判断差异来自仓库更新还是本机修改，因此只报告需要核对的差异，从不授权直接覆盖。
- 内容一致只能证明两个目录相同，不能证明正在运行的 Harness 已加载该版本；请按 Harness 自身规则重新加载或重启。
- 脚本只管理普通 Skill 目录。它不修改 Harness 配置，不安装依赖，不执行构建，也不拉取 Git。
- 会写入本仓库源码的操作会在创建任何内容前被拒绝：目标根目录等于、包含或位于 `skills/` 或 `variants/zh/skills/` 之内，以及位于这两棵目录树下的备份位置。无论 `--language` 选择哪种语言，两种语言的源码树都受保护。Skill 条目本身是符号链接时仍按链接替换或移除，链接指向的目录绝不会被写入。
- 缺失部分包含 `.` 或 `..` 的路径按字面保留并直接拒绝，不做折叠：命令返回 `2`、指出该分量并且不创建任何内容。折叠此类路径得到的解析结果与文件系统解析实际写入路径的结果可能不同。
- `check` 和 `install` 读取脚本自身所在的检出目录，因此结果始终对应该克隆。要比较更新的内容，请先在该克隆中执行 `git pull`。

## 相关材料

- [仓库 README](../README.zh.md)：能力列表和开发环境准备
- [scripts/skills.sh](../scripts/skills.sh)：本指南所述的脚本
- [scripts/tests/skills.sh](../scripts/tests/skills.sh)：脚本的回归测试
