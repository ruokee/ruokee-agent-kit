# Install workloop

English | [中文](./installation.zh.md)

Choose one management method for each installed Skill: a standalone directory managed through your Harness, or the OMP resource package. Both provide the complete workflow. The OMP package also supplies five slash commands. Neither method installs tk, collaboration tools, or auxiliary Skills.

The repository's ordinary Skill installer does not manage this component. No build or component dependency installation is required.

## Install a standalone Skill

Use your Harness's documented Skill discovery and loading mechanism. Determine the actual user or project Skill root from that Harness's documentation; do not assume another host's path. Choose the complete English `workloop` or Chinese `workloop-zh` directory from this component's `skills/` directory.

For a Harness that discovers ordinary Skill directories, the following POSIX shell example copies one complete Skill. Run it from the component root containing `package.json`, `skills/`, and `commands/`. Set `skill_root` to the actual discovery root. The destination `$skill_root/$skill` must not already exist; use the update procedure for an existing installation.

```sh
component_root="$PWD"
skill=workloop
skill_root="/path/to/skill-root"
mkdir -p "$skill_root"
cp -R "$component_root/skills/$skill" "$skill_root/$skill"
```

For Chinese, set `skill=workloop-zh`. The names are independent, so both can be installed if wanted. Keep every file beneath the selected directory. Copying only `SKILL.md` loses the operation bodies and setup guidance.

If the Harness supports directory symlinks, use a link instead of the copy:

```sh
ln -s "$component_root/skills/$skill" "$skill_root/$skill"
```

Keep the linked source at a stable location. Follow the Harness's reload or restart procedure after installation, then use the selected Skill by name and request an operation in natural language. Standalone installation does not add `/wl-*` commands.

### Update a standalone Skill

Obtain the desired component revision first. Review local changes in the installed directory before replacing it. For a copied installation, move the old whole directory to a new backup location outside the Harness's discovery roots, then copy the new whole directory. This also removes files that the new version no longer contains.

Set `backup_root` to a new location whose `$backup_root/$skill` does not exist:

```sh
backup_root="/path/to/new-backup"
mkdir -p "$backup_root"
mv "$skill_root/$skill" "$backup_root/$skill"
cp -R "$component_root/skills/$skill" "$skill_root/$skill"
```

The old directory remains in the backup if copying fails. Restore that directory before using the Skill again. For a linked installation, updating its source updates the linked content; if the source moves, replace only the installed link with one pointing at the new source. Reload or restart through the Harness after either kind of update. A directory copy or matching version does not establish that a running session has loaded the new body.

### Remove a standalone Skill

For a copied installation, remove only the selected installed directory, after preserving any local changes:

```sh
rm -r -- "$skill_root/$skill"
```

For a symlink installation, unlink it without a trailing slash:

```sh
rm -- "$skill_root/$skill"
```

Do not remove the shared Skill root, another language installation, or the source checkout. Reload or restart according to the Harness so its discovery state reflects removal.

## Install the OMP package

The package is `@ruokee/workloop`. Its `omp` manifest enables native package discovery; OMP reads complete Skills from `skills/` and Markdown command prompts from `commands/`. There is no Extension entry or runtime dependency. The package and both Skills share one version.

The commands below use OMP's local package linking interface. From the component root:

```sh
component_root="$PWD"
omp plugin link "$component_root"
omp plugin list
```

This registers a user-scoped link to this component, including both language Skills and all five commands. Keep the source directory available. In OMP 18.12.3, local package linking is user-scoped; `--scope project` does not turn it into a project-scoped link. Linking the same package name replaces its existing package link, so use this operation only for the installation you intend to manage.

After linking, run `/reload-plugins` in the active OMP session, or start a new session. Use one of:

```text
/wl-clarify <idea or Task reference>
/wl-exec <Task reference>
/wl-verify <Task reference and candidate>
/wl-ship <Task reference>
/wl-supervise <Task reference>
```

An explicit language-Skill choice wins; without one the command loads English `workloop`. For example:

```text
/wl-exec 使用 workloop-zh，执行这个 Task 的剩余 Plan
```

The entry loads the selected Skill and its operation relative to the actual loaded Skill directory. It does not look for workflow bodies in a global prompt directory. Both Skills also remain usable by name without a slash command.

### Update the OMP package

Update the linked component checkout to the intended revision, then run `/reload-plugins` or start a new OMP session. If the component moved, run `omp plugin link` with its new absolute path. `omp plugin upgrade @ruokee/workloop` does not update local links; OMP rejects linked sources for that operation. Updating a link does not update a separately copied Skill.

### Remove the OMP package

```sh
omp plugin uninstall @ruokee/workloop
```

Then run `/reload-plugins` or start a new session. Uninstall removes the registered package link and its plugin state, not the source component directory. It does not remove standalone Skill copies or manually installed commands; manage those through the method that installed them.

### Resolve resource collisions

Use one installation method per Skill name to avoid loading different revisions. In OMP 18.12.3, native `.omp` resources have priority 100 and package resources priority 90. For differing same-name Skills, the higher-precedence copy keeps the bare name and other copies get namespaced identities; identical copies are deduplicated. A custom Skill directory has its own higher-precedence override behavior. Inspect the reported source before assuming that `workloop` names the package copy.

Native same-name file commands outrank package file commands. Built-in, extension, and custom command handlers run before file commands; file commands run before prompt templates. The `wl-` prefix does not guarantee freedom from user-defined collisions. Remove or rename only the conflicting installation you own, then reload. Do not rely on order between equal-priority sources.

### Interface basis

The CLI and source contracts above were checked against OMP 18.12.3. This is an interface reference, not a host maintenance lower bound or a live installation claim:

- [Package management](https://github.com/can1357/oh-my-pi/blob/v18.12.3/docs/plugin-manager-installer-plumbing.md) describes linking, update restrictions, removal, and conventional resources.
- [Command discovery](https://github.com/can1357/oh-my-pi/blob/v18.12.3/docs/slash-command-internals.md) describes `commands/`, precedence, and expansion.
- [Skill collisions](https://github.com/can1357/oh-my-pi/blob/v18.12.3/docs/skills.md#collision-and-duplicate-handling) describes same-name handling.
- [Reload implementation](https://github.com/can1357/oh-my-pi/blob/v18.12.3/packages/coding-agent/src/slash-commands/builtin-marketplace.ts) refreshes Skills and file commands through `/reload-plugins`.

For other OMP versions, follow their current public interface. File copies and manifest inspection establish resource completeness; check actual host discovery and model behavior separately when validating an installation.
