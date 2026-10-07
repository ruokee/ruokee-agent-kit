# ADR proposal: Move model prompt rules to QoL

Draft owner: Ruokee
Draft writer: OMP

English | [中文](./2026-10-07-move-model-prompts-to-qol.zh.md)

## Motivation

Move model-scoped prompt rules from `@ruokee/omp-system-prompt` to an independently switchable QoL module and mark system-prompt as approaching deprecation.

Users who need only model rules currently have to install the system-prompt component, although rule appending does not depend on its template strategy. QoL already provides native plugin settings, independent module switches, failure isolation, and status reporting.

The maintainer reports that recent OMP updates substantially reduced the built-in prompt and added template support, reducing the need for a separate system-prompt extension. This motivates its approaching-deprecation status, not a claim that native templates replace model matching and per-turn rule refresh. No specific upstream release is assigned to that observation.

## Proposal

### Decisions to reverse

The following effective clauses cannot coexist with this choice:

| Current decision | Effective clause | Proposed choice and conflict |
| --- | --- | --- |
| [Add model-scoped prompt rules to the system prompt extension](../decision/2026-09-14-add-model-prompt-rules.md) | system-prompt owns rules; files activate them without an enable setting; two handlers inside that extension apply the template before rules; unknown frontmatter keys invalidate a file | QoL alone owns rules behind a default-off switch; composition crosses the component boundary; extra top-level metadata is ignored. Ownership, activation, handler placement, and top-level validation cannot retain both meanings. |
| [Render the system prompt strategy only from the component template](../decision/2026-10-04-use-system-prompt-template-only.md) | The template-route responsibilities include a second handler that appends model rules | system-prompt retains only its template responsibilities. Rule appending belongs to QoL and is no longer a system-prompt handler. |
| [Maintain OMP quality-of-life adjustments on the standalone wait entry](../decision/2026-10-04-use-standalone-qol-wait.md) | QoL is limited to its existing behavior adjustments | Model rules become an additional QoL adjustment. The scope expands only to that capability, not to external tool guards or unrelated host behavior. |

The reversal changes only these conflicting choices. The remaining contracts, including effective `Changes` entries and their evidence limits, remain binding. Complete successor decisions must retain them within their respective scopes; historical host observations do not establish that the migrated capability has been verified.

### Ownership, settings, and migration

QoL provides model rules without system-prompt or a selected template. Its native boolean setting `modelPromptsEnabled` defaults to `false` and remains subordinate to the existing master `enabled` switch. Either switch being off prevents rule discovery, reads, appending, and diagnostics about unused rule files.

Use the existing OMP plugin-settings authority, global values with project overrides, and once-per-activation snapshot. A configuration change needs an OMP restart; switching sessions within the same process does not refresh it. An invalid module boolean disables only model rules. An unknown settings key, a non-object root, or a failed settings getter retains the existing component-wide rejection. Setting diagnostics name the key and rule without echoing the value.

`/qol` reports the effective switch, module state, and inactive reason without starting a model turn or exposing rule bodies. A registered rule module need not match the current model or make every file valid; a file failure does not permanently disable it.

Remove system-prompt's rule discovery and append capability, with no forwarding entry, alias, or compatibility shim. Rule documents stay in their existing locations and need no rewrite. Installation, coordinated component updates, settings changes, and actual extension load order remain user-owned; neither component edits user configuration, templates, rules, installed host files, or installation state.

When both updated components are enabled, the actual extension load order must put system-prompt before QoL, retaining template processing before rule appending and independent failure boundaries. Migration guidance must state that requirement rather than treating installation-command order as a guarantee. Neither component reorders extensions or claims precedence over later handlers. Enable QoL rules only after updating any co-installed system-prompt so its former rule handler cannot append them again.

### Rule contract retained in QoL

