# ADR decision: Render the system prompt strategy from a host template

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash
Reverses: [Add an OMP system prompt extension](../archived/2026-09-09-add-omp-system-prompt.md)

English | [中文](./2026-09-30-render-system-prompt-from-host-template.zh.md)

## Motivation

Record two supported instruction-block paths for `@ruokee/omp-system-prompt`: the component's own template rendered by the host, and the existing conversion of the host's default block.

The extension replaces the fixed policy text of OMP's default instruction block with its own maintained text and appends model-scoped rule documents. It recognizes the default block from its rendered structure and rebuilds it from the extension's own template. Host releases in the current upgrade target rewrote that block, so its structure no longer matches: on those releases the maintained strategy, the Delivery setting, and the footer corrections stopped applying while they kept applying on hosts whose block the extension still recognizes.

The host now offers a supported route for the same job. A user selects a Handlebars template through the host's own mechanism, and the host renders the instruction block from it with the same live data and helpers as its bundled template. That route puts the component's own text in the block instead of rebuilding host-authored prose, and the contract has to state what the extension owns on each path.

## Analysis

On the template route the host renders the instruction block from the selected source and produces its own footer block, which still opens with `<project-context>` and carries context files, workspace data, and the append text. The provider cache breakpoint lands on the last block before the first `<project-context>` block, so the marker, the block order, and the split between the static prefix and the working-directory-derived block are part of the host's caching layout rather than presentation.

The template receives the session's live data, including visible skills, rules, always-apply rules, tool inventory, internal URLs, device lists, tool references, and task settings, and it receives no plugin settings. A component preference, such as `renderDelivery`, therefore cannot be expressed inside the template, and nothing in the rendered text proves which author selected it.

The footer is still produced by the host from its own source and reaches the extension as text in the block array, exactly as on the older path.

## Decision

### Two recognized instruction blocks

The extension recognizes two shapes for the instruction block instead of one.

1. The host default block, when the turn input still carries it. This keeps the existing behavior: the recognized block is rebuilt from the owned template, and the existing footer conversion applies.
2. The component's own template render, when the session selected it. The extension identifies it by component-owned template text together with a validated skeleton, not by the mere availability of a template mechanism on the host. The recognition basis is the owned static skeleton: each anchor is edge-trimmed, order-preserving, the first at the block start, and the last at the block end. The rendered bodies of the template's dynamic slots are not checked. A third-party template that reproduces the complete static skeleton and changes only those bodies is therefore claimed as well, and that boundary is accepted rather than pursued with further checks.

Any other shape, including a host default block the extension cannot fully validate and a skeleton that does not reproduce the owned anchors in order and at the block ends, leaves the input unchanged with one bounded reason. The extension never guesses a structure and never reports the strategy as applied.

### Route precedence

When both shapes could describe the turn input, the default-block route answers first whenever it can still rebuild the input and the input does not already carry the owned Delivery chapter as its own block. That keeps the chapter inside the block the older route rebuilds, as before. The template route answers the remaining input: a render that already carries the chapter as its own block, and input no default-block rebuild can reproduce, such as a hybrid whose footer was already converted. A `renderDelivery` change between turns then adds or removes only that chapter on the route that has the input.

### Selecting the component template

The component ships its template as a maintained artifact derived from its owned strategy text. The user selects that file through the host's existing template mechanism, such as a command-line argument for one run or a discoverable template file for a project or agent directory. The component writes no user configuration, no installed host file, and no copy of the host's bundled template, and it does not select the template itself.

A template that fails belongs to the route that read it. A strict template argument that is missing, unreadable, empty, or malformed fails that session at startup, before the extension runs, so the extension has no input to preserve and nothing to report. Discovery follows the host's own precedence, so an empty discovered candidate is skipped and the host keeps looking, reaching its bundled prompt only when no candidate remains. The extension classifies whichever block finally reaches its handler: a component template that survives after a skipped candidate stays legitimately reportable, and a block it cannot verify, including another author's template whose skeleton diverges from the owned one, a lookalike body, a missing identity, or a damaged render skeleton, is never rewritten and is reported as unrecognized rather than adapted.

