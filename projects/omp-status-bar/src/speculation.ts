/**
 * Speculation-band estimation state machine for the `context` provider.
 *
 * The indicator means only "the context is probably inside OMP's speculation
 * band". It cannot observe whether compaction is actually running, whether a
 * handoff is being generated, or whether a session hook blocked the
 * speculation task, and OMP may raise its internal token estimate above what
 * the public context-usage API reports. The UI and documentation must not
 * claim that compaction is running or finished.
 *
 * Band inputs reuse OMP's exported resolvers:
 *
 *   threshold = resolveThresholdTokens(contextWindow, compactionSettings)
 *   lead      = resolveSpeculationLeadTokens(threshold)
 *   start     = max(0, threshold - lead)
 *   band      = [start, threshold)
 *
 * Public states: `hidden` (compaction off, async off, no speculation-capable
 * method, or unusable threshold data), `normal` (solid dimmed glyph), and
 * `indicating` (glyph blinking between emphasis and dim on a 600 ms cadence).
 *
 * Latching: once inside the band, `indicating` holds even past the threshold
 * until a token drop, a condition loss (compaction off, async off, method
 * gone, model or context window changed), or the session ends. After a drop
 * the machine requires the token count to fall back below the band start
 * before the next cycle may indicate again. A fingerprint change (model,
 * window, method, threshold, or start) establishes a fresh baseline: previous
 * token and this cycle's entry permission are cleared, and the sample stays
 * `normal` or `hidden`.
 */

import type { CompactionSettings } from "@oh-my-pi/pi-coding-agent/config/settings-schema";
import { resolveThresholdTokens } from "@oh-my-pi/pi-agent-core/compaction";
import { resolveSpeculationMethod } from "@oh-my-pi/pi-coding-agent/session/compaction-methods";
import { resolveSpeculationLeadTokens } from "@oh-my-pi/pi-coding-agent/session/speculation-lead";
import type { CompactionSettingsShape } from "./snapshot-store.ts";

/** Public indicator states. */
export type SpeculationState = "hidden" | "normal" | "indicating";

/** Model identity the fingerprint keys on. */
export interface SpeculationModel {
  provider: string;
  id: string;
  contextWindow: number | null;
}

/** Everything one evaluation needs, all from public data. */
export interface SpeculationInputs {
  /** Current context usage, or undefined when unknown. */
  usage: { tokens: number; contextWindow: number } | undefined;
  /** Active model, or undefined when unknown. */
  model: SpeculationModel | undefined;
  /** Current compaction settings group (structural subset of OMP's). */
  compaction: CompactionSettingsShape;
}

/** Resolved band description; `method: undefined` means no speculation-capable method. */
export interface SpeculationBand {
  method: "remote" | "handoff" | "soft" | undefined;
  threshold: number;
  start: number;
}

/**
 * Resolve the speculation band from public inputs. Returns undefined when the
 * threshold data is unusable (no model window, non-positive window, or a
 * non-finite threshold).
 */
export function resolveBand(inputs: SpeculationInputs): SpeculationBand | undefined {
  const { usage, model, compaction } = inputs;
  if (!compaction.enabled || compaction.asyncEnabled === false) {
    return undefined;
  }
  // OMP's resolvers take the full `Model` and `CompactionSettings` types;
  // the inputs here are the structural subsets those resolvers actually
  // read. The model parameter type is derived from the resolver itself, so
  // the public contract stays free of OMP-internal types.
  type ResolverModel = Parameters<typeof resolveSpeculationMethod>[0];
  const method = resolveSpeculationMethod(
    model as unknown as ResolverModel,
    compaction as unknown as CompactionSettings,
  );
  if (method === undefined) {
    return undefined;
  }
  const window = usage?.contextWindow ?? model?.contextWindow ?? undefined;
  if (typeof window !== "number" || !Number.isFinite(window) || window <= 0) {
    return undefined;
  }
  const threshold = resolveThresholdTokens(window, compaction as unknown as CompactionSettings);
  if (!Number.isFinite(threshold) || threshold <= 0) {
    return undefined;
  }
  const lead = resolveSpeculationLeadTokens(threshold);
  return { method, threshold, start: Math.max(0, threshold - lead) };
}

/** Fingerprint of the band basis: model identity plus resolved band. */
interface Fingerprint {
  provider: string;
  id: string;
  contextWindow: number | null;
  method: "remote" | "handoff" | "soft";
  threshold: number;
  start: number;
}

