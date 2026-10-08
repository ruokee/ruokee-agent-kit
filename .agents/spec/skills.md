# Skills

English | [中文](./skills.zh.md)

Spec for the ordinary Skills under `skills/` and their Chinese variants under `variants/zh/skills/`. The tk Skills ship with tk and are covered by [.agents/spec/tk.md](./tk.md).

## Goals

- Ship each Skill as a self-contained, host-discoverable component: the English base at `skills/<name>/` and the Chinese variant at `variants/zh/skills/<name>/`.
- Install a selected language variant at the host's normal Skill path, `<skill root>/<name>/`, without the source-only `variants/zh/` prefix.
- Keep each Skill understandable on its own. A link to another Skill may only point to related reading.
- Mark each Skill in the repository capability index as user-invoked or Agent-invoked.

## Non-goals

- Plugin manifests, marketplace metadata, package changelogs, host-specific Agent definitions, or package README files inside a Skill tree.
- Third-party Skills, forks, or upstream mirrors. A Skill may cite, quote, or adapt third-party material.
- Structure prebuilt for hypothetical Skills.

## Public surface

- Skill list and invocation mode: [Skills](../../README.md#skills) in the repository README.
- Checking, installing, updating, uninstalling, and backups: [docs/installation.md](../../docs/installation.md).
- Each Skill's behavior: its own `SKILL.md` and the files beside it.

## Invariants

- References inside a Skill resolve within that Skill's directory. A Skill does not link to, depend on, or instruct loading another repository component or a repository support file.
- Links inside a Chinese variant use the installed `skills/<name>/` form.
- The two language variants of a Skill have the same file set and the same scope. Neither omits an observable capability or a required instruction that the other has, and both change together.
- A Skill tree holds host-discoverable material such as `SKILL.md`, workflows, references, examples, and glossaries, plus required source attribution and license notices. `grill-me` keeps its `agents/openai.yaml` invocation policy.
- `grill-me` loads only on explicit user invocation. `architect`, `code-quality`, `deep-research`, `msgspec`, `python-engineering`, and `well-said` may be loaded by the model.
- Review workflows in `code-quality` and `python-engineering` may report findings and recommendations, but a review request does not authorize changes to the reviewed files.
- Material adapted from a third party keeps its source attribution and license notice in both language variants.
- `well-said` applies when outputting anything. Its complete writing guidance includes defensive phrasing and distinguishes work problems from wording problems. Each language component declares its version in `metadata.version` and keeps source attribution and licenses in adjacent files, as defined by the [well-said decision](../adr/decision/2026-10-08-rewrite-well-said.md).
- The installer never writes into `skills/` or `variants/zh/skills/`.

## Host lower bound

None. Skills are instructions and do not load code into a host process, so they have no maintenance lower bound. See [.agents/spec/host-compatibility.md](./host-compatibility.md).

## Acceptance criteria

- Every Skill under `skills/` has a same-name Chinese variant with the same file list.
- No link inside a Skill resolves outside its own directory.
- `pnpm check:skills` passes.
- The English and Chinese capability indexes in the repository README list the same Skills with the same invocation mode and link to both variants.
- Skills whose decisions require real-host or real-model checks, such as `grill-me` and `well-said`, keep those checks when their behavior changes.

## Related ADRs

- [Package Skills as self-contained language variants](../adr/decision/2026-08-20-package-self-contained-skill-variants.md)
- [Keep distributable components self-contained](../adr/decision/2026-08-24-keep-components-self-contained.md)
- [Establish a first-party Agent capability kit](../adr/decision/2026-08-20-establish-first-party-capability-kit.md)
- [Colocate English and Chinese public documentation](../adr/decision/2026-09-07-colocate-bilingual-docs.md)
- [Add the user-invoked grill-me Skill](../adr/decision/2026-09-06-add-grill-me-skill.md)
- [Allow model invocation of architect](../adr/decision/2026-09-18-make-architect-model-invoked.md)
- [Provide the deep-research Skill](../adr/decision/2026-09-06-migrate-deep-research.md)
- [Rewrite the well-said Skill](../adr/decision/2026-10-08-rewrite-well-said.md)
- [Review authorization](../adr/decision/2026-09-06-review-authorization.md)
