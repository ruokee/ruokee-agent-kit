# Glossary

## Task

A temporary project effort worth preserving. Creating a Task does not imply a commitment to execute or complete it.

## Task metadata

The runtime-managed schema version, identity, name, lifecycle status, creation time, relationships, and optional extra value stored in `tk.toml` or embed `TASK.md` frontmatter.

## Task body

The ordinary Markdown content in `TASK.md`, excluding managed embed frontmatter.

## Metadata carrier

The canonical file that stores Task metadata under the project's configured mode: `tk.toml` in split mode or `TASK.md` in embed mode.

## Task reference

A full UUIDv7, absolute Task directory, absolute canonical carrier path, or project-relative Task path accepted by exact operations.

## Harness

The software environment around a model that enables it to operate as an Agent, including the interaction loop, prompts, context, tools, permissions, and hooks. Codex, Claude Code, Pi, and OMP are supported Harnesses.

## Component

A self-contained tk unit assembled and installed for one Harness.

## Adapter

Code that maps Pi or OMP native tool calls to the public tk process interface.

## Cleanup manifest

A minimal manifest containing only its format version, producer process identity, creation time, and tk-created temporary paths.

## Activity marker

A process marker that blocks other project writes during a multi-target operation and remains until successful cleanup or GC.

## Partial commit

The fact that a multi-target operation completed only part of its target set before an error or cancellation.

## WAL

The ordinary append-only Markdown work activity log for durable events that are not current Task state.

## Clean uninstall

Removal that returns a Harness to the state it would have had if tk had never been installed, while preserving unrelated content.