function fingerprintOf(model: SpeculationModel, band: SpeculationBand): Fingerprint {
  return {
    provider: model.provider,
    id: model.id,
    contextWindow: model.contextWindow,
    method: band.method as "remote" | "handoff" | "soft",
    threshold: band.threshold,
    start: band.start,
  };
}

function sameFingerprint(a: Fingerprint, b: Fingerprint): boolean {
  return (
    a.provider === b.provider &&
    a.id === b.id &&
    a.contextWindow === b.contextWindow &&
    a.method === b.method &&
    a.threshold === b.threshold &&
    a.start === b.start
  );
}

/**
 * The state machine. Feed it one sample per tick with `evaluate`; it keeps
 * the fingerprint, previous token, and re-entry permission internally.
 */
export class SpeculationMachine {
  #fingerprint: Fingerprint | undefined;
  #previousToken: number | undefined;
  #mayEnter = false;
  #state: SpeculationState = "hidden";
  /** Whether a baseline exists at all; a fresh baseline may indicate immediately. */
  #everBaselined = false;
  /** Latch independent of the published state so a hidden publish keeps it. */
  #latched = false;

  /** Current public state. */
  get state(): SpeculationState {
    return this.#state;
  }

  /** True session reset: provider stopped or the session ended. */
  reset(): void {
    this.#fingerprint = undefined;
    this.#previousToken = undefined;
    this.#mayEnter = false;
    this.#state = "hidden";
    this.#everBaselined = false;
    this.#latched = false;
  }

  /**
   * Evaluate one sample. Never claims compaction is running or finished:
   * above-threshold samples keep the latched state or render `normal`.
   */
  evaluate(inputs: SpeculationInputs): SpeculationState {
    const band = resolveBand(inputs);
    if (band === undefined || inputs.model === undefined) {
      // Condition loss ends a latch immediately but never rebaselines: when
      // the conditions return, the fingerprint below re-evaluates and the
      // machine resumes from a known state instead of treating the return
      // as a first sample.
      this.#fingerprint = undefined;
      this.#previousToken = undefined;
      this.#mayEnter = false;
      this.#latched = false;
      this.#state = "hidden";
      return this.#state;
    }
    const fingerprint = fingerprintOf(inputs.model, band);
    if (this.#fingerprint === undefined || !sameFingerprint(this.#fingerprint, fingerprint)) {
      // Fingerprint change: fresh baseline. The old latch does not carry
      // over; only the very first valid sample may indicate immediately.
      const wasFirst = !this.#everBaselined;
      this.#fingerprint = fingerprint;
      this.#everBaselined = true;
      const token = inputs.usage?.tokens;
      this.#mayEnter = token !== undefined && token < band.start;
      this.#latched = false;
      if (token === undefined) {
        this.#previousToken = undefined;
        this.#state = "hidden";
      } else {
        this.#previousToken = token;
        this.#state = wasFirst && token >= band.start && token < band.threshold ? "indicating" : "normal";
        this.#latched = this.#state === "indicating";
      }
      return this.#state;
    }
    const token = inputs.usage?.tokens;
    if (token === undefined) {
      // Usage temporarily unknown: keep the latch, publish hidden.
      this.#previousToken = undefined;
      this.#state = "hidden";
      return this.#state;
    }
    const previous = this.#previousToken;
    this.#previousToken = token;
    if (this.#latched) {
      // Latched. A token drop ends the indication; everything else keeps it,
      // including reaching or exceeding the threshold. A sample below the
      // band start is past the drop even when an unknown gap hid it.
      if ((previous !== undefined && token < previous) || token < band.start) {
        this.#latched = false;
        this.#mayEnter = token < band.start;
        this.#state = "normal";
      } else {
        this.#state = "indicating";
      }
      return this.#state;
    }
    if (token < band.start) {
      // Below the band: solid glyph, and the next cycle may indicate.
      this.#mayEnter = true;
      this.#state = "normal";
      return this.#state;
    }
    if (this.#mayEnter && token < band.threshold) {
      // Entering the band with permission.
      this.#latched = true;
      this.#state = "indicating";
      return this.#state;
    }
    // At or above the threshold without a latch, or inside the band without
    // permission: solid glyph, never an "already compacting" claim.
    this.#state = "normal";
    return this.#state;
  }
}
