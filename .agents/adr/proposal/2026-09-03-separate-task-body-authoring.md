# ADR proposal: Separate Task creation from body authoring

Decision owner: Ruokee
Draft writer: Mind (OMP GPT-5.6 Sol)

English | [中文](./2026-09-03-separate-task-body-authoring.zh.md)

## Motivation

The [tk Task data model](../decision/2026-09-03-define-tk-task-data-model.md) makes `TASK.md` ordinary content maintained by the user and Agent. Task creation still accepts body text through the CLI and logical create tool, so the runtime can create managed state and author ordinary content in one request.

Agents already receive the created `task_dir` and have file-writing tools. Writing the body separately keeps the runtime responsible for creating a valid Task while leaving content structure and detail to the Agent. It also gives each tool call one target. A creation error requires retrying only create, while a body-writing error requires retrying only the file write. The Agent does not need to reconstruct Task creation arguments and Markdown quoting in one shell command.

## Proposal

### Creation contract

Remove `--body` from `tk create task`. Remove `body` from the logical create request for both top-level Tasks and child Task items. Calls that still provide the removed option or field fail as invalid requests. `tk log --body` remains unchanged because it writes a WAL entry rather than Task content.

The runtime always creates the initial Task body from the normalized name as:

```markdown
# <normalized-name>
```

In split mode, `TASK.md` contains only that heading. In embed mode, `TASK.md` contains the required managed frontmatter followed by the same heading. The heading becomes ordinary body content after creation. Later metadata changes, including rename, do not manage or rewrite it.

### Agent behavior

Creation results continue to return the absolute `task_dir`. When a request needs durable goals, constraints, decisions, or material links, the Agent writes `TASK.md` in a separate file operation after creation. tk does not add a body update command, stdin body input, or another create-time content field.

The `tk`, `tk-zh`, `tk-cli`, and `tk-cli-zh` Skills must teach the separate creation and file-writing sequence. Pi and OMP adapters must stop mapping create body data to the CLI. Generated MCP and native schemas must reject the removed fields.

### Contract version

This is a clean cutover. Do not retain an alias, compatibility field, or deprecation path for create body input. Increment the CLI contract version when implementing the change. Task schema and component format versions remain unchanged because neither persisted metadata nor the component archive format changes.

## Alternatives considered

**Remove only the CLI option.** The logical tool and child Task item could continue accepting body text. This would give CLI and tool callers different creation behavior and keep ordinary content inside the runtime request contract.

**Create an empty body without a heading.** This would make split `TASK.md` zero bytes and embed `TASK.md` frontmatter-only. Keeping the existing generated heading makes a newly created Task identifiable without adding configuration or another input.

## Acceptance criteria

1. `tk create task --help` does not list `--body`, and passing it returns a request error with exit status 2.
2. Top-level logical create requests and child Task items have no `body` field. Generated schemas reject it as an unknown field.
3. Split creation writes `tk.toml` and a `TASK.md` containing only the normalized-name heading.
4. Embed creation writes valid managed frontmatter followed only by the normalized-name heading.
5. Pi and OMP adapters no longer map create body data. Their contract and argument-mapping tests cover the removed field.
6. The `tk`, `tk-zh`, `tk-cli`, and `tk-cli-zh` Skills instruct the Agent to create the Task first and write `TASK.md` separately when content is needed.
7. `tk log --body`, Task body reads, metadata body preservation, and representation switching retain their current behavior.
8. The implementation increments the CLI contract version without changing the Task schema or component format versions.
9. The English and Chinese CLI reference and tool API documents remove create body input and document the always-generated normalized-name heading.

## Risks

A caller built against the old contract can fail after upgrade when it sends create body data. Contract-version checks and regenerated Harness components must reject the mismatch before exposing incompatible tools.
