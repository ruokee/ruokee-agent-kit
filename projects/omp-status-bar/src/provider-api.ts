/**
 * Public provider registration contract for the OMP status bar.
 *
 * This module and the package subpath `@ruokee/omp-status-bar/provider` are
 * the entire public surface for provider authors: provider identity, option
 * validation, instance creation and lifecycle, fragment publication, and
 * managed scheduling. Registry storage, configuration, composition, and OMP
 * UI access are Host internals and are not exported here.
 *
 * Providers publish structured fragments; the Host sanitizes, styles,
 * composes, and truncates. Providers never call OMP UI methods, never obtain
 * the widget or theme, and never emit separators.
 */

import { getProviderRegistry } from "./registry.ts";

/** Contract version this module speaks; the only version the Host creates instances for. */
export const PROVIDER_CONTRACT_VERSION = 1;

/** Internal: the single supported version, used for the two-layer rejection. */
function isSupportedContractVersion(version: number): boolean {
  return version === PROVIDER_CONTRACT_VERSION;
}

/** Internal: rejection message shared by registration and instance creation. */
function unsupportedVersionError(id: string, version: number): RangeError {
  return new RangeError(
    `Provider "${id}" declares contract version ${String(version)}; supported version: ${PROVIDER_CONTRACT_VERSION}`,
  );
}

/**
 * Declarative configuration for one provider instance, echoed back through
 * the lifecycle context. Free-form: the provider's `describe` validates it.
 */
export type ProviderOptions = Readonly<Record<string, unknown>>;

/**
 * Result of `describe`: the per-instance configuration the Host echoes back
 * verbatim through the lifecycle context. Free-form; the Host never
 * interprets it.
 */
export type ProviderDescription = Readonly<Record<string, unknown>>;
/** One styled run of visible text inside a published fragment. */
export interface ProviderSpan {
  /** Visible text. The Host strips escapes and control characters. */
  text: string;
  /** Fill color; only `#RRGGBB` is accepted. */
  color?: `#${string}`;
  /**
   * Dim the span. Composes with `color`: the text renders in the given
   * color, dimmed; without a color it renders dimmed in the terminal's
   * default foreground.
   */
  dim?: boolean;
}

/** One publication unit: an ordered list of styled spans. */
export interface ProviderFragment {
  spans: readonly ProviderSpan[];
}

/**
 * Lifecycle context handed to one provider instance. Every configured entry
 * creates an independent instance, so the same provider id may run multiple
 * times with different options.
 */
export interface ProviderInstanceContext {
  /** Validated options for this instance, as given in the configuration entry. */
  readonly options: ProviderOptions;
  /** Instance config returned by `describe`. */
  readonly config: ProviderDescription;
  /**
   * Publish a structured fragment for this instance. An empty `spans` array,
   * or a fragment that sanitizes to nothing, withdraws the instance's content
   * from the composed line. A structurally invalid fragment clears the
   * instance's previous content and records a diagnostic. Providers publish
   * through this method only; OMP UI access is reserved for the Host.
   */
  publish(fragment: ProviderFragment): void;
  /** Schedule a repeating callback. Backed by OMP-managed timers; cleared at session shutdown. */
  setInterval(callback: () => void, ms: number): unknown;
  /** Schedule a one-shot callback. Backed by OMP-managed timers; cleared at session shutdown. */
  setTimeout(callback: () => void, ms: number): unknown;
  /** Clear a timer previously returned from this context. */
  clearTimer(timer: unknown): void;
}

/** Lifecycle object a provider returns from `create`. */
export interface ProviderInstance {
  /** Begin the provider's work. May be async; the Host awaits it once. */
  start(): void | Promise<void>;
  /** Release every resource. May be async; the Host awaits it once. */
  stop(): void | Promise<void>;
}

/**
 * A status provider definition. Registration is permanent for the process:
 * the Host rejects a second definition with the same id.
 */
export interface ProviderDefinition {
  /** Stable provider id, referenced by configuration entries. */
  readonly id: string;
  /** Contract version the definition implements. The Host refuses incompatible versions. */
  readonly contractVersion: 1;
  /** Validate options and return this instance's config. Throw to mark an entry invalid. */
  describe(options: ProviderOptions): ProviderDescription;
  /** Create the instance lifecycle for one configured entry. */
  create(context: ProviderInstanceContext): ProviderInstance;
}

/**
 * Registration entry point. Call during extension activation, before the
 * Host's `session_start`. Throws on duplicate id or unsupported contract
 * version; the Host skips configuration entries referencing rejected ids.
 */
export function registerProvider(definition: ProviderDefinition): void {
  if (!isSupportedContractVersion(definition.contractVersion)) {
    throw unsupportedVersionError(definition.id, definition.contractVersion);
  }
  getProviderRegistry().register(definition);
}

/**
 * Internal: the Host calls this before creating instances, so a definition
 * registered through another copy's older entry point is still rejected.
 */
export function assertSupportedContractVersion(definition: ProviderDefinition): void {
  if (!isSupportedContractVersion(definition.contractVersion)) {
    throw unsupportedVersionError(definition.id, definition.contractVersion);
  }
}
