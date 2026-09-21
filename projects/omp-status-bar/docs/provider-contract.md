# Provider contract

[中文](./provider-contract.zh.md)

The public contract third-party extensions use to add status bar providers. Import from `@ruokee/omp-status-bar/provider`.

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

`PROVIDER_CONTRACT_VERSION` is `1`. Registration rejects a duplicate id or an unsupported contract version; the Host checks the version again before instance creation, so a definition registered through an older copy of the module is still rejected.

## Publishing

`ProviderInstanceContext.publish()` accepts a `ProviderFragment`. A fragment with empty spans, or one whose visible text sanitizes away entirely, withdraws that instance's current content.

### Normalization rules

The Host normalizes every published fragment:

1. `spans` must be an array; each item must carry a string `text`.
2. `color` is optional and accepts only `#RRGGBB`, case-insensitively. Any other present value invalidates the whole fragment; rule 7 applies.
3. `dim` defaults to `false`; any present non-boolean value invalidates the whole fragment; rule 7 applies.
4. Each `text` has ANSI and VT escape sequences removed, C0/C1 control characters replaced with spaces, and runs of ASCII spaces collapsed. Spans are not joined with automatic spaces; providers keep needed spacing in their span text.
5. Spans whose sanitized `text` is empty are dropped. Only the fragment's outermost leading and trailing spaces are trimmed; single spaces at boundaries between adjacent spans are kept.
6. The Host deep-copies the normalized result; mutating a published object afterwards cannot change the UI.
7. A structurally invalid fragment clears that instance's previous fragment, records a bounded diagnostic, and leaves other providers running.

Providers never emit separators, never call OMP UI APIs, and never touch the widget or theme. The Host owns the process registry, config, composition, rendering, and lifecycle.

## Registry

The registry uses a versioned `Symbol.for()` key, so a third-party extension that resolves its own copy of this package still registers into the same process-wide registry. Duplicate ids and incompatible contract versions are rejected at registration time; the Host re-checks before creating instances.

The six builtin providers register through the same function as everyone else. Because one process activates this extension for each session, the extension preflights its own ids before registering: an id it registered earlier is recognized by a mark it put on that definition, and the definition that registered first stays in place while nothing is registered again. A third party that owns a builtin id still fails activation before any of the six registers. The mark is an internal convention of this package and is not part of the registration contract.

## Instance context

`options` is the raw `options` mapping from the config entry. `config` is the object your `describe()` returned for those options, echoed back verbatim. `setInterval`, `setTimeout`, and `clearTimer` go through OMP-managed timers and are invalidated after shutdown.

## See also

- [Provider development guide](./provider-dev.md) for a working third-party provider.
