# ADR proposal: Render the OMP system prompt strategy from a host template

Draft owner: Ruokee
Draft writer: OMP DeepSeek V4.1 Flash

English | [中文](./2026-09-29-use-host-template-for-system-prompt.zh.md)

## Motivation

This proposal asks the maintainer to approve a two-path contract for the system prompt extension: the host's template route where the user selects a component-provided template, and the existing conversion where the input is still the host default block.

The `@ruokee/omp-system-prompt` extension replaces the fixed policy text of OMP's default instruction block with its own maintained text, and appends model-scoped rule documents. It identifies the default block from its rendered structure and rebuilds it from the extension's own template. Host releases in the current upgrade target rewrote that block, so the recognized structure no longer matches and the extension leaves the host prompt untouched there. The maintained strategy, the Delivery setting, and the footer corrections therefore stop applying on those hosts while they keep applying on hosts whose block the extension still recognizes.

The host offers a supported route for the same job: a Handlebars template that renders the instruction block with the same live data and registered helpers as the bundled template. The contract states the division of what the extension owns on each path.

## Analysis

On the template route the host renders the instruction block from the selected source and keeps the generated footer block, which still opens with `<project-context>` and carries context files, workspace data, and the append text. The Anthropic cache breakpoint lands on the last block before the first `<project-context>` block, so the marker, the block order, and the split between the static prefix and the working-directory-derived block are part of the host's caching layout rather than presentation ([customization documentation](https://github.com/can1357/oh-my-pi/blob/v18.4.3/docs/system-prompt-customization.md)).

The template receives the session's live data, including the visible skills, rules, always-apply rules, tool inventory, internal URLs, device lists, tool references, and task settings, and it receives no plugin settings. A component preference therefore cannot be expressed inside the template, and nothing in the rendered text proves which author selected it.

The footer is still produced by the host from its own source and reaches the extension as text inside the block array, exactly as it does today.

## Proposal

### Two recognized instruction blocks

The extension recognizes two shapes for the instruction block instead of one.

1. The host default block, as today, when the turn input still carries it. This stays the older path: the existing structural validation, the owned rebuild, and the existing footer conversion keep their behaviour.
2. The component's own template render, when the session selected it. This is the new path. The extension identifies it by a component-owned template identity together with a validated skeleton, not by the mere availability of a template mechanism on the host.

Any other shape — another author's template, a host default block the extension cannot fully validate, or a partly matching skeleton — leaves the input unchanged and reports one bounded reason. The extension never guesses a structure and never reports the strategy as applied.

### Selecting the component template

The component ships its own template as a maintained artifact derived from its owned strategy text, carrying a stable identity the extension can verify. The user selects it through the host's existing template mechanism. The component writes no user configuration, no installed host file, and no copy of the host's bundled template.

A template that fails belongs to the route that read it. A strict template argument that is missing, unreadable, empty, or malformed fails that session at startup, before the extension runs, so the extension has no input to preserve and no reason to report there. The host's discovery applies its own precedence: a candidate whose file is empty is skipped and the host keeps looking for a plain literal or template at a lower precedence, reaching its bundled prompt only when no candidate remains, so an empty candidate leaves the handler no input attributable to that file. A selected discovered template that is malformed gives a different result: the host warns and renders its bundled prompt. The extension classifies only the final block that reaches its handler, whatever produced it. It reports the new path as in effect when that block verifies as the component template, including when the lower-precedence source the host selected after skipping an empty candidate is that template; every other block follows the older path or the unrecognized fallback by its actual shape, and a block it cannot verify is reported as unrecognized rather than as a failed template.

### What the extension owns on the new path

- **Delivery.** The effective `renderDelivery` value is read on every covered turn through the public settings API, as today, and decides whether the owned Delivery chapter is inserted directly after the recognized template block. Its content, default, fail-open value, and per-turn refresh keep their meaning.
- **Footer.** The extension corrects the outer loading guidance and removes the fixed outer critical tail, while `<project-context>`, context bodies, listed paths, workstation data, workspace data, active-repository text, and the append text stay byte-for-byte. A boundary it cannot determine uniquely leaves the whole footer unchanged and reports that the correction did not apply.
- **Model rules.** The second handler appends matching rule documents to the array the turn already has, as today, with the same matching, ordering, and byte-exact bodies.
- **Skill text.** The template binds the host's visible skill data. The extension does not re-derive descriptions from command metadata on this path, does not restore a description the host shortened, and never adds a skill to the visible set. Description single-lining stays on the older path.

Each of these reports its own bounded result. One step failing does not suppress another, and no step's success stands for the others.

### Repeated turns and settings changes

