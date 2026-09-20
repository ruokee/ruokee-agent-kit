/**
 * Fake host for the wiring tests.
 *
 * It mirrors the observable parts of the real extension API: entries land in one
 * branch array, a delivered custom message is persisted as a `custom_message`
 * entry, and extensions can be driven through the handlers they registered.
 * Tests append records by hand to model a damaged or edited journal.
 */

import { zod } from "@oh-my-pi/pi-coding-agent";
import type { ExtensionAPI, ExtensionContext } from "@oh-my-pi/pi-coding-agent";

/** One entry of the fake branch. */
export interface FakeEntry {
  id: string;
  type: string;
  customType?: string;
  data?: unknown;
  content?: unknown;
  display?: boolean;
  details?: unknown;
  summary?: string;
  parentId?: string | null;
  [key: string]: unknown;
}

/**
 * Entry identities of the fake branch.
 *
 * One counter serves every host a test builds, because a host that continues an
 * existing branch must not reuse an identity that branch already holds.
 */
let entryIds = 0;

/** Dialog scripting: a queued value, or a callback run when the dialog opens. */
export type Scripted<T> = T | (() => T);

/** One custom component as the fake host drives it. */
interface FakeComponent {
  handleInput?: (data: string) => void;
  render: (width: number) => readonly string[];
  invalidate?: () => void;
}

/** The component factory one custom dialog is opened with. */
type FakeFactory = (tui: unknown, theme: unknown, keybindings: unknown, done: (value: unknown) => void) => unknown;

export interface FakeUI {
  notifies: Array<{ message: string; kind: string | undefined }>;
  /** Titles the command opened a selection with. */
  selectTitles: string[];
  /** Options each selection offered, in the order the dialog showed them. */
  selectOptions: string[][];
  /** Lines of the last render of a custom component. */
  listLines: string[];
  /** Lines of every render of a custom component, in order. */
  listRenders: string[][];
  /** Widths a custom component was rendered at, in order. */
  listWidths: number[];
  select: (title?: string, options?: string[]) => string | undefined;
  editor: () => string | undefined;
  confirm: () => boolean | undefined;
  custom: (factory: unknown, options?: unknown) => Promise<unknown>;
}

export function scriptedUI(script: {
  select?: Scripted<string | undefined>[];
  editor?: Scripted<string | undefined>[];
  confirm?: Scripted<boolean | undefined>[];
  /** Keys fed to the custom component of one dialog, in the order it gets them. */
  keys?: Scripted<string[] | undefined>[];
  /** Width the custom component renders at, and the height the terminal reports. */
  width?: number;
  /** Widths of successive renders, so one dialog can be drawn at two widths. */
  widths?: number[];
  rows?: number;
}): FakeUI {
  const notifies: Array<{ message: string; kind: string | undefined }> = [];
  const selectTitles: string[] = [];
  const selectOptions: string[][] = [];
  const listLines: string[] = [];
  const listRenders: string[][] = [];
  const listWidths: number[] = [];
  const pull = <T>(queue: Scripted<T>[] | undefined, fallback: T): T => {
    const next = queue?.shift();
    return typeof next === "function" ? (next as () => T)() : ((next as T) ?? fallback);
  };
  return {
    notifies,
    selectTitles,
    selectOptions,
    listLines,
    listRenders,
    listWidths,
    select: (title?: string, options?: string[]) => {
      if (title !== undefined) selectTitles.push(title);
      selectOptions.push(options ?? []);
      return pull(script.select, undefined);
    },
    editor: () => pull(script.editor, undefined),
    confirm: () => pull(script.confirm, false),
    // A custom dialog is opened the way the host opens it: the factory builds a
    // component, the host hands it the keys a user presses, and the component
    // answers once. Every render is kept, so a test can read what the list shows
    // at the width it was given.
    custom: (factory: unknown, _options?: unknown) => {
      const keys: string[] = pull(script.keys, [] as string[]) ?? [];
      const widths = script.widths ?? [];
      const widthAt = (index: number) => widths[index] ?? script.width ?? 60;
      const draw = (view: FakeComponent, index: number) => {
        const width = widthAt(index);
        const lines = [...view.render(width)];
        listLines.splice(0, listLines.length, ...lines);
        listRenders.push(lines);
        listWidths.push(width);
      };
      return new Promise((resolve) => {
        let settled = false;
        const done = (value: unknown) => {
          if (settled) return;
          settled = true;
          resolve(value);
        };
        const building = (factory as FakeFactory)({ terminal: { rows: script.rows ?? 24 } }, {}, {}, done);
        void Promise.resolve(building).then((component) => {
          const view = component as FakeComponent;
          draw(view, 0);
          let rendered = 1;
          for (const key of keys) {
            if (settled) break;
            view.handleInput?.(key);
            draw(view, rendered);
            rendered += 1;
          }
          // A dialog whose keys are used up gets no answer, the way a user who
          // leaves it open and walks away does.
          done(undefined);
        });
      });
    },
  };
}

