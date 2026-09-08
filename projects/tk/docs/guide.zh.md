# tk 用户指南

[English](./guide.md)

tk 使用普通项目文件保存持久 Task，并通过 CLI、MCP 服务器以及 Pi 和 OMP 原生工具执行同一套规则。

Task 是值得持久保存的项目内临时性努力。创建 Task 不代表已经承诺执行或完成。

## 安装运行时

把 `tk` 可执行文件安装到固定的用户级路径：

```text
$HOME/.local/bin/tk
```

该路径必须是具有执行位的常规文件。Harness 组件命令不安装、更新或删除运行时。

确认运行时合同：

```sh
$HOME/.local/bin/tk --output json --version
```

## 安装组件

为支持的 Harness 安装一个选择：

```sh
tk install --harness codex
tk install --harness claude --mode tools --language zh
tk install --harness pi --mode cli --language en
tk install --harness omp --mode cli --language zh
```

`--mode` 接受 `tools` 或 `cli`，默认 `tools`。`--language` 接受 `en` 或 `zh`，默认 `en`。最终安装的 Skill 是 `tk`、`tk-zh`、`tk-cli` 或 `tk-cli-zh`。

tools 模式安装 Harness 集成和所选 Skill。cli 模式只在 Harness 组件中安装所选 CLI Skill。再次使用其他选择运行 install 时，tk 直接更新组件，并删除新选择所取代的已知 Skill 目标。

把自包含 CLI Skill 安装到其他 Skill 根目录：

```sh
tk install --mode cli --skill-root .agents/skills
tk install --mode cli --skill-root /srv/project/skills --language zh
```

`--skill-root` 表示父目录。英文创建 `<skill-root>/tk-cli`，中文创建 `<skill-root>/tk-cli-zh`，tk 可以创建缺失的父目录。相对根目录按进程当前工作目录解析。`--harness` 与 `--skill-root` 必须且只能提供一个，自定义根目录 install 必须显式使用 CLI 模式。

自定义根目录 install 不要求 Harness 可执行文件，也不修改 Harness 配置和注册。它只管理所提供根目录正下方的 `tk-cli` 和 `tk-cli-zh`。已支持 Harness 的用户级集成需要完整注册和干净卸载时，应使用 `--harness`。

`tk install` 只使用当前可执行文件内嵌载荷，不下载组件，也不接受本地归档。现有安装完全匹配时返回 `no_change`。

使用 `--dry-run` 可以检查运行时、内嵌选择和准确目标边界，不执行写入：

```sh
tk install --mode cli --skill-root .agents/skills --language zh --dry-run --output json
```

生命周期和干净卸载规则见[安装](./design/installation.zh.md)。各已支持 Harness 的组件内容见 [Harness 集成](./design/harnesses.zh.md)。

## 初始化项目

在项目目录运行：

```sh
tk init
```

默认使用 `.tk` 作为 Task 根目录，顶层创建采用 strict，元数据使用 split，不执行 Git 策略检查。只需传入与默认值不同的选项：

```sh
tk init --creation-policy permissive --metadata-mode embed
```

旧配置无法解析时，`init --force` 仍会根据本次显式参数和默认值重写项目配置。它不读取或修改 Task 数据。

## 创建和查找 Task

创建顶层 Task：

```sh
tk create task "调查启动延迟"
```

CLI 创建本身就是用户明确操作，因此 strict 项目把它视为已确认。Agent 通过 MCP 或原生工具创建时，必须传入当前对话中真实的授权状态。

tk 创建 Task 时，运行时自动生成 `# <规范化名称>` 作为初始 `TASK.md` 正文。创建完成后可用普通文件工具扩展正文；create 命令和 create 工具不接受正文输入。

search 默认包含 planning、open 和 closed：

```sh
tk search latency
tk search 0192aabb --status closed
tk search ./notes/benchmark.md
tk search 'startup|cold' --regex --search-body --output json
```

使用唯一 Task 引用读取：

```sh
tk read <task_ref>
tk read <task_ref> --view detailed --wal-max-entries 50 --wal-max-length 16000
```

名称、UUID 前缀、文本和材料路径属于 search 输入，不是精确引用。read 和 update 应使用 search 返回的完整引用。

## 处理 Task

在同一个父 Task 下创建子工作项：

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

重命名 Task 并查看引用，但不自动改写引用：

```sh
tk rename <task_ref> "新名称" --dry-run
tk rename <task_ref> "新名称"
```

移动 Task 路径的 rename 在存在旧路径引用时以退出码 3 停止。更新报告中的引用后，再重新执行 rename。如果明确接受断链风险并继续移动，加上 `--ignore-brokenlinks`。

同一命令也能修复 split 和 embed 中符合范围的旧字符串名称及可识别生成式后缀不一致问题。使用完整 UUID、精确 Task 目录或精确受管载体；其他受管数据校验保持严格。

清理已结束 tk 进程留下的临时内容：

```sh
tk gc --dry-run
tk gc
```

GC 只删除已登记的 tk 临时路径，不继续、回滚或修复 Task、迁移、rename 或组件操作。

多目标命令失败时会报告已完成项和未完成项。发起新的完整命令前，先 read 或 check 当前状态。tk 不保留续跑令牌，也不维护自动回滚状态。

## 卸载组件

```sh
tk uninstall --harness codex
tk uninstall --harness claude
tk uninstall --harness pi
tk uninstall --harness omp

tk uninstall --skill-root .agents/skills
```

Harness 卸载会删除整个固定 tk 专用目标，包括其中的用户修改和额外内容。对于共享配置，它只删除 tk 对应的结构化配置项。Codex 卸载还会删除全部已知 tk Skill variant 目标。其他 Harness 内容保持不变。

自定义根目录卸载会删除所提供根目录下的 `tk-cli` 和 `tk-cli-zh`，并保留根目录、`tk`、`tk-zh` 和其他全部子项。

## Agent 使用

tk 提供四个可独立发现的 Skill：[tk](../skills/tk/SKILL.md)、[tk-zh](../skills/tk-zh/SKILL.md)、[tk-cli](../skills/tk-cli/SKILL.md) 和 [tk-cli-zh](../skills/tk-cli-zh/SKILL.md)。四者均为自包含目录。已支持 Harness 的模式和语言决定加载哪一个。自定义根目录可以直接接收任一纯 CLI Skill。

[设计索引](./design/README.zh.md)列出当前运行时、数据、工具、Harness、安装、Skill 和验证合同。