The new path is idempotent. A turn whose input already carries the component template block, the owned Delivery chapter in its expected position, and the corrected footer is recognized, and the extension returns no replacement when nothing would change. A change of `renderDelivery` between turns adds or removes only that chapter.

### Compatibility boundary

The compatibility object is the extension, not the host. The component does not require the host to keep its older default block, does not carry the template route back to hosts that lack it, does not vendor the host's bundled template text, and raises no maintenance bound. Older hosts keep the existing conversion and its behaviour.

### Relationship to the current decisions

[Add an OMP system prompt extension](../decision/2026-09-09-add-omp-system-prompt.md) contains clauses this contract cannot satisfy at the same time.

- "Recognize exactly one supported default main block" and "Rebuild the main block from the owned template": on the new path the instruction block is the component's own template render, produced by the host before the hook runs. Accepting it as a second recognized shape means the extension no longer requires the host default block, and no longer rebuilds the instruction block on that path.
- The `renderDelivery` chapter as part of that rebuilt main block: on the new path the chapter is a separate owned block placed after the template render, because the template cannot read plugin settings.
- The fallback rule that leaves the input untouched for custom prompts and ambiguous outer boundaries: a host-rendered component template is neither. Without naming the template render as a supported input, the extension would have to treat the supported new path as a failure.

An accepted proposal therefore needs a complete successor decision that records the two-path contract and preserves the still-effective rules: structural recognition instead of version reading, no host version in eligibility, activation, transformation, diagnostics, or fallback; the per-turn settings read; fail-open for unrecognized input with bounded diagnostics; the model-rule contract and its ordering; the coverage and evidence boundaries; and the prohibitions on writing user files and on vendoring host content.

[Add model-scoped prompt rules to the system prompt extension](../decision/2026-09-14-add-model-prompt-rules.md) does not conflict. Its append step reads whatever array the turn carries, which is also what it does on the new path.

## Alternatives considered

**Extend the existing converter to recognize the upgrade target's default block.** Considered while choosing how to keep the strategy on a new host. It keeps one path and needs no user configuration, but the component would keep maintaining a parser of host-authored prose, and every host rewording of that block would repeat the same failure.

**Use the plain-text custom prompt route instead of a template.** Considered while comparing supported routes. Plain text is simpler to install, but that route renders the session data from the host's plain-custom template rather than from the component's own text, so the maintained tool, device, internal-URL, and runtime sections could not be kept.

**Put the Delivery chapter inside the template.** Considered while deciding where that chapter lives. It needs no per-turn insertion, but the template cannot read plugin settings, so the documented switch and its per-turn change would be lost.

## Acceptance criteria

1. A turn that carries the host default block keeps today's behaviour: the recognized block is rebuilt, the existing footer conversion applies, and an unrecognized structure leaves the input unchanged with a bounded diagnostic.
2. A session that selected the component template reaches the provider with the maintained strategy, the host-rendered tool inventory, device documentation, internal URLs, skills, and rules in the instruction block, and with the host's footer block whose `<project-context>` marker survives.
3. `renderDelivery` unset or true includes the owned Delivery chapter and false omits it; the chapter sits after the template block and before the footer block, and a change between turns affects only that chapter.
4. The footer correction removes the outer loading guidance and the fixed outer critical tail and preserves context bodies, listed paths, workspace data, and append text byte-for-byte; a boundary that is not unique changes nothing and reports that the correction did not apply.
5. A strict template argument the host rejects fails that session before the extension runs; an empty discovered candidate is skipped and does not decide what the extension receives; and a malformed selected discovered template warns and renders the host's bundled prompt. None of the three is reported as the new path on its own. The extension classifies whichever block finally reaches its handler, so a lower-precedence component template stays legitimately reportable after an empty candidate is skipped. A block the extension cannot verify, including another author's template, a lookalike body, a missing identity, or a damaged render skeleton, is never rewritten, is reported as unrecognized, and is not reported as adapted.
6. Matching rule documents keep their keys, ordering, per-turn reading, and byte-exact bodies on both paths, and a failed replacement still lets the append step extend the incoming array.
7. In a real session, the provider request carries the component strategy, the effect of the Delivery setting, and a matching rule body; a handler return value alone is not that evidence.
8. The component documentation keeps distinguishing the sessions that run the hook from those that do not, on both paths.
9. Implementation creates the successor decision, records the relationship on the current prompt decision, and moves the component version and its bilingual documentation in the same change.

## Risks

- Two implementations of one behaviour can drift. A change applied to the older conversion but not to the template, or the reverse, gives two maintained hosts different strategy text with no error.
- Accepting the host's previewed and summarized skill descriptions means an activation constraint the extension previously preserved can disappear from the prompt, with no diagnostic, because the host-side shortening is expected behaviour.
