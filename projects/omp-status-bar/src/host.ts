/**
 * Status bar Host.
 *
 * One Host serves exactly one extension session. It reads the configuration
 * file, creates one provider instance per configured entry, and owns the
 * single `belowEditor` widget. Providers never touch the UI: they publish
 * `ProviderFragment`s through their lifecycle context, the Host sanitizes
 * them, composes the visible line, and refreshes the widget on change.
 *
 * Failure containment and lifecycle gates:
 *
 * - A failing entry (unknown id, unsupported contract version, rejected
 *   options, or a create/start throw) skips only that entry; the other
 *   entries still run. Diagnostics are bounded and deduplicated.
 * - Every provider callback (tick, timeout, publish-time stop) runs through
 *   a wrapper that catches sync throws and settles thenable rejections into
 *   bounded diagnostics; interval ticks are serialized so async runs never
 *   overlap.
 * - The lifecycle gate (`active`) plus a session generation counter refuse
 *   late publishes, timers, and diagnostics from instances that were
 *   deactivated by a discard or a shutdown, however the race lands.
 * - Timer handles a provider created are tracked per instance and
 *   force-cleared at discard and shutdown.
 * - The widget mounts lazily when the first instance starts and unmounts at
 *   shutdown; headless sessions (`hasUI: false`) never mount anything.
 */

import {
  CONFIG_FILE_NAME,
  SEPARATOR_TEXT,
  readConfigFile,
  type StatusBarConfig,
  type StatusEntryProblem,
} from "./config.ts";
import {
  assertSupportedContractVersion,
  type ProviderDescription,
  type ProviderDefinition,
  type ProviderFragment,
  type ProviderInstance,
  type ProviderInstanceContext,
  type ProviderOptions,
  type ProviderSpan,
} from "./provider-api.ts";
import { getProviderRegistry, type ProviderRegistry } from "./registry.ts";
import { sanitizeFragment } from "./sanitize.ts";
import { getSnapshotStore } from "./snapshot-store.ts";
import { composeLine, createStatusBarWidget, type ComposedLine, type StatusBarWidgetComponent } from "./widget.ts";

/** Maximum distinct provider failure messages reported per Host. */
const MAX_PROVIDER_FAILURES = 8;

/** Widget key the Host registers; package-qualified to avoid collisions. */
const WIDGET_KEY = "ruokee.omp-status-bar";

/** Returned by the context when an inactive instance tries to schedule. */
const IGNORED_TIMER = null;

/** OMP-facing surface the Host needs; mirrors the used subset of `ExtensionContext`. */
export interface HostEnvironment {
  hasUI: boolean;
  setWidget(key: string, factory: WidgetFactory, options?: { placement?: "belowEditor" | "aboveEditor" }): void;
  unsetWidget(key: string): void;
  setInterval(callback: () => void, ms: number): unknown;
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimer(timer: unknown): void;
}

/** Shape the Host's factory receives from OMP; themes separators via `fg`. */
export interface WidgetTheme {
  /** Render `text` in the given theme color; keeps OMP's native color mode. */
  fg(color: string, text: string): string;
}

/** Outcome of reading the configuration source. */
export type ConfigReadResult =
  { config: StatusBarConfig; problems: StatusEntryProblem[] } | { failure: string } | { missing: true };

/** Reads the configuration file; injectable so behavior tests can feed text directly. */
export type ConfigReader = (path: string) => Promise<ConfigReadResult>;

/** Resolves the agent directory; injectable so tests never touch a real profile. */
export type AgentDirResolver = () => string;

/** Joins path segments; injectable so tests stay platform-stable. */
export type PathJoiner = (...segments: string[]) => string;

/**
 * Widget factory the Host hands to OMP. OMP calls it with the live TUI and
 * theme exactly once when the widget mounts.
 */
export type WidgetFactory = (tui: unknown, theme: WidgetTheme) => StatusBarWidgetComponent;

export interface HostOptions {
  environment: HostEnvironment;
  /** Resolve the active agent directory. */
  getAgentDir: AgentDirResolver;
  /** Join path segments for the config file path. */
  joinPath: PathJoiner;
  /** Diagnostic sink. */
  onDiagnostic: (message: string) => void;
  /** Override the default file-backed reader. Tests inject text directly. */
  configReader?: ConfigReader;
}

