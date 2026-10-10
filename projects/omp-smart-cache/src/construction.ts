import type { AgentSession } from "@oh-my-pi/pi-coding-agent";
import { AgentRegistry } from "@oh-my-pi/pi-coding-agent/registry/agent-registry";
import { object } from "./reuse.ts";

const SLOT = Symbol.for("ruokee.omp-smart-cache.remote.construction");
const globals = globalThis as typeof globalThis & { [key: symbol]: unknown };
interface Origin {
  readonly agent: AgentSession["agent"];
  readonly runner: AgentSession["extensionRunner"];
  readonly stream: AgentSession["agent"]["streamFn"];
  readonly context: NonNullable<AgentSession["extensionRunner"]>["emitContext"];
}
export interface Construction {
  confirms(session: AgentSession): boolean;
  release(): void;
}
interface Observer {
  readonly version: "0.1.0";
  readonly origins: WeakMap<AgentSession, Origin>;
  readonly registry: AgentRegistry;
  readonly wrapper: AgentRegistry["attachSession"];
  readonly restore: () => void;
  leases: number;
  compromised: boolean;
}

/** Observe native CLI/SDK publication before session_start, not arbitrary existing Agent instances. */
export function observeConstruction(): Construction {
  let observer: Observer | undefined;
  const present = globals[SLOT];
  if (present !== undefined) {
    if (
      !object(present) ||
      present.version !== "0.1.0" ||
      !(present.origins instanceof WeakMap) ||
      typeof present.restore !== "function" ||
      typeof present.leases !== "number"
    )
      return unavailable();
    observer = present as unknown as Observer;
    if (observer.compromised || observer.registry.attachSession !== observer.wrapper) return unavailable();
  } else {
    const registry = AgentRegistry.global(),
      descriptor = Object.getOwnPropertyDescriptor(registry, "attachSession");
    // A pre-existing instance wrapper is unknown provenance, not a native baseline.
    if (
      descriptor ||
      registry.attachSession !== AgentRegistry.prototype.attachSession ||
      !Object.isExtensible(registry)
    )
      return unavailable();
    const original = registry.attachSession;
    const origins = new WeakMap<AgentSession, Origin>();
    const wrapper: typeof original = function (this: AgentRegistry, ...args) {
      const [id, session, , expected] = args;
      let before: ReturnType<AgentRegistry["get"]>, origin: Origin | undefined;
      try {
        before = registry.get(id);
        const runner = session.extensionRunner;
        if (
          this === registry &&
          before &&
          before.session === null &&
          expected === before &&
          runner &&
          !origins.has(session)
        ) {
          origin = { agent: session.agent, runner, stream: session.agent.streamFn, context: runner.emitContext };
        }
      } catch {
        /* Unknown construction retains complete-range proof only. */
      }
      const result = Reflect.apply(original, this, args) as boolean;
      try {
        if (
          result &&
          origin &&
          registry.attachSession === wrapper &&
          registry.get(id) === before &&
          before!.session === session &&
          session.agent === origin.agent &&
          session.extensionRunner === origin.runner &&
          session.agent.streamFn === origin.stream &&
          session.extensionRunner?.emitContext === origin.context
        )
          origins.set(session, origin);
      } catch {
        /* A successful native attach must remain successful. */
      }
      return result;
    };
    const entry: Observer = {
      version: "0.1.0",
      registry,
      wrapper,
      origins,
      leases: 0,
      compromised: false,
      restore: () => {
        if (registry.attachSession === wrapper) Reflect.deleteProperty(registry, "attachSession");
        else entry.compromised = true;
      },
    };
    try {
      Object.defineProperty(registry, "attachSession", {
        value: wrapper,
        writable: true,
        configurable: true,
        enumerable: true,
      });
    } catch {
      return unavailable();
    }
    globals[SLOT] = observer = entry;
  }
  observer.leases++;
  const source = observer;
  let released = false;
  return {
    confirms(session) {
      const origin = source.origins.get(session);
      return (
        !source.compromised &&
        !!origin &&
        session.agent === origin.agent &&
        session.extensionRunner === origin.runner &&
        session.agent.streamFn === origin.stream &&
        session.extensionRunner?.emitContext === origin.context
      );
    },
    release() {
      if (released) return;
      released = true;
      if (--source.leases === 0) {
        source.restore();
        if (globals[SLOT] === source && !source.compromised) Reflect.deleteProperty(globals, SLOT);
      }
    },
  };
}
function unavailable(): Construction {
  return { confirms: () => false, release: () => {} };
}