### What the extension owns on the template path

- **Instruction block.** The template render stays byte-for-byte in its position. Its tool, device, `xd://` URI, skill, rule, and runtime sections already carry the host's live data.
- **Delivery.** The effective `renderDelivery` value is read on every covered turn through the public settings API, as on the older path, and decides whether the owned Delivery chapter is inserted as its own block directly after the recognized template block. Its content, default, fail-open value, and per-turn refresh keep their meaning. A foreign block that occupies that position belongs to another writer: the extension keeps it and reports that its own chapter stayed out.
- **Footer.** The extension corrects the outer loading guidance and removes the fixed outer critical tail, while `<project-context>`, context bodies, listed paths, workstation data, workspace data, active-repository text, and the append text stay byte-for-byte. A boundary it cannot determine uniquely leaves the whole footer unchanged and reports that the correction did not apply. An absent footer needs no work and reports nothing.
- **Model rules.** The second handler appends matching rule documents to the array the turn already has, with the same matching, ordering, and byte-exact bodies. A failed replacement still lets the append step extend the incoming array.
- **Skill text.** The template binds the host's visible skill data. The extension does not re-derive descriptions from command metadata on this path, does not restore a description the host shortened, and never adds a skill to the visible set. Description single-lining stays on the older path.

Each of these reports its own bounded result. One step failing does not suppress another, and no step's success stands for the others.

### Repeated turns and settings changes

The template path is idempotent. A turn whose input already carries the template block, the owned Delivery chapter in its expected position, and the corrected footer is recognized, and the extension returns no replacement when nothing would change. A change of `renderDelivery` between turns adds or removes only that chapter on either route, including a prompt whose footer was already converted. The older path keeps its atomic contract, and a turn that matches neither path keeps its input unchanged with the bounded replacement diagnostic.

### Compatibility boundary

The compatibility object is the extension, not the host. The default host peer dependency stays unrestricted, and the extension still reads no host version to decide eligibility, activation, transformation, diagnostics, or fallback. Structural recognition of the turn input remains the compatibility boundary. The component does not require the host to keep its older default block, does not carry the template route back to hosts that lack it, does not vendor host-authored prompt text, and raises no maintenance bound. The component's documented maintenance declaration stays as recorded in [Adapt first-party host components to host upgrades](./2026-09-28-adapt-components-to-host-upgrades.md), and the component documents the fixture its automated checks render and the release each observation came from.

### Rules preserved from the archived decision

The archived decision's still-effective rules keep their meaning under this decision:

- Distribute one self-contained extension that uses the unmodified host distribution and public APIs only, never patch installed files, and never write prompt files for the user.
- Process the current turn's `event.systemPrompt` on every covered turn, never a startup snapshot.
- Recognize exactly one supported input structure per path without assuming fixed array indexes, treat embedded bodies as opaque data, and return no replacement when the validated output would not change.
- Read `omp.settings.renderDelivery` through the public settings API each turn; only an exact boolean `false` omits the chapter; a read failure or non-boolean value keeps it enabled with one bounded diagnostic.
- Use the event catalog as the authority for visible skills and command metadata only as ordered candidates for description boundaries; keep the catalog byte-for-byte when correspondence is unavailable, and treat an unreliable outer boundary as a structural failure.
- Fail open with bounded diagnostics that carry no prompt bodies, skill names, private paths, or session context, deduplicated within the session, including the `unexpected-error` boundary and the activation-time template failure.
- Keep the recorded coverage and evidence boundaries, and require provider-facing evidence rather than a handler return value alone.

## Alternatives considered

**Extend the existing converter to recognize the upgrade target's default block.** Considered while choosing how to keep the strategy on a new host. It keeps one path and needs no user configuration, but the component would keep maintaining a parser of host-authored prose, and every host rewording of that block would repeat the same failure.

