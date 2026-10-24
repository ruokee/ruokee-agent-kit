# Skill language variants

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Archived: 2026-10-24
Reversed by: [Skill language variants](../../../decision/2026/08/20-skill-variants.md)

English | [中文](./20-r1-skill-variants.zh.md)

## Motivation

Store each Skill's English base under `skills/<name>/` and its Chinese variant under `variants/zh/skills/<name>/`, and install the selected variant without that prefix.

A packaged Skill has to remain self-contained and discoverable by Agent Harnesses without depending on repository packaging details. The source repositories stored a Skill beside Plugin manifests, marketplace metadata, package documentation, and language overlays, and copying that layout would make the Skill depend on those packaging details.

Language variants add a second ambiguity. Their source path identifies the selected variant, but installed Skills must keep the path expected by Agent Harnesses. Links that include the source-only variant prefix break after installation.

## Decision

Store the English base Skill under `skills/<name>/`. Store the Chinese variant under `variants/zh/skills/<name>/`. Keep the corresponding file sets and subject matter aligned in the same change.

A pure Skill contains the material needed to discover, understand, and use that Skill. This may include `SKILL.md`, workflows, references, examples, and a glossary. Do not copy Plugin manifests, marketplace metadata, `meta.toml`, host-specific Agent definitions, Plugin changelogs, or package-level README files into the Skill tree.

Install a selected language variant at the normal host Skill path, with no `variants/zh/` prefix. Links and path examples inside every variant therefore use the installed form `skills/<name>/...` when they refer to another Skill.

Keep each Skill understandable on its own. A cross-Skill link may provide related reading, but another Skill must not be required to explain this Skill's own terms or operating rules.

## Alternatives considered

None

## Consequences

English Skills live under `skills/<name>/`, while Chinese variants live under `variants/zh/skills/<name>/`. A pure Skill tree contains no Plugin manifest, marketplace metadata, package changelog, or host-specific Agent definition.

Installed-path links omit the variant source prefix. Source paths and installed paths therefore differ intentionally, and validation must check links as they appear after variant selection rather than only against the repository tree.

Each variant remains complete and reviewable against its counterpart. Language-specific explanations may differ where translation requires it, but neither variant may silently omit an observable capability or required instruction.

Imports preserve body meaning and distinguish path adaptations from editorial changes. Each Skill explains its own domain and remains usable without loading another Skill.

## Changes

### 2026-09-02 tk language Skill names

tk uses the independently discoverable Skills `tk`, `tk-zh`, `tk-cli`, and `tk-cli-zh`. They are separate Skill identities rather than same-name language variants, so all four live under `projects/tk/skills/<name>/`. This does not change the same-name variant rule for other Skills.

### 2026-10-22 Project component Skills

Skills included in independently maintained project components live under `projects/<component>/skills/<name>/`. Their layout follows component ownership rather than a list of named exceptions. A component may give its language Skills separate, independently discoverable identities. Each language Skill remains complete and self-contained; equivalent instructions and versions are maintained in the same change. The ordinary Skill layout and same-name variant rule remain unchanged.
