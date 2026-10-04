# omp-qol

[English](./omp-qol.md) | 中文

[projects/omp-qol](../../projects/omp-qol/README.zh.md) 的规格。

## 目标

- 在一个包里提供五项可分别开关的 OMP 调整：持续等待、符合条件的上游临时错误后续跑、延长单个压缩期限、恢复会话时沿用原生历史、远端压缩缓存对齐。
- 这些调整共用一次安装、一个配置入口和一套检查，每项调整有各自的开关、可用状态和失败报告。

## 非目标

- 外部工具的守卫，以及与这些调整无关的宿主行为。
- 替用户安装或迁移，或修改其他扩展、用户配置或已安装的宿主文件。
- 在等待入口上提供只含消息的续等、按进程名等待或只含服务的续等。
- 精简设置项。

## 公共面

- 调整项与默认值：[调整项](../../projects/omp-qol/README.zh.md#调整项)。
- 设置的键名、默认值和范围：[配置](../../projects/omp-qol/README.zh.md#配置)以及 `package.json` 中的 `omp.settings` manifest。
- `/qol` 状态命令：[状态](../../projects/omp-qol/README.zh.md#状态)。
- 各调整的行为、边界和验证：[projects/omp-qol/docs/adjustments.zh.md](../../projects/omp-qol/docs/adjustments.zh.md)。

## 不变量

- `omp-qol` 0.5.0 的 manifest 声明的设置项逐项保留，包括 `compactionCacheEnabled` 和 `compactionCacheProvider` 两个缓存设置，键名、默认值和取值范围不变。
- `waitMessagesSeconds` 和 `waitProcessSeconds` 在受支持的宿主上不起作用，中英文文档和 manifest 的设置说明写明这一点。
- 续等只服务独立的 `wait` 入口。入口缺失、属于他方或无法识别时，保留原生行为并报告有界的原因。
- 压缩期限补丁保留所有权检查：拒绝与带有 `Symbol.for("ruokee.omp.compaction-timeout.patched")` 标记的补丁共存，后续的同类激活也不会接管已有的所有者。
- 配置只来自 OMP 插件设置，每次激活读取一次。
- 一项调整出错不会停用其他调整。被拒绝的设置只给出键名和规则，不回显其值。
- 组件不保留只为 OMP 18.5.0 以前宿主存在的代码路径，包括只服务内置 `hub` 工具的等待路径。

## 宿主下限

OMP `18.5.0`，声明在[兼容性](../../projects/omp-qol/README.zh.md#兼容性)。`@oh-my-pi/*` 开发依赖锁定为 `18.5.0`，测试以该宿主的行为为基线。通用规则见 [.agents/spec/host-compatibility.zh.md](./host-compatibility.zh.md)。

## 验收标准

- 在组件目录运行 `bun run typecheck` 和 `bun test` 通过。
- manifest 与 0.5.0 的 manifest 逐项一致：全部设置项（含两个缓存设置）保留，键名、默认值和范围不变。
- `waitMessagesSeconds` 和 `waitProcessSeconds` 的说明写明它们不起作用。
- 每项调整的真实 OMP CLI 证据记录在 [projects/omp-qol/docs/adjustments.zh.md](../../projects/omp-qol/docs/adjustments.zh.md) 对应的验证小节，未运行的场景标为未验证。

## 相关 ADR

- [在独立等待入口上维护 OMP 体验调整](../adr/decision/2026-10-04-use-standalone-qol-wait.zh.md)
- [Codex 网页访问使用原生插件设置](../adr/decision/2026-09-10-use-codex-web-plugin-settings.zh.md)
- [宿主内组件按共同的 OMP 下限维护](../adr/decision/2026-10-04-raise-omp-host-floor.zh.md)
- [保持可分发组件自包含](../adr/decision/2026-08-24-keep-components-self-contained.zh.md)
