# ADR mechanism

Decision owner: Ruokee
Decision writer: OMP
Reverses: [ADR mechanism](../../../archived/2026/08/22-r7-adr-mechanism.md)

English | [中文](./22-adr-mechanism.zh.md)

## Motivation

Maintain bilingual current decisions and replaced decisions through the internal `maintain-adr` Skill, with discussion and execution tracked in tasks.

Durable choices need one current reference and separately accessible historical contracts. Task materials already hold discussion, approval, and execution arrangements. The [predecessor](../../../archived/2026/08/22-r7-adr-mechanism.md) additionally required active and rejected ADR proposals and proposal-first integration. That duplicates work tracking and makes a separate proposal a prerequisite even when the maintainer has already approved the choice.

The Skill owns the reusable structure, lifecycle, and writing method. Keeping the full method both there and in the ADR README would create competing authorities. Project supplements retain local policy, and the repository dictionary remains the term authority outside distributed components.

## Decision

### Maintenance ownership

[maintain-adr](../../../../skills/maintain-adr/SKILL.md) owns the main ADR maintenance method, [record rules](../../../../skills/maintain-adr/references/records.md), and [writing rules](../../../../skills/maintain-adr/references/writing.md). It is an English internal project Skill under `.agents/skills/`, not a public installation source. Its references may reach the project documents it maintains. Public component self-containment stays unchanged.

The [ADR README](../../../README.md) owns repository locations, language policy, Git workflow, and maintainer authority. It does not duplicate the complete method. Agents load the Skill before applicable maintenance or review, including feature work that affects a durable choice, then read confirmed requirements, relevant current decisions and their `Changes`, specs, supplements, and necessary component documentation. Ordinary reading and routine changes without a durable choice do not require an ADR. Loading grants no write or lifecycle permission.

### Records

Use ADR as the term and `.agents/adr/` as the root. ADRs have one document type, the decision. `decision/` holds current decisions and `archived/` holds decisions that took effect and were later replaced. Directories express state; records carry no `Status` field. Keep both roots tracked with `.gitkeep` and the supplement at the ADR root.

Discussion, approval, rejected options, and execution arrangements belong in the existing tk task. Public collaboration may use an accessible Issue or PR without requiring either platform. An unadopted draft is not an archived decision. Important rejected alternatives that explain a choice belong in its ADR; a durable choice not to adopt an option can itself be a decision. Ordinary rejection needs no ADR.

### Identity

A new topic uses the date its first formal decision is written from effective approval and completed implementation, when implementation is needed, plus a short canonical English topic. A document-only choice uses its decision-writing date. Discussion, task creation, and future integration dates do not supply the identity, and later review does not rename it.

Existing decisions retain their identity dates and canonical paths, including dates inherited from historical proposals. Ordinary reversals preserve that identity. Actual archival and change dates remain event metadata, and each decision's archive sequence advances continuously from `r1` without resetting across days, months, or years.

