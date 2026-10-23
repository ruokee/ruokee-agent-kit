# omp-smart-cache release history

English | [中文](./omp-smart-cache.zh.md)

These releases belong to the retired `@ruokee/omp-smart-cache` component. Its retained request-alignment capabilities are maintained in `@ruokee/omp-smart-context`, whose first release is `0.1.0`.

## Releases

### 0.1.7

Permit native assistant `completedAt` and `contextSnapshot` bookkeeping to be filled after the ordinary dispatch. Responses Handoff source proof still compares every other field strictly and preserves the complete native input.

### 0.1.6

Report `navigation-unsettled` while an ordinary Responses context is observed during session navigation. Keep reference capture suspended until navigation settles.

### 0.1.5

Support independently enabled Responses Handoff by aligning the system prompt of a confirmed ordinary dispatch. Preserve instructions and leading developer expressions, history order, native none, reasoning, and configuration updates; validate and count Handoff separately from V2. Capture source from the same preparation dispatch rather than an Agent state that may not yet be synchronized.

### 0.1.4

Prevent late ordinary responses and identical retries from reviving invalid Handoff references or operations. Require a native construction baseline for the Handoff methods, preserve foreign wrappers, and project and count Handoff requests only at final transport. Freeze native tool schemas through the host's wire-schema conversion.

### 0.1.3

Treat the native hidden Eval state context as a prepared projection rather than a journal-history dependency. Full-source reuse remains available after that projection is rebuilt, in both modes. User-authored messages, other custom messages, and sessions with unconfirmed construction keep their source dependencies.

### 0.1.2

Restore remote references when automatic compaction advances the epoch inside an ordinary tool run. Fresh ordinary dispatches prove their own credential binding without replacing an older compaction operation's immutable reference or reviving that operation.
