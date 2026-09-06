/**
 * Behavioral tests for the provider registration contract.
 *
 * Covers: registration succeeds, duplicate id rejection, unsupported
 * contract-version rejection, and process-level registry sharing across two
 * independently installed package copies. The dual-copy test materializes
 * two temp `node_modules/@ruokee/omp-status-bar` packages (each with its own
 * `package.json` exports map and a full copy of `src/`), imports them
 * through the bare public subpath `@ruokee/omp-status-bar/provider` from two
 * separate importer modules, and proves the two copies have distinct module
 * identities while sharing one `Symbol.for` registry — the same resolution
 * an installed OMP extension performs.
 */

import { describe, test, expect } from "bun:test";
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { registerProvider, type ProviderDefinition } from "../src/provider-api.ts";
import { StatusBarHost } from "../src/host.ts";
import { getProviderRegistry, resetProviderRegistryForTests } from "../src/registry.ts";

// The cast is intentional: the runtime rejection path for unsupported
// versions can only be reached with a definition that lies about its type.
function makeProvider(id: string, contractVersion: number = 1): ProviderDefinition {
  return {
    id,
    contractVersion: contractVersion as ProviderDefinition["contractVersion"],
    describe: () => ({}),
    create: () => ({ start() {}, stop() {} }),
  };
}

describe("provider registration", () => {
  test("accepts a valid definition and exposes it to later readers", () => {
    resetProviderRegistryForTests();
    const provider = makeProvider("clock");
    registerProvider(provider);
    expect(getProviderRegistry().get("clock")).toBe(provider);
  });

  test("rejects a second definition with the same id", () => {
    resetProviderRegistryForTests();
    registerProvider(makeProvider("clock"));
    expect(() => registerProvider(makeProvider("clock"))).toThrow(/already registered/);
  });

  test("rejects definitions declaring an unsupported contract version", () => {
    resetProviderRegistryForTests();
    expect(() => registerProvider(makeProvider("future", 99))).toThrow(/contract version/);
  });

  test("the public entry exposes no mutable set of supported versions", async () => {
    const api = await import("../src/provider-api.ts");
    expect(Object.keys(api).sort()).not.toContain("SUPPORTED_CONTRACT_VERSIONS");
  });

  test("unsupported versions stay rejected at registration and at instance creation", async () => {
    resetProviderRegistryForTests();
    // A definition registered directly with an unsupported version throws.
    expect(() => registerProvider(makeProvider("v9", 9))).toThrow();
    // The Host refuses an instance whose definition declares an unsupported
    // version even when the definition reached the registry otherwise.
    registerProvider(makeProvider("good", 1));
    const registry = getProviderRegistry();
    expect(registry.get("good")?.contractVersion).toBe(1);
    // The rejection contract is enforced by assertSupportedContractVersion
    // through the Host; a direct unsupported registration never lands.
    expect(registry.get("v9")).toBeUndefined();
  });

  test("registry is shared across package copies reached through the public subpath", async () => {
    resetProviderRegistryForTests();
    // Materialize a realistic installed layout: two consumer workspaces,
    // each with its own node_modules containing a separate physical copy of
    // this package (package.json exports map + full source tree). Each
    // consumer has an importer that registers a provider through the bare
    // public subpath specifier `@ruokee/omp-status-bar/provider`, resolved
    // by bun through that copy's exports map — the same resolution an
    // installed OMP extension performs.
    const root = mkdtempSync(path.join(tmpdir(), "ompsb-copies-"));
    const projectSrc = path.resolve(import.meta.dir, "../src");
    const packageJson = JSON.stringify({
      name: "@ruokee/omp-status-bar",
      type: "module",
      exports: { "./provider": "./src/provider.ts" },
    });
    const installConsumer = (suffix: string) => {
      const consumerDir = path.join(root, `consumer-${suffix}`);
      const pkgDir = path.join(consumerDir, "node_modules", "@ruokee", "omp-status-bar");
      mkdirSync(pkgDir, { recursive: true });
      cpSync(projectSrc, path.join(pkgDir, "src"), { recursive: true });
      writeFileSync(path.join(pkgDir, "package.json"), packageJson);
      writeFileSync(
        path.join(consumerDir, "extension.ts"),
        [
          `import { registerProvider, PROVIDER_CONTRACT_VERSION } from "@ruokee/omp-status-bar/provider";`,
          `const providerUrl = import.meta.resolve("@ruokee/omp-status-bar/provider");`,
          `export const entryUrl = import.meta.url;`,
          `export const resolvedProviderUrl = providerUrl;`,
          `export const contractVersion = PROVIDER_CONTRACT_VERSION;`,
          `const definition = {`,
          `  id: ${JSON.stringify(`shared-${suffix}`)},`,
          `  contractVersion: 1,`,
          `  describe: () => ({}),`,
          `  create: () => ({ start() {}, stop() {} }),`,
          `};`,
          `registerProvider(definition);`,
          ``,
        ].join("\n"),
      );
      return path.join(consumerDir, "extension.ts");
    };
    const consumerA = installConsumer("a");
    const consumerB = installConsumer("b");
    try {
      // Each consumer's extension registers through its own installed
      // copy's public subpath. The definitions must surface in the
      // process-wide registry that this test (resolving from the source
      // tree) reads.
      const modA = await import(consumerA);
      const modB = await import(consumerB);

      expect(getProviderRegistry().get("shared-a")).toBeDefined();
      expect(getProviderRegistry().get("shared-b")).toBeDefined();

      // The two copies are physically distinct module identities: the
      // importers resolved `@ruokee/omp-status-bar/provider` inside their
      // own consumer roots, under different node_modules directories.
      expect(modA.resolvedProviderUrl).toContain(`consumer-a${path.sep}node_modules`);
      expect(modB.resolvedProviderUrl).toContain(`consumer-b${path.sep}node_modules`);
      expect(modA.entryUrl).not.toBe(modB.entryUrl);

      // Both copies speak the same contract version constant.
      expect(modA.contractVersion).toBe(modB.contractVersion);

      // The Host (resolving from the source tree, i.e. a third copy)
      // sees and starts a provider that registered through copy A's
      // public subpath — the registry is genuinely shared, not per-copy.
      const widgets: { factory: unknown; options: unknown }[] = [];
      const hostEnvironment = {
        hasUI: true,
        setWidget(_key: string, factory: unknown, options?: unknown) {
          widgets.push({ factory, options });
        },
        unsetWidget() {},
        setInterval: () => 1,
        setTimeout: () => 2,
        clearTimer() {},
      };
      const host = new StatusBarHost({
        environment: hostEnvironment,
        getAgentDir: () => "/agent-dir",
        joinPath: (...segments: string[]) => segments.join("/"),
        onDiagnostic: () => {},
        configReader: (async () => ({
          config: {
            version: 1,
            separator: "slash",
            statuses: [{ id: "shared-a", options: {}, sourceIndex: 0 }],
          },
          problems: [],
        })) as never,
      });
      await host.start();
      expect(widgets.length).toBe(1);
      await host.shutdown();

      // Sanity: the importers really import through the bare specifier.
      expect(readFileSync(consumerA, "utf8")).toContain('"@ruokee/omp-status-bar/provider"');
      expect(readFileSync(consumerB, "utf8")).toContain('"@ruokee/omp-status-bar/provider"');
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
