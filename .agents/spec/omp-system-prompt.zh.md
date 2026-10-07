# omp-system-prompt

[English](./omp-system-prompt.md) | 中文

[projects/omp-system-prompt](../../projects/omp-system-prompt/README.zh.md) 的规格。

## 目标

- 只在宿主用组件自己的模板渲染出主块的轮次，把维护的英文策略应用到主系统提示。
- 随包提供这份模板作为可选示例 `host-template.hbs`，由组件的模板源生成。是否使用由用户决定。
- 标记组件即将弃用，同时保留模板、Delivery、页脚及当前维护，不设删除日期或自动卸载。
- 由插件设置 `renderDelivery` 开关组件拥有的 `# Delivery` 章节。

## 非目标

- 识别、转换或改写宿主默认系统提示的文本结构。
- 写入、复制或选择模板文件，写入用户配置或已安装的宿主文件，修改或删除用户的任何系统提示输入。
- 读取宿主版本来决定激活、转换、诊断或回退。
- 调整其他扩展的顺序，或声称优先于后续 handler。
- 发现、读取、追加或转发模型规则文档，该能力归 QoL。

## 公共面

- 模板路线和可选的安装步骤：[工作机制](../../projects/omp-system-prompt/README.zh.md#工作机制)和[选择模板](../../projects/omp-system-prompt/README.zh.md#选择模板)。
- `renderDelivery` 设置：[Delivery 配置](../../projects/omp-system-prompt/README.zh.md#delivery-配置)。
- 即将弃用状态与模型规则归属：[即将弃用](../../projects/omp-system-prompt/README.zh.md#即将弃用)。
- 原样放行与诊断：[失败回退](../../projects/omp-system-prompt/README.zh.md#失败回退)和[覆盖边界](../../projects/omp-system-prompt/README.zh.md#覆盖边界)。
- 安装、更新和 handler 顺序：[安装](../../projects/omp-system-prompt/README.zh.md#安装)。

## 不变量

- 中英文 README 的安装指引都把模板列为可选步骤，并写明两种启用方式：运行时传入 `--system-prompt-template <host-template.hbs 的路径>`，或者把文件放为项目级或用户级的 `SYSTEM_TEMPLATE.md`。
- 安装指引写明宿主的选择顺序：命令行参数优先于发现的文件；项目级优先于用户级；同一级别内 `SYSTEM.md` 优先于 `SYSTEM_TEMPLATE.md`。因此存在更优先的 `SYSTEM.md` 时，安装的模板不会生效。
- 提交的 `host-template.hbs` 由组件拥有的模板源生成，两者不会出现偏差。
- 当前轮的主块由组件模板渲染时，扩展按模板路线处理：模板块逐字节保留，除非关闭，Delivery 章节紧随其后，`<project-context>` footer 得到校正。footer 校正识别主代理尾部和 OMP 18.5.0 引入的 subagent 尾部。
- 当前轮的主块不是由组件模板渲染时，扩展不修改系统提示（包括 `<project-context>` footer），也不报告诊断。这包括没有模板、使用 `SYSTEM.md`、使用 `--system-prompt` 以及使用其他模板的情况。
- 模型规则不再是本组件 handler、别名或转发入口。两个更新组件共存时，实际加载顺序为本组件在 QoL 之前；模板与规则失败相互隔离，不重排后续 handler。
- 诊断只带有界的原因，不含提示词正文、Skill 名称、私有路径或会话上下文，并按会话去重。
- 组件不保留只为 OMP 18.5.0 以前宿主存在的代码路径、探测、fixture、测试或文档段落，包括默认块路线和旧 `PROJECT` footer 处理。

## 宿主下限

OMP `18.5.0`，声明在[兼容性](../../projects/omp-system-prompt/README.zh.md#兼容性)。`@oh-my-pi/*` 开发依赖锁定为 `18.5.0`，测试以该宿主的行为为基线。通用规则见 [.agents/spec/host-compatibility.zh.md](./host-compatibility.zh.md)。

## 验收标准

- 在组件目录运行 `bun run typecheck`、`bun test` 和 `bun run build:template` 通过，模板偏差测试通过。
- 在 OMP 18.5.0 或更新的宿主上，按 README 安装模板后，主代理的系统提示由该模板渲染并经模板路线处理。证据来自发给 Provider 的请求，而不只是 handler 的返回值。
- 没有设置模板，或使用 `SYSTEM.md`、`--system-prompt` 时，Provider 收到的系统提示词与宿主输入逐字节相同，会话中没有本组件的诊断。
- 组件运行前后，用户的系统提示文件内容不变。
- 源码中没有以 OMP 18.5.0 以前宿主为条件的分支。
- 组件与仓库说明标明即将弃用及 QoL 的规则归属，不声称已移除或停止维护。用户模板/规则及安装状态保持不变。

## 相关 ADR

- [保留即将弃用的系统提示词模板](../adr/decision/2026-10-07-retain-system-prompt-template.zh.md)
- [宿主内组件按共同的 OMP 下限维护](../adr/decision/2026-10-04-raise-omp-host-floor.zh.md)
- [保持可分发组件自包含](../adr/decision/2026-08-24-keep-components-self-contained.zh.md)