Retain the discovery, matching, composition, refresh, and failure contracts from the current model-rule decision and [projects/omp-system-prompt/README.md](../../../projects/omp-system-prompt/README.md#model-prompt-rules), except for the ownership, switch, handler placement, and top-level-key changes above. QoL's own bilingual documentation must carry the resulting complete public contract without depending on the system-prompt component.

- Read `model-prompts` under the active profile's host-resolved user agent directory and the current turn's host-resolved project agent directory. Do not search ancestors or resource roots. Read only direct, non-hidden regular files ending in lowercase `.md`, with no recursion or file-symlink following. A missing directory is empty.
- Sort each directory by JavaScript filename string order, independent of read completion. Append user bodies before project bodies. Same-name files do not shadow each other; identical bodies from different sources still contribute separately, with no filename or content deduplication.
- Read UTF-8 Markdown with an optional leading BOM and exact `---` delimiter lines, accepting LF and CRLF. `match` remains a required non-empty array of single-key objects with non-blank string values. `exact` equals `provider/id`, `model` equals the complete bare id including any `/`, `contains` is a literal `provider/id` substring, and `regex` is a JavaScript regular expression without flags. Matching is case-sensitive and textual; entries are alternatives and apply a file only once. Do not add alias, role, family, display-name, wire-name, thinking-suffix, wildcard, or model-list resolution.
- Ignore extra top-level frontmatter keys and never inject them. Unknown keys or multiple keys inside a match entry still invalidate the whole file. Invalid YAML, missing or malformed delimiters, invalid `match`, invalid entries or values, an uncompilable regex, or a blank body skip that file at its first failure without partial application.
- Each matching file contributes one system-prompt block containing exactly the body after the closing delimiter and its line ending. Exclude frontmatter and BOM; preserve headings, blank lines, LF, CRLF, indentation, comments, template-like text, and trailing newlines. Do not wrap, trim, or re-render it. Preserve the content and order of the current turn's incoming blocks without mutating the array or writing rules as messages or history.
- Re-read and match against the effective current model on every covered turn. Additions, edits, deletions, and repairs apply next turn without restart. Do not restore an unreadable or invalid file from an earlier body. No model, no rules, or no match leaves the incoming prompt unchanged without a no-match error. Retain the host's base-prompt and rebuild boundary so turns do not accumulate rule blocks and a within-turn rebuild does not duplicate them; do not mask that contract with content deduplication.
- A file failure affects only that file; a directory failure affects only that directory. An unexpected handler error leaves its incoming prompt in effect. Rule failures neither disable other QoL modules nor undo another component's completed prompt processing. Diagnostics use fixed reasons and locatable scope-relative sources, deduplicated by session, source, and reason, with interactive host notifications or otherwise the host logger. Do not expose rule bodies, absolute paths, raw errors, regex sources, or conversation content.

Rules remain Agent-turn instructions on ordinary main-session and ordinary child turns that run the public `before_agent_start` hook. Each child uses its own effective model and retains its role, independent blocks, and host protocol. Do not add routes for plan-mode children, Handoff, title generation, classification, or other requests that bypass the hook. Ephemeral side requests retain the host's treatment of the live Agent prompt. Temporary model switches, fallback, and individual Provider requests gain no independent refresh promise.

Retain the existing trust and execution boundaries: project rules can become system instructions, JavaScript regexes have no sandbox or execution timeout, and bodies gain no size or quota restriction. Add no trust gate, rule cache, or configuration hot refresh. When OMP provides equivalent model instructions, re-check matching dimensions, prompt composition and block order, refresh timing, and discovery conventions before deciding whether the local capability stays, narrows, or is removed.

### system-prompt approaching deprecation

Mark system-prompt as approaching deprecation in its component description and repository entry, and explain that model rules belong to QoL. Do not describe it as removed or unavailable. Keep its template, Delivery, footer handling, and current maintenance. Set no removal date, stop-maintenance policy, automatic uninstall, or deletion of user files.

The [template-only decision](../decision/2026-10-04-use-system-prompt-template-only.md) remains binding outside its model-rule handler: optional host template selection and native precedence; owned static-skeleton recognition; silent no-op for unrecognized input; byte-preserved template and opaque data; per-turn `renderDelivery`, its default and fail-open behavior, and foreign-block conflict handling; independently bounded failures; and idempotence, including Delivery changes on an already converted footer. Host template-read failures remain host-owned.

Footer correction retains known main-agent and subagent tails, ambiguous-boundary refusal, and the existing conditional neutral ownership comment. That comment and its necessary separator remain the sole byte-preservation exception, only when the valid footer lacks loading guidance, conversion removes an exactly known critical tail, and the append begins with a complete known critical block. Preserve its validated structural position outside opaque data, the `<project-context>` block start and array position, and the static-prefix cache boundary. Use no process-local ownership cache or new setting. Textual recognition is not provenance or a security boundary.

### Unchanged QoL and host contracts

All existing QoL modules retain their behavior, setting keys, defaults, ranges, state reporting, activation snapshots, failure isolation, and host responsibilities. This includes wait and recovery boundaries, process-wide patch ownership and release rules, native replay, cache request identity and proof requirements, and the effective `standard`/`hooks` cache-mode contract in the [QoL decision's Changes](../decision/2026-10-04-use-standalone-qol-wait.md#changes). Adding model rules does not relax existing ownership or native-interface replacement obligations.

Both components remain self-contained, use the unmodified host and public extension interfaces, and retain the shared OMP maintenance floor of `18.5.0` under [Maintain host components against a shared OMP floor](../decision/2026-10-04-raise-omp-host-floor.md). Unrestricted host peers remain metadata, not runtime gates. Add no maintenance upper bound or old-host compatibility paths. Source analysis, automated checks, and real-host observations remain distinct; unrun scenarios stay unverified.

## Alternatives considered

None

## Acceptance criteria

- QoL alone can append matching bodies to the Provider-facing system prompt on covered main and ordinary child turns after explicit enablement, without a component template. The default-off state and either disabled switch cause no rule reads, appends, or unused-file diagnostics. `/qol` accurately reports state without a model run or rule disclosure.
- Existing files keep their discovery, ordering, matching, byte-exact body, per-turn refresh, no-accumulation, and localized-failure behavior. Extra top-level metadata is ignored; unknown match-entry keys still reject the file. Configuration restart semantics, module-local invalid booleans, and component-wide settings rejection remain distinct.
- The updated system-prompt has no rule loader or forwarding route. With the documented actual load order, both updated components retain template, Delivery, footer, and independent failure behavior while only QoL appends rules. Later handlers retain their host-defined authority.
- Both self-contained components and repository documentation describe the same ownership, settings, coverage, migration, and trust boundaries in English and Chinese. The affected project specifications preserve unrelated requirements, and complete successor ADRs preserve effective non-conflicting clauses and evidence limits.
- Public descriptions mark system-prompt as approaching deprecation and direct model-rule users to QoL while retaining its remaining capabilities and maintenance, with no deletion date or automatic user-file or installation change. Existing QoL contracts and the shared host floor remain unchanged.
- Real-host observations identify the version and exercised conditions and distinguish Provider-facing evidence from handler results or status output. Historical evidence and unrun paths are not presented as migrated-feature verification.

## Risks

- A new QoL rule module combined with an old system-prompt installation can append the same files twice. Default-off activation and coordinated-update guidance reduce this risk but do not make mixed versions compatible.
- An incorrect actual load order can let system-prompt recognize or modify template-like rule bodies instead of appending them after its work. Documented ordering is a requirement, not automatic protection or a guarantee against later extensions.
- Default-off migration stops rule injection for users who update system-prompt without explicitly enabling the QoL capability and restarting OMP. Keeping file paths and documenting the switch avoids file migration, but does not preserve the previous file-presence activation.
