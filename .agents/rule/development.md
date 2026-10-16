# Development

English | [中文](./development.zh.md)

## Planning

- Read the documentation that covers the capability or area you are about to change before analyzing requirements or starting development.
- Search the [specifications](../spec/README.md), the [ADR proposals and decisions](../adr/README.md), and the rule pages for the area before planning a requirement, and reuse what they already state.
- As far as possible, read the rule pages that apply to the work, and check the work against them before reporting it done.
- Limit changes to the requested capability. Do not prebuild structure or capability for hypothetical Skills, hosts, or requirements.

## Validation

### Environments

- Prepare root dependencies with `pnpm install --frozen-lockfile`, then install Git hooks with `pnpm hooks:install`. The hooks format staged files before each commit and check the commit message.
- Prepare root tools and only the environments the selected checks need, as described in [Check prerequisites](../../README.md#check-prerequisites). Use locked versions.
- Keep independent writable dependency and build directories for each branch, and do not share `node_modules` or build output across branches. Package-manager content caches may be reused within the same trust boundary.
- Prepare a selected environment again when its manifest or lockfile changes.
- Report a missing prerequisite that needs elevated or global access, and keep the result and the missing prerequisite recorded.

### Checks

- Run `pnpm check:changed` from the repository root during development and before requesting review. It includes committed and working-state changes relative to the merge base with local `main`, keeps deletion and rename paths, and selects a deduplicated check union.
- Use `pnpm check:changed --base <ref>` for the merge base of another ref with `HEAD`, not a comparison of branch tips. The command does not fetch history.
- Rank consumer rules above the ordinary Markdown rule. Unknown components, including their Markdown files, are not treated as formatting-only. A deleted explanatory document may need no formatter, and an empty affected result is not complete merge validation.
- Let unknown inputs, shared inputs, and unreliable classification fall back to one complete `pnpm check`.
- Run a component's checks from that component, where they live beside it.
- Update the complete aggregate, the selector mapping, and the selector regression tests together when adding a component or a document consumer, or when changing a required automated check.
- Let a missing selected tool or local dependency fail the check. Do not skip tests, rewrite hooks, or substitute a global tool to hide the problem.
- Keep dependency installation and source formatting out of check commands. Prepare missing dependencies separately under [Environments](#environments) before rerunning checks.
- Use targeted `pnpm check:*` commands only when needed. `pnpm check:base` covers Markdown and Rust checks, not component checks.
- Treat automated success as no proof of real-model behavior or interactive UI correctness, and follow the component's own scenario and release validation as well.
- As far as possible, consult applicable specs, ADRs, and rules when validating or evaluating work, and check the result against them.

The [selector](../../scripts/check-changed.mjs) maintains an explicit mapping:

| Changed scope | Selected checks |
| --- | --- |
| Known explanatory Markdown, including ADRs, specifications, rule pages, root READMEs, Skills, and component documentation | Prettier for changed files that still exist, using the repository configuration and ignore rules |
| Registered OMP component non-Markdown files, or Markdown under its `src/` or `test/` | That component's `typecheck` and `test`, plus changed Markdown formatting |
| tk non-Markdown files, or Markdown in its `skills/`, `claude/`, `pi/`, or `omp/` packaging trees | Rust formatting and tests, native adapter tests, and changed Markdown formatting |
| [docs/installation.md](../../docs/installation.md), its Chinese counterpart, or the Skill installation and lifecycle scripts | Skill lifecycle tests, plus changed Markdown formatting |
| Multiple known scopes | Their check union, without duplicate execution |
| Shared toolchain or check inputs, selector changes, unknown paths, or an unreliable baseline or classification | One complete `pnpm check`, without first running partial checks |

### Merge gate

- Run the complete `pnpm check` on the clean, committed final candidate before merge. The candidate must contain target `main`.
- Record the candidate commit and tree, the target commit, the command, and the result.
- Treat further tracked changes, pending changes, a changed candidate, or an advancing target as invalidating the recorded success. Form a new final candidate and repeat complete validation.
- Confirm before an authorized squash merge that the target is unchanged and that the merged tree equals the validated tree.
