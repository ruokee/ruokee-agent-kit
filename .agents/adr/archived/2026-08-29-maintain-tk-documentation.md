# ADR decision: Maintain tk documentation

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Archived: 2026-09-11
Reversed by: [Align tk usage patterns](../decision/2026-09-11-align-tk-usage-patterns.md)

English | [中文](./2026-08-29-maintain-tk-documentation.zh.md)

## Motivation

The [tk product architecture](../decision/2026-08-21-define-tk-product-architecture.md) spans Task files, a Rust runtime, CLI, MCP, native tools, four Harnesses, component lifecycle, Skills, and bilingual public documentation. Repeating the same contract on every page would create conflicting sources. Keeping only implementation code would make behavior and rationale difficult to audit.

The repository uses English as its default public language and needs complete Chinese material for maintainer review. The two languages must describe the same product without forcing Chinese into sentence-by-sentence translation.

## Decision

### Public documentation set

Public tk documentation lives under `projects/tk/docs/` and contains:

- English and Chinese user guides;
- English and Chinese design indexes;
- paired pages for system architecture, data model, runtime, tool API, CLI reference, Harness integration, installation, Skill behavior, validation, documentation, and the glossary;
- tk entry points in the repository root README and Chinese README;
- current English and Chinese tk ADRs under `decision/`.

Review records, revision numbers, Task paths, branch status, implementation logs, and local materials do not appear in public pages.

### Topic ownership

Each behavior has one primary owning page. The system page owns product boundaries and invariants. The data-model page owns Task formats and persistence. Runtime owns process and failure behavior. Tool API owns logical requests and results. CLI reference owns command spelling and exit behavior. Harness integration owns component forms and adapters. Installation owns component lifecycle. Skill owns Agent behavior. Validation owns observable acceptance. Documentation owns maintenance rules. The glossary owns only project-specific terms and fixed translations.

A parameter table, algorithm, or normative field definition appears only on its owning page. Other pages link to it and state only the context needed by their readers.

ADRs preserve durable decisions, alternatives, and consequences. They link to current public contracts instead of copying full command, field, or test inventories.

### Final-state wording

Public documentation states the current formal contract as if it had been implemented in that form from the beginning. It does not narrate design revisions, review debates, discarded development commands, compatibility with unreleased formats, or Agent work history.

A real behavior change after release may include migration guidance when users need it. Development-only experiments do not become compatibility history and are not listed as removed features.

### English and Chinese

Each guide and design topic links to its other-language counterpart immediately after the H1. Repository file links are relative to the current document. Paths in the current directory or below start with `./`; links outside the directory use the required `../` segments.

English and Chinese pages have equivalent meaning. Chinese uses natural Chinese rather than mechanical sentence mapping. Commands, paths, fields, code, logs, product names, and identifiers retain their required spelling and capitalization.

The glossary contains only terms with tk-specific meaning, fixed capitalization, or a translation that must remain stable. General technical vocabulary stays in its owning document. Fixed Chinese forms include `受管`, `临时记事区`, `人类可读`, `直接切换`, `支持的子命令`, `活动操作标记`, `表示切换`, `续跑令牌`, and `续跑状态`.

### Skills and ADRs

The four authoritative Skill trees are `projects/tk/skills/tk/`, `projects/tk/skills/tk-zh/`, `projects/tk/skills/tk-cli/`, and `projects/tk/skills/tk-cli-zh/`. Each is self-contained. English and Chinese Skills in the same mode have equivalent semantic coverage.

ADR proposals and decisions use separate repository formats and directories. English and Chinese pairs remain semantically aligned, and the maintainer controls proposal approval, rejection, and decision archival.

### Maintenance

A public behavior change updates the owning design page, affected guide and CLI examples, both languages, affected Skill content, every current ADR that owns the decision, and the corresponding validation contract in the same change.

Repository Markdown, link, formatting, and spelling checks are combined with manual bilingual review. tk does not add a custom documentation structure or translation checker until repeated maintenance or an observed drift failure establishes a concrete invariant worth automating.

The authoritative maintenance details live in the [documentation design](../../../projects/tk/docs/design/documentation.md) and [glossary](../../../projects/tk/docs/design/GLOSSARY.md).

## Alternatives considered

**Repeat complete contracts on every related page.** Duplication would make routine changes require many synchronized edits and leave readers unsure which copy is authoritative.

**Keep implementation history in public design pages.** Development chronology would obscure the current contract and turn unreleased experiments into accidental compatibility promises.

**Put every technical term in the glossary.** A large general glossary would duplicate ordinary technical documentation and create needless translation maintenance.

**Build a tk-specific bilingual structure checker.** Structural similarity cannot prove semantic equivalence or natural Chinese. Existing checks plus direct review are sufficient until a repeated mechanical failure identifies a useful rule.

## Consequences

Readers can enter through a guide, design topic, Skill, or ADR and follow relative links to the owning contract. Each normative detail has one main maintenance location.

Every product change carries bilingual documentation work. Manual review remains necessary because formatting checks cannot establish semantic equivalence or writing quality.

Final-state wording keeps public documentation compact, but review history and implementation evidence must live in Task materials or other non-public records. ADRs retain rationale without becoming release notes or progress logs.

## Changes

### 2026-09-02: Adopt the proposal and decision model

tk documentation now refers to current ADRs under `decision/` rather than modeling current records through an `implemented` status. Proposals and decisions use separate formats without a `Status` field, while the maintainer retains lifecycle authority.

### 2026-09-02: Document selectable Skills and components

Documentation covers tools and CLI modes, English and Chinese selection through `tk install`, four Skill identities, multiple component payloads, and the split routing contract. The four Skill paths above replace the earlier English Skill and the Chinese Skill that required manual installation.

### 2026-09-03: Document custom CLI Skill roots

Documentation now covers multiple Harness payloads, two Harness-independent CLI Skill payloads, the mutually exclusive install targets, and the bounded custom-root lifecycle.

### 2026-09-07: Define component README navigation

The public documentation set includes the component [English README](../../../projects/tk/README.md) and [Chinese README](../../../projects/tk/README.zh.md). They introduce tk and link to the existing guides and design pages without duplicating detailed commands or normative contracts. The repository README pair links to these component entry pages. Public Markdown counterparts use same-directory `name.md` and `name.zh.md` pairs under the [public documentation decision](../decision/2026-09-07-colocate-bilingual-docs.md); topic ownership remains unchanged.
