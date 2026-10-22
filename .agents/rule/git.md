# Git

English | [中文](./git.zh.md)

The [repository spec](../spec/repository.md) states the properties these rules serve: `main` is the only long-lived branch, integration happens through squash merge, and commit messages follow a fixed format and scope set.

## Branches

- Create a short-lived branch from current `main` for each feature, fix, or documentation change, except for authorized dependent development below. Never edit or commit directly on `main`.
- Use an independent worktree under `.worktrees/` for code, configuration, scripts, parallel tasks, or any task whose exclusive use of the main working directory cannot be confirmed.
- Use the main working directory only for a serial explanatory Markdown or ADR task that is clean, has no parallel work, and has confirmed exclusive use.
- Do not qualify a runtime template for that exception. Qualify an explanatory document consumed by tests only together with its consumer checks.
- Create and switch to the short-lived branch before editing. Stop editing in the shared directory and preserve the work in an independent worktree before continuing when the scope grows beyond explanatory Markdown or exclusive use is lost.
- For authorized multi-unit development, a later unit may branch from a verified, committed predecessor containing its dependencies before that predecessor merges. Freeze the predecessor and record each unit's branch, base, candidate, and verification scope. This exception changes the development base, not proposal approval, archival authority, or integration permission. Integrate units through separate squash merges in dependency order.
- Run `git worktree remove` in the teardown step after the branch has been merged into `main`. The merge authorization covers this cleanup.

## Commits

- Stage only the files that belong to the current task, and commit each atomic task to its branch separately.
- Write commit messages as English Conventional Commits, with the types from the standard set and the optional scope set the spec declares.
- Let `git commit` run the quality hooks. Review and restage the task files when a hook modifies them, then retry the commit.
- Use `git commit --amend` only to edit a commit message, and never to add, remove, or replace committed changes.
- Commit the task changes and leave the working tree clean before requesting review.

## Authorization

- Treat a request to commit as authorization for a branch commit only.
- Merge into `main` only after explicit user review and authorization, and squash-merge the task branch into `main`. Do not use a plain merge, a fast-forward merge, a rebase-and-fast-forward, or direct ref movement.
- Never push without explicit authorization, and never delete a branch without explicit authorization.
- Do not treat a review request as authorization to edit the reviewed files.
