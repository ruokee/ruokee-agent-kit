# tk 用户指南

[English](./guide.md)

tk 使用普通项目文件保存持久任务，并通过 CLI 提供任务操作。

## 安装运行时

把 `tk` 可执行文件安装到固定的用户级路径：

```text
$HOME/.local/bin/tk
```

该路径必须是具有执行位的常规文件。Skill 安装命令不安装、更新或删除运行时。

运行时通过本地克隆构建获得。请从本地克隆构建可执行文件并放到该路径：

```sh
cd /path/to/ruokee-agent-kit
cargo build --release --manifest-path projects/tk/Cargo.toml
mkdir -p "$HOME/.local/bin"
install -m 755 projects/tk/target/release/tk "$HOME/.local/bin/tk"
```

`tk install` 安装的 Skill 来自运行该命令的可执行文件内嵌的载荷。修改源码或替换运行时不会改变已安装的 Skill 文件。

确认运行时合同：

```sh
$HOME/.local/bin/tk --output json --version
```

## 安装 Skill

把一种语言的 Skill 安装到已支持 Harness 的普通 Skill 根目录：

```sh
tk install --harness codex
tk install --harness claude --language zh
tk install --harness pi --language en
tk install --harness omp --language zh
```

[CLI 参考](./design/cli-reference.zh.md#tk-install)持有可取值、默认值和最终 Skill 名称。

安装把 `tk-cli` 或 `tk-cli-zh` 写入所选根目录，并删除另一种语言的版本。它只管理这两个直接子项，保留其他全部内容。

把自包含 CLI Skill 安装到其他 Skill 根目录：

```sh
tk install --skill-root .agents/skills
tk install --skill-root /srv/project/skills --language zh
```

`--skill-root` 表示父目录。英文创建 `<skill-root>/tk-cli`，中文创建 `<skill-root>/tk-cli-zh`，tk 可以创建缺失的父目录。相对根目录按进程当前工作目录解析。`--harness` 与 `--skill-root` 必须且只能提供一个。

两种目标都不要求 Harness 可执行文件，也不读取 Harness 配置。`--harness` 只选择已知的普通 Skill 根目录。

`tk install` 只使用当前可执行文件内嵌载荷，不下载组件，也不接受本地归档。现有安装完全匹配时返回 `no_change`。

使用 `--dry-run` 可以检查运行时、内嵌选择和准确目标边界，不执行写入：

```sh
tk install --skill-root .agents/skills --language zh --dry-run --output json
```

根目录映射、生命周期和卸载行为见[安装](./design/installation.zh.md)。

## 初始化项目

在项目目录运行：

```sh
tk init
```

默认使用 `.tk` 作为任务根目录，顶层创建采用 strict，元数据使用 split，不执行 Git 策略检查。只需传入与默认值不同的选项：

```sh
tk init --creation-policy permissive --metadata-mode embed
```

旧配置无法解析时，`init --force` 仍会根据本次显式参数和默认值重写项目配置。它不读取或修改任务数据。

## 创建任务

创建顶层任务：

```sh
tk create task "调查启动延迟"
```

CLI 直接创建默认视为已确认授权。Agent 必须按当前真实授权传入 `--user-confirmed`，不能依赖该默认值。

create 命令不接受正文输入；生成标题的规则见[创建正文](./design/data-model.zh.md#创建正文)。

## 查找任务

search 默认包含 planning、open 和 closed：

```sh
tk search latency
tk search 0192aabb --status closed
tk search ./notes/benchmark.md
tk search 'startup|cold' --regex --search-body --output json
```

使用唯一任务引用读取：

```sh
tk read <task_ref>
tk read <task_ref> --view detailed --wal-max-entries 50 --wal-max-length 16000
```

名称、UUID 前缀、文本和材料路径属于 search 输入，不是精确引用。read 和 update 应使用 search 返回的完整引用。

## 处理任务

在同一个父任务下创建子工作项：

```sh
tk create subtask <parent_ref> \
  --item '{"name":"测量基线"}' \
  --item '{"name":"测试缓存行为","status":"planning"}'
```

修改关系、extra 或一个生命周期动作：

```sh
tk update <task_ref> --start
tk update <task_ref> --depends-on-add <uuid>
tk update <task_ref> --extra-set '{"owner":"runtime"}'
tk update <task_ref> --close "调查已经结束"
```

记录持久事件：

```sh
tk log <task_ref> --message "已复现基准结果" --body "见 ./records/baseline.md"
```

用户明确希望保存仍在形成的想法、调查或计划时使用 `planning`。已经开始实际处理时使用 `open`。`closed` 表示这项努力已经结束，包括完成、放弃、不可行或被替代。

## 维护项目数据

检查项目且不修改内容：

```sh
tk check
```

把正式发布的旧 schema 逐级向前迁移：

```sh
tk metadata migrate --dry-run
tk metadata migrate
```

在 split 和 embed 之间切换整个项目：

```sh
tk metadata switch --to embed --dry-run
tk metadata switch --to embed
```

重命名任务并查看引用，但不自动改写引用：

```sh
tk rename <task_ref> "新名称" --dry-run
tk rename <task_ref> "新名称"
```

保存名称可以包含排版空格，生成目录仍保留无空格后缀。读取和检查保留这种合法写法，具体见[任务名称](./design/data-model.zh.md#任务名称)。显式 rename 会规范化请求名称，即使源排版已经合法，也可能移动目录。

移动任务路径的 rename 在存在旧路径引用时以退出码 3 停止。更新报告中的引用后，再重新执行 rename。如果明确接受断链风险并继续移动，加上 `--ignore-brokenlinks`。

同一命令也能修复 split 和 embed 中符合范围的旧字符串名称及可识别生成式后缀不一致问题。使用完整 UUID、精确任务目录或精确受管载体；其他受管数据校验保持严格。closed 任务同样可以改名或修复，并保持其状态。

清理已结束 tk 进程留下的临时内容：

```sh
tk gc --dry-run
tk gc
```

[GC](./design/data-model.zh.md#gc) 规则说明 gc 会删除什么。

多目标命令失败时会报告已完成项和未完成项。发起新的完整命令前，先 read 或 check 当前状态。tk 不保留续跑令牌，也不维护自动回滚状态。

## 卸载 Skill

```sh
tk uninstall --harness codex
tk uninstall --harness claude
tk uninstall --harness pi
tk uninstall --harness omp

tk uninstall --skill-root .agents/skills
```

卸载删除所选根目录下的 `tk-cli` 和 `tk-cli-zh`，包括其中的修改和额外内容。根目录及其他全部子项保持不变。

## Agent 使用

tk 提供两个可独立发现的 Skill：[tk-cli](../skills/tk-cli/SKILL.md) 和 [tk-cli-zh](../skills/tk-cli-zh/SKILL.md)。每个 Skill 都携带完整参考，全部任务操作使用公开 CLI。

[设计索引](./design/README.zh.md)列出运行时、数据、CLI、安装、Skill 和验证合同。
