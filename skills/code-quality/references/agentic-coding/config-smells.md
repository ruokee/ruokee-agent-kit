# Agent Configuration Smells

The files that configure an AI agent — `AGENTS.md`, `CLAUDE.md`, SKILL files, prompt rules, permission manifests, workflow docs — are engineered artifacts, and they degrade in characteristic ways. Like the code smells in [code-smells](skills/code-quality/references/refactoring/code-smells.md), each item below is a *symptom that invites investigation*, not a verdict. A long configuration file can be exactly right; a duplicated rule can be a deliberate reminder. The judgment is always whether the smell is costing the agent accuracy, tokens, or coherence — and the false-positive boundary at the end of each section is as important as the detection signals.

These smells are platform-neutral. Whether the agent is Claude, Codex, Cursor, or something else, the underlying mechanics are the same: a finite context window, instructions read as priorities, references the model may or may not follow, and configuration that drifts from the codebase it describes.

## Context Bloat

**What it is.** Low-frequency, verbose, or task-irrelevant information permanently loaded into the agent's context on every turn. The classic shape is a giant system prompt that pastes an entire style guide, full tool documentation, and exhaustive examples inline, so they are present whether or not the current task needs them.

**Why it matters.** Context is a fixed budget shared with the actual task. Every token spent on always-on reference material is a token unavailable for the file under edit, the error output, or the reasoning chain. Beyond raw budget, signal dilutes: the rule that matters for this task sits buried among hundreds of lines that do not, and the model weights them roughly equally. Bloated context also raises cost and latency on every single turn, not just the turns that need the information.

**Detection signals.** A system prompt or always-loaded config measured in many thousands of tokens. Entire documents pasted inline rather than linked. Reference material (API specs, full style guides, long enumerations) present regardless of task. The same large block loaded across every session even though most sessions never touch its subject.

