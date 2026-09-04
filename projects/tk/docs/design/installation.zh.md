# 安装

[English](./installation.md)

本文定义 Linux 用户级 tk 运行时前提、内嵌 Harness 组件与独立 CLI Skill 载荷、安装、更新、卸载和失败语义。命令语法见 [CLI 参考](./cli-reference.zh.md#tk-install)，已支持 Harness 的组件内容见 [Harness 集成](./harnesses.zh.md)。

## 运行时前提

全部组件生命周期都使用固定运行时路径：

```text
$HOME/.local/bin/tk
```

规划操作前，tk 会验证该路径存在、是常规文件，并具有至少一个 Unix 执行位。实际启动 Harness 失败时保留操作系统错误。

组件生命周期命令不安装、更新或删除运行时本身。

## 内嵌载荷

Cargo 构建多份 Harness 载荷，覆盖四个 Harness、两种模式和两种语言。构建还会生成两份与 Harness 无关的 CLI Skill 载荷，每种语言一份，并在 `OUT_DIR` 写入一个确定性 `tar.zst` 和一份对应清单。

清单把 Harness 载荷保存在 `components` 中，由 Harness、模式、语言和 Skill 标识。独立 CLI Skill 载荷保存在 `cli_skills` 中，由语言和 Skill 标识，不含 Harness 字段。运行时通过 `include_bytes!` 嵌入清单和归档。安装只读取这些内嵌产物，不访问网络。

模式为 `tools` 和 `cli`，语言为 `en` 和 `zh`，对应 Skill 名称为 `tk`、`tk-zh`、`tk-cli` 和 `tk-cli-zh`。Harness install 默认使用 tools 模式和英文。自定义根目录 install 只支持 CLI 模式，并默认使用英文。

## 清单

清单记录安装所需的静态事实：

- component format version；
- runtime version 与 `runtime_compat`；
- `source_revision`；
- 每个 Harness 组件的 Harness、模式、语言和 Skill 名称；
- 每个独立 CLI Skill 的语言和 Skill 名称；
- 归档内允许的相对路径、文件类型、权限和内容摘要。

摘要用于验证内嵌归档没有损坏或路径错配，不用于记录安装所有权或决定卸载保留项。

设置 `TK_SOURCE_REVISION` 时使用该值。否则 `source_revision` 为 `package-v<CARGO_PKG_VERSION>`。构建脚本不调用 Git。

## 归档验证

任何持久写入前完成：

1. 清单与归档可以解码；
2. component format 受支持；
3. Rust 判断运行时版本满足 `runtime_compat`；
4. 请求目标、模式、语言、Skill 名称和载荷根目录符合所选清单项；
5. 每个归档路径是规范相对路径，不绝对、不含 `..`、不逃逸；
6. 文件类型、权限、重复项、缺失项、多余项和摘要符合清单；
7. 对 Harness 操作，目标 Harness 可用，官方接口或记录的直接配置方式可执行。

归档验证不建立来源身份、签名、安装所有权或历史摘要系统。

## 生命周期

每条 install 与 uninstall 命令必须且只能选择一种目标：通过 `--harness` 选择已支持 Harness，或通过 `--skill-root` 选择 Skill 根目录。

Harness 组件有三种基础生命周期动作：

- install：当前没有 tk 组件时写入并注册所选组件；
- update：当前载荷、注册、模式、语言或 Skill 与请求不同时直接替换；
- uninstall：移除全部 tk 专用内容和注册，包括已知的残留 Skill variant。

自定义根目录 install 要求显式 CLI 模式。英文写入 `tk-cli`，中文写入 `tk-cli-zh`，目标位于所提供的父目录下。它会修复所选目标内的内容偏差，删除另一种语言的 CLI Skill 目标，并在两个受管目标都符合要求时收敛为 no_change。自定义根目录 uninstall 删除两个 CLI Skill 目标，不接受模式或语言选择。

相对 Skill 根目录按进程当前工作目录解析。组件操作拒绝全局 `--cwd`。结果中的 `skill_root` 是绝对路径。

生命周期计划只使用固定 tk 专用目标、已知 Skill 目标名称、适用的 tk 配置项和所选内嵌载荷，不依赖安装历史、根目录登记表或另一份所有权数据库。

## Harness 官方接口

已支持 Harness 提供官方安装或卸载 API 时优先使用该 API。tk 接受官方机制规定的目标和清理行为，并在执行前验证命令可用。

只有在 Harness 没有可用官方接口时，tk 才直接管理记录在组件驱动中的固定 tk 专用目标和 tk 配置项。

具体目标路径、配置键和官方命令属于各 Harness 驱动的实现细节。自定义根目录操作不调用 Harness 接口，也不安装 Harness 专用包装、manifest、extension、Package、Plugin、MCP 配置或操作注册。

## 预检

dry-run 与执行共享相同预检：

- 固定运行时前提；
- 所选内嵌清单项、归档和兼容范围；
- 所选生命周期所有权边界内的每个当前目标都可以读取；
- 计划中的新增、替换和整目录删除；
- 多目标活动操作标记不存在。

Harness 操作还会验证 Harness 可用性、官方接口、已知残留目标和共享配置完整解析。自定义根目录操作会验证解析后的绝对根目录，以及名称完全匹配的 `tk-cli` 与 `tk-cli-zh` 子目录，不检查 Harness 配置或根目录中的无关条目。

预检不读取 Task 项目、项目配置、WAL、Git 状态或早先安装历史。

## 安装和更新

安装或更新按确定顺序提交：

1. 创建最小清理清单和活动操作标记；
2. 在 tk 临时位置准备所选载荷；
3. 再次验证全部已观察目标，以及 Harness 操作的共享配置；
4. 提交所选 tk 专用文件和目录；
5. 对 Harness 操作，按所选模式添加、替换或删除 tk 注册；
6. 删除新选择所取代的 tk Skill 目标；
7. 删除临时内容、清单和活动操作标记。

自定义根目录 install 可以创建所提供的父目录及其父目录。它只把 `<skill-root>/tk-cli` 和 `<skill-root>/tk-cli-zh` 视为受管目标。配置不能指向临时路径。

普通 I/O 错误时立即停止。结果列出已完成和未完成项，不自动回滚，不生成续跑令牌，也不在进程退出后继续。

重新运行 install 会重新读取当前文件。符合所选内嵌载荷时返回 no_change，不读取上一次失败的领域状态。

## 干净卸载

干净卸载会移除所选生命周期负责的全部目标，包括 tk 专用目录中的修改和额外内容，同时保留无关内容。

### Harness 目标

Harness 卸载完成后，该 Harness 应与从未安装过 tk 等价。固定路径明确专用于 tk 时，卸载删除整个文件或目录。Codex 的四个已知 Skill 目标都属于 tk 专用路径，卸载时一并删除。卸载后不保留无法使用的 tk 残片。

该规则不适用于共享目录。

### 自定义 Skill 根目录

自定义根目录 uninstall 删除 `<skill-root>/tk-cli` 和 `<skill-root>/tk-cli-zh`。它保留 Skill 根目录本身、`tk`、`tk-zh` 和其他全部子项。自定义根目录 install 不创建 Harness 注册，因此 uninstall 也不删除注册。

### 共享结构化配置

官方 Harness 卸载 API 可用时优先使用。必须直接编辑共享配置时：

1. 完整读取并解析；
2. 解析失败时保持原文件不变并返回错误；
3. 只删除 tk 对应的结构化配置项，不比较旧值；
4. 保留其他全部配置；
5. 如果配置文件由 tk 在本次 Harness 生命周期中创建，且删除 tk 项后为空，可以删除文件；
6. 否则保留文件，包括合法的空共享配置文件。

固定的 Harness 驱动必须明确哪些配置文件是 tk 专用文件，哪些是共享文件。

### 卸载提交

卸载在修改前完成全部读取和解析。Harness uninstall 撤销 tk 注册，删除当前组件目标和已知残留 Skill variant，并移除共享配置中的 tk 项。自定义根目录 uninstall 删除两个 CLI Skill 目标。两条路径都按确定顺序执行，遇到普通 I/O 错误时停止并报告完成和未完成项。

部分完成是失败状态，不是可选择的部分卸载功能。tk 不根据内容摘要保留被修改的 tk 专用文件。

## 临时内容与 GC

组件操作使用[最小清理清单](./data-model.zh.md#最小清理清单)。清单只记录进程身份、创建时间和 tk 临时路径。

异常退出后，GC 可以删除已结束进程的组件临时文件、目录、清单和标记。GC 不继续 install、update 或 uninstall，也不修改 Harness 规范目标、自定义 Skill 根目录或 Harness 配置。

## 与外部内容共存

Harness 生命周期操作管理固定 tk 专用目标、四个已知 tk Skill 目标名称和共享配置中的 tk 项。自定义根目录操作只管理所提供根目录正下方的 `tk-cli` 和 `tk-cli-zh`。其他 Skill、Plugin、Package、MCP 注册、用户配置和相邻目录不在计划中，也不因路径邻近被删除。

## 兼容性

Rust 解析并判断 `runtime_compat`。Pi 和 OMP TypeScript 适配器只读取 Rust 已验证的版本和生成合同，不实现自己的 semver 解析器。

component format 不受支持、运行时不兼容、所选清单项无效或归档无效时，在持久写入前失败。Harness 操作还会在 Harness 不可用时于写入前失败。
