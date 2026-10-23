# Repository

## Goals

Hold only capabilities Ruokee authors and maintains, together with the first-party packaging, installation, documentation, and validation needed to distribute them. Keep each capability in its host-native or build-native form and each distributable component self-contained.

Provide complete bilingual targets, durable decisions with traceable history, clear working rules, and shared terminology. Contributors and Agents must be able to distinguish required results, implementation choices, operating instructions, and execution evidence.

## Out of scope

- Third-party capabilities, forks, upstream mirrors, empty capability categories, or structure for hypothetical requirements. A first-party capability may cite, quote, or adapt licensed third-party material without making that capability the subject of maintenance.
- Tracked developer-local directories, machine inventories, deployment or recovery configuration, credentials, private hostnames, internal service URLs, or device-specific model, Provider, and channel settings. Ignored local materials and links to them are not public authority.
- Public distribution or cross-project adaptation of internal maintenance Skills, task Goal maintenance by those Skills, or a new maintenance CLI, sidecar, archive manifest, or general adaptation framework.
- Checks that install dependencies, format source, or substitute global tools for missing local prerequisites.

## Public surface

### Repository areas

- `projects/` contains independently maintained extensions, executables, and host packages, including their component documentation and checks.
- Ordinary public English Skills use `skills/<name>/`; their Chinese variants use `variants/zh/skills/<name>/`. Skills owned by a project component stay under that component's `skills/` directory.
- `docs/` contains repository-wide documentation; `scripts/` contains repository-wide installation, maintenance, and checks. Component-specific material stays with its component.
- `.agents/spec/` contains long-lived specifications. Every project component, ordinary Skill distribution, repository conventions, and host compatibility has a complete specification set. A non-spec index identifies every file in each set and both languages.
- `.agents/adr/` contains proposals, current decisions, rejected proposals, and replaced decisions. `.agents/rule/` contains working rules, one bilingual page per activity, without dated filenames or subdirectories. Its index is not a closed list of future activities.
- `.agents/skills/maintain-spec/` and `.agents/skills/maintain-adr/` contain English internal maintenance Skills discoverable by the project's native Skill mechanism.

### Documentation

Specifications completely state purpose, required behavior, input conditions, defaults, limits, failure results, compatibility, and observable acceptance. After removing the original implementation and its explanatory material, the complete specification set must still support a substantially equivalent implementation with different internals. Internal functions, algorithms, build organization, verification logs, and session records are not specification content.

Spec bodies contain no repository-file links, including language links, links to other specs, ADRs, rules, or source. Bare paths and references to current behavior cannot delegate requirements. A path that is itself a confirmed external interface may be stated with its behavior. Language, topic, and decision navigation belongs in the non-spec index. Specs are maintained in place, without revision history or lifecycle status, and must agree with effective decisions and confirmed requirements.

ADRs preserve durable choices, reasons, material alternatives, consequences, and necessary historical contracts. Design explains implementation. User documentation independently explains installation and use of the same confirmed contract. Validation material preserves methods and evidence. Rules govern contributor actions, order, permissions, and prohibitions. Repository README pages introduce capabilities and development; Agent instructions carry navigation and the frequently needed rules. Repeating a target in a user guide must not create a conflicting authority.

The repository dictionary defines canonical shared English terms, Chinese equivalents, and meanings for repository development. Component glossaries remain self-contained and semantically aligned. Commands, fields, file names, and third-party proper names retain their original spelling. New terms or changed meanings need maintainer confirmation; intentional aliases are explicit.

### Maintenance Skills

`maintain-spec` applies before creating, changing, removing, or reviewing a long-lived spec, and when feature work changes its goals, boundaries, or acceptance. It covers new subjects, changed targets, omissions, boundary clarification, implementation deviations, removal, and editorial repair. It requires relevant current specs, effective decisions including dated changes, active proposals, project supplements, and necessary sources beyond existing links. Existing code or a proposal does not approve a requirement.

The method preserves conditions, quantities, defaults, exceptions, failure results, permissions, and compatibility. It separates external requirements from implementation within mixed clauses, maintains the complete affected language and reference set, and checks whether a new implementer can determine conformance without implementation material. A conflicting source pauses only the affected clause for maintainer resolution. Unaffected authorized work continues.

`maintain-adr` applies before creating, repairing, updating, reversing, rejecting, archiving, or reviewing ADRs, or changing a durable choice. It distinguishes factual repair, non-conflicting updates, complete successors, and lifecycle actions. It preserves original authorship, identity, real dates, direct relationships, historical requirements, and bilingual meaning. Neither Skill owns task Goals or task lifecycle, expands permission, requires the other for unrelated work, or creates an ADR for a change without a durable choice. Read-only work stays read-only.

Each main method has one owner in its Skill and necessary references. Layer indexes hold project coverage, language, authority, Git policy, and navigation rather than another complete method. Descriptions and Agent entry points identify when to load each method without repeated user naming.

### ADR records

Records use `proposal/YYYY/MM/DD-name.md`, `decision/YYYY/MM/DD-name.md`, `rejected/YYYY/MM/DD-name.md`, and `archived/YYYY/MM/DD-rN-name.md`, with same-directory Chinese counterparts. The first proposal date and canonical topic identify a decision. A reversal keeps its canonical current path and increments only that decision's archive sequence, including same-day, cross-month, and cross-year reversals. Extracting an independent topic creates its own identity and sequence while preserving actual relationships. Naming repair consumes no revision.

