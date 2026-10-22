# Skill

English | [中文](./skill.zh.md) | [Dictionary](./README.md)

Chinese term: 技能

A set of instructions that a host discovers and loads, with a `SKILL.md` and supporting files. Publicly distributed Skills are self-contained components; internal project Skills are repository maintenance material.

## Mechanism

A Skill is instructions, not code loaded into the host process. The host discovers it at its skill root and loads the instructions when the task matches or the user invokes it. Public English Skills live at `skills/<name>/`; their Chinese variants live at `variants/zh/skills/<name>/` with the same file set and scope. Installation copies the selected variant to `<skill root>/<name>/`.

A public Skill may include references, workflows, examples, and a glossary. Its files reference only files inside its own directory. Internal project Skills under `.agents/skills/` may read the project documents they maintain and are not public installation sources; the [repository spec](../../.agents/spec/repository.md) covers them.

## Example

`code-quality` is Agent-invoked; `grill-me` is user-invoked. Both carry their own `SKILL.md` and supporting files.

## Avoid

Avoid "plugin" for a Skill. A plugin is a host extension, not an instruction component.

## Skill root

The parent directory that contains installed Skills, each at `<skill root>/<name>/`. The installer copies a Skill there without the source-only `variants/zh/` prefix.

## User-invoked

A Skill invocation mode that requires an explicit user command, such as `/skill:grill-me`. The model does not load the Skill on its own.

## Agent-invoked

A Skill invocation mode that lets the model load the Skill when its task matches. The Skill description states when it applies.
