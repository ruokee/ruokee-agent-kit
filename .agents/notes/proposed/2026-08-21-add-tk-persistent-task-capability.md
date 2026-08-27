# Agent Note: Add tk as a persistent project-work capability

Status: proposed
Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

English | [中文](./2026-08-21-add-tk-persistent-task-capability.zh.md)

## Motivation

`ruokee-agent-kit` needs a first-party way to carry project work across Agent sessions and Harnesses. Conversations end, context is compacted, and models change. Work that lasts longer than one chat needs its own identity, current state, materials, and history.

The previous Task Plugin proved that this model is useful, but it also exposed problems in the build, metadata file, and public name. Its Python/Nuitka standalone build is slow enough to interrupt routine maintenance. Build caches consume disk and can be deleted, so they do not remove the cold-build cost. `TASK.md` mixes generated frontmatter with human-written Markdown, which forces metadata updates to rewrite a user-owned file. The public name `task` is ambiguous and collides with OMP's subagent tool.

The capability also runs through Codex, Claude Code, Pi, and OMP. Past wrapper/runtime mismatches and generated-schema drift showed that source tests alone cannot prove that the installed tools agree.

tk keeps the Task model and what real use taught, but adopts a new implementation, file-ownership boundary, name, and public contract. It does not preserve the old Python runtime or public API for compatibility.

## Proposal

### Architecture

Add `tk` as a Plugin under `plugins/tk/`, with an OMP/Pi-native package under `packages/tk/`. Both paths use one Rust implementation and one generated contract.

Write the shared implementation in Rust. Faster cold builds are the main reason for replacing Python/Nuitka; cache tuning only improves warm builds and adds storage cost. The migration must measure Rust cold-build time, artifact size, and startup time against the Nuitka baseline rather than assume the rewrite is faster.

The Rust program handles discovery, identity, relationships, lifecycle rules, path boundaries, managed metadata, WAL format, request validation, and structured errors. These rules must not change with the host that invokes them. Host adapters only translate registration and transport. The tk Skill explains creation authorization, recovery, logging, and closure behavior without teaching the implementation layout.

Rust types generate every host schema. Package metadata, wrappers, runtime, generated schemas, and Skill all report the same version and protocol. Release checks call the installed host packages because a correct Rust build can still be shipped with a stale wrapper or schema.

### Domain

A Task is a finite effort that needs a stable identity, materials, and activity history. It may begin as an explicitly saved idea, continue through planning and execution, and end because it was completed, abandoned, found infeasible, or replaced. An early idea becomes a Task only when the user chooses to preserve that specific effort. tk does not rank Tasks or provide a queue, board, or triage process, so it does not become a backlog, todo manager, issue tracker, Agent scheduler, workflow runner, or knowledge index.

Use `tk` for the command, package, Plugin, and tool namespace. The stored object remains Task, with Task ID and `TASK.md` as domain terms. Renaming the tool avoids the OMP `task` collision without renaming the domain object or its files.

### Lifecycle

A Task has exactly three states: `planning`, `open`, and `closed`. The allowed transitions are `planning -> open`, `planning -> closed`, `open -> closed`, and `closed -> open`. An `open` Task cannot return to `planning`. A Task cannot reopen while any ancestor remains `closed`; the user must reopen the ancestor chain or create a new Task outside that closed tree.

`planning` describes an effort that is being recorded, researched, or shaped before execution. It was chosen over `proposed`, which implies waiting for acceptance and already names the Agent Note lifecycle. The old `paused` state added no behavior beyond an `open` Task with a recorded blocker, and `archived` added no behavior beyond `closed`. A required close reason records whether the effort completed, was abandoned, proved infeasible, or was replaced without adding more terminal states.

Creation and every lifecycle transition append a WAL event automatically, so recovery does not depend on an Agent remembering to log the state change. Closing and reopening also require a reason. A normal close requires every descendant and every `depends_on` target to be `closed`; otherwise a parent could claim completion while required work remains active. `related_to` never blocks closure because it records context, not required work. A force close bypasses those checks only after an explicit user request and never changes another Task.

### Agent behavior

