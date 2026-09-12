# Provider 开发指南

[English](./provider-dev.md)

一个可运行的第三方状态栏 Provider 完整示例。完整接口先看 [Provider 合同](./provider-contract.zh.md)。

## 最小 Provider

```ts
import type { ExtensionAPI } from "@oh-my-pi/pi-coding-agent";
import { registerProvider } from "@ruokee/omp-status-bar/provider";
import type { ProviderDefinition } from "@ruokee/omp-status-bar/provider";

const counter: ProviderDefinition = {
  id: "example.counter",
  contractVersion: 1,
  describe: (options) => {
    const step = options.step;
    if (step !== undefined && typeof step !== "number") {
      throw new Error("`step` must be a number");
    }
    return { step: step ?? 1 };
  },
  create: (context) => {
    let count = 0;
    let timer: unknown;
    const tick = () => {
      count += (context.config.step as number) ?? 1;
      context.publish({
        spans: [{ text: `n ${count}`, color: "#5fafaf" }],
      });
    };
    return {
      start() {
        tick();
        timer = context.setInterval(tick, 600);
      },
      stop() {
        if (timer !== undefined) {
          context.clearTimer(timer);
          timer = undefined;
        }
      },
    };
  },
};

export default function exampleStatusProvider(pi: ExtensionAPI): void {
  registerProvider(counter);
}
```

在 Extension 激活阶段、OMP 发出 `session_start` 之前完成注册。OMP 会先激活所有已加载的 Extension，再发出该事件，因此 Provider 注册不依赖 Extension 的相对加载顺序。

## 各部分的作用

`describe(options)` 校验条目的 options，返回该实例的配置。抛错只让当前条目失效；Host 跳过它并继续启动其他条目。返回值会原样作为 `context.config` 回传。

`create(context)` 为每个配置条目创建一个实例。同一个 ID 可以在 `statuses` 里出现多次，各自持有独立状态。

`publish()` 替换该实例的片段。span 支持 `#RRGGBB` 颜色和 `dim`。空片段会撤回该实例的文本。只在变化时发布；内容相同的 fragment 虽然开销小，但没有意义。

`setInterval` 和 `setTimeout` 使用 OMP 托管 timer。实例提前停止时用 `clearTimer` 清掉未触发的 timer；shutdown 后残留的 timer 会被安全拒绝，但最好避免。

## 规则

- ID 使用 `example.counter` 形式：短所有者前缀加名称。不要使用六个内置 ID。
- 不要输出 separator、ANSI escape 或控制字符；Host 会剥离它们并合并连续空格。
- 在 `describe` 里校验 options，而不是 `create`；`create` 失败同样只影响当前条目，但发生得更晚。
- 不要调用 OMP UI API，也不要操作 Widget；渲染由 Host 负责。
- 已停止或已 shutdown 的 context 会拒绝发布，不要重试。

## 测试你的 Provider

标准化、组合和截断都由 Host 完成；`describe` 和发布的片段可以直接用 Bun 做单元测试。要看真实效果，把你的 ID 加进 `<agentDir>/omp-status-bar.yml` 的 `statuses`，然后启动一个带 UI 的 OMP 会话。
