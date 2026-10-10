# 验证

[English](./verification.md)

## 宿主接口

导入使用编译宿主公开的入口。源编码保持使用 `buildResponsesInput`，其经过模型适配及 hoist 的输出传给 `buildOpenAiNativeHistory`，不传原始消息，以执行原生 V2 重放规范化。opaque 来源比较通过同一原生编码器处理单条 compaction record，要求唯一匹配，并在规范化之前恢复原 record。局部图片资格通过原生 `images.urls.enabled` handle 读取当前会话设置，包括子会话覆盖；缺失 handle 报告为不可用。

相关宿主源码路径位于 `@oh-my-pi/pi-agent-core`、`pi-ai` 和 `pi-coding-agent` 包内，包括 `src/sdk.ts`、`src/registry/agent-registry.ts`、`src/session/session-maintenance.ts`、`src/session/date-cwd-reminder.ts`、`src/session/messages.ts`、`src/compaction/compaction.ts` 和 `src/providers/openai-shared.ts`。

## 已核对内容

在 OMP `18.5.0` 及更高的受维护宿主上运行的真实原生 CLI 覆盖完整范围复用、工具输出裁剪后的局部复用、主会话/task/Eval 归属、并行子会话隔离、子会话 revive 与取消，以及 switch/branch/tree 恢复。同一批运行还覆盖宿主导入、opaque 身份、必需局部复用，以及原生 task、Eval 子会话的 false/true 图片设置覆盖。

受控合成 HTTP 验证原生 serializer、调度和 maintenance；合成 usage 只覆盖机制，真实 Provider 行为与运行验证来自原生 CLI 运行。没有独立单元合同的 context 或 provider-request handler 会阻止局部证明，完整范围复用仍然可用。缓存收益来自另行授权的真实 Provider 运行。

## 替换条件

受维护原生接口在所需路径提供等价配置、隔离、复用安全及失败行为后，以行为验证为依据替换本适配。
