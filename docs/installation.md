# Installing Skills

English | [中文](./installation.zh.md)

This guide covers the ordinary Skills in this repository. Extensions keep their own installation and update instructions:

- [tk](../projects/tk/README.md)
- [omp-status-bar](../projects/omp-status-bar/README.md)
- [omp-system-prompt](../projects/omp-system-prompt/README.md)
- [omp-codex-web-access](../projects/omp-codex-web-access/README.md)
- [omp-context-pin](../projects/omp-context-pin/README.md)

## Choose what to install

The [repository README](../README.md#capabilities) lists every capability and links each Skill. Read a Skill's `SKILL.md` before installing it; a Skill is selected from its frontmatter description.

An ordinary Skill is a directory that contains `SKILL.md` and, when it needs them, its own references, workflows, and glossaries. Installing copies that whole directory.

| Language | Source in this repository | Installed as |
| --- | --- | --- |
| English | `skills/<name>/` | `<skill root>/<name>/` |
| Chinese | `variants/zh/skills/<name>/` | `<skill root>/<name>/` |

A Skill root holds one installation per name, so a name is installed in one language at a time. `check` and `install` state the language of the source they compare. `--language` accepts `en` or `zh` and defaults to `en`; `uninstall` takes no language, because it removes one target name. Run `sh scripts/skills.sh --help` for the complete option list.

## Requirements

- A local clone of this repository. Get the newest content with `git pull` in that clone.
- A POSIX shell: the commands below run through `sh`.
- A `diff` command plus the common system file tools that every Linux and macOS system provides. Directory comparison is `diff -r -q`, and its exit status decides the reported state.
- No Node, Bun, Python, `jq`, or Rust. The script never uses the network, and it does not need the repository's development dependencies or a build step.
- Git is optional. When the clone is a Git checkout, `check` prints the compared `HEAD` and the uncommitted changes under the compared sources.

## Choose a Skill root

`--target` names the directory that holds your Skills, not the Skill directory itself. `install` creates it when it does not exist.

For OMP, the user-level ordinary Skill directory is:

```text
$HOME/.omp/agent/skills
```

Other Harnesses load Skills from their own paths. A project-level root is the directory your Harness reads for the current project. Confirm the path in the documentation of the Harness you actually run before installing; the script does not guess a root and cannot verify that a Harness loads what it writes.

## Check what is installed

```sh
sh scripts/skills.sh check --target "$HOME/.omp/agent/skills"
sh scripts/skills.sh check code-quality --language zh --target "$HOME/.omp/agent/skills"
```

Without Skill names, `check` compares every Skill that is installed under the root and reports the rest as a count. With names, it compares exactly those Skills and reports a named Skill that is not installed.

`check` is read only. It creates no target, no backup, and no state file. For each Skill it prints the source and target paths, the version declared in `SKILL.md` (`metadata.version`, or `unknown`), and the content state:

- `identical`, or
- `differs`, followed by the lines from a recursive `diff` of the two directories, or
- `cannot compare` with the reason, when either tree cannot be read, or
- `not installed`, or
- a broken symlink, which is never treated as the installed content.

It compares the whole directory, so a changed reference file, an added file, and a deleted file are all found. Equal versions with different content are still a difference. A tree that cannot be read is a failure, not a difference and not a match: `check` never reports an unreadable target as identical, and a comparison that cannot complete exits `2`.

## Install or update

```sh
sh scripts/skills.sh install code-quality --language en --target "$HOME/.omp/agent/skills"
```

When the target does not exist, `install` copies the complete Skill directory. When the target already matches the source, it reports `no change` and writes nothing. When the target exists with different content, it stops without touching it and prints the commands to inspect and replace it.

Replacing is a separate authorization:

```sh
sh scripts/skills.sh install code-quality --language en --target "$HOME/.omp/agent/skills" --replace
```

`--replace` copies the current target into a backup directory, then replaces the whole directory. Files that exist only in the target are removed with it, which is what an update to a newer revision requires. The replacement never merges directories. The command prints the backup path and points to [Restore a backup](#restore-a-backup) for the steps that put the previous content back.

A failed operation stops with a nonzero status, keeps the previous content or a complete backup, and names anything it could not finish. A partially written Skill is never reported as installed. A target that cannot be read is left alone instead of being replaced.

## Uninstall

```sh
sh scripts/skills.sh uninstall code-quality --target "$HOME/.omp/agent/skills"
sh scripts/skills.sh uninstall code-quality --target "$HOME/.omp/agent/skills" --yes
```

The first command prints the exact target and stops. Removal requires `--yes`, which confirms that target only.

An ordinary installation directory is copied into the backup directory and then removed from the Skill root. A target that is a symlink is only unlinked; the directory it points to is left alone. Neighbouring Skills, the Skill root itself, and the repository source are untouched. A Skill that you copied by hand is managed the same way, so no migration or registration step is needed.

Removing an installed Skill does not depend on this repository, and this repository does not require an installation record. A directory with the same name as a Skill is only a comparison candidate, not proof of where its content came from; compare it before removing it.

## Backups

An authorized replacement or removal copies the previous target into a per-operation directory below:

```text
${XDG_STATE_HOME:-$HOME/.local/state}/ruokee-agent-kit/skill-backups/
```

Each operation prints the exact path, which is unique even within the same second. The directory holds copies only; it is not an installation registry. It is never placed inside a Skill root or inside this repository's sources, so a Harness does not load it and a backup cannot overwrite a source.

## Restore a backup

Every authorized replacement or removal prints the path of the backup it wrote. Use that path, not a guessed one:

```sh
backup='<the backup path the command printed>'
root='<the Skill root you passed as --target>'
name='<the Skill name>'
```

The backup path starts under `${XDG_STATE_HOME:-$HOME/.local/state}/ruokee-agent-kit/skill-backups/`, so a custom `XDG_STATE_HOME` changes it. The backup directory holds the whole Skill as `<name>/`, or, when a symlink was replaced or removed, only its `link-target.txt`.

Restore a directory:

```sh
holding=$(mktemp -d "$backup/restore.XXXXXX") &&
  { { [ ! -e "$root/$name" ] && [ ! -L "$root/$name" ]; } || mv "$root/$name" "$holding/$name"; } &&
  mv "$backup/$name" "$root/$name"
```

Restore a replaced or removed link:

```sh
holding=$(mktemp -d "$backup/restore.XXXXXX") &&
  { { [ ! -e "$root/$name" ] && [ ! -L "$root/$name" ]; } || mv "$root/$name" "$holding/$name"; } &&
  ln -s "$(cat "$backup/link-target.txt")" "$root/$name"
```

Replace the placeholders before running these commands. Both commands first move whatever is installed now into a fresh holding directory within the backup, outside the Skill root. Nothing is deleted: a file added to the installed Skill after the replacement waits at `$holding/$name` instead of being lost or left for system temporary-directory cleanup. The `&&` chain stops at the first failure, which keeps content that was not moved aside from being overwritten. Each run creates its own holding directory, so a repeated restore never nests a Skill inside another one. Delete the holding directory once you no longer need what it holds.

## Manual alternatives

Copying by hand is the same installation:

```sh
mkdir -p "$HOME/.omp/agent/skills"
cp -R skills/code-quality "$HOME/.omp/agent/skills/"
```

A top-level symlink is also valid for a Skill root that follows links:

```sh
ln -s "$PWD/skills/code-quality" "$HOME/.omp/agent/skills/code-quality"
```

A linked Skill has no separate copy: its content is the checkout, so it changes when you pull. Whether a Harness follows such a link and when it reloads the content are properties of that Harness; the script cannot confirm either. `check` reports a linked target, compares the content it resolves to, and treats a broken link as a difference. `uninstall` removes only the link.

Install one Skill at a time. Neither the script nor this guide installs every Skill by default.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | The comparison is consistent, or the Skill was installed, unchanged, or removed. |
| `1` | Nothing changed: `--replace` or `--yes` is required, the installed target differs from the source, or a named Skill is not installed. |
| `2` | The request failed: usage, name, path, read, or file operation. A comparison that could not complete, a refused write into the repository sources, and a refused backup location are also `2`. |

## Limits

- `check` compares the source in your clone with the target you name. Without an earlier baseline it cannot tell whether a difference came from the repository or from a local edit, so it reports a difference to review and never authorizes an overwrite.
- Identical content proves that two directories match. It does not prove that a running Harness has loaded that version; reload or restart the Harness according to its own rules.
- The script manages ordinary Skill directories only. It does not edit Harness configuration, install dependencies, build anything, or pull Git.
- A write that would reach this repository's own sources is refused before anything is created: a target root that is, contains, or lies inside `skills/` or `variants/zh/skills/`, and a backup location under either tree. The refusal covers both languages, whatever `--language` selected. A Skill entry that is itself a symlink is still replaced or unlinked as a link, and the directory it points to is never written through.
- A path whose missing part contains `.` or `..` is refused rather than folded: the command exits `2`, names that component, and creates nothing. Folding such a path would resolve it differently from how the filesystem resolves the path used for writing.
- `check` and `install` read the checkout in which the script itself is stored, so it always reflects that clone. Use a fresh `git pull` in that clone to compare against newer content.

## Related

- [Repository README](../README.md): capability list and development setup
- [scripts/skills.sh](../scripts/skills.sh): the script this guide describes
- [scripts/tests/skills.sh](../scripts/tests/skills.sh): its regression tests