/** One live provider instance and everything the Host tracks for it. */
interface RunningInstance {
  /** Position in the configured entry order; fixes composition order. */
  entryIndex: number;
  providerId: string;
  instance: ProviderInstance | undefined;
  /** Latest sanitized spans; empty when nothing is published or valid. */
  spans: ProviderSpan[];
  /** Timers this instance created; the Host force-clears leaks at shutdown. */
  timers: unknown[];
  /**
   * Lifecycle gate: while false the context refuses to schedule timers,
   * publish, or report late diagnostics, and queued timer callbacks skip
   * their provider body. Set false when shutdown or a discard begins.
   */
  active: boolean;
  /** In-flight-or-done memoized stop; set on the first stop attempt. */
  stopped: Promise<void> | undefined;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Structural span equality; no JSON serialization in the update hot path. */
function sameSpans(a: readonly ProviderSpan[], b: readonly ProviderSpan[]): boolean {
  if (a.length !== b.length) {
    return false;
  }
  return a.every((span, index) => {
    const other = b[index];
    return other !== undefined && span.text === other.text && span.color === other.color && span.dim === other.dim;
  });
}

/**
 * Invoke `settled` once the value settles: immediately for non-thenables,
 * after resolution/rejection for thenables (anything with a callable `then`).
 */
function settleLikePromise(result: unknown, settled: (error?: unknown) => void): void {
  let done = false;
  const settleOnce = (error?: unknown) => {
    if (done) {
      return;
    }
    done = true;
    settled(error);
  };
  try {
    // The read itself is guarded: a hostile then-getter must classify as a
    // callback failure, not escape into the OMP timer callback.
    const then = (result as { then?: unknown } | null | undefined)?.then;
    if (typeof then !== "function") {
      settleOnce();
      return;
    }
    (then as (onFulfilled: () => void, onRejected: (error: unknown) => void) => void).call(
      result,
      () => settleOnce(),
      (error: unknown) => settleOnce(error),
    );
  } catch (error) {
    settleOnce(error);
  }
}

/**
 * Wrap a provider callback so sync throws and promise rejections never
 * escape. Interval callbacks are additionally serialized: while one async
 * run is in flight the next tick is skipped instead of overlapping.
 */
function containsErrors(callback: () => void, report: (error: unknown) => void, serialize: boolean): () => void {
  let inFlight = false;
  return () => {
    if (serialize && inFlight) {
      return;
    }
    inFlight = true;
    try {
      const result = callback() as unknown;
      settleLikePromise(result, (error?: unknown) => {
        if (error !== undefined) {
          report(error);
        }
        inFlight = false;
      });
    } catch (error) {
      report(error);
      inFlight = false;
    }
  };
}

/**
 * Bounded provider-failure channel for one Host. Covers callback failures
 * and stop failures alike. While under the cap, identical failures from
 * the same source are reported once; the first over-cap failure emits a
 * generic suppression summary (no invented totals), and everything after
 * that is dropped without allocating: the seen set never grows past the
 * cap, keeping the reporter's memory strictly bounded.
 */
class BoundedFailureReporter {
  readonly #seen = new Set<string>();
  readonly #onDiagnostic: (message: string) => void;
  #suppressing = false;

  constructor(onDiagnostic: (message: string) => void) {
    this.#onDiagnostic = onDiagnostic;
  }

  /**
   * Report one failure under a dedupe key. `key` is the failure content
   * without any entry index, so the same rejection from two configured
   * instances of one provider is reported once; `message` is what reaches
   * the diagnostic sink, carrying the first failing entry's index.
   * Distinct keys each get a line. Exactly one suppression notice is
   * emitted, at the moment the first over-cap key arrives; after that the
   * reporter drops everything without allocating: the seen set never grows
   * past the cap.
   */
  report(key: string, message: string): void {
    if (this.#suppressing) {
      return;
    }
    if (this.#seen.has(key)) {
      return;
    }
    if (this.#seen.size >= MAX_PROVIDER_FAILURES) {
      this.#suppressing = true;
      this.#onDiagnostic("... further status bar failures suppressed");
      return;
    }
    this.#seen.add(key);
    this.#onDiagnostic(message);
  }

