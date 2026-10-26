# QoL native-history replay

## Goals

Use stored provider-native history on the first eligible request after session resume. This adjustment follows the component-wide configuration, activation, status, and isolation requirements.

## Public surface

### Configuration

| Key | Default |
| --- | --- |
| `replayEnabled` | `true` |

### Status

The `/qol` replay line shows actual process-wide state and rewrite count.

### Native-history replay

When enabled, the first `openai-responses` request after resuming a session uses the stored provider-native history, including replayable thinking signatures, as the host would in a warmed session. Do not rebuild, filter, or sanitize that history. Do not alter session files. A session without stored native items has nothing to replay. Other protocols, including `openai-codex-responses`, Anthropic, and completions, remain unchanged.

The effect applies process-wide. Another enabled activation shares it and its rewrite count rather than creating a second adjustment. It may remain active after its original activation ends. An off switch releases a recognizable owned adjustment; rejected settings stop it with `runtime-conflict` without enabling defaults. Unknown ownership reports `registry-unrecognized`, foreign replacement reports `patch-overwritten`, and inability to activate reports `install-failed`. A refusal leaves unrelated state untouched, and release never overwrites a foreign replacement. `/qol` reflects the live process state, not a stale activation result.

Replay assumes the endpoint accepts the stored native items. Rejection can fail the first request where native rebuilding might have succeeded. The amount of reusable prompt context varies; there is no cache-hit or cost-saving guarantee. This adjustment neither changes other provider protocols nor promises coverage of host histories rebuilt outside the recognized provider-state creation path.

## Acceptance criteria

- After resume, the first eligible `openai-responses` request retains stored native history, including replayable thinking signatures, without rebuilding or altering session files. Other protocols remain unchanged.
- Enabled activations share the process-wide effect and rewrite count. Release affects only recognizable owned state, preserves foreign replacements, and leaves `/qol` reporting the live state and count.
