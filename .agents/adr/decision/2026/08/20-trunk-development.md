# Trunk development

Decision owner: Ruokee
Decision writer: OMP GPT-5.6 Sol

English | [中文](./20-trunk-development.zh.md)

## Motivation

Keep `main` as the only long-lived branch, develop each change on a short-lived branch, and squash-merge it into `main`.

Repository initialization, Skill imports, documentation changes, and later capability work produce different numbers of intermediate commits, and publishing every one of them would turn review context and local experimentation into permanent maintenance cost.

## Decision

Use `main` as the only long-lived branch. Start each feature, fix, documentation change, or repository task on a short-lived branch created from current `main`.

Commit coherent steps to the task branch and keep the task working tree clean. Write commit messages in English and follow Conventional Commits. Let commit hooks validate the message and the staged files.

After explicit review and merge authorization, squash the task branch into one Conventional Commit on `main`. Do not use a plain merge, fast-forward merge, rebase-and-fast-forward, or direct branch reference movement as the integration method.

Treat pushes and branch deletion as separate external actions that require explicit authorization. A request to commit authorizes a branch commit, not a merge or push.

## Alternatives considered

None

## Consequences

`main` is the only long-lived branch. Every repository task starts from current `main` on a short-lived branch, uses English Conventional Commit messages, passes installed hooks, and reaches review with a clean working tree.

After explicit authorization, the task enters `main` as one squash commit. Commit, merge, push, and branch deletion remain distinct authorization boundaries.

Squashing removes intermediate commit identifiers from public history. Important rationale therefore belongs in ADRs, code, or documentation rather than temporary branch commits.

A large task can still produce an oversized squash commit. Such work must be split by independently reviewable behavior instead of preserving accidental work-in-progress commits.

## Changes

### 2026-09-02 ADR proposal integration

An approved ADR proposal reaches `main` as its own squash commit before implementation begins. Implementation starts from that updated `main` on a new short-lived branch and reaches `main` through a separate review and squash.
