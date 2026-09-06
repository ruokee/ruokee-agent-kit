/**
 * Agent directory resolution. The status bar configuration lives under the
 * OMP agent directory. OMP owns the resolution (profiles, env overrides),
 * so this module only re-exports the public `getAgentDir()` from
 * `@oh-my-pi/pi-coding-agent` for one shared implementation.
 */

export { getAgentDir } from "@oh-my-pi/pi-coding-agent";
