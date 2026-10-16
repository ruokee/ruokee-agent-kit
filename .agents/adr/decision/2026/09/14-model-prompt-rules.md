# Model prompt rules

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [Model prompt rules](../../../archived/2026/09/14-r2-model-prompt-rules.md)

English | [中文](./14-model-prompt-rules.zh.md)

## Motivation

Keep the model prompt rules in QoL after the system prompt extension they were compared against leaves the repository.

The archived decision moved the rules out of `@ruokee/omp-system-prompt` into QoL and, in the same act, kept the template, the Delivery chapter, and the footer with that component and required it to run before QoL in actual load order. [Remove the omp-system-prompt extension](./07-omp-system-prompt.md) deletes that component, so a boundary that assigns these behaviors to it and a load-order requirement between two components have no subject. The rules, their matching, their diagnostic channel, and their coverage are unaffected.

## Analysis

A maintainer needs user-authored Markdown rules that give different models different system instructions without editing extension source, host files, or a distribution, and QoL provides that capability independently of any component template or strategy replacement. The public `before_agent_start` event exposes the current turn's system-prompt blocks and effective model and accepts an extended array. Native handlers chain in actual extension load order without a priority setting, and installation-command order does not establish execution order.

## Decision

### Component switches

The self-contained `@ruokee/omp-qol` owns the rules under [Keep components self-contained](../08/24-component-self-containment.md) and [Maintain the extension that improves the OMP experience](./20-omp-qol.md). `modelPromptsEnabled` is a native boolean setting, defaults to `false`, and is subordinate to `enabled`. Both switches must be on for the rule handler, rule directory access, and unused-file diagnostics. Settings are read once at activation; changes require restarting OMP, and navigation or a new session does not refresh the snapshot.

An invalid boolean disables this module only. Unknown settings, a non-object settings root, or a settings read failure reject all modules under the existing QoL contract. `/qol` shows the module's effective state, boolean, and inactive reason without running a model or exposing rule bodies or model identifiers.

The component declares a direct pi-utils peer; host peers stay unrestricted, and its maintenance lower bound is declared in the compatibility section of the component README, which is the authority for that bound. The component is maintained against OMP 18.5.0 under [Maintain host components against a shared OMP floor](./28-host-maintenance.md), which owns the bound for every OMP-facing component.

### Rule application

The append step reads a user rule directory and a project rule directory on every turn the hook runs, matches each rule document's frontmatter against that turn's effective model, and returns a new array containing every incoming block in its original order followed by one block per matching file. A matching rule contributes its body byte-for-byte, and the step neither modifies an incoming block nor wraps, trims, re-renders, or rewrites host content. User-directory bodies precede project-directory bodies, filename order applies inside one directory, and asynchronous reads cannot change the result. The component README's [model prompt rules section](../../../../../projects/omp-qol/README.md#model-prompt-rules) is the current public contract for the matching keys, the document format, the validation reasons, and the ordering rules.

When nothing matches, the step returns nothing and leaves the turn input untouched. The system-prompt channel is the only channel.

### Diagnostics

Invalid rules, unreadable directories, and errors raised outside validation report through the component's existing channel: `ctx.ui.notify` in interactive sessions and the host logger otherwise, deduplicated by the current event's session, source, and reason code, including a return to an earlier session or overlapping sessions. A diagnostic carries a fixed reason code and a source locatable relative to the rule scope. It never carries a rule body, an absolute path, a raw parser error, a regular expression source, or conversation content. A file failure affects one file, a directory failure affects one directory, and an unexpected processing error preserves the incoming blocks, including earlier components' results; a diagnostic failure cannot stop the model turn. Regular expressions run as JavaScript regular expressions with no timeout and no sandbox.

### Host coverage

Each turn uses its effective event model and current cwd; no model means no rule read. Refresh happens per turn, not per provider request, temporary mid-turn switch, or automatic fallback, so additions, edits, deletions, and repairs apply on the next covered turn without a restart and without a body snapshot or cache. Coverage is ordinary main sessions and ordinary child Agents that run the public `before_agent_start` hook, and each child keeps its own model, role, and independent blocks. No new injection route serves plan-mode children, Handoff, titles, classification, or other bypasses, and later handlers retain their authority to change the final input.

Rule documents in a project directory turn repository content into system-prompt text. Project rules can become system instructions, and this component adds no trust gate, security isolation, regular expression sandbox or timeout, or body size limit. Public documentation states the directory and the injection.

