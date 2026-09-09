# ADR proposal: Attempt prompt replacement without version restrictions

Decision owner: Ruokee
Draft writer: OMP GPT-5.6 Sol

English | [中文](./2026-09-09-attempt-compatible-host-prompts.zh.md)

## Motivation

The current extension rejects every OMP version except `18.1.11` before it examines the rendered system prompt. A newer OMP release may still supply an input that the extension can transform, but the version gate disables the extension and leaves the default prompt active.

The extension already validates the complete target structure before producing a replacement. That structural validation is the effective compatibility check. A version number alone does not show that the rendered input is incompatible.

This proposal reverses the exact runtime version gate in [the current OMP system prompt extension decision](../decision/2026-09-07-add-omp-system-prompt.md).

## Proposal

Attempt the replacement whenever the host loads the extension and the extension can call the public APIs it needs. Tested OMP releases provide verification evidence only and do not limit activation or installation.

Run the existing structural recognition, settings read, Skill metadata matching, output construction, and output validation on each turn. If they succeed, apply the owned prompt. If an operation throws or the input fails a structural check, leave the incoming prompt unchanged and report the concise reason through the existing session diagnostic channel.

Remove `unsupported-version` as a runtime failure reason. Do not inspect the host version to decide whether to activate, transform, warn, or fall back. Declare the OMP host package as a peer dependency without a version restriction.

## Alternatives considered

### Keep the exact runtime version gate

This is the current behavior. It prevents the extension from attempting a structurally compatible prompt after any newer OMP release, so it does not meet the compatibility requirement.

### Maintain an allowlist of reviewed versions

An allowlist would still disable the extension after each unlisted release before testing the actual input. It repeats the same failure mode with more maintenance.

## Acceptance criteria

- A newer OMP release is processed by the normal transformation path instead of being rejected as `unsupported-version`.
- A structurally compatible prompt is replaced without inspecting the host version.
- A structurally incompatible prompt remains unchanged and emits the existing bounded replacement diagnostic.
- An unexpected exception during turn processing leaves the incoming prompt unchanged, emits a bounded diagnostic, and does not block the model request.
- Public documentation reports tested OMP releases as evidence, without defining a supported version boundary.
- Component checks and repository checks pass.

## Risks

A later host may keep a recognizable prompt shape while changing the meaning of a public API or a section the extension preserves. Structural checks can miss that semantic change, and the extension then applies an incorrect replacement. Real-host checks provide evidence only for tested releases and cannot rule out the same failure in an untested host.
