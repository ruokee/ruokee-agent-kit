import { expect, test } from "bun:test";
import { parseSettings } from "../src/settings.ts";

test("invalid explicit configuration never silently enables a repair or echoes private values", () => {
  for (const input of [null, [], 0, false, "private-root"])
    expect(parseSettings(input)).toEqual({ ok: false, reason: "settings-root-invalid" });
  const cases = [
    [{ compactionCacheEnabled: null }, "compactionCacheEnabled=type"],
    [{ compactionCacheEnabled: "true" }, "compactionCacheEnabled=type"],
    [{ compactionCacheProvider: null }, "compactionCacheProvider=type"],
    [{ compactionCacheProvider: [] }, "compactionCacheProvider=type"],
    [{ compactionCacheMode: null }, "compactionCacheMode=enum"],
    [{ compactionCacheMode: "private-invalid-mode" }, "compactionCacheMode=enum"],
    [{ "private-dynamic-key": "private-value" }, "settings-unknown-key"],
  ] as const;
  for (const [input, reason] of cases) expect(parseSettings(input)).toEqual({ ok: false, reason });
});

test("provider selection and mode cannot override an explicit disabled switch", () => {
  for (const mode of ["standard", "hooks"] as const)
    expect(
      parseSettings({
        compactionCacheEnabled: false,
        compactionCacheProvider: "synthetic-provider",
        compactionCacheMode: mode,
      }),
    ).toEqual({ ok: true, settings: { enabled: false, provider: "synthetic-provider", mode } });
});
