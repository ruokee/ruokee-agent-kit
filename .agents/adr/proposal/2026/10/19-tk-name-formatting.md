# tk name formatting

Draft owner: Ruokee
Draft writer: OMP GPT-6.1 Sol

English | [中文](./19-tk-name-formatting.zh.md)

## Motivation

Accept differences in the use or omission of ordinary spaces, hyphens, and underscores between stored Task names and their generated directory suffixes.

A formatter can insert a space between Latin and Chinese text in an embedded Task's `name`, for example changing `AI学习` to `AI 学习`, without changing its directory. The stored-name normalization check and the exact name-to-suffix check each reject this state, blocking ordinary operations until it is repaired.

The [tk data decision](../../../decision/2026/08/28-tk-data.md) makes UUIDv7 the identity, names descriptions, and paths locators. Formatting differences should not require a name repair or directory move when the name remains valid and describes the same generated suffix. Actual display width, strict validation of unrelated data, explicit rename targets, and partial-failure reporting must remain intact.

## Proposal

Update the [tk data decision](../../../decision/2026/08/28-tk-data.md) with a dated `Changes` entry for name-format compatibility. Its identity, lifecycle, strict discovery, narrow rename repair, body preservation, reference protection, and no-rollback rules remain in force. This extends which names strict validation accepts; it does not give ordinary operations the rename repair loader. No existing decision is reversed. The [tk runtime decision](../../../decision/2026/08/28-tk-runtime.md) continues to own the shared runtime and result contract.

### Stored names

Allow a stored name and its generated directory suffix to correspond when removing only ordinary spaces `U+0020`, hyphens `-`, and underscores `_` from each leaves identical text. Do not fold case, replace other text, or broaden the existing NFKC, non-empty, and other character constraints. Thus `AI学习`, `AI 学习`, `AI-学习`, and `AI_学习` can correspond to the same suffix without becoming the same Task.

Validate the stored name and the generated suffix separately against the limit of 32 terminal display columns, using each actual string. Count every space, hyphen, and underscore. Do not measure a stripped comparison key or a rewritten string instead. Date and sequence prefixes are not part of the name suffix. A name that grows from 32 to 33 columns after formatting remains invalid and returns `task_name_too_wide`.

Generated directory names remain free of spaces and use hyphens by default. Ordinary discovery, reads, checks, and updates do not normalize stored names or move directories. These rules concern tk-generated directory portions, not unrelated project paths. Non-generated child directories acquire no name-to-path matching requirement.

Apply the same validity rules to metadata decoding, discovery, reads, permitted updates, managed writes, and split/embed conversion. Preserve permitted name spellings and body bytes during ordinary writes and conversion. All public interfaces share these rules in the Rust runtime; adapters do not implement another interpretation. The [data model](../../../../../projects/tk/docs/design/data-model.md) owns the detailed contract.

### Creation retries

Keep creation and rename request normalization, including space-free generated directories. When an existing child's name acquires legal formatting spaces, retrying the same original creation request with the other matching fields unchanged must reuse that child.

Do not use the separator-insensitive directory comparison as a creation identity or deduplication key. Requests such as `AI学习` and `AI-学习`, which have distinct normalized creation names, must retain that distinction. The comparison creates no search alias, global name uniqueness rule, or Task merge behavior.

### Explicit rename

Keep rename's concrete normalized target. Report no change only when both the stored name and the applicable path exactly reach that target, not merely when their formatting comparison keys match.

For example, a legal name `AI 学习` with suffix `AI学习` still targets the name and suffix `AI-学习` when explicitly renamed to `AI 学习`. A name `AI-学习` with suffix `AI_学习` can likewise require a path move for a same-name request. Rename continues to report the actual plan and references, reject an existing target, and apply reference protection to real moves. A metadata-only repair is not a move. References are not rewritten automatically.

Retain the narrow loader for repairing invalid old string names and recognizable generated suffixes, including empty or over-wide names. A closed Task remains closed, and the new target must pass full validation. Do not let new ordinary suffix checks make these repairable old states unreachable.