Creation defaults to `open` because most new Tasks are ready for execution. `planning` requires explicit early-save intent such as an inbox item, plan, idea, short note, or work to refine later. If the material is not executable and that intent is unclear, the Agent asks instead of storing an ordinary thought as durable work. `planning` replaces the previous Inbox field, fixed Inbox file, and separate capture, start, and abandon workflow.

Creating a child inside an already authorized active Task tree needs no second top-level persistence approval. The child's initial state still follows the ordinary `open` and `planning` rules. A request to create a child under a closed parent follows the closed-parent rule in Lifecycle rather than reopening anything implicitly.

Finishing one request, goal, run, or Agent session does not authorize closing its Task. A Task may span several such boundaries. When an Agent believes the Task is finished, it presents the evidence and proposed close reason, then asks the user. Without approval for that close in the current conversation, the Task remains `planning` or `open`. A normal close still obeys descendant and dependency checks after approval.

The Skill activates for an explicit Task path or directory, an explicit request to create or find a Task, or a clearly durable executable effort when the project uses permissive creation. It does not bind work from a Git branch, working directory, worktree, the word `continue`, or conversation length. Those signals are unstable, and one session may work across several repositories and Task roots. No creation policy may capture a `planning` Task without explicit early-save intent.

Catchup is a read-only Skill phase, not a dedicated tool. It does not stop a compound request after recovery. A closed Task remains read-only; new work normally gets a new Task related to the old one, while reopening requires an explicit choice. This keeps the old completion boundary intact.

Before context compaction, the Agent makes a best effort to preserve the exact Task directory or `TASK.md` path in the resulting context. Generic recent-file lists may omit the Task entry point, so the Skill names it directly. Paths to the next needed Task materials may also be kept. tk does not register compaction hooks or manage conversation history because those mechanisms differ across Harnesses.

### Public operations

The `tk` executable exposes these CLI operations:

- `tk search` finds project-scoped Task candidates and applies the filters defined below;
- `tk read` resolves one exact Task and returns metadata, summary, or detailed views with bounded WAL reads;
- `tk create` creates one top-level Task or a batch of child Tasks under one parent, writing nothing unless every item validates;
- `tk update` changes supported metadata and performs at most one lifecycle action;
- `tk log` appends one durable activity event;
- `tk init` initializes the project Task root and optional sparse project configuration;
- `tk check` performs read-only validation and reports configuration, project, or Task diagnostics;
- `tk rename` changes a Task name and directory through the managed path rules; and
- `tk --version` reports the runtime version and protocol without accessing a project.

Every command calls the same Rust contract and returns structured errors. The CLI does not define behavior that the Harness tools lack.

### Harness integration

Codex and Claude Code connect through the packaged MCP server. It exposes six tools:

- `tk_read` resolves one exact Task and returns metadata, summary, or detailed views with bounded WAL reads;
- `tk_search` finds project-scoped candidates and applies the filters defined below;
- `tk_create` creates one top-level Task or a batch of child Tasks under one parent, writing nothing unless every item validates;
- `tk_update` changes supported metadata and performs at most one lifecycle action;
- `tk_log` appends one durable activity event; and
- restricted `tk_exec` accepts only `--version`, `init`, `check`, and `rename` argument vectors and never invokes a shell.

Pi and OMP support native extensions, so their packages register the same six operations as native tools instead of starting the MCP server. Rust types generate the MCP and native schemas. Adapters only map names, registration, transport, `cwd`, and available actor context; they do not add domain behavior.

An Agent uses the integration intended for its current Harness: MCP in Codex and Claude Code, native tools in Pi and OMP. It does not bypass a working tool entry point to call the CLI. If the preferred entry point is missing or fails, the Agent may use the Harness Bash tool to run the equivalent `tk` CLI command as a last resort. This fallback still follows the same authorization, discovery, validation, and lifecycle rules, and it never authorizes direct edits to `tk.toml`.

Each shipped Skill language variant includes a local `references/troubleshooting.md`. It explains how to check registration and version agreement, run `tk check`, choose an equivalent CLI command, quote structured input safely, and return to the Harness tool after recovery. A successful CLI fallback proves that the runtime works; it does not prove that the broken MCP or native integration is healthy.

