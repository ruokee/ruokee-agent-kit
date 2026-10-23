# Changelog

[中文](./CHANGELOG.zh.md)

## 0.1.0

First release of `@ruokee/omp-smart-context`:

- Provide Remote and Handoff request alignment, missing compaction usage recording, optional model prompt rules, and optional Pin in one self-contained package.
- Keep independent switches and failure boundaries. Pin and model rules default off; usage recording defaults on.
- Use one native activation snapshot and `/smart-context` for read-only status. Preserve `/ctx-pin`, `ctx_pin`, existing rule files, and supported Pin journal records.
- Replace smart-cache, standalone context-pin, and QoL's migrated modules. Follow [Migration](./docs/migration.md), including moving `compactionCacheProvider` to `compactionCacheProviderFilter` at both configuration scopes. The filter does not select a model or route, and the old key is not an alias.
