# ADR mechanism

Decision owner: Ruokee
Decision writer: OMP
Reverses: [ADR mechanism](../../../archived/2026/08/22-r6-adr-mechanism.md)

English | [中文](./22-adr-mechanism.zh.md)

## Motivation

Maintain bilingual ADRs with stable identities and traceable history through the internal `maintain-adr` Skill.

Durable choices need one current reference and separately accessible historical contracts. Their structure, lifecycle, and writing rules form a reusable maintenance method. Keeping the full method both in a Skill and in the ADR README would create competing authorities.

The [predecessor](../../../archived/2026/08/22-r6-adr-mechanism.md#maintenance) excluded a dedicated ADR Skill and assigned detailed formats and operations to the guide. Adopt the Skill as the main owner while retaining project supplements, review, search, and Git history. The repository dictionary remains the term authority outside distributed components; the project entry links its ADR page.

## Decision

### Maintenance ownership

[maintain-adr](../../../../skills/maintain-adr/SKILL.md) owns the main ADR maintenance method, [record rules](../../../../skills/maintain-adr/references/records.md), and [writing rules](../../../../skills/maintain-adr/references/writing.md). It is an English internal project Skill under `.agents/skills/`, not a public installation source. Its references may reach the project documents it maintains. Public component self-containment stays unchanged.

The [ADR README](../../../README.md) owns repository locations, language policy, Git workflow, and maintainer authority. It does not duplicate the complete method. Agents load the Skill before applicable maintenance or review, including feature work that affects a durable choice, then read relevant current decisions and their `Changes`, proposals, specs, supplements, and necessary component documentation. Ordinary reading and routine changes without a durable choice do not require an ADR. Loading grants no write or lifecycle permission.

### Identity

Use ADR as the term and `.agents/adr/` as the root. The `proposal`, `decision`, `rejected`, and `archived` directories express document type and state; records carry no `Status` field. Titles name the topic. The first proposal date and canonical topic identify a decision and its archives. Current paths remain stable, actual archival and change dates remain event metadata, and each decision's archive sequence advances continuously from `r1` without resetting across days, months, or years.

An extracted independent topic gets its own date, name, and sequence; a shared predecessor or relationship alone does not share identity. Language counterparts, link repairs, ordinary updates, and naming corrections consume no revision. The [record rules](../../../../skills/maintain-adr/references/records.md#identity) own the detailed identity operations. The project keeps all lifecycle roots tracked with `.gitkeep` and its supplement at the ADR root.

### Record contract

Every record is an English and Chinese pair with identical owner and original writer, reciprocal links after the complete metadata block, and equal semantic authority. Both versions are complete in the same change and move together. A semantic conflict requires maintainer resolution. [Project language supplements](../../../README.md#languages) own the spelling and pairing details.

Proposals state motivation, proposal, material alternatives, observable acceptance, and risks. Decisions state motivation, complete choice, material alternatives, and consequences. A substantive analysis may follow motivation. The opening states one concrete action or complete choice. An empty alternatives or risks section is complete when no entry qualifies. An ADR preserves necessary contracts, reasons, conditions, uncertainty, and historical capabilities, not a component manual, execution plan, or session log. [Writing rules](../../../../skills/maintain-adr/references/writing.md) own the exact criteria, including evidence for alternatives and causal, material risk statements wherever they occur.

### Lifecycle

Non-conflicting additions append actual-date entries under final `Changes`; an independent addition may link a separate decision. Editorial or evidenced factual repair creates no new choice. A conflicting choice first needs a proposal identifying each effective clause, the new choice, and why both cannot hold. Code size, another feature or host dependency, or a rename alone is not a conflict.

After implementation, form a complete successor from the accepted choice and all still-effective clauses within the decision's scope. Archive the replaced pair at the next unused revision and write the successor at the canonical path in the same change. Preserve actual event dates and original authors. `Reverses` and `Reversed by` link direct versions: if C replaces B, A's earlier link to B follows B into its archive rather than drifting to C.

Classify citations by meaning, not source directory. Current authority uses the canonical path; a historical choice follows that version. Recompute all affected paths, language links, inbound links, and fragments. Archives freeze after relationship and factual link repairs; rejected proposals freeze after factual link repairs and retain their rejection reason. Naming and evidenced identity repair do not change promises or unfreeze history. Keep no old-name aliases. A historical spelling remains when it is the cited fact. A changing Skill or spec cannot replace the contract needed to explain a historical choice.

### Project authority

The maintainer owns approval, rejection, and decision archival. Agents execute within effective authorization, reuse existing approval, and keep read-only requests read-only. One requirement gets one proposal unless the maintainer requests another split. Proposal and implementation remain separately reviewed and committed, with the proposal integrated first. Authorized dependent development may use a verified unmerged predecessor; it does not grant integration permission. The [project supplements](../../../README.md#integration) own that Git sequence.

Neither document-maintenance Skill owns task Goals or task lifecycle. A target change uses `maintain-spec` when needed; the two Skills are not loaded together unconditionally.

### Automation boundary

Keep review, repository search, and Git history. Do not add a classification system, translation sidecar, archive manifest, index, or permanent maintenance script. Add a mechanical check only when repeated maintenance or an observed failure establishes a concrete invariant. Skill discovery and formatting do not establish correct maintenance: actual project sessions must show applicable loading, effective-source reading, and correct document results against confirmed requirements.

Keep Skills, project supplements, documentation rules, the repository spec, dictionary, and affected references aligned. Public distribution and adaptation to other projects or hosts require their own scope; no general framework is prebuilt for them.

## Alternatives considered

Keep full rules in project README files and use a Skill only for general steps. This retains guide ownership, but each maintenance task must assemble the method from two sources. Giving the Skill the main method requires a careful contract and reference migration, while leaving project-specific supplements separate.

## Consequences

Current authority stays at one stable path per decision, with each replaced version independently accessible. Direct historical relationships and complete successors still require semantic review; formatting cannot prove them.

The main method is available on demand without a second complete guide. If an Agent skips loading it, the shortened supplement cannot supply the omitted rules, so requirement or historical-relationship errors remain possible. Project triggers and evidence from actual maintenance are necessary to judge the pilot.
