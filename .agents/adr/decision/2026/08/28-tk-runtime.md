# tk runtime

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Reverses: [tk runtime](../../../archived/2026/08/28-r1-tk-runtime.md)

English | [中文](./28-tk-runtime.zh.md)

## Motivation

Keep Task behavior in one Rust runtime behind the public CLI.

People, scripts, and Agents need the same domain rules, persistence, output, cancellation, and resource limits. Structured expected failures must preserve operating-system errors and actual partial commits.

## Decision

### Runtime implementation

One Cargo package under `projects/tk/` builds `tk`, with the fixed Linux path `$HOME/.local/bin/tk`. Interface, application, domain, persistence, and maintenance responsibilities remain separate. Every command uses a short-lived process and resolves its working directory, project, and Task state again. There is no background process, project graph cache, or resident index.

### CLI contract

The CLI is the sole public interface. Its [reference](../../../../../projects/tk/docs/design/cli-reference.md) specifies command names, arguments, defaults, results, stable errors, and exit statuses. JSON inputs require object roots and reject duplicate keys at every depth. Agent authorization must reflect the actual user request.

Creation accepts no body input: `tk create task` rejects `--body`, and child Task items reject `body` as an unknown field. Creation writes `# <normalized-name>` as the initial body; subsequent body editing is ordinary file maintenance.

`tk rename` retains exact references and repairs eligible old string names or recognizable generated suffixes. Validation outside the repair scope remains enforced. A path move with old-path references fails before writing with a conflict and exit status 3. `--ignore-brokenlinks` permits the move without changing reference files. Dry-run reports the complete plan and references without writing.

### Request context

Explicit `--cwd` takes precedence over the runtime process directory. A complete absolute Task or material path may locate its own project independently. Context is not persisted as Task state.

actor applies to update, log, and rename, defaults to `cli`, and provides WAL attribution rather than identity, authorization, or assignment. Agents supply their available model or Harness identity explicitly where attribution matters.

Project discovery is independent of Git policy. Reads, searches, and diagnostics stay available without Git policy rejection. Persistent project writes run the shared Git check immediately before their first write.

### Resource boundaries

Search processes candidates incrementally and retains at most the best 100. Checks, relationship graphs, schema migration, and representation switching may use memory proportional to the Task count. Subprocess stdout and stderr each have a 1 MiB limit.

`tk read` defaults to `summary`. `minimal` reads neither body nor WAL. `summary` returns the complete Task body and recent WAL entries without entry bodies, defaulting to 5 entries and 4000 bytes. `detailed` includes WAL bodies and defaults to 50 entries and 16000 bytes. Explicit budgets range from 0 to 50 entries and 0 to 16000 bytes. Measure compact JSON UTF-8 bytes after view projection, select complete entries from newest to oldest within both budgets, then return them chronologically. Omission adds no truncation field, warning, or diagnostic. Full history is available through daily files, without pagination or a full-history read mode.

`tk check` independently streams every regular daily WAL file and entry without fixed total file, byte, or entry limits. Required I/O failures identify the path; cancellation makes the check incomplete. Valid WAL size alone never causes `wal_truncated`.

### Commit boundaries

Single-file writes observe cancellation before atomic replacement and complete any replacement already started. Multi-target operations observe cancellation between commit points. Cancellation before the first write leaves no persistent change; after a commit it reports the same completed and uncompleted boundary as I/O failure.

Expected domain and environment failures use the public result envelope. Panics, killed processes, and malformed output remain process or internal failures, not fabricated domain results. A partial commit includes completed targets, uncompleted targets, and the original error, without automatic rollback or continuation state. WAL append failure after metadata commit is a warning.

### Contract ownership

Runtime, CLI contract, Task schema, component format, and cleanup manifest versions remain separate. `tk --version --output json` reports the first four. The [interface specification](../../../../spec/tk-interface.md) fully states required behavior, fields, defaults, failure semantics, limits, and compatibility. Public references are independently usable; [runtime design](../../../../../projects/tk/docs/design/runtime.md) explains implementation rather than supplying missing requirements.

## Alternatives considered

None

## Consequences

Short-lived calls avoid cache invalidation and stale graphs at the cost of process startup and repeated bounded discovery. A runtime defect can affect every caller.

CLI names, argument ownership, JSON fields, errors, and versions are a public compatibility boundary. Changes require coordinated runtime, Skill, documentation, and validation updates.