**Resolution.** Progressive disclosure: keep the always-on layer small and route to detail on demand. Replace inline dumps with a one-line summary plus a link the agent reads only when the trigger applies (see [Blind Reference](#blind-reference) for how to write the link). Load conditionally — gate domain-specific context behind the task that needs it. This skill's own structure is an example: SKILL files stay lean and point to leaf documents like this one, which load only when a relevant signal appears.

**Example scenario.** An `AGENTS.md` grows to 1,200 lines because every library convention, every past incident, and the full deployment runbook were pasted in "so the agent always has them." A typo-fix task now reads all 1,200 lines, and the deployment section crowds out the function actually being edited.

**False-positive boundary.** Small, high-frequency, genuinely cross-cutting rules belong in always-on context — that is not bloat, that is the job of the config. A 30-line `AGENTS.md` that every task depends on is correctly sized. Length alone is not the smell; *irrelevance-weighted length* is. Audit by frequency of use, not by line count.

## Skill Leakage

**What it is.** Task-specific knowledge placed at the wrong abstraction level — either too high, where it clutters global context for everyone, or too low, where the agent that needs it will never reach it. It is a layering error: the right knowledge in the wrong tier.

**Why it matters.** Knowledge at too high a level is a form of [Context Bloat](#context-bloat) — a niche rule taxes every unrelated task. Knowledge at too low a level is worse in a quiet way: the agent never loads it, silently violates a constraint it would have honored, and no one notices until the output is wrong. Both are misroutings of the same information.

**Detection signals.** Project-specific or repo-specific rules sitting in a global, user-level config. A critical, high-frequency constraint buried three links deep in a rarely loaded leaf. Expert-level edge-case guidance placed in a beginner-facing onboarding prompt, or vice versa. A rule whose natural audience is "only tasks touching subsystem X" living somewhere all tasks pay for.

**Resolution.** Layer by frequency and scope. Global config holds only what is true across all projects; project config holds project truths; a skill or leaf holds what only its triggering task needs. Match the load condition to the knowledge's real audience: high-frequency and broad goes up, low-frequency and narrow goes down — but never so far down that its triggering task cannot find it.

**Example scenario.** A user's global `~/.claude/CLAUDE.md` contains "in this repo, migrations run via `make db-upgrade`." Every project that user touches now carries an instruction that applies to one repo, while the repo's own config — where it belongs — stays silent.

**False-positive boundary.** Some knowledge genuinely is cross-cutting and belongs high even though it looks specific (a security rule that must never be missed may justly live in always-on context). And deliberately deferring rare, heavy detail to a deep leaf is correct design, not leakage, *as long as* a reliable trigger routes the agent there when it matters.

## Lint Leakage

**What it is.** Rules that a formatter, linter, or type checker already enforces mechanically, restated as natural-language prompt rules. "Always use 4-space indentation," "sort imports alphabetically," "no unused variables," "lines under 88 characters" — all of these are already someone else's job.

**Why it matters.** A deterministic tool enforces these perfectly and for free; a prompt rule enforces them probabilistically and at the cost of context budget and attention. Worse, prompt-stated formatting rules invite the agent to spend reasoning on hand-formatting code that the formatter would rewrite anyway, and they go stale the moment the tool's config changes — now the prompt and the `.ruff.toml` disagree, and the agent has two masters. Mechanical rules in prose dilute the rules that actually need a human-language explanation.

**Detection signals.** Any prompt rule that a `ruff`, `eslint`, `prettier`, `black`, `gofmt`, or `mypy` config could express. Formatting, import ordering, whitespace, naming-case, unused-symbol, or line-length rules stated in `AGENTS.md`. Instructions duplicating a `.editorconfig` or pre-commit hook already in the repo.

**Resolution.** Delete them from the prompt and trust the tool. Point the agent at the command instead ("run `ruff check --fix` before committing") rather than re-implementing the ruleset in prose. Reserve prompt space for the things tools *cannot* check: architectural intent, when to abstract, domain rules, and any behavior that would surprise someone who only read the tool config.

**Example scenario.** `AGENTS.md` lists fifteen style rules — indentation, quote style, trailing commas, import grouping — every one of which is already in the repo's `ruff` and `prettier` configs. The agent dutifully re-derives them, occasionally conflicts with the formatter, and the fifteen lines crowd out the one rule that matters: "never call the billing API from a request handler."

**False-positive boundary.** Mentioning a rule *because the tool's behavior would surprise the agent* is legitimate — for example, noting that a non-standard formatter config does something unusual, or that a specific lint rule is intentionally disabled and why. The smell is restating what the tool already does silently and correctly, not explaining where the tool diverges from expectation.

## Blind Reference

**What it is.** A pointer to another file, URL, or document with no statement of *when* to read it, *what* it establishes, or *what it does not* cover. "See also: `architecture.md`" with no surrounding context is a blind reference; so is a flat list of links with no routing logic.

**Why it matters.** An agent deciding whether to spend a tool call and context budget on opening a reference needs a reason. Without a trigger condition, the agent either ignores the link (and misses required context) or opens everything defensively (and reintroduces [Context Bloat](#context-bloat) by other means). A reference with no purpose statement also can't be reasoned about: the agent can't tell whether the document is authoritative, illustrative, or merely tangential, so it can't weigh what it reads there.

**Detection signals.** "See also" or "refer to" lines with no condition attached. Lists of links under a heading with no per-item routing. References that don't say what the target proves, so the agent can't decide if the answer it found is authoritative. Pointers to external URLs with no note on what to extract or why.

**Resolution.** Every reference earns its place with a trigger and a purpose: *when* the agent should follow it and *what* it will get there. The index and routing tables elsewhere in this skill are the model — each row pairs a signal in the code with the document that addresses it. A good reference reads "when X, read Y, which establishes Z," not "see Y."

**Example scenario.** A workflow doc ends with "Related: `deploy.md`, `rollback.md`, `secrets.md`." The agent, mid-task on a code change, can't tell whether any of these are relevant now, so it either reads all three (wasting budget) or none (missing the deploy precondition that `deploy.md` would have surfaced).

**False-positive boundary.** A curated index whose surrounding prose already supplies the routing logic doesn't need a trigger restated on every single line — the context is established once for the section. And a "further reading" pointer that is genuinely optional enrichment is fine when it's labeled as optional, so the agent knows it can skip it without risk.

## Init Fossilization

**What it is.** Configuration produced by an initialization or scaffolding template that has since drifted from the actual codebase. The config describes a project that no longer exists: rules referencing deleted files, workflow steps for abandoned processes, permissions for tools no longer in use, directory-structure descriptions that no longer match the tree.

**Why it matters.** Stale configuration is actively misleading in a way that no configuration is not. The agent treats every instruction as currently true, so a rule pointing at a deleted module sends it looking for something gone, and a workflow step for a retired CI pipeline makes it perform or expect actions with no effect. Fossilized permissions are a quieter risk: they may grant access to tools that should have been revoked, or block tools the project now depends on. The agent has no way to know the config lies; it reasons confidently over fiction.

**Detection signals.** Rules naming files or directories that no longer exist (grep the config's paths against the tree). Workflow steps referencing processes, services, or commands the team has abandoned. Permission entries for tools nobody uses anymore. A "project structure" section that doesn't match `ls`. Boilerplate phrasing characteristic of an `init` template that was never edited for this project.

**Resolution.** Periodic audit, ideally tied to a recurring trigger (a release, a dependency bump, a quarterly review). Resolve each path and tool reference against current reality and delete what no longer holds. Treat the config as code that needs maintenance, not as a write-once artifact. When a file or process is removed in a change, sweep the config in the same change.

**Example scenario.** A repo's `CLAUDE.md` still says "run tests with `make test` and check coverage in `htmlcov/`," but the project migrated to `pytest` directly and deleted the Makefile six months ago. The agent runs `make test`, gets "no such target," and wastes a turn rediscovering how the project actually builds.

**False-positive boundary.** Not every mismatch is fossilization — a config may *intentionally* describe a target state the codebase is migrating toward, or document a convention that's aspirational and enforced going forward. Confirm the reference is meant to describe current reality before deleting it; an in-progress migration legitimately has config ahead of code.

## Conflicting Instructions

**What it is.** Two rules that contradict each other with no mechanism to decide which wins — no stated scope, no priority order. A global rule says "always do X," a project rule says "never do X," and nothing tells the agent how to reconcile them.

**Why it matters.** Faced with a contradiction and no resolution rule, the agent picks one nondeterministically, or oscillates between them across turns, or follows whichever it read most recently. Behavior becomes unpredictable and unauditable — you can't reason about what the agent will do because the config doesn't determine it. Contradictions also erode trust in the whole config: once the agent has seen two rules conflict, every rule becomes a candidate for "maybe this one is overridden too."

**Detection signals.** Always/never pairs on the same subject across files or sections. Rules that overlap in scope without saying which scope is narrower or higher priority. A config that resolves a contradiction by piling on exceptions ("always X, except when Y, unless Z") rather than restructuring. Layered configs (global, project, task) with no stated precedence between layers.

**Resolution.** Make scope and priority explicit. State which layer wins when layers disagree (typically the most specific: task over project over global). Give each rule a clear scope so two rules don't both claim the same situation. Most importantly, resolve the contradiction at the source rather than papering over it — if two rules genuinely conflict, one of them is wrong or they belong to different scopes, and the fix is to correct or separate them, not to add a third rule mediating the first two. This skill's own configs state an explicit priority order for exactly this reason.

**Example scenario.** Global config says "always write tests for new functions." A project's config says "this is a prototype, skip tests." Neither references the other. The agent writes tests for some functions and not others depending on which instruction is more salient in a given turn, and the test suite ends up half-complete and incoherent.

**False-positive boundary.** Rules that *look* contradictory but operate at different, clearly-stated scopes are not in conflict — "default to X" plus "in subsystem Y, do Z instead" is a correct general-rule-and-exception structure, not a smell, as long as the scopes are explicit and don't overlap ambiguously. The smell is unresolved contradiction, not the coexistence of a rule and its scoped exception.