Keep exact pre-commit revalidation of names, paths, metadata, and references. A formatting-equivalent external edit can still invalidate a rename plan. If moving the directory succeeds but writing the metadata fails, report the original partial-commit error and its completed and pending items. The resulting state may be readable under the compatibility rule; that does not complete the failed rename. A retry must finish the concrete target rather than return a formatting-based no-op. Do not add rollback or persistent recovery state.

The body remains ordinary content. No heading is required or matched to the managed name, the name-width limit does not constrain headings, and rename does not synchronize them. Initial body generation remains unchanged.

## Alternatives considered

- Keep strict spelling and improve repair messages. This option was considered during the comparison of formatting compatibility with canonical name storage. This preserves canonical storage, but formatting still repeatedly disables ordinary use and requires repairs that may move paths.
- Automatically normalize metadata or directories during reads and checks to resolve stored-name and directory-suffix mismatches. This option was considered during the analysis of how to reconcile stored names and directory suffixes. This removes the mismatch through implicit writes or moves, changing diagnostic behavior and potentially breaking references. Accepting compatible spellings avoids that migration.
- Use the formatting comparison for creation-request deduplication and rename completion to reduce separate matching rules. This option was considered during the analysis of how creation retries and rename interact with formatting correspondence. This conflates previously distinct creation requests and suppresses explicit separator changes or unfinished metadata writes.
- Remove ordinary spaces before applying the 32-column limit so formatter-inserted spaces do not reject a formerly valid name. This option was considered during the width-boundary discussion about formatter-inserted spaces. This permits the displayed name to exceed the limit and changes its meaning rather than resolving name-to-path correspondence.

## Acceptance criteria

- In split and embed, top-level Tasks and generated children remain discoverable and usable through read, search, check, permitted updates, managed writes, and representation conversion after only legal name-format changes. These operations preserve the permitted spelling, identity, path, ownership, and body according to their existing responsibilities, without repair warnings for the legal state.
- Actual names at 32 display columns pass width validation; names at 33 columns fail with `task_name_too_wide`, including a single inserted formatting space. Generated suffixes are independently width-checked and contain no spaces. Different text, damaged fields, and other invalid data still fail. Existing valid Tasks require no migration.
- A formatted child's original creation request remains retryable without duplication, while previously distinct normalized creation names remain distinct. Search semantics and UUID identity do not change.
- Explicit separator changes and same-display-name requests reach their normalized name and path targets. Dry-run reports the real plan. Target conflicts, reference protection for moves, metadata-only repair, and non-generated child placement retain their behavior.
- Narrow repair still reaches eligible invalid old names and suffixes, including closed Tasks, and validates new targets fully. Rename preserves body bytes and status.
- Directory-move success followed by metadata-write failure remains a partial failure even if read or check succeeds. Retrying completes the precise target. Exact stale-plan checks still reject changed inputs.
- The implementation updates the bilingual data contract and affected references together. It does not add schema fields, CLI arguments, result fields, adapter-specific name rules, or heading validation. The [validation contract](../../../../../projects/tk/docs/design/validation.md) continues to govern the evidence required for these behaviors.

## Risks

The accepted set of stored names expands. An older runtime may reject a spelling accepted by a newer runtime even though the schema is unchanged; unchanged schema does not promise backward readability of the new spelling.

Formatting correspondence is broader than creation-request matching. Reusing it outside name-to-path validation could silently merge distinct requests or hide a requested rename, so those operations retain their own matching rules.

Explicitly renaming a legal Task to its displayed name can still move the directory. The concrete target and existing reference checks make this visible without adding a second rename mode.

A formatter can make a name exceed the actual width limit. That remains a real validation error and still needs an explicit valid name, not a width exemption.

A partially completed rename can leave a valid, readable Task. Callers must use the operation's failure and completed/pending items to judge completion rather than treat successful reads as recovery evidence.