export interface FakeCtxOptions {
  journal: FakeEntry[];
  /** Every entry of the session, when it holds more than the branch of this host. */
  sessionEntries?: FakeEntry[];
  /** Whether this host's session manager offers every entry of the session. */
  offersSessionEntries?: boolean;
  ui?: FakeUI;
  hasUI?: boolean;
  sessionId?: () => string;
}

export function fakeContext(options: FakeCtxOptions): ExtensionContext {
  const ui = options.ui ?? scriptedUI({});
  return {
    hasUI: options.hasUI ?? true,
    mode: "interactive",
    cwd: "/tmp/project",
    ui: {
      notify: (message: string, kind?: string) => {
        ui.notifies.push({ message, kind });
      },
      select: (title: string, options: string[]) => ui.select(title, options),
      editor: () => ui.editor(),
      confirm: () => ui.confirm(),
      custom: (factory: unknown, options?: unknown) => ui.custom(factory, options),
    },
    sessionManager: {
      getBranch: () => options.journal,
      ...(options.offersSessionEntries === false
        ? {}
        : { getEntries: () => options.sessionEntries ?? options.journal }),
      getSessionId: () => (options.sessionId ?? (() => "session-1"))(),
      getCwd: () => "/tmp/project",
      getSessionFile: () => "/tmp/project/session.jsonl",
    },
    isIdle: () => true,
  } as unknown as ExtensionContext;
}

export interface FakeHostOptions {
  journal?: FakeEntry[];
  /** Every entry of the session, when it holds more than this host's branch. */
  sessionEntries?: FakeEntry[];
  /** Whether this host's session manager offers every entry of the session. */
  offersSessionEntries?: boolean;
  ui?: FakeUI;
  hasUI?: boolean;
  sessionId?: () => string;
  version?: string | undefined;
  /**
   * Whether a delivered message reaches the journal at once. The real host
   * queues it while a run is streaming and persists it later, so tests that
   * cover a missing projection set this to `false`.
   */
  persistDeliveries?: boolean;
  /**
   * Whether a submitted user message reaches the journal at once. The real host
   * records the entry after the turn that consumed it, so a message submitted
   * mid-turn is carried by the request before the branch holds it.
   */
  persistSubmissions?: boolean;
  /**
   * Whether a recorded custom message is offered to the model. The real host
   * decides this by its own rules, so a test that covers a result the branch
   * holds without the request showing it sets this to `false`.
   */
  offerDeliveredMessages?: boolean;
}

export interface FakeHost {
  pi: ExtensionAPI;
  journal: FakeEntry[];
  appended: Array<{ customType: string; data: unknown }>;
  sent: Array<{ message: Record<string, unknown>; options: Record<string, unknown> | undefined }>;
  /**
   * Messages the host would run as a further model turn.
   *
   * A custom message handed over without the non-initiating mode is queued as a
   * steering message while a run streams, and the host runs it: a result must
   * never be handed over that way, so the tests check this list stays empty.
   */
  steering: Array<Record<string, unknown>>;
  /** User messages submitted through the public message API, in order. */
  submitted: Array<{ content: string; options: Record<string, unknown> | undefined }>;
  /**
   * Messages the host would send for the current branch.
   *
   * A submitted user message is part of the branch, so the next request carries
   * it, exactly as the real host runs the prompt it was given.
   */
  request(): unknown[];
  tools: Map<string, Record<string, unknown>>;
  commands: Map<string, { description?: string; handler: (args: string, ctx: ExtensionContext) => unknown }>;
  handlers: Map<string, Array<(event: unknown, ctx: ExtensionContext) => unknown>>;
  warnings: string[];
  ui: FakeUI;
  ctx: ExtensionContext;
  /** Add an entry to the branch by hand, as a host or another writer would. */
  push(entry: FakeEntry): FakeEntry;
  /** Persist the messages delivered so far, as the host does once its queue drains. */
  drain(): void;
  /** Record the user messages submitted so far, as the host does once a turn ends. */
  drainSubmissions(): void;
  emit(event: string, payload?: unknown): unknown;
}

