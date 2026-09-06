/**
 * Root export: the public contract surface for status bar providers.
 *
 * Third-party extensions import from `@ruokee/omp-status-bar/provider` for
 * registration; this root mirrors the same symbols for convenience.
 */

export {
  PROVIDER_CONTRACT_VERSION,
  registerProvider,
  type ProviderDefinition,
  type ProviderDescription,
  type ProviderFragment,
  type ProviderInstance,
  type ProviderInstanceContext,
  type ProviderOptions,
  type ProviderSpan,
} from "./provider-api.ts";
export { CONFIG_FILE_NAME } from "./config.ts";