### Upstream recheck

The component documents the re-check it needs when the host provides model-scoped instructions itself, through upstream [issue #6739](https://github.com/can1357/oh-my-pi/issues/6739) or an equivalent capability:

- which matching dimensions the host covers, such as exact `provider/model` keys, bare model ids, substrings, and regular expressions;
- how host text composes with a replaced or customized system prompt: replacement or append, and its position in the block order;
- when host text refreshes: per turn, per provider request, on model switch, on temporary switch, and on fallback;
- how the host discovers rules: directories, user and project precedence, and file order.

The outcome decides whether the local capability stays, covers only what the host leaves out, or is removed, with a matching version change.

### Verification

Component checks cover the matching keys with positive and negative cases, alternative semantics within one file, rule validation and BOM handling, body fidelity for LF and CRLF, ordering across both directories regardless of read completion order, missing directories, and the non-accumulation of appended blocks across turns.

Real-host checks record the exercised OMP release, the models, and the observed provider-facing request, and a handler return value is not provider evidence. They confirm that appended text reaches the request, that frontmatter never does, that a model switch re-matches against the new model, that host blocks and dynamic content survive, and that no appended text is duplicated across consecutive turns or after a mid-turn prompt rebuild.

### Decision reversal

| Effective clause in the archived decision | Choice and conflict |
| --- | --- |
| The template, the Delivery chapter, and the footer stay with the system prompt component, which continues to maintain them | That component and its repository content are deleted by [Remove the omp-system-prompt extension](./07-omp-system-prompt.md). A boundary that assigns these behaviors to a component the repository no longer contains cannot stay in force. |
| The two components coexist with the system prompt component before QoL in actual load order, with neither depending on the other's files | One of the two components no longer exists, so the requirement has no subject. Nothing in the prompt pipeline now depends on another extension being installed or ordered first. |

The reversal changes the two clauses in the table and nothing else in the choice. This decision records the complete rules that stay in QoL: component switches, rule matching and injection, diagnostics and failure isolation, coverage, the upstream re-check, and verification. The archived decision explains why the rules moved into QoL and which alternatives were considered at that time, and it carries no current constraint. The reversal of [Add model scoped prompt rules to the system prompt extension](../../../archived/2026/09/14-r1-model-prompt-rules.md) moves with those rules and is carried here, because the component it moved the rules into is the component this decision records.

## Alternatives considered

Reversing the archived decision had these options.

- **Keep the archived decision current and rewrite its two clauses as factual maintenance.** Considered while checking which mechanism fits. Maintenance keeps a current decision accurate when paths, names, or verification entry points move; here the clauses lose their subject, so a rewrite would reverse a decision through the mechanism that is not allowed to reverse one.
- **Withdraw the two clauses by appending a `## Changes` entry to the current decision.** Considered as the lighter mechanism. An update is allowed only when the added content does not conflict with the decision, and an entry that withdraws the binding force of an existing clause conflicts with it, so this route is closed.
- **Move the model prompt rules out of QoL together with the removed component.** Considered while judging whether the rules still have a subject. The removal deletes a component rather than a capability: the rules serve sessions on any host, they never depended on the extension's template to run, and public documentation already describes them as a QoL module.

## Consequences

- The rules no longer depend on another extension being installed, ordered before QoL, or updated in step. The two-component update procedure that produced the module disappears with it.
- Rule files in the project directory turn repository content into system-prompt text. OMP performs no project-trust gating, and project settings and extensions load unconditionally for the current directory, so a cloned repository that ships `.omp/model-prompts/*.md` can add instructions to any session opened inside it. A maintainer keeps their own rules in the user directory.
- Appended text could compound if a host change starts feeding a previous turn's override back as input. The append step relies on the host building each turn's prompt from its base prompt, and a change there would add another copy of every matching body on each turn.
- Rule bodies grow the system prompt of every matching turn. No size limit or budget check exists, so one large rule file adds its full text to all subsequent turns of a session and can crowd out other prompt content.
- Text matching cannot distinguish an intended match from a coincidental one. A `contains` or `regex` rule can apply to more models than its author expected, and an uncompilable regular expression drops that rule with a diagnostic that does not say which models the author meant to cover.
- The append step reads both rule directories on every turn the hook runs, so a slow or remote directory delays prompt assembly for each turn with no cache to amortize it.