/** Build a host that satisfies the extension's runtime check by default. */
export function fakeHost(options: FakeHostOptions = {}): FakeHost {
  const journal = options.journal ?? [];
  const appended: FakeHost["appended"] = [];
  const sent: FakeHost["sent"] = [];
  const steering: FakeHost["steering"] = [];
  const submitted: FakeHost["submitted"] = [];
  const tools = new Map<string, Record<string, unknown>>();
  const commands = new Map<
    string,
    { description?: string; handler: (args: string, ctx: ExtensionContext) => unknown }
  >();
  const handlers = new Map<string, Array<(event: unknown, ctx: ExtensionContext) => unknown>>();
  const warnings: string[] = [];
  const ui = options.ui ?? scriptedUI({});
  const ctx = fakeContext({
    journal,
    sessionEntries: options.sessionEntries,
    offersSessionEntries: options.offersSessionEntries,
    ui,
    hasUI: options.hasUI ?? true,
    sessionId: options.sessionId,
  });

  const nextId = () => `j-${(entryIds += 1)}`;
  const pending: Array<Record<string, unknown>> = [];
  const queuedSubmissions: FakeEntry[] = [];
  const persistDeliveries = options.persistDeliveries ?? true;
  const persistSubmissions = options.persistSubmissions ?? true;
  const offerDeliveredMessages = options.offerDeliveredMessages ?? true;

  const push = (entry: FakeEntry): FakeEntry => {
    journal.push(entry);
    return entry;
  };

  /** Persist one delivered message, as the host does when it consumes the queue. */
  const persist = (message: Record<string, unknown>): void => {
    push({
      id: nextId(),
      type: "custom_message",
      customType: message.customType as string,
      content: message.content as string,
      display: message.display as boolean,
      details: message.details,
      attribution: "agent",
      timestamp: 1,
    });
  };

  /** Report one event to every handler, the way the host reports what it does. */
  const emitEvent = (event: string, payload?: unknown): unknown => {
    const list = handlers.get(event) ?? [];
    let last: unknown;
    for (const handler of list) last = handler(payload, ctx);
    return last;
  };

  const pi = {
    zod,
    logger: { warn: (message: string) => warnings.push(message) },
    pi: { VERSION: options.version === undefined ? "18.1.8" : options.version },
    on: (event: string, handler: (event: unknown, ctx: ExtensionContext) => unknown) => {
      const list = handlers.get(event) ?? [];
      list.push(handler);
      handlers.set(event, list);
    },
    registerTool: (definition: Record<string, unknown>) => {
      tools.set(definition.name as string, definition);
    },
    registerCommand: (
      name: string,
      command: { description?: string; handler: (args: string, ctx: ExtensionContext) => unknown },
    ) => {
      commands.set(name, command);
    },
    appendEntry: (customType: string, data?: unknown) => {
      appended.push({ customType, data });
      push({ id: nextId(), type: "custom", customType, data });
    },
    sendMessage: (message: Record<string, unknown>, sendOptions?: Record<string, unknown>) => {
      sent.push({ message, options: sendOptions });
      // `nextTurn` holds the message for a later turn and runs none, and the
      // host records it when it takes it, so the request that reported it still
      // has to carry it until then. Any other handover is a steering message the
      // host runs as a further turn.
      if (sendOptions?.deliverAs === "nextTurn") {
        pending.push(message);
        return;
      }
      steering.push(message);
      if (persistDeliveries) persist(message);
    },
    sendUserMessage: (content: string, sendOptions?: Record<string, unknown>) => {
      submitted.push({ content, options: sendOptions });
      // The host takes the message when it hands it to the agent loop, and it
      // reports every message it takes, so the entry carries the time it was
      // taken at rather than one the fixture chose.
      const entry: FakeEntry = {
        id: nextId(),
        type: "message",
        message: { role: "user", content: [{ type: "text", text: content }], timestamp: Date.now() },
      };
      if (persistSubmissions) push(entry);
      else queuedSubmissions.push(entry);
      emitEvent("message_start", { type: "message_start", message: entry.message });
    },
  } as unknown as ExtensionAPI;

  /** One entry as the host would offer it to the model. */
  const toMessage = (entry: FakeEntry): unknown => {
    if (entry.type === "message") return entry.message;
    if (entry.type === "custom_message") {
      if (!offerDeliveredMessages) return undefined;
      return {
        role: "custom",
        customType: entry.customType,
        content: entry.content,
        display: entry.display,
        details: entry.details,
        timestamp: 1,
      };
    }
    if (entry.type === "compaction") return { role: "compactionSummary", summary: entry.summary };
    return undefined;
  };

  return {
    pi,
    journal,
    appended,
    sent,
    steering,
    submitted,
    // A queued user message is folded into the next request, before the host
    // records the entry that stands for it in the branch.
    request: () => [
      ...journal.map(toMessage).filter((message) => message !== undefined),
      ...queuedSubmissions.map((entry) => entry.message),
    ],
    tools,
    commands,
    handlers,
    warnings,
    ui,
    ctx,
    push,
    drain() {
      for (const message of pending.splice(0, pending.length)) persist(message);
    },
    drainSubmissions() {
      for (const entry of queuedSubmissions.splice(0, queuedSubmissions.length)) push(entry);
    },
    emit(event: string, payload?: unknown) {
      return emitEvent(event, payload);
    },
  };
}
