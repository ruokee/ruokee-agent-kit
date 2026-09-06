/**
 * Process-wide provider registry. Internal to @ruokee/omp-status-bar: not
 * part of the public contract.
 *
 * The registry rides `globalThis` under a well-known `Symbol.for()` key so
 * duplicate package copies (a third-party extension resolving its own
 * installed copy) share one store regardless of module identity or load
 * order.
 */

import type { ProviderDefinition } from "./provider-api.ts";

/** Registry object stored once per process on `globalThis`. */
export interface ProviderRegistry {
  register(definition: ProviderDefinition): void;
  get(id: string): ProviderDefinition | undefined;
  has(id: string): boolean;
  ids(): string[];
}

const REGISTRY_KEY = Symbol.for("@ruokee/omp-status-bar/provider-registry/v1");

/** Access the process-wide registry, creating it on first use. */
export function getProviderRegistry(): ProviderRegistry {
  const holder = globalThis as typeof globalThis & { [REGISTRY_KEY]?: ProviderRegistry };
  let registry = holder[REGISTRY_KEY];
  if (!registry) {
    const definitions = new Map<string, ProviderDefinition>();
    registry = {
      register(definition) {
        if (typeof definition?.id !== "string" || definition.id.length === 0) {
          throw new TypeError("Provider id must be a non-empty string");
        }
        if (definitions.has(definition.id)) {
          throw new Error(`Provider id "${definition.id}" is already registered`);
        }
        definitions.set(definition.id, definition);
      },
      get(id) {
        return definitions.get(id);
      },
      has(id) {
        return definitions.has(id);
      },
      ids() {
        return [...definitions.keys()];
      },
    };
    holder[REGISTRY_KEY] = registry;
  }
  return registry;
}

/** Test seam: drop the process-wide registry. Production code must never call this. */
export function resetProviderRegistryForTests(): void {
  const holder = globalThis as typeof globalThis & { [REGISTRY_KEY]?: ProviderRegistry };
  delete holder[REGISTRY_KEY];
}
