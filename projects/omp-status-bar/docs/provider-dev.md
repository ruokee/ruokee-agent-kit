# Provider development guide

[中文](./provider-dev.zh.md)

A working third-party status bar provider, end to end. Read the [provider contract](./provider-contract.md) first for the full interface.

## Minimal provider

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

Register during extension activation, before OMP emits `session_start`. OMP activates all loaded extensions before that event, so provider registration does not depend on relative extension order.

## What the pieces do

`describe(options)` validates the entry's options and returns the per-instance configuration. Throwing invalidates only this entry; the Host skips it and keeps the rest. The return value comes back verbatim as `context.config`.

`create(context)` builds one instance per config entry. The same id can appear multiple times in `statuses`, each with independent state.

`publish()` replaces this instance's fragment. Spans support `#RRGGBB` colors and `dim`. An empty fragment withdraws the instance's text. Publish only on change; identical fragments are cheap but pointless.

`setInterval` and `setTimeout` use OMP-managed timers. Stop each timer with `clearTimer` if the instance stops before the timer fires; anything left after shutdown is rejected safely but still best avoided.

## Rules

- Ids use the form `example.counter`: a short owner prefix plus a name. Do not use the six builtin ids.
- Never emit separators, ANSI escapes, or control characters; the Host strips them and collapses space runs.
- Validate options in `describe`, not `create`; a `create` failure still only kills this entry but happens later.
- Do not call OMP UI APIs or touch widgets; the Host owns rendering.
- A stopped or shut-down context rejects publishes; do not retry.

## Testing your provider

The Host normalizes, composes, and truncates; you can unit-test `describe` and the published fragments directly with Bun. For a visual check, add your id to `statuses` in `<agentDir>/omp-status-bar.yml` and start an OMP session with a UI.
