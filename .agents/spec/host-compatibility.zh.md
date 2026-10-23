# 宿主兼容

[English](./host-compatibility.md) | 中文

把代码加载进宿主进程运行的仓库组件的维护下限规格。完整规则及其理由由[宿主维护决定](../adr/decision/2026/09/28-host-maintenance.zh.md)记录。

## 目标

- 所有面向 OMP 的组件按一个共同的维护下限 OMP `18.5.0` 维护。面向 OMP 的组件是 `omp-qol`、`omp-smart-context`、`omp-status-bar` 以及 `tk` 的 OMP 适配器。
- 每个组件在用户会阅读的位置声明自己的下限。
- 宿主升级后，组件在受维护的宿主上继续工作，不保留只服务维护范围以外宿主的代码。

## 非目标

- 把下限当作安装、激活或运行时的门槛。低于下限的宿主不会被阻止，组件仍可能在那里工作，但没有维护承诺。
- 维护上限、支持版本白名单或公开的支持矩阵。
- 仓库检查器、兼容性管理器、跨组件兼容库或支持版本表。
- 为只以指令或配置形式分发的材料（例如 Skill 和 MCP 配置）设定下限。

## 公共面

每个组件的下限声明在其 README 对的兼容性小节中，该小节是权威声明：

- [projects/omp-qol/README.zh.md](../../projects/omp-qol/README.zh.md#兼容性)
- [projects/omp-smart-context/README.zh.md](../../projects/omp-smart-context/README.zh.md#兼容性)
- [projects/omp-status-bar/README.zh.md](../../projects/omp-status-bar/README.zh.md#兼容性)
- [projects/tk/omp/README.zh.md](../../projects/tk/omp/README.zh.md#兼容性)：tk OMP 适配器的 `tools` 模式
- [projects/tk/pi/README.zh.md](../../projects/tk/pi/README.zh.md#兼容性)：tk Pi 适配器的 `tools` 模式

仓库 README 在[组件宿主维护](../../README.zh.md#组件宿主维护)中概述这一策略。

## 不变量

- 每个面向 OMP 的组件在中英文 README 中都把 OMP `18.5.0` 声明为共同的维护下限，不设上限，其 `@oh-my-pi/*` 开发依赖与检查基线跟随该版本。
- 宿主 peer 声明继续写出组件使用的宿主包，不按下限收窄。安装条件、自定义元数据字段、版本检查，以及安装、加载、注册和诊断路径都不承载下限。
- 只为低于下限的宿主存在的代码被删除，下限及以下引入的宿主行为继续支持。
- 在下限范围内，更新保留较早受维护宿主已有的结果；实现按能力或输入结构选择，只有在形状无法区分且有记录在案的语义差异时才按版本选择。
- 失败保持局部：不可用的功能保留原生行为，或报告有界、可定位的原因而不声称成功；验证强度取决于实际的行为影响。
- 面向其他宿主的组件根据所交付组件的加载条件、所需能力和行为推导下限；证据不足时记录缺口，不发布猜测的下限。
- 共同的 OMP 下限对所有面向 OMP 的组件一起调整，并且只能通过单独的决定调整。

## 验收标准

- 每个面向 OMP 的组件的 README 对都把 OMP `18.5.0` 声明为维护下限。
- 面向 OMP 的组件中所有 `@oh-my-pi/*` 开发依赖都是 `18.5.0`。
- 宿主 peer 声明不按下限收窄，也不带维护上限，安装、加载、注册和诊断路径都不把宿主版本与下限比较。
- 组件源码中没有以早于 `18.5.0` 的 OMP 宿主为条件的分支。

## 相关 ADR

- [宿主维护](../adr/decision/2026/09/28-host-maintenance.zh.md)
- [组件自包含](../adr/decision/2026/08/24-component-self-containment.zh.md)
- [OMP 状态栏](../adr/decision/2026/09/04-omp-status-bar.zh.md)
- [OMP QoL](../adr/decision/2026/09/20-omp-qol.zh.md)
- [Smart context](../adr/decision/2026/10/12-smart-cache.zh.md)
- [Remote 对齐](../adr/decision/2026/10/10-remote-alignment.zh.md)
- [Handoff 对齐](../adr/decision/2026/10/12-handoff-alignment.zh.md)
