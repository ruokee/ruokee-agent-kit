# Handoff 对齐

[English](./handoff.md)

Handoff 请求可能遗漏普通请求新增的系统指令，并使用不同生成选项。即使重新发送同一段对话，这些差异仍可能破坏共同前缀，导致缓存失配。Handoff 对齐从同一会话普通请求恢复符合条件的共同内容及受支持选项。

## 支持范围

缓存对齐的目标是覆盖几乎所有可使用原生 Handoff 的模型。当前支持如下，尚未实现投影的 API 保持原生。开关独立于远端对齐及其 Provider 筛选和模式。

- `openai-completions`：Chat Completions 可恢复普通系统指令、思考强度和隐式工具选择。
- `openai-responses`：Responses 恢复缺失系统内容，保留原生思考配置及文档生成工具选择。
- `anthropic-messages`：Anthropic 支持原生 API-key 和 OAuth 认证，只恢复有证明的系统内容，包括缺失片段或末片段后缀。原生 `tool_choice: none`、thinking、messages、tools、metadata 和副会话身份保持不变。OAuth billing 字节由 OMP 原生 CCH 处理根据最终候选生成。

Handoff 对齐保留交接指令、新历史、缓存键、独立会话和取消行为。缓存可用性及收益仍取决于提供方。

## 启用

通过[原生配置](../README.zh.md#配置)设置 `handoffCacheEnabled=true`，然后重启 OMP。默认 `false`，没有额外 Provider 筛选或模式。

生成 Handoff 前先发送普通提示词，使扩展获得可比较的已确认请求。普通请求必须携带工具集合，从不发送工具的会话保持原生。

原生 CLI/SDK 主会话、task 和 Eval 子会话各自保留参照。Eager 加载、缓存命中延迟加载及进程恢复均遵循同一普通发送要求。手工构造 Agent 或替换私有准备函数不在本支持范围内。

Anthropic 要求原生工具定义匹配，并证明历史前缀一致。比较时可规范化已知内容块的缓存标记及等价的字符串/text 块表达，不改变出站 messages 和 tools 的缓存标记。缓存关闭、TTL 不兼容、缓存断点超额、未知形状或无法证明的调用方 fetch 均保持原生请求。扩展保留原生传输、认证和重试。

## 查看结果

运行 `/smart-context`，单独查看 Handoff，不与 Remote 状态混用。

- `awaiting-reference`：等待可用且已确认的普通请求。
- `already-aligned` 或 `rewritten`：对齐成功，分别表示无需改写或已经改写。
- `rejected`：Handoff 请求原样发送，未被阻断或延迟。
- `unavailable`：必要接口或配置不可用，或其他扩展占用了冲突接口。

会话或分支切换、压缩、取消，以及模型、系统指令、思考配置或工具变化，都可能使早前请求不再可用。新的普通工作可恢复后续 Handoff 的对齐资格，见[状态](./status.zh.md)。

## 原生行为

OMP 仍负责文档生成及验证、手动 focus、自动入口、投机、取消、重试和回退，以及结果提交或拒绝。对齐不新增命令或文档存储，不改变手动压缩。

共同内容不足或请求归属变化时，完整请求保持原生。后续扩展选项继续有效。在 Chat Completions 中，恢复工具选择可能让模型返回工具调用而非文档文本，OMP 仍按原生生成失败处理。除上述受支持的投影维度外，生成策略保持原生。

停止对齐时，设置 `handoffCacheEnabled=false` 后重启。关闭 Remote 不会关闭 Handoff，关闭 Handoff 也不会关闭 Remote。
