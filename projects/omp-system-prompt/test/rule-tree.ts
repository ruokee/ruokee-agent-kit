import type { RuleDirectoryEntry, RuleFileSystem } from "../src/rules.ts";

/** File tree for an in-memory rule source; a null value is a directory. */
export type RuleTree = Record<string, string | null>;

export interface RuleTreeOptions {
  /** Directories whose listing fails with a non-missing error. */
  unreadableDirectories?: readonly string[];
  /** Files whose read fails with a non-missing error. */
  unreadableFiles?: readonly string[];
}

/**
 * File access over a literal tree keyed by slash-separated path.
 *
 * A path present in the tree reads as a file unless its value is null, so a
 * test can place a nested directory entry without creating a second tree.
 * Unlisted directories fail with ENOENT, which the loader treats as an empty
 * set; the two option lists force the non-missing failures instead.
 */
export function treeFileSystem(tree: RuleTree, options: RuleTreeOptions = {}): RuleFileSystem {
  const listings = new Map<string, RuleDirectoryEntry[]>();
  for (const [path, content] of Object.entries(tree)) {
    const at = path.lastIndexOf("/");
    const directory = at === -1 ? "" : path.slice(0, at);
    const entries = listings.get(directory) ?? [];
    entries.push({ name: at === -1 ? path : path.slice(at + 1), isFile: () => content !== null });
    listings.set(directory, entries);
  }
  const failure = (code: string) => Object.assign(new Error(code), { code });
  return {
    readDirectory: async (directory) => {
      if (options.unreadableDirectories?.includes(directory)) throw failure("EACCES");
      const entries = listings.get(directory);
      if (entries === undefined) throw failure("ENOENT");
      return entries;
    },
    readFile: async (path) => {
      if (options.unreadableFiles?.includes(path)) throw failure("EACCES");
      const content = tree[path];
      if (content === undefined || content === null) throw failure("ENOENT");
      return content;
    },
    isMissing: (error) => (error as { code?: unknown }).code === "ENOENT",
  };
}
