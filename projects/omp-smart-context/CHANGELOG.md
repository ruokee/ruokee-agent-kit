# Changelog

[中文](./CHANGELOG.zh.md)

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