Other domain Skills may use the same Task operations after user intent permits persistence. A common contract is enough for composition; per-Skill commands, callbacks, and third-party schemas would make tk depend on workflows it does not own.

### Managed files

Every Task directory contains `tk.toml` and `TASK.md`. tk owns the structured state in `tk.toml`; people and Agents own the plain Markdown in `TASK.md`. Separating the files prevents metadata updates from parsing and rewriting user text. `tk_create` initializes both files. `tk_update` accepts no body or generic Markdown patch field, so host file tools remain the only way to edit `TASK.md` and ordinary materials. A missing or invalid managed file is an error; tk reports it rather than inventing contents.

Agents use tk operations for ordinary `tk.toml` changes because direct edits bypass relationship, lifecycle, and path checks. If the file is damaged and no tk operation can express the repair, an Agent may edit it only after explaining the exact change and receiving explicit user authorization in the current conversation. It then validates the result with tk and records the repair through `tk_log`.

Current `tk.toml` metadata is authoritative. WAL is an activity record, not a replay journal, so tk never reconstructs current state from it. WAL keeps decisions, corrections, recoverable milestones, verification results, verified collaboration results, and blockers. Creation and lifecycle operations write their own events; Agents use `tk_log` for other durable events. Existing entries are append-only. Corrections become new entries rather than edits to history. Work-product bodies, tool chatter, transcripts, and routine session summaries stay out of WAL.

### Task materials

`TASK.md` answers three recovery questions: what this Task is for, what remains true, and where to read next. It is a navigation entry point, not a container for work products or progress history. Keep it short. It may contain the current purpose and boundaries, conclusions and constraints still in force, a stable next direction, and links to important materials. A fact belongs there only when it should remain useful across another session or handoff until a later decision replaces it. A phase order may qualify; a failing test or current substep does not. These are content rules, not required headings or a template.

Detailed plans, research, designs, investigations, checkpoints, handoffs, command output, verification evidence, and changing progress go in ordinary material files when another session may need them. Transient execution state stays in the current conversation. `TASK.md` may say why a material matters and link to it, but does not copy its body. Any result with standalone value, supporting evidence, several reasoning steps, or an independent update cycle belongs in its own file. tk stores results needed for recovery, not a transcript of how the Agent produced them.

Navigation uses progressive disclosure so `TASK.md` does not churn whenever a material file changes. A small, stable collection may link each document and explain its purpose. As the collection grows or changes often, `TASK.md` describes the collection and points to its directory or a useful local index. File-level navigation then stays at that lower level. Three records may be clearer as direct links, while a dozen records may be clearer as one described `records/` entry. The numbers illustrate the choice; they are not thresholds.

When current truth changes, Agents replace the old statement in `TASK.md`; WAL keeps the chronology. A tool call, progress step, WAL event, or one file added to or removed from an already described collection does not by itself justify an update. Before writing detail or a soon-stale progress note, move reusable content to an ordinary material and leave a durable summary and entry point. Do not persist content with no later value. If `TASK.md` has already accumulated detail, volatile status, or a full file inventory, the next relevant edit moves or condenses that content without losing anything reusable. tk sets no required artifact list, filename scheme, line limit, or schema for ordinary materials.

### Material patterns

Each shipped tk Skill language variant includes a local `references/material-patterns.md`. It documents four optional reference patterns for organizing ordinary Task materials:

- chronological records for substantive work that accumulates across local calendar dates;
- deep research for source collection, provenance, cross-validation, and bounded claims;
- iterative design for major designs that replace earlier designs rather than merely refine wording;
- experiments for work that must preserve variables, baselines, repeated runs, results, and decision criteria.

These four patterns come from existing Task use, but they are not a complete catalog. They are Skill guidance, not managed metadata, lifecycle states, required directories, or runtime rules. The reference lists signals, signs that a pattern does not fit, a default organization, and the maintenance it creates.

When the signals fit, the Skill explains the proposed structure and its maintenance cost, then asks before adopting it. No question is needed when a project rule already requires the pattern or the Task already uses it. A matching directory name alone does not authorize the Skill to fill in missing structure. The Skill does not pre-create empty materials or apply a pattern to one-off work. Project rules may add, replace, or limit patterns, directory names, and maintenance rules. Those project rules take precedence.

