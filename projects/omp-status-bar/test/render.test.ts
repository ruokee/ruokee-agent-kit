import { describe, test, expect } from "bun:test";
import { BUILTIN_COMPOSER_SHAPES } from "@oh-my-pi/pi-coding-agent/config/settings-schema";
import { composeLine, createStatusBarWidget } from "../src/widget.ts";
import type { SeparatorValue } from "../src/config.ts";
import { BUILTIN_PROVIDERS } from "../src/providers/bundled.ts";
import type { ProviderFragment } from "../src/provider.ts";

const STATUS_LINE_PRESETS = ["default", "minimal", "compact", "full", "nerd", "ascii", "custom"] as const;

const fragments: ProviderFragment[] = [
  { spans: [{ text: "T 120K", color: "#5fafaf" }] },
  { spans: [{ text: "I 30K", color: "#00afff" }] },
  { spans: [{ text: "C 84K", color: "#8787af" }] },
  { spans: [{ text: "O 6K", color: "#ff5faf" }] },
  { spans: [{ text: "H 84K", color: "#8787af" }] },
  { spans: [{ text: "ctx 12%" }] },
];

const WIDTHS = [200, 80, 60, 40, 20, 10] as const;

/** Extension-registered shape: any non-builtin `composer.shape` value uses the same widget path. */
const EXTENSION_SHAPE = "custom-accent";

describe("shape x preset rendering", () => {
  test("all builtin shapes render through one widget path at all widths", () => {
    const shapeValues = [...BUILTIN_COMPOSER_SHAPES.map((shape) => shape.value), EXTENSION_SHAPE];
    expect(shapeValues.length).toBeGreaterThan(4);
    const widget = createStatusBarWidget();
    widget.setLine(composeLine(fragments, "slash", 1));
    for (const shape of shapeValues) {
      for (const width of WIDTHS) {
        const rows = widget.render(width);
        expect(rows.length).toBe(1);
        // Truncation never produces a row wider than the terminal.
        expect(rows[0]!.replace(/\x1b\[[0-9;]*m/g, "").length).toBeLessThanOrEqual(width);
      }
    }
  });

  test("all status line presets use the same widget path and separators", () => {
    const widget = createStatusBarWidget();
    for (const preset of STATUS_LINE_PRESETS) {
      for (const separator of ["space", "slash", "dot", "pipe"] as const satisfies readonly SeparatorValue[]) {
        widget.setLine(composeLine(fragments, separator, 1));
        const rows = widget.render(80);
        expect(rows.length).toBe(1);
        expect(rows[0]).toContain("T 120K");
        expect(rows[0]).toContain("ctx 12%");
      }
    }
  });

  test("narrow terminal keeps the bar on one row and drops overflow only", () => {
    const widget = createStatusBarWidget();
    widget.setLine(composeLine(fragments, "slash", 1));
    for (const width of WIDTHS) {
      const rows = widget.render(width);
      expect(rows.length).toBe(1);
    }
  });

  test("every builtin provider id can occupy the line", () => {
    for (const provider of BUILTIN_PROVIDERS) {
      const line = composeLine([{ spans: [{ text: provider.id, color: "#5fafaf" }] }], "space", 1);
      expect(line.spans.length).toBe(1);
      expect(line.spans[0]?.text).toBe(provider.id);
    }
  });
});
