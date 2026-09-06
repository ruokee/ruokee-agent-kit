/**
 * Line composer and row renderer for the persistent widget.
 *
 * The Host stores one sanitized fragment per running instance. `composeLine`
 * joins the visible fragments with the configured separator span and colors
 * the whole line before truncation. `renderRows` turns a composed line into
 * revision and width, and truncated from the right with pi-tui's ANSI-aware
 * `truncateToWidth` so configured-leading entries survive and a single
 * ellipsis marks the cut.
 */
import { truncateToWidth, visibleWidth } from "@oh-my-pi/pi-tui";

import type { ProviderFragment, ProviderSpan } from "./provider-api.ts";
import type { SeparatorValue } from "./config.ts";
import { SEPARATOR_TEXT } from "./config.ts";

/**
 * Host-side styled text runs ready for composition. Extends the public
 * provider span with the internal `verbatim` flag: composition embeds the
 * themed separator as pre-styled text that renders exactly as given. The
 * sanitizer never accepts `verbatim` from a provider publication, so the
 * field stays out of the public contract.
 */
export interface StyledSpan extends ProviderSpan {
  /**
   * Render `text` exactly as given, skipping re-styling. Internal
   * composition only.
   */
  verbatim?: boolean;
}

/** A line under construction: styled spans plus a change-tracking revision. */
export interface ComposedLine {
  revision: number;
  spans: readonly StyledSpan[];
}

/** Convert a `#RRGGBB` color to a truecolor foreground sequence. */
function colorPrefix(color: string): string {
  const channel = color.slice(1);
  const r = Number.parseInt(channel.slice(0, 2), 16);
  const g = Number.parseInt(channel.slice(2, 4), 16);
  const b = Number.parseInt(channel.slice(4, 6), 16);
  return `\x1b[38;2;${r};${g};${b}m`;
}

const FOREGROUND_RESET = "\x1b[39m";
const DIM_PREFIX = "\x1b[2m";
const DIM_SUFFIX = "\x1b[22m";

/** Render one styled span to an ANSI string; color and dim compose, not exclude. */
export function renderSpan(span: StyledSpan): string {
  // Themed separator text is already ANSI from the theme; never re-wrapped.
  if (span.verbatim) {
    return span.text;
  }
  let out = "";
  if (span.dim) {
    out += DIM_PREFIX;
  }
  if (span.color) {
    out += colorPrefix(span.color);
  }
  out += span.text;
  if (span.color) {
    out += FOREGROUND_RESET;
  }
  if (span.dim) {
    out += DIM_SUFFIX;
  }
  return out;
}

/** Join fragments in configured order; empty fragments contribute nothing. */
export function composeLine(
  fragments: readonly ProviderFragment[],
  separator: SeparatorValue,
  revision: number,
  themedSeparator?: string,
): ComposedLine {
  const spans: StyledSpan[] = [];
  let visible = 0;
  for (const fragment of fragments) {
    const contributes = fragment.spans.filter((span) => span.text.length > 0);
    if (contributes.length === 0) {
      continue;
    }
    if (visible > 0) {
      if (themedSeparator !== undefined) {
        // Theme-rendered separators arrive as ANSI text, not a styled span:
        // pushing them through renderSpan would double-encode.
        spans.push({ text: themedSeparator, dim: false, color: undefined, verbatim: true });
      } else {
        spans.push({ text: SEPARATOR_TEXT[separator], dim: true, color: undefined });
      }
    }
    for (const span of contributes) {
      spans.push(span);
    }
    visible++;
  }
  return { revision, spans };
}

/** ANSI text of a composed line; separators render dim in the theme color. */
export function renderLine(line: ComposedLine): string {
  let text = "";
  for (const span of line.spans) {
    text += renderSpan(span);
  }
  return text;
}

/**
 * ANSI-aware width check: control sequences and cursor-hiding CSI are not
 * visible, so a line whose visible width is zero shows nothing even when
 * escape bytes are present.
 */
function hasVisibleContent(text: string): boolean {
  return visibleWidth(text.replace(/\x1b\[[0-9;]*m/g, "")) > 0;
}

/**
 * Widget row computation: zero rows while nothing is visible, one otherwise.
 * `truncateToWidth` is ANSI-aware (escape sequences survive, visible cells
 * are cut) and appends a single Unicode ellipsis when truncating.
 */
export function renderRows(line: ComposedLine, width: number): readonly string[] {
  if (line.spans.length === 0) {
    return [];
  }
  const text = renderLine(line);
  if (!hasVisibleContent(text)) {
    return [];
  }
  return [truncateToWidth(text, width)];
}

/** Stateful row cache implementing the memoization contract for one widget. */
export class RowCache {
  #revision = -1;
  #width = -1;
  #rows: readonly string[] = [];

  get(line: ComposedLine, width: number): readonly string[] {
    if (line.revision !== this.#revision || width !== this.#width) {
      this.#rows = renderRows(line, width);
      this.#revision = line.revision;
      this.#width = width;
    }
    return this.#rows;
  }
}

/** Shape the Host needs from the mounted widget component. */
export interface StatusBarWidgetComponent {
  render(width: number): readonly string[];
  setLine(line: ComposedLine): void;
}

/**
 * Create the status bar widget component. The Host captures the component
 * from the factory and pushes composed lines into it; rendering memoizes by
 * revision and width through the row cache.
 */
export function createStatusBarWidget(): StatusBarWidgetComponent {
  const cache = new RowCache();
  let line: ComposedLine = { revision: 0, spans: [] };
  return {
    render(width: number): readonly string[] {
      return cache.get(line, width);
    },
    setLine(next: ComposedLine): void {
      line = next;
    },
  };
}