After adoption, `TASK.md` keeps only the useful top-level entry points. It does not gain a formal pattern field or list every record, revision, source, or experiment. Detailed navigation stays in the ordinary materials, where it can change without rewriting the Task entry point.

### Project configuration

tk has built-in defaults and an optional project configuration at `.agents/tk_config.toml`. Projects need different roots, child layouts, Git policies, and creation policies; no current use case requires user-level configuration or storage outside a project. tk therefore has no user-level configuration, detached mode, global registry, or `data_dir`.

The defaults are:

```toml
task_root = ".tk"
subtasks_dir = ""
git_policy = "none"
creation_policy = "strict"
```

`strict` creates a top-level Task only after the user explicitly requests or confirms persistence in the current conversation. `permissive` may create a top-level Task for an evidently durable, multi-stage, or cross-session effort that the user has chosen to pursue, and tells the user in the same turn. Neither policy captures undecided work as `planning` without explicit early-save intent.

The project file stores only values that differ from these defaults, so a configuration records decisions rather than copies defaults. Missing fields inherit built-in values. Unknown fields, invalid types, invalid enum values, and invalid paths are errors. WAL read budgets remain built-in or per-call options because no project-level need has been shown.

### Initialization

Without a project configuration, `init` with no options creates the default `.tk` root and no configuration file. With a valid configuration whose resolved root is absent, `init` creates that root. Non-default options create or rewrite a sparse `.agents/tk_config.toml` and create the resolved root. The root itself marks initialization because it is the resource that operations need. A separate marker would duplicate that fact, while a configuration may validly exist before the root is created.

Running `init` on an initialized project is an error unless the user passes `--force`. Forced initialization changes configuration only. It rewrites the sparse differences, removes the file when every value returns to its default, and ensures the newly resolved root exists. It never clears, overwrites, migrates, or deletes Task data. If the root changes, the old root remains untouched and the result reports both paths. Discovery then uses the new root; an explicit path can still reach the old one. From an explicit project directory, `init --force` may replace an invalid configuration as a recovery operation. Limiting force to configuration recovery prevents an initialization command from becoming a data migration or deletion command.

### Version-control policy

Git is the only version-control system tk understands because it is the one used by the target projects. `git_policy` is the only version-control field.

`git_policy = "track"` requires a Git worktree and requires both the Task root and `.agents/tk_config.toml` to remain visible to Git rather than ignored. tk does not require every file to be staged or committed and does not require a clean worktree.

`git_policy = "ignore"` requires the Task root to be ignored. It places no tracked or ignored constraint on the project configuration. `git_policy = "none"` performs no Git check and does not require a Git project.

tk may call read-only commands such as `git rev-parse`, `git check-ignore`, and `git ls-files`. Asking Git directly avoids reimplementing nested ignore rules, repository excludes, user excludes, and worktree behavior. tk never runs a Git command that changes the worktree, index, configuration, or history, and it never edits `.gitignore`.

Every project operation except `init` and operations that do not access a project performs the Git-policy preflight before reading or writing Task state. Reads fail too: allowing them would make the configured storage rule advisory and would produce different policy behavior for the same root. A mismatch rejects the operation with a precise diagnostic. `init` may create the root despite a mismatch because no later operation can satisfy the policy until the root exists. It reports that the policy is not ready and leaves later operations blocked until the user fixes the Git state.

### Discovery

tk resolves Task locations in code rather than asking an Agent to infer them. An explicit Task directory, `TASK.md`, `tk.toml`, or material path takes precedence over the tool call's `cwd`. A material path resolves to its nearest ancestor containing Task `tk.toml`; tk then resolves the owning Task, root, project configuration, and Git policy. Explicit paths come first because real work often crosses repositories, such as a Task kept in a notes project while its code lives elsewhere.

A prompt or session may access any number of Task roots through independent tool calls. There is no persistent current Task, current project, or actor binding because such state would become wrong as soon as work switches repositories or Agents. A bare Task ID or name is searched only within the root resolved from an explicit project directory or the tool call's `cwd`; tk never scans sibling repositories, a user directory, or a global registry.

