---
name: tk
description: Load when durable Tasks are needed, such as when the user names tk, a Task, or catchup, supplies a Task ID, name, path, or material path, requests a Task operation, or work in a permissive project clearly needs state across steps or sessions.
---

# tk Task management

tk is a persistent Task manager. Use the Harness-provided tk tools to manage durable, project-local Tasks. A Task is a temporary project effort worth preserving. It does not imply a commitment to execute or complete the work.

The tk runtime owns metadata, relationships, lifecycle, paths, and persistence.

You decide whether tk applies, pass current authorization truthfully, maintain Task materials, and confirm canonical state after failures.

## When to use tk

Use `tk` when the user:

- mentions `tk`, `catchup`, a Task operation, or Task management;
- supplies a Task ID, name, path, branch, `TASK.md`, `tk.toml`, or material path;
- asks to find, create, read, continue, record, update, close, reopen, rename, migrate, or check a Task.

In a `permissive` project, you may also create a Task when work clearly needs durable state across several steps or sessions.

Quick answers, temporary checklists, routine one-session edits, and casual ideas do not need `tk`.

## Invoke tk

Use the Harness-provided logical tk tools for routine operations:

- logical operations are `search`, `read`, `create`, `update`, `log`, and `exec`;
- Pi and OMP usually expose `tk_search`, `tk_read`, `tk_create`, `tk_update`, `tk_log`, and `tk_exec`;
- Codex and Claude Code use the same operations through MCP, usually as `task.find`, `task.read`, `task.create`, `task.update`, `task.log`, and `task.exec`. The actual prefix depends on the MCP service name, but fields, results, and domain rules do not change;
- use `exec` only for `--version`, `init`, `check`, and `rename`.

Pass the current absolute `cwd` on every call. A complete absolute Task or material path can locate its own project.

`actor` applies only to `update`, `log`, and `exec rename`. Use the most specific available model or Harness value when attribution matters. `actor` is not identity or authorization.

See [Tools](./references/tool.md) for complete fields and results.

## Resolve a Task

Exact operations accept a complete UUIDv7, an absolute discovered Task directory, an absolute managed `tk.toml` or `TASK.md`, or a project-relative discovered Task path.

Search names, directory basenames, UUID prefixes, text, regular expressions, branches, and material paths first, then use the returned exact reference. If several candidates remain plausible, show the relevant candidates and ask the user to choose.

## Create Tasks

Use `create` to create Tasks.

- New Tasks default to `open`. Use `planning` only when the user explicitly wants to preserve an idea, investigation, or plan that is still forming.
- When the user does not supply a name, choose one that states the purpose clearly. Prefer a short imperative, phrase, or noun. Do not combine independent work with conjunctions such as `and`.
- Report the new Task's name, status, and path in the same response.
- Pass `created_at` only when adding a historical Task.
- The tk runtime automatically writes `# <normalized-name>` as the initial `TASK.md` body when it creates a Task. After creation succeeds, edit `TASK.md` with a separate file operation when the Task needs durable goals, constraints, decisions, or material links.

### Authorization

- Project configuration controls the default authorization policy.
- In a `strict` project, create a top-level Task only after the user currently requests or confirms it, and pass `user_confirmed=true`.
- In a `permissive` project, an Agent may create a Task for work worth preserving.

### Subtasks

See [Subtasks](./references/subtask.md).

- Create subtasks only below an `open` or `planning` Task. Do not create below a `closed` Task or force a reopen to create one.
- Do not combine independent work in one subtask name. Create sibling subtasks instead.
- Subtasks may be nested.
- `subtasks_dir` controls only the default creation location. Discovery uses valid carriers below the parent and is not restricted by this setting.

## Catch up

Read [Catch up](./references/catchup.md) when the user explicitly names `catchup` or when an Agent needs the current Task context.

Do not recursively enumerate ordinary materials. Follow `TASK.md` and links from it as needed.

## Record work activity

WAL means Work Activity Log. It records what happened while a Task progressed.

Call `log` promptly for:

- user decisions and corrections;
- meaningful user or external edits;
- findings from exploration, analysis, or evaluation;
- verified interim results;
- recoverable milestones;
- problems found during execution;
- blockers that change the next step.

Do not log:

- file contents that were read;
- commands that were run;
- temporary todos;
- unverified guesses;
- drafts;
- lifecycle events already recorded by the tk runtime.

For each entry:

- `message` is concise, non-empty, single-line text.
- Add `body` only when necessary. It may contain multiline Markdown.

Log an event as soon as it becomes durable, before starting another independent line of work. Do not defer it to a later milestone, test, or session end, and do not merge later milestones or verification results into an earlier entry to reduce calls.

Read [WAL](./references/wal.md) when analyzing or auditing activity history.

## Update Tasks

Use `update` to change Task metadata, status, and relationships. Use host file tools to edit `TASK.md` and ordinary materials.

Lifecycle rules:

- Every lifecycle transition requires a reason.
- `planning` may move to `open` or directly to `closed` when work will not proceed. No other status moves to `planning`.
- `open` may close to `closed`; `closed` may reopen to `open`.
- A Task can close normally only after every descendant and dependency is closed. Use `force` only when the user explicitly asks to bypass that check.
- A `closed` Task is read-only by default. Related new work usually belongs in a new Task with a relationship.

Relationships:

- `depends_on` identifies Tasks that must finish before this Task can close.
- `related_to` identifies related Tasks.
- See [Task concepts](./references/task-concept.md) for graph constraints.

## Task files

The Task directory is the Task's workspace. Use ordinary files and directories for Task-owned content. Create or update them when plans, research, analysis, detailed decisions, checkpoints, handoffs, results, or other substantial content has lasting value or will affect later work or recovery. Do not leave that content only in conversation.

An Agent may create or update ordinary text files without per-file confirmation. When the user has not specified a filename, choose one that states its purpose. Ask before overwriting unclear existing content, deleting or moving materials, writing large or binary artifacts, or crossing the assignment boundary.

Keep `TASK.md` compact. Store only the current objective, scope, constraints, stable decisions that still apply, important material links, and active blockers. Put command transcripts, chat history, long research, detailed designs, check records, and volatile steps in ordinary materials.

You may edit the `TASK.md` body and ordinary materials. Metadata must be changed through tk tools.

Read [Usage patterns](./references/patterns.md) when the user explicitly requests a pattern or when signals such as chronological records, work spanning dates, repeated major redesigns, research, or drafts appear.

## Extensions

Follow additional tk instructions from the user or the applicable `AGENTS.md`. This Skill describes the basic tk behavior; users and projects may add their own rules.

## References

This file covers routine work. Load only the additional reference needed for the current situation.

- Read [Tools](./references/tool.md) for complete tool names, fields, results, cancellation, routing, or installation.
- Read [Task concepts](./references/task-concept.md) when identity, paths, metadata, relationships, or lifecycle is unclear.
- Read [Subtasks](./references/subtask.md) for creation placement, discovery, numbering, or batch failures.
- Read [Catch up](./references/catchup.md) to recover Task context.
- Read [Project storage](./references/project-storage.md) for initialization, project discovery, Git policy, schema migration, or metadata mode switching.
- Read [Maintenance](./references/maintenance.md) for errors, partial commits, damaged managed data, `check`, `rename`, or GC.
- Read [WAL](./references/wal.md) when deciding what to record, reading older history, or handling an append warning.
- Read [Usage patterns](./references/patterns.md) to organize durable ordinary materials.
