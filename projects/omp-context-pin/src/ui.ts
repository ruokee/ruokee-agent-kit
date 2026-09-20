/**
 * The `/ctx-pin` list of pinned entries.
 *
 * The list is the host's own selection component, wrapped so this command can say
 * what its left column means. The entry number is the icon column of a row: the
 * component draws that column as wide as the longest number of the list, so the
 * numbers line up, the text of every row starts at the same place, and the rows
 * that are not entries leave the column empty. The text of a row is the entry body
 * folded to one line and cut by the component to the width the row has when it is
 * drawn: a wider terminal shows more of a body and a narrower one shows less, and
 * no fixed length of it is dropped beforehand.
 *
 * The answer is the entry number, not the row text, so a body that begins like
 * another body, or that is cut at the same place as another one, still selects the
 * entry it named.
 */

import type { ExtensionCommandContext } from "@oh-my-pi/pi-coding-agent";
import { getSelectListTheme, type Theme } from "@oh-my-pi/pi-coding-agent";
import { Ellipsis, SelectList, type SelectItem, type TUI, truncateToWidth } from "@oh-my-pi/pi-tui";
import { type PinState, foldBody } from "./state.ts";

/** What one answer of the list means. */
export interface PinChoice {
  kind: "add" | "entry" | "close";
  /** Entry number an `entry` answer names. */
  entryId?: number;
}

/** Value of the row that creates an entry. */
const ADD_VALUE = "add";
/** Value of the row that closes the list. */
const CLOSE_VALUE = "close";
/** Text of the row that creates an entry. */
const ADD_LABEL = "Add a new pin";
/** Text of the row that closes the list. */
const CLOSE_LABEL = "Close";
/** Rows the list may use when the terminal reports no height. */
const DEFAULT_VISIBLE_ROWS = 10;
/** Rows the list keeps for itself when the terminal is small. */
const MIN_VISIBLE_ROWS = 3;
/** Rows the list never takes, however tall the terminal is. */
const MAX_VISIBLE_ROWS = 20;
/** Rows of the terminal the title and the surrounding session keep. */
const CHROME_ROWS = 6;

/**
 * Rows of one entry list, in the order they are offered.
 *
 * Creating stays first and closing stays last, so the two rows that are not
 * entries keep their places while the entries between them change.
 */
export function pinRows(state: PinState): SelectItem[] {
  const rows: SelectItem[] = [{ value: ADD_VALUE, label: ADD_LABEL }];
  for (const entry of state.entries) {
    rows.push({ value: String(entry.entryId), icon: `#${entry.entryId}`, label: foldBody(entry.body) });
  }
  rows.push({ value: CLOSE_VALUE, label: CLOSE_LABEL });
  return rows;
}

/** The choice one row value stands for. */
export function choiceOf(value: string): PinChoice | undefined {
  if (value === ADD_VALUE) return { kind: "add" };
  if (value === CLOSE_VALUE) return { kind: "close" };
  const entryId = Number(value);
  if (!Number.isSafeInteger(entryId) || entryId < 1) return undefined;
  return { kind: "entry", entryId };
}

/**
 * Rows the list may use in this terminal.
 *
 * The terminal reports its height in rows, and the list keeps room for the title
 * and for what the session around it draws. A terminal that reports no usable
 * height leaves a small list, so the dialog still opens.
 */
export function visibleRows(tui: TUI): number {
  const rows = (tui as { terminal?: { rows?: unknown } }).terminal?.rows;
  if (typeof rows !== "number" || !Number.isFinite(rows) || rows <= 0) return DEFAULT_VISIBLE_ROWS;
  return Math.max(MIN_VISIBLE_ROWS, Math.min(MAX_VISIBLE_ROWS, Math.trunc(rows) - CHROME_ROWS));
}

/**
 * The entry list as the host draws it: a title line over the selection list.
 *
 * The component hands the width it is given straight to the list, so a terminal
 * resize changes how much of each body is shown without changing what a row
 * selects.
 */
class PinList {
  #title: string;
  #list: SelectList;
  #done: (choice: PinChoice | undefined) => void;

  constructor(
    rows: readonly SelectItem[],
    title: string,
    done: (choice: PinChoice | undefined) => void,
    maxVisible: number,
  ) {
    this.#title = title;
    this.#done = done;
    // The theme comes from the host: it is the theme the session is set to, and
    // an extension that painted its own would not follow a theme change.
    // The row text is cut by the width it is drawn at, and a cut row says so:
    // the list asks this back for the text of a row that does not fit.
    // The host component keeps its own search, which it offers once the list is
    // longer than the rows it shows, and it is handed the width of every render.
    this.#list = new SelectList(rows, maxVisible, getSelectListTheme(), {
      truncatePrimary: ({ text, maxWidth }) => truncateToWidth(text, maxWidth, Ellipsis.Omit),
    });
    this.#list.onSelect = (item) => this.#done(choiceOf(item.value));
    this.#list.onCancel = () => this.#done(undefined);
  }

  render(width: number): readonly string[] {
    const title = truncateToWidth(this.#title, Math.max(1, width), Ellipsis.Omit);
    return [title, ...this.#list.render(width)];
  }

  handleInput(data: string): void {
    this.#list.handleInput(data);
  }

  invalidate(): void {
    this.#list.invalidate();
  }
}

/** Ask for one row of the entry list. */
export async function selectEntry(
  ctx: ExtensionCommandContext,
  state: PinState,
  title: string,
): Promise<PinChoice | undefined> {
  const rows = pinRows(state);
  return ctx.ui.custom<PinChoice | undefined>(
    (tui, _theme: Theme, _keybindings, done) => new PinList(rows, title, done, visibleRows(tui)),
    { overlay: true },
  );
}
