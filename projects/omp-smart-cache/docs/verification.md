# Verification

[中文](./verification.zh.md)

## Host interfaces

Imports use entries the compiled host exposes. Source encoding stays with `buildResponsesInput`, whose model-adapted, hoisted output reaches `buildOpenAiNativeHistory` without raw messages, so native V2 replay normalization applies. Opaque correspondence runs the same native encoder over a single compaction record, requires a unique match, and restores the original record before normalization. Local image eligibility reads the native `images.urls.enabled` handle against the current session's settings, including child overrides; a missing handle reports unavailability.

The relevant host source paths, inside the `@oh-my-pi/pi-agent-core`, `pi-ai`, and `pi-coding-agent` packages, are `src/sdk.ts`, `src/registry/agent-registry.ts`, `src/session/session-maintenance.ts`, `src/session/date-cwd-reminder.ts`, `src/session/messages.ts`, `src/compaction/compaction.ts`, and `src/providers/openai-shared.ts`.

Handoff alignment uses no interface that marks a request as a handoff request. It reads the session's ordinary dispatch through `agent.streamFn`, and it reconstructs one operation from the session's `convertMessagesToLlm` and `prepareSimpleStreamOptions` seams, which receive the same `AbortSignal`; `session.isGeneratingHandoff` marks the window in which an operation may bind, and `session.handoff` is the host entry point that generates the document. The host sends that work outside `agent.streamFn`, which is why the reference observed at that seam belongs to the ordinary dispatch. The corresponding sources are `src/session/session-handoff.ts` and `src/session/agent-session.ts`.

## What was checked

Real native CLI runs on OMP `18.5.0` and on a maintained host above it cover complete-range reuse, tool-output trimming with local reuse, main/task/Eval attribution, parallel child isolation, child revive and cancellation, and switch/branch/tree recovery. The same runs cover the host imports, opaque identity, required local reuse, and false/true image-setting overrides in native task and Eval children.

Controlled synthetic HTTP exercises the native serializer, scheduler, and maintenance. Synthetic usage exercises the mechanism only; real Provider behavior and runtime verification come from the native CLI runs. A context or provider-request handler without an independent-unit contract prevents local proof, while complete-range reuse stays available. Cache savings come from the separately authorized real Provider runs.

## Tool continuation

The component regression follows the native order: before-model hook, context preparation, credential resolution, stream, payload hook, and final fetch. It covers two ordinary dispatches sharing a run signal, a compaction operation retaining its first reference across newer work, history invalidation followed by ordinary continuation on the same signal, and a new compaction operation using the restored reference. An old operation still sends its native body after the epoch changes, and cancellation prevents a new ordinary reference. The fixture uses the locked `18.5.0` host libraries and controlled HTTP responses; it does not measure Provider cache benefit.

In both remote modes, the runtime regression covers a native display-only Eval projection after opaque history, reuse of the confirmed ordinary prefix, and preservation of a new native tail. Identical text in a user message, user-attributed custom content, another custom type, or an unobserved construction remains a dependency; deleting it keeps the compaction body native.

## Native remote continuation

Native OMP `18.8.3` validation of `0.1.3` in `hooks` mode covers five automatic remote V2 compactions across two independent sessions. Each native `tokensBefore` and actual Provider input exceeds `131072`; all five requests receive cached input, are adopted, and continue ordinary work. One session's second compaction captures the exact hidden, agent-attributed Eval metadata, retains the complete canonical source, and sends the confirmed ordinary prepared prefix with the new native tail. All comparisons include opaque bytes without decoding them. The other session's three compaction references contain no Eval custom message; later ordinary references do contain it. That session validates ordinary continuation separately, not an independent repeat of the exact Eval compaction condition. A zero-cache ordinary continuation is retained in the results rather than counted as a compression cache hit. These runs do not extend the existing Handoff API boundary or provide native `standard`-mode coverage.

## Handoff alignment

Real native CLI runs on OMP `18.8.3` with a chat-completions model compare the outgoing request bodies of an aligned run and a control run with the switch off, over the same prompts, the same session shape, and the same model. The control run's handoff request carried two system segments instead of the three the ordinary request sent, dropped its reasoning effort, and added a tool choice. The aligned run sent the same three system segments with identical digests, kept the reasoning effort, and dropped the added tool choice, and its message history was the ordinary history followed by the appended instruction. Two handoffs in one session each aligned against the latest ordinary request instead of the previous handoff request, and the copied prefix never carried an agent attribution.

The same runs cover the host's own automatic compaction path, a handoff whose reference was established in an earlier process, a thinking-level change after the reference was captured, an injected system segment, an injected field outside the restored axes, the switch off, a change of the active tool set after the reference was captured, a handoff cancelled while its response was in flight, and runs that load an installed released copy or the trial extension in the same process as this candidate. The checker compares structural summaries of every recorded request and asserts the activation states, the alignment axes, the counters, the coexistence outcome, and that `/smart-cache` starts no model request. Those runs take the effective package settings from this machine's plugin configuration, where the other capability is switched on with a Provider this candidate's model does not match, so the other capability's state machine is observed while its own rewrite never runs; a separate run switches it off explicitly and observes this capability's section staying switched off beside the other capability's own reason. Message bodies are not retained in the records; the comparison uses per-field digests, system and history digests, tool-schema digests, and fixed scalars.

Command output is checked through the same formatter the command calls: this host does not echo command notifications in print mode, so the bare command run is evidenced by a successful exit and zero recorded model requests, and the report text is rendered from the command's own formatter with the live session snapshot.

A component-level run drives the registration seams directly and covers a dispatch that carries no tool set and therefore never becomes a reference, a switched-off capability that reports no dispatch bookkeeping, and a side request that repeats the confirmed online view.

Not covered by these runs: a model whose serializer writes the system prompt fragments with the `developer` role rather than `system`, speculative compaction, an incomplete handoff response and the retry the host runs after it, switching the model between the reference and the handoff, multimodal input, subagent sessions, a session whose model API lets the other capability rewrite, and real Provider cache benefit. Two runs load two copies of this package in one process, one beside a released copy and one beside the trial extension, and the boundary rules above rest on a source reading of the host's handoff path rather than on a host change that exercises them.

The `0.1.4` component regression rejects late successful responses after epoch, signal, tools, system, thinking, or Provider identity changes. It counts no send at the payload callback, counts actual repeated transport delegations, and permanently rejects an old operation after its owner changes, including when the original values return. Registration and release preserve an unknown session-method wrapper.

Controlled native CLI runs on OMP `18.5.0` and `18.8.3` exercise the final Chat Completions path with all seven normal plugins and native callable tool schemas. Two consecutive Handoffs use their latest ordinary references and commit native documents. A native transport retry after HTTP 503 records one operation, two sends, and one retry. A tool-set change in a later provider hook leaves the Handoff body native; an in-flight cancellation commits no document and ordinary work continues. Interference with pre-registration native publication and a post-registration method wrapper each report unavailability, preserve the foreign wrapper, and retain native document adoption and continuation. A later provider option survives the final rewrite. These runs use controlled local HTTP and do not measure Provider cache benefit.

Interactive TUI runs on both hosts display the actual `/smart-cache` notification, including separate remote and Handoff sections. A subsequent local observation records zero HTTP requests, so reading status starts no model turn. The command reports states and counters without payloads or private values.

## Replacement

Replace this adaptation when a maintained native interface preserves equivalent configuration, isolation, reuse safety, and failure behavior across the required paths, after behavioral verification.
