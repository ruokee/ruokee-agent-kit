# workloop

English | [中文](./README.zh.md)

workloop is a Markdown workflow for Agent tasks: clarify the goal, implement a Plan, independently verify results, and deliver what the project defines. It requires tk for durable Tasks and uses the target Harness's existing Skill loading mechanism. It contains no workflow runtime or programmatic action enforcement.

## Use a Skill

Choose one complete language directory:

| Language | Skill source | OMP Prompt source | Installed as |
| --- | --- | --- | --- |
| English | `skills/workloop/` | `prompts/` | `workloop` |
| Chinese | `variants-zh/skills/workloop-zh/` | `variants-zh/prompts/` | `workloop-zh` |

Each Skill contains an entry, all operation bodies, conditional references, and setup guidance. Load the selected Skill through your Harness and request an operation in natural language. Keep the whole directory, not just `SKILL.md`. The entry routes to the activity; its body loads shared rules only when needed.

Install tk separately and use its public interface under the project's Task rules. Collaboration uses the terminal multiplexer selected by the user or project, for example Tern, Herdr, or tmux; the listed tools are examples, and this component carries no built-in preference. Other Skills are used for relevant activities under their own entry rules, not installed or made mandatory by this component.

workloop is for new tasks. It continues and repairs its own Tasks across sessions but does not migrate old workflow entries or material names.

## Install

The default installation is the complete Skill. OMP users may also install the five matching Prompt templates. Install one language at a time. The command blocks use the variables set under Locate OMP directories. The component has no OMP package manifest, Extension, build step, runtime dependencies, or dedicated installer, and the repository's ordinary Skill installer does not manage it. Install tk and any required collaboration tools separately. Setup configures optional workflow defaults; it is not an installation or ordinary-use prerequisite.

### Retire an existing package

Before direct installation, remove an existing `@ruokee/workloop` installation through the manager that installed it. For OMP's native package manager:

```sh
omp plugin list
omp plugin uninstall @ruokee/workloop
```

Run uninstall only for a listed installation you intend to replace. In OMP 18.12.3 it removes the registered package and plugin state, not a linked source checkout. It does not remove standalone copies or manually installed commands. Do not run `plugin link` against the direct-install component; it has no package manifest.

Locate any workloop file commands you installed under the effective user or project `commands/` directory. Move those five owned `wl-clarify.md`, `wl-exec.md`, `wl-verify.md`, `wl-ship.md`, and `wl-supervise.md` files outside discovery roots before installing templates. A same-name file command runs before a Prompt template and would keep the old entry active. Do not remove unrelated commands or another owner's files. Resolve any other same-name handler with its owner rather than relying on discovery order.

### Locate OMP directories

Run the examples from the component root containing `skills/`, `prompts/`, and `variants-zh/`. With default configuration, OMP uses `~/.omp/agent/skills/` and `~/.omp/agent/prompts/`. Resolve the effective agent directory through the actual CLI when environment settings or a profile relocate it:

```sh
component_root="$PWD"
agent_root="${agent_root:-$(omp config path)}"
skill_root="$agent_root/skills"
prompt_root="$agent_root/prompts"
```

Set `agent_root` explicitly to use a temporary root in a check. Run `config path` with the same environment and profile as the intended OMP session, for example `omp --profile work config path` for a named profile. Do not substitute the default path for its output. Custom Skill sources and project-local resources may also contain conflicts; inspect the reported source when validating discovery. For a deliberately project-local installation, use the project's actual `.omp/skills/` and `.omp/prompts/` roots instead.

### Install the Skill

The selected Skill destination and the other language destination must be absent. Preserve unknown content instead of overwriting it. Choose the language before copying.

English:

```sh
skill=workloop
other_skill=workloop-zh
skill_source=skills/workloop
prompt_source=prompts
for name in "$skill" "$other_skill"; do
  if [ -e "$skill_root/$name" ] || [ -L "$skill_root/$name" ]; then
    printf 'target exists: %s\n' "$skill_root/$name" >&2
    exit 1
  fi
done
mkdir -p "$skill_root"
cp -R "$component_root/$skill_source" "$skill_root/$skill"
```

Chinese:

