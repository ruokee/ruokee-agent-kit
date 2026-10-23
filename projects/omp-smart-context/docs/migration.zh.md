# 迁移上下文能力

[English](./migration.md)

`@ruokee/omp-smart-context` 替换 smart-cache、独立 context-pin，以及 QoL 的压缩用量和模型提示词模块。它只读取自身原生设置。迁移需要显式修改配置，扩展不代为修改。

## 保留有效设置

删除任何内容前，先检查旧用户设置及每个项目的覆盖。

### 远端设置

将 smart-cache 的 `compactionCacheEnabled`、`compactionCacheMode` 和 `handoffCacheEnabled` 复制到新包相同作用域。旧 `compactionCacheProvider` 改存为 `compactionCacheProviderFilter`。保留值和覆盖关系，缺失键沿用相同默认值。

新包若已有 `compactionCacheProvider`，先迁移值，再从用户级和项目级设置中移除旧键。它不是别名，遗留会拒绝整个新配置。筛选不选择模型、路由或压缩方式。

### QoL 设置

1. 读取旧用户值。默认值为 `enabled=true`、`compactionUsageEnabled=true`、`modelPromptsEnabled=false`。
2. 对每项迁出模块计算 `enabled && 模块开关`，将两个结果写入新包，不复制 QoL 总开关 `enabled`。
3. 对每个项目，先将旧 QoL 项目覆盖合并到旧用户值，再计算同样的结果，写入必要的新项目覆盖。即使没有显式模块键，项目总开关覆盖仍可能改变两项模块。
4. 从用户级及项目级 QoL 设置中移除 `compactionUsageEnabled`、`modelPromptsEnabled`。任一遗留都会拒绝整个 QoL `0.5.10` 配置。保留所有无关键，包括 QoL 总开关。

例如，用户 QoL `enabled=false` 时，两项迁出模块均关闭，即使 `compactionUsageEnabled=true`。某项目覆盖 `enabled=true` 和 `modelPromptsEnabled=true` 时，需要在新配置中开启两项模块。

### Pin 设置

已有独立 Pin 用户须在需要的各作用域显式设置 `pinEnabled=true`。新默认值为 `false`，仅安装不会提供 Pin 工具或命令。不需要的作用域保持关闭。

通过 OMP 原生插件配置命令处理每个作用域。`omp plugin config list @ruokee/omp-smart-context` 显示新设置。本包没有总开关。

## 替换注册

1. 在组件目录安装锁定依赖及组件。
2. 移除旧 smart-cache 和独立 Pin 注册，包括加载它们的手动扩展路径。
3. 将 QoL 更新到没有迁出实现的版本，保留无关插件和设置。
4. 修改注册和设置后重启 OMP。

运行进程保留已加载代码及设置。新包拒绝旧 smart-cache 或 QoL 占用的冲突接口，不继承它们。同进程同时加载新旧实现不能完成迁移。

上下文状态用 `/smart-context`，QoL 留存能力用 `/qol`。`/smart-cache` 没有别名。启用 Pin 后保留 `/ctx-pin` 和 `ctx_pin`。

## 保留既有数据

会话日志及 `model_usage` 条目保持原样。规则文件仍位于当前配置档案用户 agent 的 `model-prompts` 和项目 `.omp/model-prompts`，文件名、元数据及正文不变，无需转换或复制。

Pin 保留记录类型 `omp-context-pin`、消息类型 `omp-context-pin-change` 和 `omp-context-pin-result`，以及记录版本 `2`。这些持久化名称不是对已退出包的依赖。受支持的条目编号、操作身份、修订号及正文原样重放。不要为了改名而改写日志。

关闭 Pin 只停止新增保留文本消息，不删除记录或历史，重新启用后恢复重放。关闭用量保留历史条目。关闭模型规则停止读取、注入及未使用文件诊断。规则文件编辑在下一受覆盖普通轮次生效，开关修改需重启。
