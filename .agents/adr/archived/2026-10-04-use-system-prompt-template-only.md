# ADR decision: Render the system prompt strategy only from the component template

Decision owner: Ruokee
Decision writer: OMP Claude Opus 5.5
Reverses: [Render the system prompt strategy from a host template](../archived/2026-09-30-render-system-prompt-from-host-template.md)
Archived: 2026-10-07
Reversed by: [Retain the approaching-deprecation extension's template functionality](../decision/2026-10-07-retain-system-prompt-template.md)

English | [中文](./2026-10-04-use-system-prompt-template-only.zh.md)

## Motivation

Have `@ruokee/omp-system-prompt` apply its strategy only to a host render of the component's own template, which the user selects as an optional step, and leave every other system prompt to the host without a diagnostic.

The extension replaces the policy text of OMP's instruction block with its own maintained text and appends model-scoped rule documents. It used to support two routes: the host rendering the component's template, and a conversion that recognized the host's default block and rebuilt it from the component's template. The conversion recognized only the identity lines OMP used before 18.3.0. On 18.3.0 and later it found no main block, reported a failure on every turn, and left the host prompt unchanged, so users who selected no template got no strategy text and one diagnostic per session.

The OMP-facing components now share the maintenance lower bound OMP 18.5.0 under [Maintain host components against a shared OMP floor](../decision/2026-10-04-raise-omp-host-floor.md), so no maintained host still uses the conversion. The template route covers the job on every maintained host, and a turn without the component's template is a session the component does not serve rather than a failure.

## Analysis

On the template route the host renders the instruction block from the selected source and produces its own footer block, which still opens with `<project-context>` and carries context files, workspace data, and the append text. The provider cache breakpoint lands on the last block before the first `<project-context>` block, so the marker, the block order, and the split between the static prefix and the working-directory-derived block are part of the host's caching layout rather than presentation.

The template receives the session's live data, including visible skills, rules, always-apply rules, tool inventory, internal URLs, device lists, tool references, and task settings, and it receives no plugin settings. A component preference, such as `renderDelivery`, therefore cannot be expressed inside the template, and nothing in the rendered text proves which author selected it.

In 18.5.0, [`discoverSystemPromptOverride`](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/system-prompt.ts) looks at the project level before the user level, and within one level a literal `SYSTEM.md` wins over `SYSTEM_TEMPLATE.md`. An explicit command-line template or prompt overrides discovery. A selected `SYSTEM.md` is wrapped by the host's custom-prompt template, and the `<project-context>` block is still appended.

## Decision

### One recognized instruction block

The extension recognizes one shape for the instruction block: the component's own template render, when the session selected it. The extension identifies it by component-owned template text together with a validated skeleton, not by the mere availability of a template mechanism on the host. The recognition basis is the owned static skeleton: each anchor is edge-trimmed, order-preserving, the first at the block start, and the last at the block end. The rendered bodies of the template's dynamic slots are not checked. A third-party template that reproduces the complete static skeleton and changes only those bodies is therefore claimed as well, and that boundary is accepted rather than pursued with further checks.

When the current turn's main block is not recognized as a render of the component's template, the extension changes no block, including the `<project-context>` footer, and reports no diagnostic. This covers a session with no template, `SYSTEM.md`, `--system-prompt`, another author's template, and a damaged render. The host's default logic applies. The extension never guesses a structure and never reports the strategy as applied.

The extension does not recognize or rewrite the structure of the host's default system prompt. It keeps no default-block route, no precedence between routes, no handling of the older `PROJECT` footer, and no skill-description single-lining, which only the default-block route performed.

### Selecting the component template

The component ships its template as `host-template.hbs`, a maintained artifact generated from its owned strategy text. Selecting it is an optional installation step. The English and Chinese README installation guides describe both ways to enable it: pass `--system-prompt-template <path to host-template.hbs>` for one run, or place the file as a project-level or user-level `SYSTEM_TEMPLATE.md`. The guides state the host's selection order: a command-line argument wins over discovered files, the project level wins over the user level, and within one level `SYSTEM.md` wins over `SYSTEM_TEMPLATE.md`, so an installed template has no effect while a higher-priority `SYSTEM.md` exists.

The component writes no user configuration, no installed host file, and no copy of the host's bundled template. It does not write, copy, or select a template file, and it does not modify or delete any of the user's system prompt inputs.

A template that fails belongs to the route that read it. A strict template argument that is missing, unreadable, empty, or malformed fails that session at startup, before the extension runs, so the extension has no input to preserve and nothing to report. Discovery follows the host's own precedence, so an empty discovered candidate is skipped and the host keeps looking, reaching its bundled prompt only when no candidate remains. The extension classifies whichever block finally reaches its handler: a component template that survives after a skipped candidate is processed, and a block it cannot verify is never rewritten.

### What the extension owns on the template route

- **Instruction block.** The template render stays byte-for-byte in its position. Its tool, device, `xd://` URI, skill, rule, and runtime sections already carry the host's live data.
- **Delivery.** The effective `renderDelivery` value is read on every covered turn through the public settings API and decides whether the owned Delivery chapter is inserted as its own block directly after the recognized template block. Its content, default, fail-open value, and per-turn refresh keep their meaning. A foreign block that occupies that position belongs to another writer: the extension keeps it and reports that its own chapter stayed out.
- **Footer.** The extension corrects the outer loading guidance and removes the fixed outer critical tail, while `<project-context>`, context bodies, listed paths, workstation data, workspace data, active-repository text, and the append text stay byte-for-byte. The footer contract recognizes the exactly known main-agent and subagent critical tails at the validated outer boundary. Unknown tails and a boundary the extension cannot determine uniquely leave the whole footer unchanged and report that the correction did not apply. An absent footer needs no work and reports nothing.
- **Model rules.** The second handler appends matching rule documents to the array the turn already has, with the same matching, ordering, and byte-exact bodies. Appending does not depend on the template, and a turn the replacement step leaves unchanged still lets the append step extend the incoming array.
- **Skill text.** The template binds the host's visible skill data. The extension does not re-derive descriptions from command metadata, does not restore a description the host shortened, and never adds a skill to the visible set.

Each of these reports its own bounded result. One step failing does not suppress another, and no step's success stands for the others.

### Footer ownership marker

A footer without loading guidance needs a conversion-state signal when its append begins with a complete known critical block. After native-tail removal, that append occupies the same textual position as an unprocessed tail. With Delivery disabled, the complete block array can be identical in both cases, yet one identity requires preservation and the other deletion. Text alone cannot distinguish them. Footers with loading guidance already acquire an owned loading line during conversion.

Insert a neutral, non-instructional ownership comment only when all three conditions hold: the valid footer has no loading guidance, this conversion removes an exactly recognized native critical tail, and the append starts with a complete recognized native critical block. Place it inside the outer `<project-context>` block, outside workstation data, context bodies, listed paths, workspace data, active-repository text, and append bytes. The comment and its necessary separator are the sole exception to byte-identical prior complete output. Ordinary appends and footers with loading guidance gain no marker; no opaque data or strategy instruction may be rewritten under this exception.

Recognize converted footers through owned loading guidance or the comment at its validated structural position, never through marker text inside opaque data. Keep the `<project-context>` block start, array position, and static-prefix cache boundary; use no process-local ownership cache or new setting. This remains textual recognition, not provenance or a security boundary.

[projects/omp-system-prompt/README.md](../../../projects/omp-system-prompt/README.md#how-it-works) owns the concrete footer contract and separates API regressions from real-host Provider observations. Those observations must cover required-marker and no-marker cases, including an ordinary subagent, without claiming general host certification.

### Repeated turns and settings changes

The template route is idempotent. A turn whose input already carries the template block, the owned Delivery chapter in its expected position, and the corrected footer is recognized, and the extension returns no replacement when nothing would change, so reprocessing preserves the complete block array when settings are unchanged. A change of `renderDelivery` between turns adds or removes only that chapter, including on a prompt whose footer was already converted.

### Compatibility boundary

The compatibility object is the extension, not the host. The component's maintenance lower bound is the shared OMP bound recorded in [Maintain host components against a shared OMP floor](../decision/2026-10-04-raise-omp-host-floor.md) and stated in its README. The default host peer dependency stays unrestricted, and the extension reads no host version to decide eligibility, activation, transformation, diagnostics, or fallback. Structural recognition of the turn input remains the compatibility boundary. The component does not vendor host-authored prompt text, and it documents the fixture its automated checks render and the release each observation came from.

### Rules preserved from earlier decisions

These rules from the system prompt decisions keep their meaning:

- Distribute one self-contained extension that uses the unmodified host distribution and public APIs only, never patch installed files, and never write prompt files for the user.
- Process the current turn's `event.systemPrompt` on every covered turn, never a startup snapshot.
- Recognize exactly one supported input structure without assuming fixed array indexes, treat embedded bodies as opaque data, and return no replacement when the validated output would not change.
- Read `omp.settings.renderDelivery` through the public settings API each turn; only an exact boolean `false` omits the chapter; a read failure or non-boolean value keeps it enabled with one bounded diagnostic.
- Fail open with bounded diagnostics that carry no prompt bodies, skill names, private paths, or session context, deduplicated within the session, including the `unexpected-error` boundary and the activation-time template failure.
- Keep the recorded coverage and evidence boundaries, and require provider-facing evidence rather than a handler return value alone.

## Alternatives considered

**Extend the existing converter to recognize the upgrade target's default block.** Considered while choosing how to keep the strategy on a new host. It keeps a route that needs no user configuration, but the component would keep maintaining a parser of host-authored prose, and every host rewording of that block would repeat the same failure.

**Use the plain-text custom prompt route instead of a template.** Considered while comparing supported routes. Plain text is simpler to install, but that route renders the session data from the host's plain-custom template rather than from the component's own text, so the maintained tool, device, internal-URL, and runtime sections could not be kept.

**Put the Delivery chapter inside the template.** Considered while deciding where that chapter lives. It needs no per-turn insertion, but the template cannot read plugin settings, so the documented switch and its per-turn change would be lost.

**Ship a default template that applies without user action.** This was the first direction for replacing the default-block route. It would restore the strategy for users who select nothing, but the component would have to write or select a host prompt file, which this decision excludes and which would override a choice the host leaves to the user.

**Keep the diagnostic when no template render is recognized.** This was the behavior before this decision. It tells a user whose template failed to match, but a user of `SYSTEM.md`, `--system-prompt`, or no template gets a failure report for a path the component does not serve.

**Mark every converted footer, or carry conversion state outside the prompt.** Considered while designing the footer ownership marker. Marking every footer without loading guidance changes ordinary output unnecessarily. Carrying source or processing state outside the prompt preserves prompt bytes but needs a separate interface and lifecycle design. The conditional comment keeps state in the validated footer while limiting its provider-visible cost to the ambiguous case.

## Consequences

A template that does not apply is silent. A user whose template is shadowed by a higher-priority `SYSTEM.md`, whose copy of `host-template.hbs` is outdated, or who edited its static skeleton gets the host prompt with no diagnostic and may believe the strategy is in effect. An edit confined to a dynamic slot body is claimed, because slot bodies lie outside the recognition basis.

A user who selects no template gets the host's own strategy text. The component's strategy applies only after the optional installation step.

The template route publishes the component's text as a file the host reads directly. Because the template binds host-side sections, a host reword or field change in those sections needs a matching update to the component's template; until then the render carries the older section text rather than failing.

Accepting the host's previewed and summarized skill descriptions means an activation constraint the older conversion preserved can disappear from the prompt with no diagnostic, because the host-side shortening is expected behavior.

The ownership comment changes provider-visible output in the ambiguous footer case, so a consumer requiring complete byte identity can still reject that output. Recognizing a marker outside its validated position could leave native policy in place, so opaque text must not participate in ownership recognition.

Text recognition remains no provenance or security boundary. Real-host verification establishes only the observed behavior, and the component documentation must keep identifying the exercised fixture and each observation's scope rather than promising exact host compatibility.
