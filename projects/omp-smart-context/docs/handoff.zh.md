# Handoff 对齐

[English](./handoff.md)

Handoff 请求可能遗漏普通请求新增的系统指令，并使用不同生成选项。即使重新发送同一段对话，这些差异仍可能破坏共同前缀，导致缓存失配。Handoff 对齐从同一会话普通请求恢复符合条件的共同内容及受支持选项。

## 支持范围

支持 `openai-completions` 和 `openai-responses`，其他 API 保持原生。开关独立于远端对齐及其 Provider 筛选和模式。

- Chat Completions 可恢复普通系统指令、思考强度和隐式工具选择。
- Responses 恢复缺失系统内容，保留原生思考配置及文档生成工具选择。

两者均保留交接指令、新历史、缓存键、独立会话和取消行为。缓存可用性及收益仍取决于提供方。

## 启用

通过[原生配置](../README.zh.md#配置)设置 `handoffCacheEnabled=true`，然后重启 OMP。默认 `false`，没有额外 Provider 筛选或模式。

生成 Handoff 前先发送普通提示词，使扩展获得可比较的已确认请求。普通请求必须携带工具集合，从不发送工具的会话保持原生。

## 查看结果

运行 `/smart-context`，单独查看 Handoff，不与 Remote 状态混用。

- `awaiting-reference`：等待可用且已确认的普通请求。
- `already-aligned` 或 `rewritten`：对齐成功，分别表示无需改写或已经改写。
- `rejected`：Handoff 请求原样发送，未被阻断或延迟。
- `unavailable`：必要接口或配置不可用，或其他扩展占用了冲突接口。

会话或分支切换、压缩、取消，以及模型、系统指令、思考配置或工具变化，都可能使早前请求不再可用。新的普通工作可恢复后续 Handoff 的对齐资格，见[状态](./status.zh.md)。

## 原生行为

OMP 仍负责文档生成及验证、手动 focus、自动入口、投机、取消、重试和回退，以及结果提交或拒绝。对齐不新增命令或文档存储，不改变手动压缩。

共同内容不足或请求归属变化时，完整请求保持原生。后续扩展选项继续有效。在 Chat Completions 中，恢复工具选择可能让模型返回工具调用而非文档文本，OMP 仍按原生生成失败处理。Responses 保留原生文档生成选择。

停止对齐时，设置 `handoffCacheEnabled=false` 后重启。关闭 Remote 不会关闭 Handoff，关闭 Handoff 也不会关闭 Remote。
