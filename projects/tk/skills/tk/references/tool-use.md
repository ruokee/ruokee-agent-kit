# Tool and CLI routing

## Six logical tools

Use the Harness-native or MCP forms of:

|Operation|MCP|Pi and OMP|
|-|-|-|
|Search|`search`|`tk_search`|
|Read|`read`|`tk_read`|
|Create|`create`|`tk_create`|
|Update|`update`|`tk_update`|
|Log|`log`|`tk_log`|
|Administrative exec|`exec`|`tk_exec`|

`tk_exec` accepts only `--version`, `init`, `check`, and `rename`. It invokes the public parser without a shell. Use the CLI directly for migration, representation switching, GC, schema generation, component lifecycle, help, MCP startup, and other commands outside that whitelist.

## Context

Use explicit `cwd` when project discovery is ambiguous. Otherwise the adapter uses the Harness session directory, then the runtime process directory. A complete absolute Task or material path may locate another project.

actor is accepted only by update, log, and exec rename. The CLI accepts `--actor` only on update, log, and rename.

## Results

Successful tools return `ok:true` with `data` and optional warnings. Expected failures return `ok:false` with a stable `error.code`, `category`, human-readable `message`, and structured `details`.

Do not branch on message text. For multi-target failure, inspect `completed`, `uncompleted`, and the original error. The runtime does not supply a continuation token or automatic rollback state.

Keep transport failures separate from domain failures. A killed process, malformed stdout, protocol failure, or output-limit error is not a fabricated tk result.

## Cancellation

Cancellation before the first persistent write leaves no domain change. A multi-target command observes cancellation between commit points. If work has already committed, the result uses the same completed and uncompleted boundary as an I/O failure.

## Routing boundary

Do not retry a covered logical operation through the direct CLI when the tool is unavailable, refuses the request, or fails. Report the integration or transport failure. Direct CLI use is reserved for public commands that have no logical tool or fall outside the `exec` whitelist.

Do not replace a failed public operation with a hidden command or direct edits to managed metadata, cleanup manifests, or Harness configuration.
