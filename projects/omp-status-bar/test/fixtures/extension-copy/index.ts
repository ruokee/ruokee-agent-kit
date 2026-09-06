/**
 * Fixture extension for the duplicate-copy registration tests: a minimal
 * third-party provider registering through its own (second) copy of the
 * package. The registry must dedupe by id across module identities.
 */
import { registerProvider } from "../../../src/provider-api.ts";

/**
 * Register the fixture provider through this module's copy of the
 * package. Exposed as a function so tests can re-run registration after
 * dropping the process-wide registry.
 */
export function registerFixtureProvider(): void {
  registerProvider({
    contractVersion: 1,
    id: "fixture.ext",
    describe: () => ({}),
    create: (context) => ({
      start: () => context.publish({ spans: [{ text: "ext" }] }),
      stop: () => {},
    }),
  });
}