  reportFailure(phase: "callback" | "stop", providerId: string, entryIndex: number, error: unknown): void {
    // The dedupe key keeps the provider id and the error content but not
    // the entry index: the same failure from two instances of one provider
    // is one failure.
    this.report(
      `${phase} failure in "${providerId}": ${describeError(error)}`,
      `${phase} failure in "${providerId}" (statuses[${entryIndex}]): ${describeError(error)}`,
    );
  }
}

export class StatusBarHost {
  readonly #environment: HostEnvironment;
  readonly #getAgentDir: AgentDirResolver;
  readonly #joinPath: PathJoiner;
  readonly #onDiagnostic: (message: string) => void;
  readonly #failureReporter: BoundedFailureReporter;
  readonly #configReader: ConfigReader;
  /**
   * Separator rendered through the theme's public `fg` channel; set when
   * the widget factory runs. Already contains the theme's color codes.
   */
  #separatorText: string | undefined = undefined;
  /**
   * TUI instance captured from the real `setWidget` factory; fragment
   * updates request component-scoped repaints on exactly this instance.
   */
  #tui: unknown = undefined;
  /** Widget component while mounted; undefined headless or before first mount. */
  #widget: StatusBarWidgetComponent | undefined;
  /**
   * Whether this Host actually called environment.setWidget. Derived
   * state (instances.length) cannot answer this: a start racing an async
   * provider may never mount, and shutdown must then not unmount.
   */
  #widgetRegistered = false;
  /**
   * The exact handler this Host installed on the shared snapshot store.
   * Shutdown clears the store's sink only when it is still this handler,
   * so a Host never removes a successor's handler.
   */
  #samplerErrorHandler: ((error: unknown) => void) | undefined = undefined;
  /**
   * Resolved when shutdown begins; start flows race their awaited provider
   * calls against it, so a never-settling provider start cannot hang
   * `host.start()` or the OMP session_start handler. The signal only
   * resolves, never rejects; a provider start's rejection is converted
   * into an outcome value by the handler in `#raceStart()`.
   */
  #shutdownSignal: Promise<void> | undefined = undefined;
  #signalShutdown: (() => void) | undefined = undefined;
  /** Live provider instances in composition order. */
  #instances: RunningInstance[] = [];
  /** Separator kind from the configuration; fixed at start. */
  #separator: "space" | "slash" | "dot" | "pipe" = "slash";
  /** Bumped by any fragment change; drives the widget render memo. */
  #revision = 0;
  /** Set by start() and never cleared: one Host serves exactly one session. */
  #started = false;
  /**
   * Lifecycle generation. Incremented when a shutdown begins; start flows
   * capture the value at entry and abandon all further work if it changed,
   * so a late-arriving start can never resurrect a closed session.
   */
  #generation = 0;
  /** True from the first shutdown() call until the Host is discarded. */
  #shuttingDown = false;

  constructor(options: HostOptions) {
    this.#environment = options.environment;
    this.#getAgentDir = options.getAgentDir;
    this.#joinPath = options.joinPath;
    this.#onDiagnostic = options.onDiagnostic;
    this.#failureReporter = new BoundedFailureReporter(options.onDiagnostic);
    this.#configReader = options.configReader ?? readConfigFile;
  }

