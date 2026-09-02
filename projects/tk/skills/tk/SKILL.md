---
name: tk
description: Use when the user names tk or an existing Task, supplies a Task ID, path, branch, or material path, asks for catchup or a Task operation, or when a permissive project has work that clearly merits durable cross-step or cross-session state.
---

# tk

Use tk for persistent, project-local Tasks. A Task is a temporary project effort worth preserving. Creating one does not imply a commitment to execute or complete it.

The runtime owns Task identity, metadata, relationships, lifecycle, paths, Git policy, persistence, migration, and cleanup rules. You decide whether tk applies, report authorization truthfully, maintain useful Task material, and close work only with current user confirmation.

## Decide whether tk applies

Use tk when the user:

- names `tk`, catchup, a Task operation, or Task management;
- provides a Task ID, Task name, Task path, branch, `TASK.md`, `tk.toml`, or material path;
- asks to find, create, read, continue, record, update, close, reopen, rename, migrate, or check a Task.

In a permissive project, you may also create a Task for work that clearly benefits from durable state across several steps or sessions. Quick answers, temporary checklists, routine one-session edits, and casual ideas do not need a Task.

Loading this Skill does not bind the session to a Task. Resolve the Task for each operation. You may retain a resolved reference during one continuous conversation, but do not persist session binding in Task state.

## Read focused references

Load only the reference needed for the current operation:

- [Task concepts](./references/concepts.md) for Task scope, identity, metadata, and `TASK.md`;
- [Project setup](./references/project-setup.md) for discovery, `init`, configuration, metadata modes, and Git policy;
- [Create Tasks and subtasks](./references/create-and-subtasks.md) for authorization, status choice, names, and batches;
- [Catch up on a Task](./references/catchup.md) for read-only context reconstruction;
- [Relations and lifecycle](./references/relations-and-lifecycle.md) for relationship changes, close, force close, and reopen;
- [Work activity log](./references/wal.md) for durable event boundaries and WAL failures;
- [Maintenance](./references/maintenance.md) for `check`, rename, migration, representation switching, and GC;
- [Tool and CLI use](./references/tool-use.md) for request context, results, cancellation, and CLI fallback;
- [Material patterns](./references/patterns.md) for optional ordinary-file organization;
- [Glossary](./GLOSSARY.md) for product terms.

## Choose the interface

Prefer the Harness's `tk_search`, `tk_read`, `tk_create`, `tk_update`, `tk_log`, and `tk_exec` tools. MCP Harnesses may show names with a server prefix.

`tk_exec` accepts only `--version`, `init`, `check`, and `rename`. Use the public CLI for `metadata migrate`, `metadata switch`, `gc`, component lifecycle commands, and any other supported command that has no logical tool.

If tools are unavailable, use the `tk` CLI. Do not invoke hidden commands or edit managed metadata, cleanup manifests, or Harness configuration to bypass a runtime refusal.

Pass `cwd` when the intended project is ambiguous. A full absolute Task or material path can locate its own project. actor is accepted only by update, log, and exec rename. On the CLI, `--actor` is accepted only by update, log, and rename. Omit actor when the Harness can supply the most specific available model or Harness value.

## Resolve a Task

Exact operations accept a full UUIDv7, an absolute Task directory, an absolute canonical `tk.toml` or `TASK.md`, or a project-relative Task path.

Names, directory basenames, UUID prefixes, text, regexes, and material paths are search inputs. Search first, then use the returned canonical reference. If several candidates remain plausible, show the relevant candidates and ask the user to choose.

Search includes planning, open, and closed Tasks unless a non-empty status filter narrows it.

## Create Tasks

In a strict project, create a top-level Task only after the user explicitly asks or confirms in the current conversation.

In a permissive project, you may create a Task for work worth preserving without treating creation as an execution commitment:

- use `planning` only when the user clearly wants to preserve an idea, investigation, or plan that is still forming;
- use `open` when the work is being handled;
- report the created Task's name, status, and path in the same response.

Tool calls must report `user_confirmed` truthfully. A schema field is not authorization.

Create child Tasks only for real work units under an open parent. Do not create under a closed parent or reopen it implicitly. A batch contains 1 to 50 independent children under one parent and is not a backlog import. Supply historical `created_at` only when the original timezone-aware timestamp is known.

## Catch up

Catchup is read-only context reconstruction:

1. Read a full ID or exact path with the summary view. Search first for a name, prefix, text, branch, or material path.
2. Extract the objective, current constraints, valid decisions, blockers, and material entry points from `TASK.md`.
3. Use the detailed view only when the summary and bounded WAL are insufficient.
4. Check status, closed ancestors, dependencies, and warnings.
5. Report the current state, unresolved questions, and next concrete action.
6. Continue working only when the user also asked to continue.

Do not recursively enumerate ordinary material. Follow links from `TASK.md` or a directory README as needed.

## Maintain `TASK.md`

Keep `TASK.md` compact and current. It should contain:

- the objective;
- scope and constraints;
- stable decisions that still apply;
- important material links;
- blockers that remain active.

Put command transcripts, individual test runs, chat history, full research, detailed designs, and volatile next steps in ordinary material. Replace superseded facts with current facts. Preserve managed frontmatter in embed projects.

You may edit the body of `TASK.md` and ordinary material. Change managed metadata through tk operations.

## Record durable events

Call log immediately after a fact becomes a durable decision, correction, verified finding, recoverable milestone, validation result, verified collaboration result, or blocker, before starting another work branch.

Use a non-empty single-line message. Put details in the Markdown body. actor is attribution, not identity or authorization.

Do not log routine reads, tool transcripts, temporary plans, progress percentages, unverified guesses, or lifecycle events already recorded by the runtime.

If metadata committed but automatic WAL append failed, read the Task first and append only the missing event. A closed Task rejects new WAL entries.

## Update, close, and reopen

Read the current Task before updating relationships, extra data, or lifecycle.

Before closing, confirm that the effort has ended, descendants and dependencies satisfy the normal rule, `TASK.md` states the current result, and durable evidence has been logged. Then state the exact non-empty reason and obtain current explicit user confirmation.

Force close bypasses only descendant and dependency checks. Use it only when the user explicitly requests that bypass.

A closed Task is read-only. New work normally belongs in a related open Task. Reopen only when the user confirms that the new work still belongs to the original Task and supplies a non-empty reason. Do not reopen beneath a closed ancestor.

## Handle errors and manual repair

Read the stable error code, category, details, and any completed and uncompleted items. For a failed multi-target operation, read or check the current canonical state before issuing a new complete command. Do not assume rollback or a continuation token exists.

Routine changes must use public tk operations. Manually repair `tk.toml` only when it is damaged and tk cannot express the repair:

1. state the exact field and final content;
2. obtain current explicit authorization;
3. make only that edit;
4. run `tk check`;
5. log the repair after the Task becomes readable again.

## Organize ordinary material

Read [Material patterns](./references/patterns.md) only when a real Task needs durable file organization. The patterns are suggestions, not runtime state. Project rules take precedence.

Use a scratchpad for short-lived notes that are not a final deliverable. Use a research package, design revisions, review records, or validation evidence only when the content actually needs that structure. Do not prebuild directories for one-off work.
