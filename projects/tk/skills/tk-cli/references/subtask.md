# Subtasks

Read this file when creating subtasks or handling placement, numbering, discovery, batch failures, or retries.

## Creation input

The parent must resolve uniquely and have status `open` or `planning`. Creation never reopens a `closed` parent implicitly.

One request creates 1 to 50 sibling subtasks below one parent. Each item requires a name and may include a body, `planning` or `open` status, historical `created_at`, relationships, and `extra`. Relationships in the batch may point only to Tasks that already exist, not to sibling Tasks that the same batch has not created yet.

Subtasks may be nested. Do not combine independent work in one name; create sibling Tasks instead. Use a subtask only for a work unit that needs its own status, relationships, WAL, body, or materials. Do not persist every routine execution step or backlog item as a subtask.

## Default creation placement

`subtasks_dir` specifies only the default location for new subtasks below a parent. Its default is the empty path:

```text
<parent>/NN--slug/
```

With a non-empty value:

```text
<parent>/<subtasks_dir>/NN--slug/
```

For example, `subtasks_dir = "children"` places new Tasks at `<parent>/children/NN--slug/`.

`subtasks_dir` must be a safe relative path. An empty value means the parent directory itself. A non-empty value cannot contain an absolute path, `.` or `..` components, symbolic links, or parent-directory escape.

Direct subtasks use `01..99`. The runtime scans discovered direct children, takes the largest valid `NN--slug` number, and adds one without filling gaps. The new directory is still written to the default creation location. A batch receives consecutive numbers. If `99` is already occupied, the request fails before its first write.

## Subtask discovery

Creation placement and discovery range are separate. `subtasks_dir` does not limit discovery.

Discovery walks real ordinary directories below the parent. A directory first becomes a structural candidate when it has an unambiguous marker for the current metadata mode:

- `split` mode uses `tk.toml` as the marker and requires a valid paired `TASK.md` in the same directory;
- `embed` mode requires `TASK.md` to start with recognizable, valid tk YAML frontmatter. An ordinary material file named `TASK.md` is not enough.

A candidate becomes a Task only after carrier, schema, identity, path-safety, and project-ownership checks pass. `check` reports a marked directory with damaged contents; normal discovery does not return it as a Task. Symbolic links, tk temporary files, and managed WAL directories do not participate in discovery.

The parent of a valid Task is its nearest valid ancestor Task. Ordinary material directories and a configured `subtasks_dir` may appear between them. A valid Task moved or imported elsewhere below the parent therefore remains discoverable, but the move itself must preserve path safety, unique identity, and valid relationships.

Directory topology expresses only parentage. It does not create dependencies or associations or inherit status.

## Batch creation

Before the first write, the runtime validates every item, the parent, authorization, relationships, and target paths. It then creates items in input order.

A field or preflight failure creates no Tasks. An I/O error or cancellation during writes may leave a partial commit. The result distinguishes `completed` and `uncompleted`. Re-read the parent and current subtasks, then submit a new complete request for the remaining work.

When retrying the same request, an existing direct child with matching content counts as satisfied. The runtime allocates new numbers only for remaining items. A similar name with different content is not a match. Do not assume automatic rollback or a continuation token.