An extracted independent topic gets its own decision date, name, and sequence; a shared predecessor or relationship alone does not share identity. Language counterparts, link repairs, ordinary updates, and naming corrections consume no revision. The [record rules](../../../../skills/maintain-adr/references/records.md#identity) own the detailed identity operations.

### Record contract

Every record is an English and Chinese pair with identical owner and original writer, reciprocal links after the complete metadata block, and equal semantic authority. Both versions are complete in the same change and move together. A semantic conflict requires maintainer resolution. [Project language supplements](../../../README.md#languages) own the spelling and pairing details.

Decisions state motivation, complete choice, material alternatives, and consequences. A substantive analysis may follow motivation. The opening states one concrete action or complete choice. An empty alternatives section is complete when no entry qualifies. An ADR preserves necessary contracts, reasons, conditions, uncertainty, and historical capabilities, not a component manual, execution plan, or session log. [Writing rules](../../../../skills/maintain-adr/references/writing.md) own the exact criteria, including evidence for alternatives and causal, material risk statements wherever they occur.

A public decision explains the choice and its necessary reasons without access to private task materials. Approval records do not replace that public contract.

### Lifecycle

For a choice requiring implementation, keep approval and pending execution in the task, then integrate the formal decision with its implementation. The existing decision remains mainline authority until the replacement change is integrated. A durable choice with no implementation work may become a decision through a document-only change. There is no separate proposal or rejected-proposal state.

Non-conflicting additions append actual-date entries under final `Changes`; an independent addition may link a separate decision. Editorial or evidenced factual repair creates no new choice. A conflicting choice identifies each effective clause, the new choice, and why both cannot hold, and obtains the required approval without a separate ADR proposal. Code size, another feature or host dependency, or a rename alone is not a conflict.

After implementation, form a complete successor from the accepted choice and all still-effective clauses within the decision's scope. Archive the replaced pair at the next unused revision and write the successor at the canonical path in the same change. Preserve actual event dates and original authors. `Reverses` and `Reversed by` link direct versions: if C replaces B, A's earlier link to B follows B into its archive rather than drifting to C.

Classify citations by meaning, not source directory. Current authority uses the canonical path; a historical choice follows that version. Recompute all affected paths, language links, inbound links, and fragments. Archives freeze after relationship and factual link repairs. Naming and evidenced identity repair do not change promises or unfreeze history. Keep no old-name aliases. A historical spelling remains when it is the cited fact. A changing Skill or spec cannot replace the contract needed to explain a historical choice.

### Project authority

The maintainer owns adoption of durable choices and archival of replaced decisions. Agents execute within effective authorization, reuse existing approval, and keep read-only requests read-only. A plan, task status, review verdict, or completed implementation grants no lifecycle or integration permission. Removing the proposal stage does not add another approval gate.

Follow the [project integration policy](../../../README.md#integration) and Git rules for local candidates, review, and separate integration permission. Authorized dependent development may use a verified unmerged predecessor; this alone approves no choice or archival. Neither document-maintenance Skill owns task Goals or task lifecycle. A target change uses `maintain-spec` when needed; the two Skills are not loaded together unconditionally.

### Automation boundary

Keep review, repository search, and Git history. Do not add a classification system, translation sidecar, archive manifest, index, or permanent maintenance script. Add a mechanical check only when repeated maintenance or an observed failure establishes a concrete invariant. Skill discovery and formatting do not establish correct maintenance: actual project sessions must show applicable loading, effective-source reading, and correct document results against confirmed requirements.

Keep Skills, project supplements, documentation rules, the repository spec, dictionary, and affected references aligned. Public distribution and adaptation to other projects or hosts require their own scope; no general framework is prebuilt for them. This mechanism adds no tk state, command, schema, template, or ADR integration interface and no mandatory replacement RFC process.

## Alternatives considered

Retain separate active and rejected ADR proposals. This gives public readers a dedicated pre-decision record, but duplicates task discussion and execution tracking and requires a separate integration stage. Decisions instead retain the reasons needed to understand the adopted choice, including material rejected alternatives.

Keep full rules in project README files and use a Skill only for general steps. This retains guide ownership, but each maintenance task must assemble the method from two sources. Giving the Skill the main method requires a careful contract and reference migration, while leaving project-specific supplements separate.

## Consequences

Current authority stays at one stable path per decision, with each replaced version independently accessible. Direct historical relationships and complete successors still require semantic review; formatting cannot prove them.

Tasks hold pre-decision work without a second ADR lifecycle. If necessary reasons remain only in private discussions, public readers cannot judge the decision. The public record must therefore preserve those reasons and material alternatives independently, while ordinary unadopted ideas need not remain in public ADR history.

The main method is available on demand without a second complete guide. If an Agent skips loading it, the shortened supplement cannot supply the omitted rules, so requirement or historical-relationship errors remain possible. Project triggers and evidence from actual maintenance are necessary to judge its use.
