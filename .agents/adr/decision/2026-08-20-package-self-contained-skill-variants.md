# ADR decision: Package Skills as self-contained language variants

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

English | [中文](./2026-08-20-package-self-contained-skill-variants.zh.md)

## Motivation

The source repositories stored a Skill beside Plugin manifests, marketplace metadata, package documentation, and language overlays. Copying that layout would make a host-discoverable Skill depend on repository packaging details.

Language variants add a second ambiguity. Their source path identifies the selected variant, but installed Skills must keep the path expected by Agent Harnesses. Links that include the source-only variant prefix break after installation.

## Decision

Store the English base Skill under `skills/<name>/`. Store the Chinese variant under `variants/zh/skills/<name>/`. Keep the corresponding file sets and subject matter aligned in the same change.

A pure Skill contains the material needed to discover, understand, and use that Skill. This may include `SKILL.md`, workflows, references, examples, and a glossary. Do not copy Plugin manifests, marketplace metadata, `meta.toml`, host-specific Agent definitions, Plugin changelogs, or package-level README files into the Skill tree.

Install a selected language variant at the normal host Skill path, with no `variants/zh/` prefix. Links and path examples inside every variant therefore use the installed form `skills/<name>/...` when they refer to another Skill.

Keep each Skill understandable on its own. A cross-Skill link may provide related reading, but another Skill must not be required to explain this Skill's own terms or operating rules.

When importing an existing Skill, preserve its body meaning. Change paths required by the new layout, but do not combine the import with unrelated rewriting. Do not delete a valid cross-reference merely because its target will arrive in a later repository change.

## Alternatives considered

**Copy the complete Plugin directory into `skills/`.** This mixes host packaging and repository metadata with the Skill contract.

**Install variants with their source prefix.** Agent Harnesses discover Skills at their normal Skill root, so source-only prefixes would leak into links and installation behavior.

**Keep language variants in the base Skill directory.** This makes host selection and file correspondence unclear and encourages mixed-language files.

**Remove unresolved cross-Skill links during import.** Turning a link into plain text changes the source meaning. Keeping the canonical installed path preserves intent while the target is added separately.

**Refactor content while moving it.** This makes it difficult to distinguish layout adaptation from editorial change and weakens review evidence.

## Consequences

English Skills live under `skills/<name>/`, while Chinese variants live under `variants/zh/skills/<name>/`. A pure Skill tree contains no Plugin manifest, marketplace metadata, package changelog, or host-specific Agent definition.

Installed-path links omit the variant source prefix. Source paths and installed paths therefore differ intentionally, and validation must check links as they appear after variant selection rather than only against the repository tree.

Each variant remains complete and reviewable against its counterpart. Language-specific explanations may differ where translation requires it, but neither variant may silently omit an observable capability or required instruction.

Imports preserve body meaning and distinguish path adaptations from editorial changes. Each Skill explains its own domain and remains usable without loading another Skill.
