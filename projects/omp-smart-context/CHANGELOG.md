# Changelog

[中文](./CHANGELOG.zh.md)

## 0.1.5

- Bind request alignment to active native CLI/SDK sessions and actual sends, including delayed extension loading. Remove factory-time construction observation.
- Leave preinstalled Handoff method wrappers untouched. Disable only Handoff alignment while Remote remains available.
- Preserve canonical Eval snapshots on resume and keep unpersisted display snapshots separate from retained history.
- Support opaque compaction items without ids and known response-stream padding differences while preserving native bytes and options.
- Count aligned, rewritten, and rejected requests on every physical send, including retries.

## 0.1.4

- Return every active Pin body verbatim from `list`, with its metadata and branch usage. Preserve single-entry `get`, full-set `show`, and width-aware interactive labels.
- Mark truncated interactive Pin labels with an ellipsis while preserving their entry ids.

## 0.1.3

- Support Anthropic Handoff with native API-key and OAuth transport. Restore proved system prefixes while preserving native generation policy, identity, caching limits, and document adoption.
- Confirm references at final transport and reject stale responses or revoked retries. Keep caller-owned fetch implementations native.
- Keep reference status tied to the current ordinary dispatch, including no-tool and unverified caller-owned transport cases.
- Reject conflicting system cache TTLs and unknown tool-choice fields before projecting Anthropic requests.

## 0.1.2

- Clarify Pin retention guidance so short-lived information is not excluded solely because of its lifetime.

## 0.1.1

- Clarify when the Agent should proactively pin, update, delete, or leave information unchanged, according to its use for later action.
- Direct capacity refusals at the exceeded limit: shorten an oversized body or remove obsolete branch content, preserving valid information and reviewing the whole active set before retrying.

## 0.1.0

First release of `@ruokee/omp-smart-context`:

- Provide Remote and Handoff request alignment, missing compaction usage recording, optional model prompt rules, and optional Pin in one self-contained package.
- Keep independent switches and failure boundaries. Pin and model rules default off; usage recording defaults on.
- Use one native activation snapshot and `/smart-context` for read-only status. Preserve `/ctx-pin`, `ctx_pin`, existing rule files, and supported Pin journal records.
- Replace smart-cache, standalone context-pin, and QoL's migrated modules. Follow [Migration](./docs/migration.md), including moving `compactionCacheProvider` to `compactionCacheProviderFilter` at both configuration scopes. The filter does not select a model or route, and the old key is not an alias.
