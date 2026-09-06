/**
 * Dedicated provider registration entry point.
 *
 * Third-party OMP extensions import this path:
 *
 *   import { registerProvider } from "@ruokee/omp-status-bar/provider";
 *
 * This module is the entire public surface for provider authors: provider
 * identity, option validation, instance creation and lifecycle, fragment
 * publication, and managed scheduling. Keep it import-light and free of
 * Host internals.
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
