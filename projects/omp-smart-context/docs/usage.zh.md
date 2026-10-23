# 补齐压缩请求用量记录

[English](./usage.md)

压缩请求会消耗 token，但部分 OMP 宿主没有把它们计入会话统计。本能力补齐缺失记录及可用的提供方成本，不改变请求，也不保存正文。

## 启用

`compactionUsageEnabled` 默认 `true`。通过[原生配置](../README.zh.md#配置)设置，修改后重启 OMP，无需单独配置遥测。

安装宿主提供原生 `compactionRequestUsage` 时，补记自动停止，状态为 `host-records-usage`，避免双记。检测依据是实际安装能力，不是版本号。

## 记录范围

完成且报告 token 的请求向所属会话分支追加一条 `model_usage`。记录以下四种用途：

- `compaction:summary`：soft 摘要。
- `compaction:short-summary`：soft 短摘要。
- `compaction:turn-prefix`：soft 轮次前缀摘要。
- `compaction:handoff`：Handoff 文档生成。

条目保留实际 API、Provider、模型、报告的 token、停止原因及宿主提供的分项成本。会话统计计入这些条目。关闭或移除能力不会删除已有记录。

## 查看结果

运行 `/smart-context` 查看用量补记是否启用及已写入条目数。总量通过 OMP 会话统计查看。

- `host-records-usage`：宿主原生记账，补记已停用。
- `costMissing`：条目缺少提供方成本，按零记录，不自行估价。
- `unrecorded=api-unresolved`：无法可靠解析请求身份，未写入条目。

切换会话后跟随当前会话日志。仍指向旧会话的请求被跳过，不会记入新会话。

## 限制

零 token 请求不写入。失败但报告计费 token 的尝试仍记录。原生 V2 压缩、分支摘要、评估请求、Skill 描述、图片问答及其他用途不补记。宿主内部重试隐藏的尝试无法从最终用量事件恢复。

会话缺失、Provider 或模型身份有歧义、宿主接口缺失时可能无法记录。扩展不猜测身份、API 或价格，不保存请求正文、摘要、Handoff 文档或独立账本。

用户遥测及回调保留原有行为，包括子会话继承。未配置遥测时，补记通过不导出数据的 tracer 启用宿主请求埋点，会增加埋点处理，但不导出正文。普通轮次遥测不变。

停止新记录时，设置 `compactionUsageEnabled=false` 后重启 OMP。其他能力和历史用量保留。

## 原生替代

[PR #15034](https://github.com/can1357/oh-my-pi/pull/15034) 跟踪上游记账修复。PR 中存在代码、PR 合并及宿主发布并安装是不同阶段。自动停用依据前述原生导出。已发布原生行为覆盖相同请求、成本及活动窗口统计后，未来扩展版本可移除补记模块。既有条目和两类对齐能力保留。