Operations without a Task target, such as search and top-level creation, use an explicit project directory when supplied and otherwise use `cwd`. Discovery stops at the current Git root. When no enclosing Git root exists, `cwd`-based discovery checks only `cwd` rather than walking arbitrary ancestors. These boundaries prevent a nested caller from borrowing configuration from an unrelated ancestor. A nested non-Git caller supplies an explicit project directory or Task path. Finding a project configuration whose resolved root does not exist reports an uninitialized project and does not borrow a parent project's root.

### Project boundaries

`task_root` must be a non-empty project-relative path. It cannot be the project root, an absolute path, contain `..`, or resolve outside the project through a symbolic link. `subtasks_dir` may be empty, which places children directly under their parent. A non-empty value follows the same relative-path and symbolic-link rules inside the parent Task. Managed Task, material, and WAL access cannot escape the resolved root. These checks keep project-scoped operations from reading or writing an unrelated location through configuration or a symbolic link.

Structured `parent`, `depends_on`, and `related_to` relationships stay within one Task root because tk has no global registry that could resolve or maintain cross-project targets. A write uses the target Task's root and rejects self-relations, unknown new targets, dependency cycles, and references from another root. An update may remove an existing relation whose target has gone missing. Markdown may link to work in another project when project policy allows it. tk treats that text as opaque and does not scan, validate, maintain, or apply lifecycle rules to it.

### Search

`tk_search` returns `planning` and `open` Tasks by default so completed history does not crowd current work. It includes `closed` Tasks for an explicit historical or status search. An exact Task directory, `TASK.md` path, or full ID may read a closed Task, and an explicit lookup may continue into closed Tasks after active candidates do not match. Ordinary search excludes a descendant of a closed parent only when that descendant is also `closed`. An active descendant left by force close remains visible because hiding it would make unfinished durable work disappear from ordinary recovery. The result identifies its closed ancestry.

Search matches identifiers, names, directory names, paths, supported metadata, and optional `extra` filters. `extra` remains available because existing projects use their own classifications. Creation may set it; update performs shallow top-level set and remove operations; search compares every supplied top-level key and value exactly with AND semantics, treating a nested value as one whole structured value. There are no dot paths, deep merge, range operators, containment operators, fuzzy matching, or query DSL because current use only needs metadata and path candidate search. A search candidate never authorizes mutation; writes require a precise reference.

### Concurrency

Multiple Agents may read and write one Task root. Most current use has one Agent, while an Agent decision takes seconds and a managed-file write takes milliseconds. The observed collision risk does not justify locks, compare-and-swap, merge rules, or a recovery protocol. tk therefore accepts last-writer-wins behavior and makes no cross-process isolation claim.

Each request still validates all input before writing, so a batch containing an invalid child Task writes nothing. This protects one request from partial application; it does not coordinate separate processes. Atomic file replacement may prevent a torn metadata file but provides no transaction isolation. A successful WAL append writes one complete entry, yet concurrent appends have the same limitation. Reads report malformed entries instead of using WAL to guess current state.

### Verification

Validate every installed entry path, not only the Rust binary. Exercise the five high-frequency CLI commands and the management commands through the packaged executable. Then exercise all six MCP tools through Codex and Claude Code, and all six native tools through Pi and OMP. Previous releases paired wrappers with the wrong runtime version and shipped an adapter schema that rejected a valid batch, so each route must compare the reported version and protocol and call the installed runtime.

The smoke scenarios cover bounded read views, durable log append, restricted management commands, child batches under one parent, and rejection of a batch with invalid input before any write. They also cover initialization, discovery, managed-file diagnostics, lifecycle transitions and automatic WAL events, default `open`, active descendants left by force close, closed filtering, exact `extra` search, relationship rules, close checks, Git-policy rejection, and the absence of `branch`, `paused`, `archived`, Inbox behavior, migration entry points, and old `task_*` aliases.