```sh
skill=workloop-zh
other_skill=workloop
skill_source=variants-zh/skills/workloop-zh
prompt_source=variants-zh/prompts
for name in "$skill" "$other_skill"; do
  if [ -e "$skill_root/$name" ] || [ -L "$skill_root/$name" ]; then
    printf 'target exists: %s\n' "$skill_root/$name" >&2
    exit 1
  fi
done
mkdir -p "$skill_root"
cp -R "$component_root/$skill_source" "$skill_root/$skill"
```

Copy the whole Skill, including `operations/`, `references/`, and `setup.md`. Install only the selected language in a Skill root.

### Add OMP prompts

The five Prompt templates are optional and OMP-specific. Install the set that matches the installed Skill; their language is fixed by the installed set, not selected from each invocation's input.

English:

```sh
skill=workloop
skill_source=skills/workloop
prompt_source=prompts
for operation in clarify exec verify ship supervise; do
  if [ -e "$prompt_root/wl-$operation.md" ] || [ -L "$prompt_root/wl-$operation.md" ]; then
    printf 'target exists: %s\n' "$prompt_root/wl-$operation.md" >&2
    exit 1
  fi
done
mkdir -p "$prompt_root"
for operation in clarify exec verify ship supervise; do
  cp "$component_root/$prompt_source/wl-$operation.md" "$prompt_root/"
done
```

Chinese:

```sh
skill=workloop-zh
skill_source=variants-zh/skills/workloop-zh
prompt_source=variants-zh/prompts
for operation in clarify exec verify ship supervise; do
  if [ -e "$prompt_root/wl-$operation.md" ] || [ -L "$prompt_root/wl-$operation.md" ]; then
    printf 'target exists: %s\n' "$prompt_root/wl-$operation.md" >&2
    exit 1
  fi
done
mkdir -p "$prompt_root"
for operation in clarify exec verify ship supervise; do
  cp "$component_root/$prompt_source/wl-$operation.md" "$prompt_root/"
done
```

Copy only the five files directly into the Prompt root, not the `prompts/` or `variants-zh/prompts/` directory. OMP names templates by basename even when it scans recursively, so the two language sets must not coexist.

Start a new OMP session after installing or updating templates. `/reload-plugins` refreshes plugin resources, Skills, and file commands, but does not reload Prompt templates. In the new session, use the installed Skill by name or one of these entries:

```text
/wl-clarify <idea or Task reference>
/wl-exec <Task reference>
/wl-verify <Task reference and candidate>
/wl-ship <Task reference>
/wl-supervise <Task reference>
```

Arguments are optional when the current Task and goal are already clear. Empty arguments add no input heading and continue sufficient current Task context; nonempty input preserves the host parser's resulting characters. The entry requests the installed Skill first, then follows that Skill's own routing to the operation. It does not search the Prompt directory for workflow bodies.

### Replace the installation

Obtain the intended component revision and inspect local changes in the installed resources. Use a new backup location outside all discovery roots. Set `old_skill` to the currently installed identity, `skill` to the desired identity, and `skill_source` and `prompt_source` to that language's sources. Use the same identity in both Skill variables to update in place. This example switches from English to Chinese. A different destination Skill must not already exist.

```sh
old_skill=workloop
skill=workloop-zh
skill_source=variants-zh/skills/workloop-zh
prompt_source=variants-zh/prompts
backup_root="${backup_root:?set a new backup directory outside discovery roots}"
if [ "$old_skill" != "$skill" ] && { [ -e "$skill_root/$skill" ] || [ -L "$skill_root/$skill" ]; }; then
  printf 'target exists: %s\n' "$skill_root/$skill" >&2
  exit 1
fi
mkdir -p "$backup_root/skills" "$backup_root/prompts"
mv "$skill_root/$old_skill" "$backup_root/skills/$old_skill"
for operation in clarify exec verify ship supervise; do
  mv "$prompt_root/wl-$operation.md" "$backup_root/prompts/"
done
if [ -e "$skill_root/$skill" ] || [ -L "$skill_root/$skill" ]; then
  printf 'target exists: %s\n' "$skill_root/$skill" >&2
  exit 1
fi
cp -R "$component_root/$skill_source" "$skill_root/$skill"
for operation in clarify exec verify ship supervise; do
  cp "$component_root/$prompt_source/wl-$operation.md" "$prompt_root/"
done
```