**Use the plain-text custom prompt route instead of a template.** Considered while comparing supported routes. Plain text is simpler to install, but that route renders the session data from the host's plain-custom template rather than from the component's own text, so the maintained tool, device, internal-URL, and runtime sections could not be kept.

**Put the Delivery chapter inside the template.** Considered while deciding where that chapter lives. It needs no per-turn insertion, but the template cannot read plugin settings, so the documented switch and its per-turn change would be lost.

## Consequences

Two supported paths mean two recognition and step implementations of one behavior. A change applied to the older conversion but not to the template, or the reverse, gives the two paths different strategy text or different footer text with no error, so a change to the owned strategy, the footer correction, or the Delivery chapter needs matching checks for both paths.

The template path publishes the component's text as a file the host reads directly. A user who edits the static skeleton of that artifact, or who points the host at a different template that does not reproduce it, gets a render the extension does not claim, and the turn keeps the host prompt with the bounded unrecognized reason instead of silently applying part of the strategy. An edit confined to a dynamic slot body is claimed, because slot bodies lie outside the recognition basis. Because the template binds host-side sections, a host reword or field change in those sections needs a matching update to the component's template; until then the render carries the older section text rather than failing.

Accepting the host's previewed and summarized skill descriptions on this path means an activation constraint the extension previously preserved can disappear from the prompt with no diagnostic, because the host-side shortening is there expected behavior.

Text recognition remains no provenance or security boundary. Real-host verification establishes only the observed behavior, and the component documentation must keep identifying the exercised fixture and each observation's scope rather than promising exact host compatibility.

## Changes

### 2026-10-03: Conditional footer ownership

The template footer contract recognizes the exactly known main-agent and subagent critical tails at the validated outer boundary. Unknown tails and ambiguous outer structure retain their existing preservation and diagnostic behavior. The strict older `PROJECT` path is unchanged.

A footer without loading guidance needs a conversion-state signal when its append begins with a complete known critical block. After native-tail removal, that append occupies the same textual position as an unprocessed tail. With Delivery disabled, the complete block array can be identical in both cases, yet one identity requires preservation and the other deletion. Text alone cannot distinguish them. Footers with loading guidance already acquire an owned loading line during conversion.

Insert a neutral, non-instructional ownership comment only when all three conditions hold: the valid footer has no loading guidance, this conversion removes an exactly recognized native critical tail, and the append starts with a complete recognized native critical block. Place it inside the outer `<project-context>` block, outside workstation data, context bodies, listed paths, workspace data, active-repository text, and append bytes. The comment and its necessary separator are the sole exception to byte-identical prior complete output. Ordinary appends and footers with loading guidance gain no marker; no opaque data or strategy instruction may be rewritten under this exception.

Recognize converted footers through owned loading guidance or the comment at its validated structural position, never through marker text inside opaque data. Reprocessing preserves the complete block array and returns no replacement when settings are unchanged. Delivery changes alter only that chapter. Keep the `<project-context>` block start, array position, and static-prefix cache boundary; use no process-local ownership cache or new setting. This remains textual recognition, not provenance or a security boundary. The default-block path, bounded failures, strategy, template artifact, model rules, maintenance floor, and structure-based eligibility retain their contracts, without a host-version gate or installed-host changes.

Marking every footer without loading guidance was considered but changes ordinary old output unnecessarily. Carrying source or processing state outside the prompt was also considered; it preserves prompt bytes but needs a separate interface and lifecycle design. The conditional comment keeps state in the validated footer while limiting its provider-visible cost to the ambiguous case. Consumers requiring complete byte identity can still reject that affected output. Recognizing a marker outside its validated position could leave native policy in place, so opaque text must not participate in ownership recognition.

[projects/omp-system-prompt/README.md](../../../projects/omp-system-prompt/README.md#host-template-route) owns the concrete footer contract and separates API regressions from real-host Provider observations. Those observations must cover required-marker and no-marker cases, including an ordinary subagent, without claiming general host certification.