Review Skill scenarios for planning authorization, explicit close authorization after a successful goal, compound catchup, closed-Task handling, authorization-gated repair of damaged `tk.toml`, refusal of an unauthorized repair, navigation-only `TASK.md` updates, omission of soon-stale progress, progressive disclosure for small and large material collections, preservation of reusable detail when cleaning `TASK.md`, material-pattern adoption, project overrides, signs that a pattern does not fit, preservation of an exact Task path across compaction, Harness entry selection, and refusal to bypass a working tool. A controlled missing-tool or failed-tool scenario must follow `references/troubleshooting.md`, use the equivalent CLI command through Bash, and keep the original integration failure visible. Run one representative real-Agent smoke with Luna in OMP. Model wording need not match byte for byte across hosts; the observable decisions and tool behavior must match.

## Alternatives considered

**Keep the Python/Nuitka runtime and improve its cache.** This avoids a rewrite, but it does not remove cold builds. The cache also consumes disk and may be cleared. Cold-build delay has already affected routine maintenance, so the proposal changes the build path instead of tuning the cache again.

**Keep Task metadata in `TASK.md`, or make `TASK.md` optional.** Managed frontmatter leaves tk and people editing the same file. Making the file optional avoids that conflict for metadata-only Tasks but removes the stable human entry point. Separate required files give each owner one file.

**Keep `task` as the public name.** The name is familiar but ambiguous, and it collides with OMP's subagent tool. Renaming the tool to `tk` is smaller than asking every conversation to disambiguate two unrelated operations.

**Retain the previous Inbox, status, and branch fields.** Inbox contradicted the claim that every Task represented decided work. `planning` now covers explicitly saved early work. `paused` and `archived` had no distinct behavior, while a branch is project context rather than Task identity.

**Bind work through a persistent current Task, branch, working directory, or `continue`.** These shortcuts fail when one session crosses repositories, the Task lives in a notes project, or the branch changes. Explicit paths and project-scoped lookup make each operation explainable without hidden session state.

**Archive conversation context or depend on Harness compaction hooks.** That would preserve more chat, but not necessarily the decisions and materials another Agent needs. Harness hooks also differ by host. tk stores reusable results in Task materials and asks the Skill to preserve the exact Task path during compaction.

**Retain user-level configuration, detached storage, a global registry, and managed cross-project relationships.** No current use requires them. They would add hidden lookup and make project behavior depend on machine-level state. Project-local roots plus explicit paths cover current work; Markdown can link to another project without claiming managed lifecycle semantics.

**Let reads skip the version-control preflight.** Writes would still enforce the policy, but reads would succeed while the configured storage rule was violated. That would make the rule advisory and apply different policy behavior to the same root, so reads fail too.

**Add locks, compare-and-swap, or conflict resolution.** Current use is mostly single-Agent, and managed writes are much shorter than Agent reasoning. The collision risk remains accepted; adding a coordination and recovery protocol now would solve an unobserved problem.

**Migrate old Task data and support both formats.** The target format must settle before a migration can be designed. The new `.tk` default leaves old `.task` data untouched, while a later migration can be reviewed without forcing compatibility branches into every tk operation.

**Close a Task when the current goal or session succeeds.** One Task may span several goals and sessions. Only the user can decide that the durable effort has ended, so closure stays explicit.

**Use MCP on every Harness.** This would reduce the number of adapter forms, but Pi and OMP already provide native extension APIs. Starting an MCP server there would add a process and protocol hop without adding Task behavior.

**Make Bash and the CLI the normal Agent entry.** The CLI is available across hosts, but shell calls lose tool-level schemas and make structured quoting errors easier. They can also hide a broken MCP or native installation. Bash remains a last-resort recovery path.

**Stop validation at Rust tests and the implementation binary.** Previous package releases showed that wrappers, runtime versions, and generated schemas can disagree after source tests pass. Installed-host smoke tests cover the boundary where those failures occurred.

## Acceptance criteria

