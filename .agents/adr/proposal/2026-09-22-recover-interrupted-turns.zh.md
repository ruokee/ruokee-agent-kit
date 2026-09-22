# ADR 提案：把续跑判据扩展到中断轮次

Draft owner: Ruokee
Draft writer: deepseek/deepseek-v4.1-flash

[English](./2026-09-22-recover-interrupted-turns.md) | 中文

## 动机

`projects/omp-qol` 中的续跑模块用于延续以可续跑错误结束的主 Agent 轮次：它注册 `session_stop` 处理器，用宿主分类器判定最后一条 assistant 错误，并在配置范围接受该错误时请求一次续跑轮次。默认档 `knownTransient` 接受宿主给出的 `Transient` 与 `Timeout` 标记。

模块本应覆盖的这类传输中断两个标记都没有。2026-09-22，一个使用 `pro-20x` 中继的会话以 `1012: websocket closed before terminal event (code 1012)` 结束轮次。宿主记录为 `errorId: 0`、没有 `errorStatus`，并带有 `stopDetails: { type: "stream_interrupted_after_content" }`。用已安装的 `@oh-my-pi/pi-ai` 18.2.4 实测，该文本的分类结果为 `0`：分类器的流中断词汇覆盖若干措辞，但不含任何 websocket 关闭措辞，而 websocket 重试词汇位于 provider 内部，不对外导出。宿主自身的各层也因此在同一条件下不接手：`AIError.retriable(0)` 为 false，轮次恢复中的 `prematureClose`、`streamStall` 与 `transportReset` 分支都要求分类 id 可重试。轮次就此停在错误上，直到用户再发一条消息。

`stopDetails.type: "stream_interrupted_after_content"` 是宿主为这一类情况留下的标记。provider 流失败时，agent loop 会丢弃未到达 `toolcall_end` 的工具调用，并给消息打上该标记。已记录会话中只有少数 assistant 错误带此标记，因此它标识的是中断，而不是任意错误。

于是有两个已经存在但未被使用的结构化信号：宿主的中断标记，以及既无 HTTP 状态也无分类结论的错误。两者都维持模块现有规则，即错误措辞由宿主负责，扩展不匹配错误文本。

## 提议

### 新增判据

在默认档 `knownTransient` 中，于固定安全排除项与终端客户端状态判定之后，满足以下任一条件即接受：

- `stream-interrupted`：最后一条 assistant 错误带有 `stopDetails.type === "stream_interrupted_after_content"`。
- `statusless-unclassified`：错误既无 HTTP 状态（`errorStatus` 缺失，且分类器也无法从消息解析出状态），也无分类结论（分类器返回 `0` 或类别掩码之外的值）。

固定排除项仍然优先：拒绝、配额结论、取消或其他被排除的类型，即使同时带有中断标记也保持原生处理。终端客户端状态规则同样适用：没有瞬时措辞的 4xx 保持原生，包括中断了工具调用的 4xx。

`unclassified` 档保持现有更宽的接受范围：所有没有分类结论的错误，带状态或不带状态均可。两个新判据只扩展默认档，不改变任何一档的定义。

模块用有界原因码报告接受的判据，且不携带任何服务端文本：`stream-interrupted` 与 `statusless-unclassified` 加入现有原因码，`recoveryNotify` 照常打印次数与等待时间。

### 设置与行为

不新增设置项。`recoveryEnabled`、`recoveryMode`、次数与退避键以及固定续跑文本保持现有含义，链规则不变：`stop_hook_active === false` 的事件开启新链，同一 agent 运行内同一轮次的重复事件被忽略，模块与宿主各自维持自己的上限。

### 文档与版本证据

在 `docs/adjustments.md`、`docs/adjustments.zh.md` 以及两个 README 的续跑行中写明两个判据、其确切条件、原因码、源码基线，以及模块不读取错误文本这一事实。真实会话一项继续标注未验证。

组件版本从 `0.2.0` 提升到 `0.3.0`：新增判据属于能力变更。

落实决定记录。当前决定[增加可配置的 OMP 体验调整](../decision/2026-09-21-reuse-a-matching-compaction-patch.zh.md)在结果一节说明这些调整依赖不带兼容承诺的宿主细节，并点名 `stopReason: "error"` 加公开分类器，其续跑段落固定了排除项、有界续跑与固定文本。新增判据扩展了该依赖，因此实现时用一个完整的新决定替换该决定并反转它，沿用其中仍然生效的规则，做法与此前 omp-qol 的改动一致。

### 验证计划

- 用已安装的分类器扩展 `test/recovery.test.ts` 的分类矩阵：仅中断标记、无状态且未分类、标记与被排除的标记同时出现、标记与终端 4xx 同时出现、带状态的无结论错误在默认档保持原生、`unclassified` 档接受范围不变、消息对象不被修改，以及上报的原因码。
- 在组件内运行 `bun test` 与 `tsc --noEmit`，提交审查前运行仓库根部 `pnpm check`。
- 真实会话一项与现状一致，保持未验证。该中断来自中继重启，无法按需复现，而直接调用处理器的单元测试不能作为真实轮次恢复的证据。

## 考虑过的替代方案

1. 只接受宿主中断标记。这是最精确的信号，代价是流断开时若没有工具调用在传输中，无状态中断仍不覆盖。
2. 只接受无状态且未分类的情况。它不依赖标记即覆盖整类情况，代价是标记未被使用，于是同时带状态的中断（例如工具调用流式传输中的 500）仍保持原生。
3. 在扩展内匹配中断措辞。已否决：这会把服务端措辞引入组件，违背"错误措辞由分类器负责"的规则，并且每遇到一种不同的中继措辞都要维护。
4. 只提供配置，让用户把 `recoveryMode` 设为 `unclassified`。作为交付物已否决：该档还会接受带 HTTP 状态且无结论的错误，放宽范围超过中断这一类，并把一个有意的默认值变成逐用户的变通做法。
5. 在上游扩展宿主自己的流中断词汇。已考虑但未采用：宿主是另一个项目，修复要等版本发布，而且无状态错误没有可匹配的措辞。

## 验收标准

- 默认档下，带 `stopDetails.type === "stream_interrupted_after_content"` 的错误以原因 `stream-interrupted` 被接受，既无状态也无分类结论的错误以原因 `statusless-unclassified` 被接受。
- 同时带有新信号时，固定排除项与终端客户端状态规则仍然优先。
- 带 HTTP 状态的无结论错误在默认档保持原生，`unclassified` 档保持现有接受范围。
- 模块不读取错误文本：两个新条件都来自宿主消息结构与宿主分类器，且分类操作不修改宿主消息。
- `docs/adjustments.md`、`docs/adjustments.zh.md` 与两个 README 写明新判据及其条件，组件版本为 `0.3.0`。
- 组件检查与根部 `pnpm check` 通过，真实会话一项继续标注未验证。

## 风险

- 无状态且无分类结论的错误可能是分类器不认识的确定性客户端故障。此时续跑会多花一轮，并可能重复副作用已经发生的工具调用。
- 每一轮都复现的 provider 故障现在会跑到有界续跑次数上限，而不是在第一次失败处停止，用户更晚看出 provider 已经不可用。
- 两个新条件都是不带兼容承诺的宿主细节。宿主某次发布不再写入 `stopDetails.type` 会静默收窄范围，而开始对无害失败写入该标记会放宽范围，组件对这两种变化都不报告。
- 默认档对已有安装在不改设置的情况下变宽，此前在同类中断后停下等待的会话，现在会多花轮次与额度。
