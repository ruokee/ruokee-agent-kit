# Provider 合同

[English](./provider-contract.md)

第三方扩展添加状态栏 Provider 使用的公开合同。从 `@ruokee/omp-status-bar/provider` 导入。

```ts
export type ProviderOptions = Readonly<Record<string, unknown>>;
export type ProviderDescription = Readonly<Record<string, unknown>>;

export interface ProviderSpan {
  text: string;
  color?: `#${string}`;
  dim?: boolean;
}

export interface ProviderFragment {
  spans: readonly ProviderSpan[];
}

export interface ProviderInstanceContext {
  readonly options: ProviderOptions;
  readonly config: ProviderDescription;
  publish(fragment: ProviderFragment): void;
  setInterval(callback: () => void, ms: number): unknown;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimer(timer: unknown): void;
}

export interface ProviderInstance {
  start(): void | Promise<void>;
  stop(): void | Promise<void>;
}

export interface ProviderDefinition {
  readonly id: string;
  readonly contractVersion: 1;
  describe(options: ProviderOptions): ProviderDescription;
  create(context: ProviderInstanceContext): ProviderInstance;
}

export function registerProvider(definition: ProviderDefinition): void;
```

`PROVIDER_CONTRACT_VERSION` 为 `1`。注册时拒绝重复 ID 和不支持的合同版本；Host 在创建实例前会再次校验版本，因此通过模块旧副本注册的定义同样会被拒绝。

## 发布

`ProviderInstanceContext.publish()` 接受 `ProviderFragment`。spans 为空，或可见文本清理后为空的 fragment，会撤回该实例当前的内容。

### 标准化规则

Host 对每个发布的 fragment 做标准化：

1. `spans` 必须是数组，每项必须包含字符串 `text`。
2. `color` 可省略；设置时只接受 `#RRGGBB`，大小写均可。其他值会让整个 fragment 无效，并按第 7 条处理。
3. `dim` 缺省为 `false`；设置时如果不是 boolean，会让整个 fragment 无效，并按第 7 条处理。
4. 每个 `text` 清除 ANSI 和 VT escape sequence，把 C0/C1 控制字符替换为空格，并合并连续 ASCII 空格。span 之间不自动插入空格；Provider 在 span 文本里显式保留需要的空格。
5. 删除清理后 `text` 为空的 span。只去掉整个 fragment 最前和最后的空格；相邻 span 边界上的单个空格保留。
6. Host 深复制标准化结果；Provider 发布后再修改原对象不能改变界面。
7. fragment 结构无效时，Host 清除该实例的旧 fragment，记录一条有界诊断，其他 Provider 继续运行。

Provider 不输出 separator，不调用 OMP UI，也不获取 Widget 或 theme。Registry、配置、组合、渲染和生命周期都由 Host 负责。

## Registry

Registry 使用带版本的 `Symbol.for()` key，第三方 Extension 即使解析到自己安装的 Package 副本，也注册到同一个进程级 Registry。重复 ID 和不兼容合同版本在注册时拒绝；Host 创建实例前再次校验。

## 实例上下文

`options` 是配置条目里原始的 `options` 映射。`config` 是你的 `describe()` 对这些 options 返回的对象，原样回传。`setInterval`、`setTimeout` 和 `clearTimer` 走 OMP 托管 timer，shutdown 之后全部失效。

## 另见

- [Provider 开发指南](./provider-dev.zh.md)提供一个可运行的第三方 Provider 示例。

## 许可证

MIT。参见仓库 [LICENSE](../../../LICENSE)。