1. `plugins/tk/` and `packages/tk/` use the same Rust implementation and generated contract. The migration records Rust cold-build time, artifact size, and startup time beside the Nuitka baseline.
2. Every Task has a stable identity, authoritative `tk.toml`, required plain Markdown `TASK.md`, and the three-state lifecycle defined here. Creation and lifecycle changes append WAL events automatically.
3. The CLI exposes `tk search`, `tk read`, `tk create`, `tk update`, `tk log`, `tk init`, `tk check`, `tk rename`, and `tk --version`. A batch of child Tasks under one parent validates completely before writing.
4. Codex and Claude Code expose `tk_read`, `tk_search`, `tk_create`, `tk_update`, `tk_log`, and restricted `tk_exec` through MCP. Pi and OMP expose the same six operations as native tools. Their schemas come from the Rust contract, the Skill contains only observable Agent rules, and adapters contain no competing domain behavior.
5. The Agent uses the current Harness's supported MCP or native entry point. It uses Bash with the equivalent CLI command only when that entry point is missing or fails, follows the local `references/troubleshooting.md`, and does not treat CLI success as proof that the Harness integration works.
6. tk exposes no `TASK.md` body-editing parameter. Missing or invalid managed files produce diagnostics instead of guessed content. Ordinary `tk.toml` changes use tk operations; a direct repair requires explicit user authorization, tk validation, and a `tk_log` record. Metadata updates never rewrite `TASK.md`.
7. The Skill keeps `TASK.md` as a short navigation entry point, leaves soon-stale progress out, uses progressive disclosure, stores detailed results in ordinary materials, updates current summaries in place, and moves accumulated detail without losing reusable content.
8. Finishing a request, goal, run, or session never closes a Task automatically. Closing requires user approval for that close in the current conversation and still obeys lifecycle checks.
9. Every shipped Skill language variant includes equivalent local guidance for chronological records, deep research, iterative design, and experiments. The patterns remain optional and non-exhaustive. Project rules may add, replace, or limit them and take precedence on conflict.
10. Creation policies, sparse configuration, initialization, forced configuration replacement, path boundaries, Git policy, and discovery behave as defined here.
11. Structured relationships enforce same-root, target-existence, self-relation, and dependency-cycle rules. tk treats cross-project Markdown references as opaque text.
12. `tk_search` filters for active work by default, keeps active descendants left by force close visible, and matches top-level `extra` fields exactly. Mutations require precise references.
13. Every request rejects invalid input before writing. tk makes no lock-based or transaction-level isolation claim for metadata or WAL.
14. tk contains no old-data migration, Python compatibility path, old `task_*` alias, detached registry, or user-level configuration.
15. Package, wrapper, runtime, schemas, and Skill agree on version and protocol.
16. The packaged CLI, Codex and Claude Code MCP entry points, and Pi and OMP native tools pass the end-to-end smoke scenarios, including rejection of a child batch containing invalid input and checks for removed behavior.
17. OMP with Luna passes one representative Agent-behavior smoke. Model wording may differ across hosts, but decisions and tool behavior must agree.
18. tk does not add cross-Task prioritization or triage, todo management, Agent orchestration, issue tracking, workflow execution, or knowledge indexing.

## Risks

People may confuse `tk` with Tcl/Tk. Package names, the README opening, the Skill description, and `tk --help` must identify it as the persistent project-work capability.

The root directory marks initialization. An unrelated directory at the configured path may therefore look initialized. Diagnostics must report the resolved project and root before an Agent acts on that directory.

A Git rule change can make the configured policy fail and block both reads and writes. tk does not repair Git state, so the diagnostic must identify the failed policy and path.

Concurrent writes can lose a metadata update, and WAL event order across processes is undefined. A crash or full disk can leave an incomplete trailing entry. Reads report that entry as malformed rather than hiding or repairing it.

`git_policy = "none"` provides no version-control or backup guarantee. The project remains responsible for protecting its Task data.

An Agent may still put volatile progress in `TASK.md` or apply a material pattern without enough evidence. Skill scenarios must cover both mistakes.

A Bash fallback may hide a broken MCP or native installation and is more exposed to quoting or payload mistakes. The Skill restricts it to failed or missing tool entry points, keeps the original error visible, and does not count CLI success as Harness verification.

A correct Rust contract does not guarantee a correct package. A stale wrapper or generated schema may still ship with the runtime, so release checks must call the installed packages rather than only the source binary.