  async start(): Promise<void> {
    if (this.#shuttingDown) {
      throw new Error("StatusBarHost was shut down; it cannot start again");
    }
    if (this.#started) {
      throw new Error("StatusBarHost.start called twice for the same session");
    }
    this.#started = true;
    // The signal exists from start() until shutdown; start flows race
    // awaited provider calls against it.
    if (this.#shutdownSignal === undefined) {
      let signal: (() => void) | undefined;
      this.#shutdownSignal = new Promise<void>((resolve) => {
        signal = resolve;
      });
      this.#signalShutdown = signal;
      // If shutdown never comes (process exit paths), a pending signal is
      // inert; no rejection exists to handle.
    }
    const generation = this.#generation;
    // Headless sessions can never display a widget: skip configuration
    // loading, provider creation, and scheduling entirely. Shutdown stays a
    // safe no-op because no instance was ever created.
    if (!this.#environment.hasUI) {
      return;
    }
    const configPath = this.#joinPath(this.#getAgentDir(), CONFIG_FILE_NAME);
    const loaded = await this.#configReader(configPath);
    // Shutdown raced the config read: abandon the flow without creating
    // anything or touching the widget.
    if (this.#generation !== generation) {
      return;
    }
    if ("missing" in loaded) {
      return;
    }
    if ("failure" in loaded) {
      this.#onDiagnostic(`Status bar disabled: ${loaded.failure}`);
      return;
    }
    this.#separator = loaded.config.separator;
    // The shared built-in sampler runs on one OMP-managed interval owned by
    // the snapshot store; built-in providers only retain/release scopes.
    // Sampler errors (source getters, listener callbacks) route into the
    // same bounded, content-deduped diagnostic reporter; the sink is
    // cleared on shutdown so the store never reaches a dead Host.
    const store = getSnapshotStore();
    store.attachTimers({
      setInterval: (callback: () => void, ms: number) => this.#environment.setInterval(callback, ms),
      clearTimeout: (timer: unknown) => this.#environment.clearTimer(timer),
    });
    this.#samplerErrorHandler = (error: unknown) => {
      // The key carries the failure category, so an identical message from
      // a different category (e.g. a widget mount failure) never dedupes
      // against a sampler failure.
      this.#failureReporter.report(`sampler: ${describeError(error)}`, `sampler: ${describeError(error)}`);
    };
    store.onSamplerError = this.#samplerErrorHandler;
    const registry = getProviderRegistry();
    const instances: RunningInstance[] = [];
    const reporter = this.#failureReporter;
    // Entry problems from the parser skip only that entry. Diagnostics
    // dedupe by content: the key keeps the category and reason but not the
    // source index, so N identical malformed entries report once (carrying
    // the first original index); distinct content still gets its own line.
    for (const problem of loaded.problems) {
      reporter.report(`parse problem: ${problem.reason}`, `statuses[${problem.index}]: ${problem.reason}`);
    }
    let skippedEntries = loaded.problems.length;
    let aborted = false;
    for (const entry of loaded.config.statuses) {
      // Shutdown raced a previous entry's pending start: create nothing.
      if (this.#generation !== generation) {
        aborted = true;
        break;
      }
      const failure = await this.#startEntry(
        entry.sourceIndex,
        entry.id,
        entry.options,
        registry,
        instances,
        generation,
      );
      if (failure === undefined) {
        continue;
      }
      skippedEntries++;
      // Dedupe by the failure content: the index prefix is stripped for the
      // key, so the same rejection from two configured instances of one
      // provider is reported once, carrying its first original index.
      const at = failure.indexOf("]: ");
      const content = at >= 0 ? failure.slice(at + 3) : failure;
      reporter.report(content, `statuses[${entry.sourceIndex}]: ${content}`);
    }
    // Shutdown raced this start (before, during, or after the loop): never
    // reassign the instance list, publish failures, or render; shutdown
    // owns the widget and the live list now.
    if (aborted || this.#generation !== generation) {
      return;
    }
    this.#instances = instances;
    this.#reportEntryFailures(skippedEntries);
    if (instances.length > 0) {
      // The widget mounts only after at least one provider started
      // successfully; pending or failed providers never become visible.
      // Without a mounted widget this session has no UI output, so a mount
      // failure tears the session down instead of leaving providers and
      // timers running invisibly.
      if (!this.#ensureWidgetMounted()) {
        await this.shutdown();
      }
    }
  }

  /**
   * Stop every instance and unmount the widget, in the specification's
   * order: first deactivate every instance (refusing new publishes and
   * new managed timers) and start every provider's stop lifecycle, then
   * reclaim all timers, then await the stops, and finally unmount. A slow
   * or stuck stop therefore cannot keep other instances' timers running,
   * and late publishes, new timers, and late callback diagnostics are
   * refused once an instance is inactive.
   */
  async shutdown(): Promise<void> {
    if (this.#shuttingDown) {
      return;
    }
    this.#shuttingDown = true;
    this.#generation++;
    // Release every start flow racing the signal; a race already lost to
    // the signal returns "shutdown" and the race winner carries the start
    // outcome, so no extra bookkeeping is needed here.
    this.#signalShutdown?.();
    const instances = this.#instances;
    this.#instances = [];
    for (const running of instances) {
      running.active = false;
    }
    // Deactivate first, then start every stop() synchronously: stop
    // promises kick off before any timer is cleared, per spec.
    for (const running of instances) {
      const instance = running.instance;
      if (instance !== undefined && running.stopped === undefined) {
        running.stopped = (async () => {
          try {
            await instance.stop();
          } catch (error) {
            this.#failureReporter.reportFailure("stop", running.providerId, running.entryIndex, error);
          }
        })();
      }
    }
    // Reclaim every managed timer after all stops have been initiated.
    for (const running of instances) {
      this.#reclaimTimers(running);
    }
    for (const running of instances.reverse()) {
      if (running.stopped !== undefined) {
        await running.stopped;
      }
    }
    // Unmount exactly once, after every provider stopped and all timers
    // were reclaimed. Blocked publishes and timers between here and OMP's
    // actual unmount have no visible component to reach.
    this.#widget = undefined;
    this.#separatorText = undefined;
    this.#tui = undefined;
    // Release this Host's sampler sink, but only if it is still ours: the
    // store may have been re-bound by a successor session.
    const store = getSnapshotStore();
    if (this.#samplerErrorHandler !== undefined && store.onSamplerError === this.#samplerErrorHandler) {
      store.onSamplerError = undefined;
    }
    this.#samplerErrorHandler = undefined;
    if (this.#widgetRegistered) {
      this.#widgetRegistered = false;
      this.#environment.unsetWidget(WIDGET_KEY);
    }
  }

  /**
   * Accept a fragment from one instance and refresh the widget. Contained:
   * a throwing provider callback must not break composition of the
   * remaining entries.
   */
  handleFragment(entryIndex: number, fragment: ProviderFragment): void {
    const target = this.#instances.find((running) => running.entryIndex === entryIndex);
    if (!target || !target.active) {
      return;
    }
    let sanitized: ReturnType<typeof sanitizeFragment>;
    try {
      sanitized = sanitizeFragment(fragment);
    } catch (error) {
      // A hostile getter can throw during sanitization; treat it as an
      // invalid fragment, clear the entry, and keep the line composed.
      target.spans = [];
      this.#failureReporter.reportFailure(
        "callback",
        target.providerId,
        entryIndex,
        new Error(`threw while publishing: ${describeError(error)}`),
      );
      this.#revision++;
      this.#refreshWidget();
      return;
    }
    if (!sanitized.ok) {
      target.spans = [];
      this.#failureReporter.reportFailure(
        "callback",
        target.providerId,
        entryIndex,
        new Error("published a structurally invalid fragment"),
      );
      this.#revision++;
      this.#refreshWidget();
      return;
    }
    // Equal content does not bump the revision, so unchanged fragments do
    // not trigger widget re-renders.
    const before = target.spans;
    target.spans = [...sanitized.fragment.spans];
    if (!sameSpans(before, target.spans)) {
      this.#revision++;
      this.#refreshWidget();
    }
  }

  /**
   * Call provider stop() exactly once per instance, however many callers
   * race.
   */
  async #stopInstance(running: RunningInstance): Promise<void> {
    if (running.stopped !== undefined) {
      await running.stopped.catch(() => undefined);
      return;
    }
    running.stopped = (async () => {
      if (running.instance === undefined) {
        return;
      }
      try {
        await running.instance.stop();
      } catch (error) {
        this.#failureReporter.reportFailure("stop", running.providerId, running.entryIndex, error);
      }
    })();
    await running.stopped;
  }

  #reportEntryFailures(skippedEntries: number): void {
    if (skippedEntries === 0) {
      return;
    }
    this.#onDiagnostic(
      `Status bar skipped ${skippedEntries} configuration ${skippedEntries === 1 ? "entry" : "entries"}`,
    );
  }

  /**
   * Await a provider's start, racing it against the shutdown signal. The
   * rejection handler wraps the reason into the outcome, so the promise
   * awaited here never rejects. Returns "shutdown" when the signal fired
   * first, "settled" when the start resolved, or the rejection reason
   * wrapped for the caller.
   */
  async #raceStart(
    instance: ProviderInstance,
    signal: Promise<void> | undefined,
  ): Promise<"shutdown" | "settled" | { startError: unknown }> {
    const started = Promise.resolve()
      .then(() => instance.start())
      .then(
        () => "settled" as const,
        (error: unknown) => ({ startError: error }),
      );
    if (signal === undefined) {
      return await started;
    }
    return await Promise.race([started, signal.then(() => "shutdown" as const)]);
  }

  /** Start one entry; returns a diagnostic string on failure, undefined on success. */
  async #startEntry(
    entryIndex: number,
    providerId: string,
    options: ProviderOptions,
    registry: ProviderRegistry,
    instances: RunningInstance[],
    generation: number,
  ): Promise<string | undefined> {
    const definition = registry.get(providerId);
    if (!definition) {
      return `statuses[${entryIndex}]: provider "${providerId}" is not registered (registered: ${registry.ids().join(", ") || "none"})`;
    }
    try {
      assertSupportedContractVersion(definition);
    } catch (error) {
      return `statuses[${entryIndex}]: ${describeError(error)}`;
    }
    let description: ProviderDescription;
    try {
      description = definition.describe(options);
    } catch (error) {
      return `statuses[${entryIndex}]: provider "${providerId}" rejected options: ${describeError(error)}`;
    }
    const running: RunningInstance = {
      entryIndex,
      providerId,
      instance: undefined,
      spans: [],
      timers: [],
      active: true,
      stopped: undefined,
    };
    const context = this.#createInstanceContext(running, options, description);
    let instance: ProviderInstance | undefined;
    try {
      instance = definition.create(context);
    } catch (error) {
      // create() may have registered timers before throwing and may have
      // started continuations: deactivate first so a resumed continuation
      // cannot schedule timers or publish, then reclaim.
      running.active = false;
      this.#reclaimTimers(running);
      return `statuses[${entryIndex}]: provider "${providerId}" failed to create an instance: ${describeError(error)}`;
    }
    running.instance = instance;
    // Register before start(): a provider may publish during start().
    this.#instances.push(running);
    instances.push(running);
    // A never-settling or late-rejecting start must not hang the start
    // flow past shutdown: race it against the signal. The rejection
    // handler inside #raceStart converts a rejection into an outcome
    // value, so a late rejection is already handled.
    const outcome = await this.#raceStart(instance, this.#shutdownSignal);
    if (outcome === "shutdown") {
      // Shutdown won the race: it owns the instance through its memoized
      // stop, so report nothing and discard nothing here.
      return undefined;
    }
    // Recheck the generation even when the start settled: if shutdown
    // already began (generation bumped) the shutdown owns the instance
    // through its memoized stop, and this flow must not discard it or
    // report a diagnostic for it.
    if (this.#generation !== generation) {
      return undefined;
    }
    const startError = outcome === "settled" ? undefined : outcome.startError;
    if (startError !== undefined) {
      await this.#discardInstance(running, instances);
      return `statuses[${entryIndex}]: provider "${providerId}" failed to start: ${describeError(startError)}`;
    }
    return undefined;
  }

  /**
   * Register the widget once for the session; later calls are no-ops. OMP
   * invokes the factory with the live TUI and theme when it actually mounts
   * the component: the theme themes the separator through its public `fg`
   * channel, and the TUI instance is captured so fragment updates can
   * request component-scoped repaints. Returns whether a registration is
   * in place: true when it already was, or when setWidget returned; false
   * when the environment has no UI or refused the registration — there is
   * no retry within a session, and a false makes the caller tear the
   * session down.
   */
  #ensureWidgetMounted(): boolean {
    // The registration flag guards re-entry: between the setWidget call and
    // the factory running, #widget is still undefined, so a second call
    // must not register again.
    if (this.#widget !== undefined || this.#widgetRegistered || !this.#environment.hasUI) {
      return this.#widgetRegistered;
    }
    const host = this;
    // Registered only after setWidget returned: an environment that throws
    // must not leave the Host believing it owns a registration, and an
    // environment failure stays inside the mount attempt instead of
    // aborting the whole start flow.
    try {
      this.#environment.setWidget(
        WIDGET_KEY,
        (tui, theme) => {
          const component = createStatusBarWidget();
          // The separator is themed through OMP's public `fg` channel, which
          // renders the native color mode (24-bit, 256, 16, or none).
          host.#separatorText = theme.fg("dim", SEPARATOR_TEXT[this.#separator]);
          // Captured from the real OMP TUI: later fragment updates request a
          // component-scoped repaint on exactly this instance.
          host.#tui = tui;
          host.#widget = component;
          // Initialize with the current content so early publications show up.
          component.setLine(host.#composedLine());
          return component;
        },
        { placement: "belowEditor" },
      );
    } catch (error) {
      // No registration happened; this session cannot display anything, so
      // the caller runs the full shutdown.
      this.#failureReporter.report(
        `widget mount: ${describeError(error)}`,
        `widget mount failed: ${describeError(error)}`,
      );
      return false;
    }
    this.#widgetRegistered = true;
    return true;
  }

  #composedLine(): ComposedLine {
    const fragments = this.#instances.map((running) => ({ spans: running.spans }));
    return composeLine(fragments, this.#separator, this.#revision, this.#separatorText);
  }

  /**
   * Recompose and push the line into the component, then request a
   * component-scoped render on the TUI captured at mount. A fragment update
   * never re-mounts the widget.
   */
  #refreshWidget(): void {
    if (this.#widget === undefined) {
      return;
    }
    const line = this.#composedLine();
    this.#widget.setLine(line);
    (this.#tui as { requestComponentRender?: (component: unknown) => void } | undefined)?.requestComponentRender?.(
      this.#widget,
    );
  }

  /** Force-clear timers a provider instance leaked and never cleared. */
  #reclaimTimers(running: RunningInstance): void {
    for (const timer of running.timers) {
      this.#environment.clearTimer(timer);
    }
    running.timers = [];
  }

  /**
   * Stop a failed instance and drop it from the live list. The instance is
   * deactivated and its timers reclaimed before stop() is awaited, so a
   * slow or stuck stop cannot keep timers running; a finally-style reclaim
   * catches handles left behind by the synchronous part of stop().
   */
  async #discardInstance(running: RunningInstance, instances: RunningInstance[]): Promise<void> {
    running.active = false;
    this.#reclaimTimers(running);
    await this.#stopInstance(running);
    this.#reclaimTimers(running);
    this.#instances = this.#instances.filter((candidate) => candidate !== running);
    const at = instances.indexOf(running);
    if (at >= 0) {
      instances.splice(at, 1);
    }
    this.#revision++;
    this.#refreshWidget();
  }

  #createInstanceContext(
    running: RunningInstance,
    options: ProviderOptions,
    instanceConfig: ProviderDescription,
  ): ProviderInstanceContext {
    return {
      options,
      config: instanceConfig,
      publish: (fragment: ProviderFragment) => {
        if (!running.active) {
          return;
        }
        this.handleFragment(running.entryIndex, fragment);
      },
      setInterval: (callback: () => void, ms: number) => {
        if (!running.active) {
          return IGNORED_TIMER;
        }
        const report = (error: unknown) => {
          if (!running.active) {
            return;
          }
          this.#failureReporter.reportFailure("callback", running.providerId, running.entryIndex, error);
        };
        // One serialized wrapper for every tick: a fresh wrapper per tick
        // would reset inFlight and let async runs overlap.
        const wrapped = containsErrors(callback, report, true);
        const timer = this.#environment.setInterval(() => {
          if (!running.active) {
            return;
          }
          wrapped();
        }, ms);
        running.timers.push(timer);
        return timer;
      },
      setTimeout: (callback: () => void, ms: number) => {
        if (!running.active) {
          return IGNORED_TIMER;
        }
        const report = (error: unknown) => {
          if (!running.active) {
            return;
          }
          this.#failureReporter.reportFailure("callback", running.providerId, running.entryIndex, error);
        };
        const wrapped = containsErrors(callback, report, false);
        const timer = this.#environment.setTimeout(() => {
          // One-shot timer fired: drop it from the tracked set so shutdown
          // does not re-clear a handle that has already run.
          running.timers = running.timers.filter((candidate) => candidate !== timer);
          if (!running.active) {
            return;
          }
          wrapped();
        }, ms);
        running.timers.push(timer);
        return timer;
      },
      clearTimer: (timer: unknown) => {
        // Only handles this instance still tracks are real: inactive
        // (already reclaimed), foreign, and already-fired handles no-op.
        if (!running.timers.includes(timer)) {
          return;
        }
        running.timers = running.timers.filter((candidate) => candidate !== timer);
        this.#environment.clearTimer(timer);
      },
    };
  }
}

/** Shape the widget component exposes to the Host for line updates. */
export type { StatusBarWidgetComponent };