Titles name the topic, not its lifecycle. Proposals carry `Draft owner` and `Draft writer`; decisions carry `Decision owner` and `Decision writer`. Original writers remain unchanged during ordinary maintenance. Archives additionally carry the actual `Archived` date before `Reversed by`. A successor's `Reverses` names its direct predecessor; earlier archives follow the intermediate predecessor into its archive rather than skipping to the latest current version. No `Status` field substitutes for the lifecycle directory. A complete leaf filename, including date, revision, language suffix, and extension, is at most 60 characters.

Proposal sections are Motivation, optional substantive Analysis, Proposal, Alternatives considered, Acceptance criteria, and Risks. Decision sections are Motivation, optional substantive Analysis, Decision, Alternatives considered, and Consequences. Non-conflicting additions use final Changes entries with their actual dates. Motivation opens with a short sentence stating the choice. Alternatives must genuinely have entered the same choice and explain a material tradeoff; risks and accepted costs need a credible cause and material consequence. Empty alternatives or risks use `None` or `无`. A record is not an execution plan or review transcript.

The maintainer owns proposal approval, rejection, and archival. Implementation consumes an approved proposal, forms complete successors preserving unaffected contracts, and repairs direct relationships and citations in the same change. Archives and rejected proposals retain their historical choices, with factual link and relationship repair allowed. Current-authority references and historical citations resolve to the intended versions. A rejected proposal retains its original proposal date without an archive revision.

### Development checks

`pnpm check:changed` selects a deduplicated union for committed and pending changes relative to the merge base with local `main`; `--base <ref>` selects another merge base without fetching. Renames and deletions remain inputs. Consumer-specific rules take priority over ordinary Markdown classification. Known explanatory Markdown selects formatting checks for surviving files. Registered component changes select their own checks. Shared, unknown, or unreliable classification selects one complete check. An empty selection does not establish merge readiness.

`pnpm check` is the complete aggregate; its coverage agrees with the selector and its regression checks. Component checks stay beside their component. Missing selected prerequisites fail visibly. Check commands do not install dependencies or format source. Independent branches have independent writable dependency and build directories; package-manager content caches may be shared within the same trust boundary.

## Invariants

- A distributable component references only files inside itself and does not import or read another repository component or repository support files. It may name another component, tool, or Skill, declare it as a prerequisite, and use its public interface. Internal maintenance Skills may read the project material they maintain.
- Code, comments, configuration, and default public documentation are English. Ordinary public documents use same-directory `name.md` and `name.zh.md` pairs, with `README.md` and `README.zh.md` entry pages. Both languages remain complete and change together. Ordinary documents have reciprocal language links; specs instead use the external index. Skill variants keep their own component layouts without cross-language file links.
- Repository-file links outside spec bodies are relative to the containing page, with `./` for the current tree and `../` to leave it. They use neither leading `/`, root-relative paths, nor absolute GitHub URLs for repository files. Heading-fragment references remain valid. `AGENTS.md` is mentioned as inline code, not a public link.
- File names and headings have one short subject, expressed as an imperative, phrase, or noun unless a specific requirement says otherwise. Heading punctuation excludes everything except `-`, `.`, and `、`; names do not join unrelated subjects. There are no explicit anchor declarations.
- Prettier formatting covers all tracked Markdown. Source attribution and applicable license information remain at repository level or in a component README or decision, not inside a pure Skill tree.
- Commit messages are English Conventional Commits with standard types. Optional scope is `skills`, `extensions`, `adr`, or `repo`; changes spanning areas omit it. Commit hooks format staged files and reject invalid messages.
- `main` is the only long-lived branch. Short-lived development branches integrate through separately authorized squash merges. An authorized dependent unit may start from a frozen, committed, verified predecessor; predecessor and descendant remain separately reviewable. Commit, merge, push, branch deletion, and task closure are separate permissions.
- A final merge candidate is clean, committed, contains the target `main`, and has a successful complete check bound to its commit, tree, and target. Changed tracked content, pending changes, candidate changes, or target advancement invalidate that success. The integrated tree equals the validated tree.
- A component's functional change includes its `X.Y.Z` version update. The final squash change increments `Z` once by default; the maintainer chooses `X` or `Y` changes. An unpublished first addition retains its initial version, normally `0.1.0`, through revisions. All version statements agree.
- Components retain no unreachable code, duplicate implementation, or speculative design. Simplification preserves confirmed commands, tools, settings, formats, and behavior.

## Acceptance criteria

- Every subject has a complete bilingual target. Spec readers determine required behavior and failures without opening implementation material; an alternative internal implementation is judged by those results. No spec body contains a repository-file link or indirect requirement delegation.
- Distributed components install and operate without repository support files. Language counterparts express equivalent capabilities, constraints, and instructions. Their inventories and navigation identify the complete sets.
- Actual maintenance loads the applicable Skill and effective basis, preserves unaffected requirements, and produces consistent current documents and historical relationships. Discovery and formatting alone do not establish this result.
- Same-day and later reversals preserve stable current paths, continuous per-decision revisions, actual event dates, and accurate direct predecessors. Historical records still explain their original choices. Empty alternatives and risks are valid; unsupported entries are absent.
- Invalid commit types or scopes are rejected. Changed-path selection preserves the specified unions, deletion inputs, consumer precedence, and complete fallback. Internal Skill and rule Markdown remain known documentation inputs.
- Final candidates meet the complete-check identity conditions. Current decisions, rules, Skills, indexes, dictionary entries, and required language versions agree without weakening existing component behavior.
