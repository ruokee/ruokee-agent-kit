# Install workloop

English | [中文](./installation.zh.md)

Install one complete language Skill and, for OMP, its matching five Prompt templates. The component has no package manifest, build step, runtime dependency, or dedicated installer. The repository's ordinary Skill installer does not manage it. Install tk and any required collaboration tools separately. Setup configures optional workflow defaults; it is not an installation or ordinary-use prerequisite.

## Retire an existing package

Before direct installation, remove an existing `@ruokee/workloop` installation through the manager that installed it. For OMP's native package manager:

```sh
omp plugin list
omp plugin uninstall @ruokee/workloop
```

Run uninstall only for a listed installation you intend to replace. In OMP 18.12.3 it removes the registered package and plugin state, not a linked source checkout. It does not remove standalone copies or manually installed commands. Do not run `plugin link` against the direct-install component; it has no package manifest.

Locate any workloop file commands you installed under the effective user or project `commands/` directory. Move those five owned `wl-clarify.md`, `wl-exec.md`, `wl-verify.md`, `wl-ship.md`, and `wl-supervise.md` files outside discovery roots before installing templates. A same-name file command runs before a Prompt template and would keep the old entry active. Do not remove unrelated commands or another owner's files. Resolve any other same-name handler with its owner rather than relying on discovery order.

## Locate OMP directories

Run the examples from the component root containing `skills/` and `prompts/`. With default configuration, OMP uses `~/.omp/agent/skills/` and `~/.omp/agent/prompts/`. Resolve the effective agent directory through the actual CLI when environment settings or a profile relocate it:

```sh
component_root="$PWD"
agent_root="$(omp config path)"
skill_root="$agent_root/skills"
prompt_root="$agent_root/prompts"
skill=workloop
```

Run `config path` with the same environment and profile as the intended OMP session, for example `omp --profile work config path` for a named profile. Do not substitute the default path for its output. Custom Skill sources and project-local resources may also contain conflicts; inspect the reported source when validating discovery. For a deliberately project-local installation, use the project's actual `.omp/skills/` and `.omp/prompts/` roots instead.

Choose `skill=workloop` for English or `skill=workloop-zh` for Chinese. Each choice supplies a complete Skill and templates fixed to that identity. Install only that language; copying both Prompt subdirectories into a discovery root creates duplicate basename commands. Templates do not select a language from the user's input.

## Install in OMP

The selected Skill destination, the other workloop language destination, and the five template filenames must be absent. For an existing owned installation, use replacement below. Preserve unknown content instead of overwriting it.

```sh
mkdir -p "$skill_root" "$prompt_root"
cp -R "$component_root/skills/$skill" "$skill_root/$skill"
cp "$component_root/prompts/$skill"/wl-*.md "$prompt_root/"
```

Copy the whole Skill, including `operations/`, `references/`, and `setup.md`. Copy only the selected five template files directly into the Prompt root, not the parent `prompts/` directory or a language subdirectory. OMP names templates by basename even when it scans recursively.

Start a new OMP session after installing or updating templates. `/reload-plugins` refreshes plugin resources, Skills, and file commands, but does not reload Prompt templates. In the new session, use the installed Skill by name or one of these entries:

```text
/wl-clarify <idea or Task reference>
/wl-exec <Task reference>
/wl-verify <Task reference and candidate>
/wl-ship <Task reference>
/wl-supervise <Task reference>
```

Arguments are optional when the current Task and goal are already clear. Empty arguments add no input heading; nonempty input preserves the host parser's resulting characters. The entry requests the installed Skill first, then follows that Skill's own routing to the operation. It does not search the Prompt directory for workflow bodies.

## Replace an installation

Obtain the intended component revision and inspect local changes in the installed resources. Use a new backup location outside all discovery roots. Set `old_skill` to the currently installed language and `skill` to the desired one; use the same value to update, or the other value to switch language. A different destination Skill must not already exist.

```sh
old_skill=workloop
skill=workloop-zh
backup_root="/path/to/new-backup"
mkdir -p "$backup_root/skills" "$backup_root/prompts"
mv "$skill_root/$old_skill" "$backup_root/skills/$old_skill"
for operation in clarify exec verify ship supervise; do
  mv "$prompt_root/wl-$operation.md" "$backup_root/prompts/"
done
cp -R "$component_root/skills/$skill" "$skill_root/$skill"
cp "$component_root/prompts/$skill"/wl-*.md "$prompt_root/"
```

The backup destinations must be new and the source resources must be your installation. Moving the complete old directory first prevents nested copies and removes obsolete files from discovery. Moving all five templates prevents mixed-language entries. Unrelated files remain untouched.

If copying fails, restore the saved complete installation before using it. Keep backups outside discovery roots. Start a new OMP session after replacement or switching. Existing sessions may still hold old template content or Skill text.

## Remove an installation

Preserve any local changes, then remove only your selected Skill and these five templates:

```sh
rm -r -- "$skill_root/$skill"
for operation in clarify exec verify ship supervise; do
  rm -- "$prompt_root/wl-$operation.md"
done
```

For a Skill symlink, use `rm -- "$skill_root/$skill"` without a trailing slash instead of removing its source. Keep shared roots, unrelated resources, backups, and the source checkout. Start a new OMP session so discovery reflects removal.

## Use another Harness

Use that Harness's documented Skill roots and loading mechanism. Copy the complete selected directory from `skills/` to its actual Skill root. Do not copy OMP templates unless the host explicitly supports that format. No dedicated command or runtime integration is required; name the Skill and request an operation in natural language.

Where supported, a directory symlink may replace the copy:

```sh
ln -s "$component_root/skills/$skill" "$skill_root/$skill"
```

Keep the source at a stable location. Replace a copied Skill by moving the old complete directory to a fresh backup outside discovery before copying the new one. Switch language by removing the old identity from discovery first. For a linked Skill, update the source or replace only its link if the source moves. Remove only the installed directory or link. Follow that Harness's actual reload or restart requirements rather than assuming OMP's procedure applies.

## Verify loading

Check these separately:

- File placement: one complete selected Skill, five matching templates for OMP, no nested copy, stale language, or owned conflicting file command.
- Host discovery: the intended Skill identity and command source, with no conflicting installation taking precedence.
- Actual loading: in a new session, the selected entry loads the intended Skill and operation from their real installed paths. Discovery or a matching version alone does not establish loaded instruction text or correct Agent behavior.

The interface basis is OMP 18.12.3, not a maintenance lower bound:

- [Prompt templates](https://omp.sh/docs/prompt-templates) explains discovery, arguments, and session loading. The [18.12.3 implementation](https://github.com/can1357/oh-my-pi/blob/v18.12.3/packages/coding-agent/src/config/prompt-templates.ts) defines the versioned discovery and expansion behavior.
- [Package management](https://github.com/can1357/oh-my-pi/blob/v18.12.3/docs/plugin-manager-installer-plumbing.md) explains old-package removal.
- [Command discovery](https://github.com/can1357/oh-my-pi/blob/v18.12.3/docs/slash-command-internals.md) explains file-command precedence.
- [Config CLI](https://github.com/can1357/oh-my-pi/blob/v18.12.3/packages/coding-agent/src/cli/config-cli.ts) defines `config path`.

For another version, use its current public interfaces. File operations and discovery checks need their own observations; model behavior and user acceptance require separate evidence.
