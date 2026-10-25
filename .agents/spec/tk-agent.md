# tk Agent behavior

## Goals

Guide Agents to preserve durable work in tk without inventing task scope, lifecycle authority, or runtime rules. English and Chinese variants provide equivalent behavior; each source and installed Skill is understandable without another component.

## Public surface

### Activation

Use tk when the user explicitly mentions a Task ID, name, path, branch, or tk operation. In a permissive project, also create or reuse a Task for work that clearly deserves persistence across steps or sessions. Quick questions, ordinary TODOs, minor one-off changes, and casual ideas need no Task merely because tk is available.

Both CLI Skills use the public CLI for every operation and contain the complete command reference they need. Every source and installed file reference resolves within its own Skill.

### Task selection

A new session has no Task bound by default. Read a unique full reference directly; search for names, prefixes, text, material paths, directory names, or branches before selecting an exact reference. If available information leaves several candidates, show them and ask the user. Retaining a resolved Task in the current conversation does not persist a session binding in Task metadata.

Catchup alone is read-only. Read the summary, `TASK.md` entry point, and necessary materials; report goal, status, dependencies, established conclusions, blockers, and next steps, then stop. A request that also authorizes continuation may resume the work. Context recovery does not repeat completed actions or create new permissions.

### Creation

Search for existing work before creating a duplicate. Choose a name for the overall intended outcome, not merely its first preparation step. Prefer avoiding preparatory words such as analysis, evaluation, or planning, but preserve user-specified names and explicitly research-only scope. A word in the name does not determine lifecycle status.

`planning` preserves ideas, investigations, or plans still taking shape; `open` means active work; `closed` means the effort ended, whether completed, abandoned, infeasible, or superseded. Status is not priority.

Strict creation needs actual current confirmation. Importance alone does not provide it. Permissive creation may save work worth retaining, using planning only when the user explicitly wants to preserve early materials and open when active work has begun. Report the created Task's name, status, and path in the same response.

Create children only under an active parent, without implicitly reopening a closed one. Batch children represent genuine independent work units under the same parent, not an imported backlog. Planning-child confirmation and the data specification's batch boundaries remain in force.

### Materials

Keep `TASK.md` concise: current goal, scope, constraints, stable adopted decisions, important material entry points, and active blockers. Put detailed research, design, execution evidence, and other ordinary material in the Task directory. Do not turn `TASK.md` into a chat transcript, command log, long report, or archive of superseded plans.

Ordinary body edits follow the user's current permissions. Managed metadata changes use public tk operations. A level-one heading is optional, may differ from name and directory, and has no 32-column limit. Edit it directly within body-edit permission; no rename or directory move is required. Rename does not synchronize headings. Prefer ordinary spaces where readable, while preserving explicit wording and meaningful identifiers. The initial generated heading requires no additional cleanup write. Closed Tasks retain their read-only boundary.

### Logging

Record a fact promptly when it becomes a persistent decision, correction, recoverable milestone, validation result, collaboration result, or blocker, before branching into more work. Use a non-empty single-line summary, optional detailed Markdown body, and the most specific available model or Harness attribution.

Do not log routine reads, command traces, tentative plans, speculation, or duplicate lifecycle events already logged by the runtime. After a WAL warning, first read the current Task and log; add only the missing event, without rerunning the committed mutation.

### Lifecycle

Read the current Task before changing relationships, extra, or lifecycle through update. Before closing, confirm that work actually ended, descendants and dependencies satisfy closing rules, `TASK.md` retains current results and entry points, and necessary decisions and validation results are recorded.

Use `tk update <task_ref> --start` without a reason argument. `--close <reason>` and `--reopen <reason>` each carry their own non-empty reason; there is no separate reason option.

Close and reopen each require a non-empty reason and explicit current user confirmation. Use force only when explicitly requested. Do not infer closure from session completion or reopen merely to write a log. New work normally uses a related Task; reopen the original only when the user confirms it still belongs to that effort. Rename and eligible repair do not authorize other closed-Task writes.

### Repair

Use public tk operations for routine changes. If damaged managed metadata cannot be repaired through tk, first state the exact fields and final contents, obtain current explicit authorization, make only those minimal edits, run `tk check`, and record the repair in WAL once usable. Do not edit metadata, cleanup state, or Harness configuration to bypass a runtime rejection.

Read stable error code, category, details, and completed/uncompleted items before deciding whether to retry. After partial failure, use the current canonical state and user goal to issue a new complete command. Do not assume rollback or continuation. Ask only for genuine user decisions, not facts available in tools or materials.

### Material patterns

Records, Deep research, Iterative design, and Scratchpad are optional and may be combined. They organize ordinary files only, adding no schema, metadata, extra keys, runtime state, commands, or automatic directories. Project conventions may override their default paths.

Suggest a pattern only after its signal appears, explaining the material it adds and its maintenance cost. An explicit user request to use it is adoption authorization by itself, regardless of counterexamples to proactive suggestions. After adoption, state the choice briefly in `TASK.md` and link existing entry materials. Do not create empty placeholders, invent past activity, future-date records, or migrate existing Tasks merely to match examples. Adoption grants no Task creation, lifecycle, deletion, or move permission.

Records may be suggested after substantive investigation, implementation, validation, or decision activity occurs on a second local calendar date. Same-day work or a plan to continue later is insufficient. Default files are `records/YYYY-MM-DD-topic.md`. Preserve the context, actions, evidence, and judgments held then; place later corrections in later materials. Keep current conclusions accessible from `TASK.md`. Records replace neither WAL nor formal decisions.

Deep research may be suggested when external sources need collection, retention, or cross-checking, or when a source list and materials already exist. One known document or an ordinary API question is insufficient. Default entries are `research/report.md` and `research/README.md`, with source material as needed. Preserve provenance, access dates, claim evidence, source conflicts, unverified points, and conclusion boundaries. Link the report directly from `TASK.md`.

Iterative design may be suggested after two or more major redesigns, an approach discarded as a whole, or continuing changes to main boundaries. Incremental features, wording edits, and ordinary review fixes do not require a new revision. Default entries are `revision_<N>/README.md` and that revision's materials. Each revision is self-contained; superseded revisions keep their content. A new major redesign starts the next revision, while ordinary corrections update the current one. `TASK.md` exposes one current design entry point.

Scratchpad may be suggested when unfinished notes, output, fragments, small scripts, or temporary files need retention. A brief exchange without retention needs creates nothing. Default location is `scratchpad/`, with free file organization. Move stable content into appropriate ordinary materials and keep obsolete notes distinguishable from current facts. Cleanup still requires deletion or move permission.

Formal decisions use the project's designated mechanism and location; a material pattern does not replace it.

## Acceptance criteria

Installed-Skill scenarios must demonstrate equivalent English and Chinese behavior:

- Strict versus permissive creation, real planning intent, names preserving user scope, duplicate avoidance, and same-response creation reporting.
- Exact versus fuzzy selection, ambiguous candidates, read-only catchup, and continuation only under effective permission.
- Stable `TASK.md` contents, independent body headings, timely useful WAL, and recovery from a failed append without repeating committed work.
- Current authorization for close, reopen, force, and manual repair; no implicit closed-Task writes or runtime-rejection bypass.
- Task operations use the public CLI and its documented commands, defaults, results, and errors.
- Each pattern's signal, counterexample, explicit adoption, useful materials, history preservation, and cleanup permissions, with no added runtime fields or empty scaffolding.

Static Markdown or compilation checks do not establish these Agent outcomes. Observe the installed candidate in the Harness scenarios used for Skill validation.
