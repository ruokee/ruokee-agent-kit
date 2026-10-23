# Trunk development

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol
Reverses: [Trunk development](../../../archived/2026/08/20-r1-trunk-development.md)

English | [中文](./20-trunk-development.zh.md)

## Motivation

Keep `main` as the only long-lived branch, develop each change on a short-lived branch, and squash-merge it into `main` with its adopted decisions.

Repository initialization, Skill imports, documentation changes, and later capability work produce different numbers of intermediate commits, and publishing every one of them would turn review context and local experimentation into permanent maintenance cost.

The [predecessor](../../../archived/2026/08/20-r1-trunk-development.md#2026-09-02-adr-proposal-integration) required an independently integrated ADR proposal before implementation. The [ADR mechanism](./22-adr-mechanism.md) keeps discussion and approval in tasks and formal decisions with their implementation, so this separate proposal stage is not part of trunk development.

## Decision

Use `main` as the only long-lived branch. Start each feature, fix, documentation change, or repository task on a short-lived branch created from current `main`. For authorized multi-unit development, a later unit may instead branch from a verified, committed predecessor containing its dependencies before that predecessor merges. Freeze that predecessor and record each unit's branch, base, candidate, and verification scope. Integrate units through separate squash merges in dependency order.

Commit coherent steps to the task branch and keep the task working tree clean. Write commit messages in English and follow Conventional Commits. Let commit hooks validate the message and the staged files.

After explicit review and merge authorization, squash the task branch into one Conventional Commit on `main`. Do not use a plain merge, fast-forward merge, rebase-and-fast-forward, or direct branch reference movement as the integration method.

For a durable choice requiring implementation, integrate its formal decision and any replaced-version archival with that implementation. A document-only choice may be integrated as a documentation change. Neither using a verified predecessor nor preparing a decision grants approval, archival, or integration permission.

Treat pushes and branch deletion as separate external actions that require explicit authorization. A request to commit authorizes a branch commit, not a merge or push.

## Alternatives considered

None

## Consequences

`main` is the only long-lived branch. Each repository task uses a short-lived branch from current `main` or an authorized verified predecessor, English Conventional Commit messages, installed hooks, and a clean working tree for review.

After explicit authorization, the task enters `main` as one squash commit. Commit, merge, push, and branch deletion remain distinct authorization boundaries.

Squashing removes intermediate commit identifiers from public history. Important rationale therefore belongs in ADRs, code, or documentation rather than temporary branch commits.

A large task can still produce an oversized squash commit. Such work must be split by independently reviewable behavior instead of preserving accidental work-in-progress commits.
