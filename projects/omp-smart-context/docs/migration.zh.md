# 迁移上下文能力

[English](./migration.md)

`@ruokee/omp-smart-context` 替换 `@ruokee/omp-smart-cache` 及 `@ruokee/omp-qol` 的压缩请求用量和模型提示词模块。它只读取自身的原生插件设置。迁移需要显式修改配置，不通过运行时兼容路径完成。

## 保留有效设置

删除旧设置前，检查用户级配置及每个项目的覆盖。

1. 将 smart-cache 的 `compactionCacheEnabled`、`compactionCacheProvider`、`compactionCacheMode`、`handoffCacheEnabled` 复制到新包设置的原有作用域。保留精确 Provider 名称和模式，缺失键沿用相同默认值。
2. 对用户级 QoL 设置，以 `enabled && 模块开关` 计算每个迁出模块的有效值。缺失的 QoL `enabled` 为 `true`，缺失的 `compactionUsageEnabled` 为 `true`，缺失的 `modelPromptsEnabled` 为 `false`。将两个有效结果写到新包，不复制 QoL 的总开关 `enabled`。
3. 对每个项目，先将旧 QoL 项目覆盖合并到旧用户设置之上，再计算同样的两个有效结果，并写入必要的新项目覆盖。即使项目没有两个模块键，对旧总开关的覆盖仍可能改变两项结果。保留最终行为，不只是复制显式键。
4. 从**用户级及项目级 QoL 设置**中删除 `compactionUsageEnabled`、`modelPromptsEnabled`。任一遗留键对 QoL `0.5.10` 都是未知键，会使整个 QoL 配置被拒绝。保留其余所有 QoL 设置，包括总开关。

例如，用户 QoL 设置 `enabled=false` 时，两项迁出模块都关闭，即使 `compactionUsageEnabled=true`。某项目若覆盖 `enabled=true` 和 `modelPromptsEnabled=true`，则需要在该项目的新配置中开启两个模块开关。

通过 OMP 原生插件配置命令修改相应作用域。`omp plugin config list @ruokee/omp-smart-context` 显示新组件设置。新组件没有总开关。

## 替换注册

在本组件目录安装锁定依赖及组件。移除旧 smart-cache 注册，以及任何加载它的手动扩展路径。将 QoL 更新到已删除迁出实现的版本，保留无关插件和设置。

修改注册或设置后重启 OMP。运行中的进程保留已加载代码、激活快照和进程级包装。新包发现旧 smart-cache 对齐 owner 或旧 QoL 用量 owner 时拒绝接管，不继承其状态。在同一进程同时加载新旧实现不能完成迁移。

上下文状态使用 `/smart-context`，QoL 留存能力使用 `/qol`。不保留 `/smart-cache` 别名。

## 保留既有数据

保留会话 journal 和 `model_usage` 条目。规则文件继续使用当前 profile 的用户 agent `model-prompts` 目录及项目 `.omp/model-prompts` 目录，名称、frontmatter 和正文不变，无需转换或复制。

关闭用量补记只停止后续补偿，不移除历史条目。关闭模型规则停止读取、注入和未使用文件诊断。文件编辑在下一个受覆盖 turn 生效，开关编辑需要重启。
