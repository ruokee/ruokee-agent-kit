# 宿主兼容

[English](./host-compatibility.md) | 中文

把代码加载进宿主进程运行的仓库组件的维护下限规格。完整规则及其理由由[宿主维护决定](../adr/decision/2026-10-04-raise-omp-host-floor.zh.md)记录。

## 目标

- 所有面向 OMP 的组件按一个共同的维护下限 OMP `18.5.0` 维护。面向 OMP 的组件是 `omp-context-pin`、`omp-system-prompt`、`omp-qol`、`omp-status-bar`、`omp-codex-web-access` 以及 `tk` 的 OMP 适配器。
- 每个组件在用户会阅读的位置声明自己的下限。
- 宿主升级后，组件在受维护的宿主上继续工作，不保留只服务维护范围以外宿主的代码。

## 非目标

- 把下限当作安装、激活或运行时的门槛。低于下限的宿主不会被阻止，组件仍可能在那里工作，但没有维护承诺。
- 维护上限、支持版本白名单或公开的支持矩阵。
- 仓库检查器、兼容性管理器、跨组件兼容库或支持版本表。
- 为只以指令或配置形式分发的材料（例如 Skill 和 MCP 配置）设定下限。

## 公共面

每个组件的下限声明在其 README 对的兼容性小节中，该小节是权威声明：

- [projects/omp-context-pin/README.zh.md](../../projects/omp-context-pin/README.zh.md#兼容性)
- [projects/omp-system-prompt/README.zh.md](../../projects/omp-system-prompt/README.zh.md#兼容性)
- [projects/omp-qol/README.zh.md](../../projects/omp-qol/README.zh.md#兼容性)
- [projects/omp-status-bar/README.zh.md](../../projects/omp-status-bar/README.zh.md#兼容性)
- [projects/omp-codex-web-access/README.zh.md](../../projects/omp-codex-web-access/README.zh.md#兼容性)
- [projects/tk/omp/README.zh.md](../../projects/tk/omp/README.zh.md#兼容性)：tk OMP 适配器的 `tools` 模式
- [projects/tk/pi/README.zh.md](../../projects/tk/pi/README.zh.md#兼容性)：tk Pi 适配器的 `tools` 模式

仓库 README 在[组件宿主维护](../../README.zh.md#组件宿主维护)中概述这一策略。

## 不变量

- 每个面向 OMP 的组件在中英文 README 中都把 OMP `18.5.0` 声明为维护下限，不设上限。
- 组件对 `@oh-my-pi/*` 有开发依赖时，这些依赖锁定为 `18.5.0`，测试 fixture 和真实宿主检查以该版本的宿主行为为基线。
- 宿主 peer 声明继续写出组件使用的宿主包，其范围不按下限收窄，也不增加维护上限；不限版本的 `*` 声明保持原样。安装条件、自定义元数据字段和运行时版本检查都不承载下限。
- 只为低于 `18.5.0` 的 OMP 宿主存在的代码路径、探测、fixture、测试和文档段落都被删除。下限及以下引入的宿主行为继续支持，例如 18.5.0 的 subagent footer 尾部。
- 面向其他宿主的组件根据所交付组件的加载条件、所需能力和行为推导下限。证据不足时记录缺口，不发布猜测的下限。
- 在下限范围内，更新保留较早受维护宿主已有的结果。实现按能力或输入结构选择；只有在形状无法区分且有记录在案的语义差异时，才按版本选择。
- 失败保持局部：不可用的功能保留原生行为，或通过已有诊断渠道报告有界、可定位的原因，不声称成功。
- 验证强度取决于实际的行为影响。记录写明证据类型、版本、场景和未覆盖的范围。
- 共同的 OMP 下限对所有面向 OMP 的组件一起调整，并且只能通过单独的决定调整。

## 验收标准

- 每个面向 OMP 的组件的 README 对都把 OMP `18.5.0` 声明为维护下限。
- 面向 OMP 的组件中所有 `@oh-my-pi/*` 开发依赖都是 `18.5.0`。
- 宿主 peer 声明不按下限收窄，也不带维护上限，安装、加载、注册和诊断路径都不把宿主版本与下限比较。
- 组件源码中没有以早于 `18.5.0` 的 OMP 宿主为条件的分支。

## 相关 ADR

- [宿主内组件按共同的 OMP 下限维护](../adr/decision/2026-10-04-raise-omp-host-floor.zh.md)
- [保持可分发组件自包含](../adr/decision/2026-08-24-keep-components-self-contained.zh.md)
- [保留即将弃用扩展的模板功能](../adr/decision/2026-10-07-retain-system-prompt-template.zh.md)
- [以静态上下文字形维护 OMP 状态栏](../adr/decision/2026-10-04-show-static-context-glyph.zh.md)
- [维护 QoL 模型提示词与既有体验调整](../adr/decision/2026-10-07-maintain-qol-model-prompts.zh.md)
