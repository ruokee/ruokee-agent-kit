# ADR proposal: Mark OMP footer ownership only when needed

Draft owner: Ruokee
Draft writer: OMP GPT-6.1 Sol

English | [中文](./2026-10-03-mark-ambiguous-omp-footers.zh.md)

## Motivation

Mark OMP template footer ownership only when an append could be mistaken for a native critical tail.

The [template decision](../decision/2026-09-30-render-system-prompt-from-host-template.md#what-the-extension-owns-on-the-template-path) requires native outer-tail removal, byte-exact opaque data, and idempotent conversion. The [OMP 18.5.0 footer](https://github.com/can1357/oh-my-pi/blob/v18.5.0/packages/coding-agent/src/prompts/system/project-prompt.md#L54-L62) renders a fixed main-agent or subagent critical block before the append. A complete copy at the append start must survive after the native block has been removed.

A footer with loaded context bodies or listed rule paths already has loading guidance that conversion replaces with owned text. A footer without that guidance has no such ownership signal. Repeated conversion can mistake its append for another native tail and silently delete user text.

## Analysis

Let `F` be a valid `<project-context>` block without loading guidance, `C` a complete recognized native critical block, and `A` append bytes. `F + "\n\n" + C + "\n\n" + A` can be an unconverted footer with native tail `C` and append `A`, or a converted footer whose append is `C + "\n\n" + A`. With Delivery disabled, the complete block array can be identical in both cases. Text alone cannot require deletion for one identity and preservation for the other. A conversion-state signal is necessary; enabling Delivery is not an ownership solution.

## Proposal

Add a conditional ownership marker in a neutral, non-instructional comment to the template footer contract of [projects/omp-system-prompt/README.md](../../../projects/omp-system-prompt/README.md#host-template-route).

1. Insert a marker only when all three conditions hold: the valid footer has no loading guidance; conversion removes an exactly recognized native critical tail; and the append itself starts with a complete recognized native critical block. Ordinary appends and footers with loading guidance receive no new marker.
2. Place the marker inside the outer `<project-context>` block, outside workstation data, context bodies, listed paths, workspace data, active-repository text, and the append. The marker and its necessary separator are the only permitted additions to the prior conversion output.
3. Recognize converted footers through owned loading guidance or the marker at its validated structural position. Never treat the append after a converted footer as a native tail. Recognition remains textual, not proof of authorship or a security boundary.
4. Keep every other maintained old input's conversion output byte-identical to its prior output. The conditional marker is the sole exception; it does not permit rewriting opaque bytes or inserting strategy instructions.
5. Keep the `<project-context>` block start, array position, and static-prefix cache boundary unchanged. Ownership recognition works with either Delivery value and across Delivery changes, without process-local caches or a new setting.
6. Preserve the default-block path, the strict older `PROJECT` contract, bounded failure behavior, strategy text, template artifact, model rules, maintenance floor, and structure-based eligibility. Do not add a host-version gate or change installed host files.

This extends the existing template decision without changing its protected data or its other ownership rules. The marker occupies outer footer space, not any field that the current decision promises to preserve byte-for-byte. The full-output exception is explicitly limited rather than inferred from that distinction.

## Alternatives considered

**Mark every footer without loading guidance.** A uniform marker gives all such outputs an ownership signal, but also changes ordinary old outputs where no append ambiguity exists. That exceeds the necessary compatibility exception.

**Preserve all old output bytes and carry state outside the prompt.** An explicit source or processing-state interface could distinguish identical text without adding provider-visible bytes. It requires a separate interface and lifecycle design rather than the current text-only contract. This proposal keeps ownership in the validated footer representation and limits its output cost to the ambiguous case.

## Acceptance criteria

- Exactly recognized main-agent and subagent native tails are removed only at a validated outer boundary. Unknown tails and ambiguous outer structure retain the existing preservation and diagnostic behavior.
- Context bodies, listed paths, workstation, workspace and active-repository data, and append bytes remain exact, including complete known critical blocks at the append start.
- Old inputs with loading guidance and old inputs with ordinary appends produce their prior complete output. Only a footer satisfying all three insertion conditions gains the marker and its separator.
- Reprocessing a converted block array produces the same complete array and no replacement when settings are unchanged. Delivery changes alter only the Delivery chapter, not the footer or append.
- The older `PROJECT` path and the component's unchanged strategy, settings, model rules, and maintenance declaration keep their contracts.
- Provider-facing observations cover required-marker and no-marker cases on the real host, including an ordinary subagent. Documentation distinguishes those observations from API regressions and does not claim general host certification.

## Risks

- The marker is provider-visible. Consumers that require complete prompt byte identity can reject the affected output even though its opaque data is unchanged. The three insertion conditions bound this accepted difference.
- Matching a marker inside a context body or append could misclassify a raw footer as converted and leave native policy text in place. Ownership must be recognized only at a validated outer structural position; opaque text must not participate in that recognition.
