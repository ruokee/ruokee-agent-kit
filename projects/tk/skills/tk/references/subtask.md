# Subtasks

Read this file when creating subtasks or handling placement, numbering, discovery, batch failures, or retries.

## Creation input

The parent must resolve uniquely and have status `open` or `planning`. Creation never reopens a `closed` parent implicitly.

One request creates 1 to 50 sibling subtasks below one parent. Each item requires a name and may include a body, `planning` or `open` status, historical `created_at`, relationships, and `extra`. Relationships in the batch may point only to Tasks that already exist, not to sibling Tasks that the same batch has not created yet.

Subtasks may be nested. Do not combine independent work in one name; create sibling Tasks instead. Use a subtask only for a work unit that needs its own status, relationships, WAL, body, or materials. Do not persist every routine execution step or backlog item as a subtask.

## Configured placement

`subtasks_dir` specifies the canonical relative location for subtasks below each parent. Its default is the empty path:

```text
<parent>/NN--slug/
```

With a non-empty value:

```text
<parent>/<subtasks_dir>/NN--slug/
```

For example, `subtasks_dir = "children"` places new Tasks at `<parent>/children/NN--slug/`.

`subtasks_dir` must be a safe relative path. An empty value means the parent directory itself. A non-empty value cannot contain an absolute path, `.` or `..` components, symbolic links, or parent-directory escape.

Direct subtasks use `01..99`. The runtime scans valid direct children in the configured location, takes the largest `NN--slug` number, and adds one without filling gaps. A batch receives consecutive numbers. If `99` is already occupied, the request fails before its first write.

## Subtask discovery

Discovery follows the configured canonical topology. For each parent, the runtime checks only the parent's `subtasks_dir` and direct real directories with valid `NN--slug` names.

A directory at that location becomes a Task only when it has a valid carrier for the project's metadata mode:

- `split` mode requires valid paired `tk.toml` and `TASK.md` files;
- `embed` mode requires `TASK.md` to start with valid tk YAML frontmatter.

Changing `subtasks_dir` changes both future creation and discovery. It does not move existing Task directories. Existing subtasks outside the configured path are not discoverable.

After discovering a child, the runtime applies the same rule recursively below it. Apart from the configured `subtasks_dir` path, ordinary material directories cannot occur between a parent and a discovered child. Symbolic links, special files, and non-canonical directory names do not participate in discovery.

The canonical parent is the Task whose configured subtask location directly contains the child. Directory topology expresses only parentage. It does not create dependencies or associations or inherit status.

## Batch creation

Before the first write, the runtime validates every item, the parent, authorization, relationships, and target paths. It then creates items in input order.

A field or preflight failure creates no Tasks. An I/O error or cancellation during writes may leave a partial commit. The result distinguishes `completed` and `uncompleted`. Re-read the parent and current subtasks, then submit a new complete request for the remaining work.

When retrying the same request, an existing direct child with matching content counts as satisfied. The runtime allocates new numbers only for remaining items. A similar name with different content is not a match. Do not assume automatic rollback or a continuation token.