The backup destinations must be new and the source resources must be your installation. Moving the complete old directory first prevents nested copies and removes obsolete files from discovery. Moving all five templates prevents mixed-language entries. Unrelated files remain untouched. For a Skill-only installation, omit both prompt loops.

If copying fails, restore the saved complete installation before using it. Keep backups outside discovery roots. Start a new OMP session after replacement or switching. Existing sessions may still hold old template content or Skill text.

### Remove the installation

Preserve any local changes, then remove only your selected Skill and these five templates:

```sh
skill="${skill:-workloop}"
rm -r -- "$skill_root/$skill"
for operation in clarify exec verify ship supervise; do
  rm -f -- "$prompt_root/wl-$operation.md"
done
```

The block defaults to `workloop`; set `skill=workloop-zh` in the shell or edit the default to remove the Chinese Skill. The prompt removal is optional for a Skill-only installation; `rm -f` leaves absent files alone. For a Skill symlink, use `rm -- "$skill_root/$skill"` without a trailing slash instead of removing its source. Keep shared roots, unrelated resources, backups, and the source checkout. Start a new OMP session so discovery reflects removal.

### Use another Harness

Use that Harness's documented Skill roots and loading mechanism. Copy the complete selected directory from its `skill_source` to the actual Skill root. Do not copy OMP templates unless the host explicitly supports that format. No dedicated command or runtime integration is required; name the Skill and request an operation in natural language.

English:

```sh
component_root="$PWD"
skill_root="<the Skill root your Harness loads>"
skill=workloop
other_skill=workloop-zh
skill_source=skills/workloop
prompt_source=prompts
for name in "$skill" "$other_skill"; do
  if [ -e "$skill_root/$name" ] || [ -L "$skill_root/$name" ]; then
    printf 'target exists: %s\n' "$skill_root/$name" >&2
    exit 1
  fi
done
mkdir -p "$skill_root"
cp -R "$component_root/$skill_source" "$skill_root/$skill"
```

Chinese:

```sh
component_root="$PWD"
skill_root="<the Skill root your Harness loads>"
skill=workloop-zh
other_skill=workloop
skill_source=variants-zh/skills/workloop-zh
prompt_source=variants-zh/prompts
for name in "$skill" "$other_skill"; do
  if [ -e "$skill_root/$name" ] || [ -L "$skill_root/$name" ]; then
    printf 'target exists: %s\n' "$skill_root/$name" >&2
    exit 1
  fi
done
mkdir -p "$skill_root"
cp -R "$component_root/$skill_source" "$skill_root/$skill"
```

Where supported, a directory symlink may replace the copy. Move or remove an existing copy first. English:

```sh
component_root="$PWD"
skill_root="<the Skill root your Harness loads>"
skill=workloop
other_skill=workloop-zh
skill_source=skills/workloop
prompt_source=prompts
for name in "$skill" "$other_skill"; do
  if [ -e "$skill_root/$name" ] || [ -L "$skill_root/$name" ]; then
    printf 'target exists: %s\n' "$skill_root/$name" >&2
    exit 1
  fi
done
mkdir -p "$skill_root"
ln -s "$component_root/$skill_source" "$skill_root/$skill"
```

Chinese:

```sh
component_root="$PWD"
skill_root="<the Skill root your Harness loads>"
skill=workloop-zh
other_skill=workloop
skill_source=variants-zh/skills/workloop-zh
prompt_source=variants-zh/prompts
for name in "$skill" "$other_skill"; do
  if [ -e "$skill_root/$name" ] || [ -L "$skill_root/$name" ]; then
    printf 'target exists: %s\n' "$skill_root/$name" >&2
    exit 1
  fi
done
mkdir -p "$skill_root"
ln -s "$component_root/$skill_source" "$skill_root/$skill"
```

Keep the source at a stable location. Replace a copied Skill by moving the old complete directory to a fresh backup outside discovery before copying the new one. Switch language by removing the old identity from discovery first. For a linked Skill, update the source or replace only its link if the source moves. Remove only the installed directory or link. Follow that Harness's actual reload or restart requirements rather than assuming OMP's procedure applies.

### Verify loading

Check these separately:

- File placement: one complete selected Skill, five matching templates when OMP prompts are installed, no nested copy, stale language, or owned conflicting file command.
- Host discovery: the intended Skill identity and command source, with no conflicting installation taking precedence.
- Actual loading: in a new session, the selected entry loads the intended Skill and operation from their real installed paths. Discovery or a matching version alone does not establish loaded instruction text or correct Agent behavior.

The interface basis is OMP 18.12.3, not a maintenance lower bound:

- [Prompt templates](https://omp.sh/docs/prompt-templates) explains discovery, arguments, and session loading. The [18.12.3 implementation](https://github.com/can1357/oh-my-pi/blob/v18.12.3/packages/coding-agent/src/config/prompt-templates.ts) defines the versioned discovery and expansion behavior.
- [Package management](https://github.com/can1357/oh-my-pi/blob/v18.12.3/docs/plugin-manager-installer-plumbing.md) explains old-package removal.
- [Command discovery](https://github.com/can1357/oh-my-pi/blob/v18.12.3/docs/slash-command-internals.md) explains file-command precedence.
- [Config CLI](https://github.com/can1357/oh-my-pi/blob/v18.12.3/packages/coding-agent/src/cli/config-cli.ts) defines `config path`.

In this interface, native `.omp` resources have priority `100` and package resources `90`. Different same-name Skills keep the higher-precedence bare name and namespace other copies; identical copies deduplicate, while custom Skill directories have their own overrides. Native file commands outrank package file commands. Built-in, extension, and custom handlers precede file commands, which precede Prompt templates. These are versioned interface facts, not a guarantee about equal-priority order or future hosts; inspect the actual discovered source.

For another version, use its current public interfaces. File operations and discovery checks need their own observations; model behavior and user acceptance require separate evidence.

## Choose an operation

- **Clarify** resolves goals, performs necessary research or diagnosis, develops design, and forms or revises `plan.md` in the same operation. Resolve the goal, necessary design, and consequential choices before making a unit executable; keep required subtask clarification in the parent Plan. Explicit discussion-only, design-only, no-plan, pause, and writing restrictions remain effective. Preparation does not start implementation.
- **Execute** implements in the current session and coordinates self-check and independent Verify. Without a narrower limit, it continues the remaining Plan, usually one unit at a time and several serially.
- **Verify** independently evaluates specified materials or an implementation candidate without editing it. Each report names its candidate, evidence, verdict, and limits.
- **Ship** performs the delivery defined by the project under the actual request and permissions. It need not mean production release or Task closure.
- **Supervise** schedules independent Workers instead of implementing itself. It can assign independent units to separate Workers while preserving each unit's review boundary.

An actual `/wl-exec` or equivalent direct Execute request starts the resolved owning Task from `planning` to `open` before Plan readiness is checked. An `open` Task continues without another start; a `closed` Task still needs separate reopening permission. Returning to Clarify for missing planning or problems found during execution, verification, or user acceptance keeps the Task `open`, never `planning`.

Check is preparation's implicit material inspection. Goal discussion and Plan completion do not start execution or invite it in the closing reply.

## Keep materials focused

The owning tk Task holds the materials. `goal.md` states the desired result and stopping conditions without implementation methods. Optional `design.md` explains the approach. Optional diagnosis records the problem and supported causes without repair recommendations. Research summarizes sources; Grill preserves discussion.

Every task entering Execute needs an independent `plan.md`, even a single-unit change. It can expand units inline or link to tk subtasks. Execution records preserve candidates and checks. Preparation self-check normally uses `plan-check.md`; requested independent preparation review appends to `material_check.md`; independent Verify of an executed candidate appends to `verification.md`. An executed Markdown-only unit is still an implementation candidate. Preserve prior assessments and failures. Optional activities need no empty files or role matrix.

The parent Plan covers every confirmed subtask, including work that still needs clarification or is blocked. Keep its goal, owner, current step, dependencies or blockers, and material links in the parent; detailed contracts and evidence stay with the child. For separate child preparation, name the Clarify step, inputs, expected goal, necessary design and Plan materials, completion conditions, and continuation. Link existing materials rather than creating empty child Plans. A Task index alone is insufficient.

For example, a parent Plan may include this entry while an unrelated unit is ready for implementation:

```text
U02 Support policy
Goal: publish the supported scope and contact route.
Owner and materials: the policy subtask, linked through its existing Task and design.
Current step: Clarify the policy using the draft options and maintainer decisions.
Blocker: the maintainer must choose the supported scope and contact route.
Preparation result: confirmed goal, necessary design, and an executable child Plan.
Continuation: read those results and update U02's next step, dependencies, and links
before implementing the policy under the applicable permission.
```

Recording the questions does not complete preparation, and preparation does not complete U02's final result. Keep stable labels, completed results, and valid evidence when updating the Plan. Execute and Supervise continue unrelated authorized ready work without dropping unresolved scope or assigning it as implementation. Preparation checks detect omitted subtask work, even when it is not ready to implement.

## Understand checks

A formed Plan receives preparation self-check by default. Preparation's independent Verify starts on user request and includes necessary in-scope author repairs and rechecks unless the user limits it. Implementation requires both quick self-check and independent Verify for each unit.

Self-check defaults to a selected maximum of three to five inspections, overridable in external guidance. A pass ends early. Preparation and each implementation unit count separately. Preparation counts are per Clarify round: a later round starts a fresh count after the previous round returns for a new request, a returned material or design defect, or changed requirements or basis, and an earlier exhausted round does not block it. A round declared only to obtain a fresh count remains the same round. Within a round or an implementation unit, revisions, repairs, and Verify feedback do not reset the count. At the applicable limit, stop adding self-checks, finish actionable repairs, and report unrechecked changes. Independent Verify has no self-check limit.

Execution normally needs no repeated confirmation for in-scope implementation, repairs, checks, or independent Verify. Execute and Supervise prohibit structured question tools; indispensable user-only decisions are raised in ordinary text. `confirm` requests item-by-item confirmation without removing checks or enabling structured questions. `nowait` changes cross-session request waiting, not self-check barriers or permission.

Verification, user acceptance, integration, installation, publication, and Task closure are distinct. Verified dependency candidates can support subsequent development under project rules without integration permission. Changed candidates require affected evidence to be refreshed.

## Examples

Use the selected Skill name and your actual Task reference in the request. No host-specific slash command is required.

```text
Use workloop to clarify this idea and save the agreed goal.
Use workloop to write a one-unit Plan for the already-confirmed goal.
Use workloop to discuss the design only. Do not form a Plan or implement it.
Use workloop to execute the remaining Plan for this Task.
Use workloop to execute only U02 for this Task.
Use workloop to supervise the independent units in this Plan.
Use workloop to independently verify these preparation materials.
Use workloop to ship this candidate according to the project's delivery definition.
```

For Chinese guidance, request `workloop-zh` and express the operation in Chinese. Either language supports the complete workflow. An infeasible or unnecessary task may stop after a supported conclusion, with any closure handled through tk's applicable permission rather than a forced Plan.

## Configure defaults

Initialization is optional. Ask to initialize or reconfigure the selected Skill; its short setup link leads to the full instructions. Settings belong in appropriate external guidance such as `AGENTS.md`: independent role models and reasoning, the two self-check limits, collaboration choice, project work conventions, and Ship's intended result. A Senior default model does not activate a Senior.

Explicit current choices override continuing choices, which override applicable defaults. Preserve exact model selectors and aliases. workloop does not embed machine-specific models or create a user/project configuration hierarchy. Ordinary operations do not perform proactive availability checks; actual errors lead to focused diagnosis.

## Recover work

Retain the current activity's Task or configuration scope, basis, candidate where relevant, permissions, restrictions, inspection count when applicable, and next action in recoverable state. Reload a missing entry, operation, or currently required reference from the selected installed Skill. A remembered link is not loaded text. No particular Pin API is required.

## Validation scope

The distributed material is instruction text. Directory completeness, internal links, and scenario walkthroughs can be checked without a live Harness. Host discovery, actual Agent behavior, and user outcomes need their own exercised evidence; a file check does not prove them. Keep those claims separate when evaluating a particular installation.

Repository checks treat Markdown in either language Skill's shared reference directory as documentation, without registering each filename. Unknown operations or languages, legacy command paths, non-Markdown files, shared check inputs, and mixed unknown changes retain complete-check fallback.
