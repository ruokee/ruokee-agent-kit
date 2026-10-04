# Catch up

Read this file when the user explicitly says `catchup` or when Task context must be restored before work continues.

## Resolve

A complete UUIDv7, absolute discovered Task directory, absolute managed carrier, or project-relative discovered Task path can be read directly. Search names, directory basenames, UUID prefixes, text, regular expressions, branches, and material paths first, then use the returned exact reference.

If several candidates remain plausible, show the relevant candidates and ask the user to choose. Do not guess from similarity.

## Read

Read the summary first. Extract the objective, scope, constraints, stable decisions, blockers, and material links from the complete `TASK.md` body. Use the detailed view only when recent WAL bodies are needed. Use minimal when only metadata, relationships, and managed paths matter.

Read recent WAL, relationships, and materials linked from `TASK.md` as needed. Read daily WAL files directly when older or complete history is necessary. Do not recursively enumerate ordinary materials or read all history or related Tasks by default.

## Report

Report current status, conclusions that still apply, dependencies or `closed` ancestors, missing evidence, blockers, and the next step. Treat recent WAL as bounded context. Only read daily files and report missing history when task-specific evidence requires older entries; never report budget omission itself as a problem or blocker.

A catchup-only request restores context. It does not log, modify, reopen, or continue work automatically. When the user also asks to proceed, restore context and then perform the original request. An Agent that restores context during already authorized work may continue that work.
