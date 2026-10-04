# omp-codex-web-access

[English](./omp-codex-web-access.md) | 中文

[projects/omp-codex-web-access](../../projects/omp-codex-web-access/README.zh.md) 的规格。

## 目标

- 通过 OMP 已为 `openai-responses` API 注册的模型，为 OMP 增加网页搜索和页面提取，与 OMP 内置工具并存。
- 通过 OMP 原生插件设置配置组件，凭据留在 OMP 的模型注册表中。

## 非目标

- 启动 Codex CLI，或修改 OMP 内置的搜索和抓取设置。
- 由组件自己抓取目标 URL，或探测 DNS、私有地址。
- 返回原始 HTML 或逐字的页面快照。
- 读取、导入、删除或改写旧的 `omp-codex-web-access.yml` 文件。

## 公共面

- `codex_web_search` 和 `codex_web_fetch`：[工具](../../projects/omp-codex-web-access/README.zh.md#工具)。
- 设置、用户级设置和项目覆盖：[配置](../../projects/omp-codex-web-access/README.zh.md#配置)。
- 从旧文件手工迁移：[从旧 YAML 手工迁移](../../projects/omp-codex-web-access/README.zh.md#从旧-yaml-手工迁移)。
- 模型执行与错误：[模型执行](../../projects/omp-codex-web-access/README.zh.md#模型执行)。

## 不变量

- 组件可注册的工具名称只有 `codex_web_search` 和 `codex_web_fetch` 两个。实际只注册有效设置快照中启用的工具，禁用的工具不注册。每个已注册的工具保留各自的加载模式，处于 OMP 的 `read` 审批级别，并把取消传递给模型请求。
- `codex_web_fetch` 在解析模型、查找凭据或发起网络工作之前，拒绝协议不是 HTTP 或 HTTPS 的 URL。
- 原生插件设置是唯一的配置来源。manifest 与运行时校验器使用相同的键、类型、枚举和默认值。
- 设置在第一次 `session_start` 时作为一个完整对象校验。对象无效时两个工具都不注册；同一进程内切换会话不会刷新设置。
- 插件设置只保存模型选择器。端点、请求头和凭据来自 OMP。
- 错误信息有界，从不暴露凭据或请求头。

## 宿主下限

OMP `18.5.0`，声明在[兼容性](../../projects/omp-codex-web-access/README.zh.md#兼容性)。`@oh-my-pi/*` 开发依赖锁定为 `18.5.0`，测试以该宿主的行为为基线。通用规则见 [.agents/spec/host-compatibility.zh.md](./host-compatibility.zh.md)。

## 验收标准

- 在组件目录运行 `bun run typecheck` 和 `bun test` 通过。
- 在使用真实模型的真实 OMP CLI 会话中，`codex_web_search` 和 `codex_web_fetch` 各自返回带引用来源 URL 的回答。
- manifest 与运行时校验器对每个设置都一致。

## 相关 ADR

- [Codex 网页访问使用原生插件设置](../adr/decision/2026-09-10-use-codex-web-plugin-settings.zh.md)
- [宿主内组件按共同的 OMP 下限维护](../adr/decision/2026-10-04-raise-omp-host-floor.zh.md)
- [保持可分发组件自包含](../adr/decision/2026-08-24-keep-components-self-contained.zh.md)
