# Catch up

Read this file when the user explicitly says `catchup` or when Task context must be restored before work continues.

## Resolve

A complete UUIDv7, absolute discovered Task directory, absolute managed carrier, or project-relative discovered Task path can be read directly. Search names, directory basenames, UUID prefixes, text, regular expressions, branches, and material paths first, then use the returned exact reference.

If several candidates remain plausible, show the relevant candidates and ask the user to choose. Do not guess from similarity.

## Read

Read the summary first. Extract the objective, scope, constraints, stable decisions, blockers, and material links from `TASK.md`. Use the detailed view only when the summary and bounded WAL are insufficient. Use metadata when only status and relationships matter.

Read recent WAL, relationships, and materials linked from `TASK.md` as needed. Do not recursively enumerate ordinary materials or read all history or related Tasks by default.

## Report

Report current status, conclusions that still apply, dependencies or `closed` ancestors, missing evidence, blockers, and the next step. Truncated WAL means the read budget was exceeded, not that a file is damaged.

A catchup-only request restores context. It does not log, modify, reopen, or continue work automatically. When the user also asks to proceed, restore context and then perform the original request. An Agent that restores context during already authorized work may continue that work.
