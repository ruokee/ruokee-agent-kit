import { expect, test } from "bun:test";
import { parseSettings } from "../src/settings.ts";

const handoffDisabled = { ok: true, settings: { enabled: false } } as const;
const remoteDisabled = { ok: true, settings: { enabled: false, provider: "", mode: "hooks" } } as const;

test("invalid explicit configuration never silently enables a repair or echoes private values", () => {
  const root = {
    remote: { ok: false, reason: "settings-root-invalid" },
    handoff: { ok: false, reason: "settings-root-invalid" },
    compactionUsage: { ok: false, reason: "settings-root-invalid" },
    modelPrompts: { ok: false, reason: "settings-root-invalid" },
  } as const;
  for (const input of [null, [], 0, false, "private-root"]) expect(parseSettings(input)).toEqual(root);
  expect(parseSettings({ "private-dynamic-key": "private-value" })).toEqual({
    remote: { ok: false, reason: "settings-unknown-key" },
    handoff: { ok: false, reason: "settings-unknown-key" },
    compactionUsage: { ok: false, reason: "settings-unknown-key" },
    modelPrompts: { ok: false, reason: "settings-unknown-key" },
  });
});

test("a remote field failure leaves the handoff switch usable", () => {
  const cases = [
    [{ compactionCacheEnabled: null }, "compactionCacheEnabled=type"],
    [{ compactionCacheEnabled: "true" }, "compactionCacheEnabled=type"],
    [{ compactionCacheProvider: null }, "compactionCacheProvider=type"],
    [{ compactionCacheProvider: [] }, "compactionCacheProvider=type"],
    [{ compactionCacheMode: null }, "compactionCacheMode=enum"],
    [{ compactionCacheMode: "private-invalid-mode" }, "compactionCacheMode=enum"],
  ] as const;
  for (const [input, reason] of cases) {
    const settings = parseSettings(input);
    expect(settings.remote).toEqual({ ok: false, reason });
    expect(settings.handoff).toEqual(handoffDisabled);
  }
});

test("a handoff switch failure leaves remote alignment settings usable", () => {
  for (const input of [{ handoffCacheEnabled: null }, { handoffCacheEnabled: "true" }, { handoffCacheEnabled: 1 }]) {
    const settings = parseSettings(input);
    expect(settings.handoff).toEqual({ ok: false, reason: "handoffCacheEnabled=type" });
    expect(settings.remote).toEqual(remoteDisabled);
  }
});

test("provider selection and mode cannot override an explicit disabled switch", () => {
  for (const mode of ["standard", "hooks"] as const)
    expect(
      parseSettings({
        compactionCacheEnabled: false,
        compactionCacheProvider: "synthetic-provider",
        compactionCacheMode: mode,
      }).remote,
    ).toEqual({ ok: true, settings: { enabled: false, provider: "synthetic-provider", mode } });
});

test("each capability reports its own switch without enabling the other", () => {
  const settings = parseSettings({ compactionCacheEnabled: true, compactionCacheProvider: "synthetic-provider" });
  expect(settings.remote).toEqual({
    ok: true,
    settings: { enabled: true, provider: "synthetic-provider", mode: "hooks" },
  });
  expect(settings.handoff).toEqual(handoffDisabled);
  expect(parseSettings({ handoffCacheEnabled: true })).toEqual({
    remote: remoteDisabled,
    handoff: { ok: true, settings: { enabled: true } },
    compactionUsage: { ok: true, settings: { enabled: true } },
    modelPrompts: { ok: true, settings: { enabled: false } },
  });
});

test("migrated switches fail locally and retain independent defaults", () => {
  for (const value of [null, "private-value", 1]) {
    const usage = parseSettings({ compactionUsageEnabled: value, modelPromptsEnabled: true });
    expect(usage.compactionUsage).toEqual({ ok: false, reason: "compactionUsageEnabled=type" });
    expect(usage.modelPrompts).toEqual({ ok: true, settings: { enabled: true } });
    expect(usage.remote).toEqual(remoteDisabled);
    const prompts = parseSettings({ modelPromptsEnabled: value });
    expect(prompts.modelPrompts).toEqual({ ok: false, reason: "modelPromptsEnabled=type" });
    expect(prompts.compactionUsage).toEqual({ ok: true, settings: { enabled: true } });
    expect(prompts.handoff).toEqual(handoffDisabled);
  }
});
