# Dictionary

English | [中文](./README.zh.md)

This dictionary is the shared vocabulary for developing this repository. It is authoritative for shared terms: use its canonical term and definition in repository documents, rules, specifications, decisions, task materials, and discussions about repository work.

Each entry gives the canonical English term, its Chinese term, and a one-sentence definition. A linked term has a page with mechanism, examples, and boundary notes. Terms without a page are defined here.

Component glossaries keep their own copies for use after installation in other projects. This dictionary covers development of this repository.

## Repository and components

**[component](./component.md)**（组件）

A first-party capability kept in its host-native or build-native format, with its own documentation, checks, and version.

**capability**（能力）

A unit of Agent functionality that the repository distributes as a component, such as a Skill, extension, executable, or host package.

**[Skill](./skill.md)**（技能）

A set of host-discoverable instructions with a `SKILL.md` and supporting files. Public Skills are self-contained components; internal project Skills are repository maintenance material.

**[language variant](./component.md#language-variant)**（语言变体）

A complete translation of a component with the same file set and scope, maintained beside the English base.

**extension**（扩展）

A host plugin or runtime addition that changes or adds Harness behavior without being a Skill.

**[host](./agent.md#host)**（宿主）

The Agent Harness or product that discovers, loads, and runs a component.

**[skill root](./skill.md#skill-root)**（技能根目录）

The parent directory that contains installed Skills, each at `<skill root>/<name>/`.

**[self-contained](./component.md#self-contained)**（自包含）

A property of a distributable component: its files reference only files inside that component and its code does not depend on other repository content. Component text may declare another component, tool, or Skill as a runtime prerequisite.

**[user-invoked](./skill.md#user-invoked)**（用户调用）

A Skill invocation mode that requires an explicit user command, such as `/skill:grill-me`.

**[Agent-invoked](./skill.md#agent-invoked)**（Agent 调用）

A Skill invocation mode that lets the model load the Skill when its task matches.

**selector**（选择器）

The check-changed script that maps changed paths to affected checks and falls back to the complete check when classification is uncertain.

**affected check**（受影响检查）

The subset of repository checks selected for a change, normally run during development and before requesting review.

**complete check**（完整检查）

The full repository check run on the clean, committed final candidate before integration.

## Documents and decisions

**[spec](./spec.md)**（规格）

A statement of a target state and its acceptance: a long-term component or repository spec under `.agents/spec/`, or a Task Spec that states the requirements and acceptance conditions for one Task.

**[invariant](./spec.md#invariant)**（不变量）

A property a spec requires to remain true across changes, independent of implementation details.

**[acceptance criterion](./spec.md#acceptance-criterion)**（验收条件）

An observable condition that distinguishes a conforming result from a deviation.

**[public surface](./spec.md#public-surface)**（公共面）

The commands, formats, files, and behaviors that users or other components rely on and that a change must preserve or update.

**[out of scope](./spec.md#out-of-scope)**（范围外）

Work or content a component or repository area explicitly does not cover.

**rule**（规则）

A normative statement under `.agents/rule/` that states how work is done: what to do, in what order, with which permission, and what is forbidden.

**owning layer**（归属层）

The single document layer that owns a normative statement, so the same rule is not stated in conflicting places.

**[ADR](./adr.md)**（ADR）

A bilingual record under `.agents/adr/` of a durable repository decision's rationale and contract, as a proposal or a decision.

**[proposal](./adr.md#proposal)**（提案）

An ADR that describes a change for review before implementation and before any resulting decision is created or reversed.

**[decision](./adr.md#decision)**（决定）

An ADR that records a complete current choice, its rationale, alternatives, boundaries, and consequences.

**[update decision](./adr.md#update-decision)**（更新决定）

Add non-conflicting content to a current decision under `Changes` without archiving it.

**[reverse decision](./adr.md#reverse-decision)**（反转决定）

Create a complete successor from an old decision's still-effective rules and an accepted proposal naming the conflict; the old version is archived.

**[archived version](./adr.md#archived-version)**（归档版本）

A replaced decision kept under `.agents/adr/archived/` with its identity date and revision number.

## Workflow

**[Task](./task.md)**（任务）

A durable, project-local unit of work managed by tk, with a material directory and a lifecycle.

**[Plan](./plan.md)**（计划）

An execution basis for a Task that groups work into independently assessable units with references, actions, acceptance, permissions, and dependencies.

**[unit](./plan.md#unit)**（工作单元）

A labeled, independently assessable result inside a Plan, such as U01.

**[Verify](./verify.md)**（独立验证）

An independent check of a candidate against its requirements and evidence, performed in isolated context and ending in a final verdict.

**[Ship](./ship.md)**（交付）

The authorized delivery of an accepted result, including local commits and integration into the established target.

**Senior**（资深顾问）

An optional advisory role that settles consequential in-scope choices and execution doubts for an assigned execution.

**[material](./task.md#material)**（材料）

A file in a Task's material directory that records analysis, plans, decisions, or evidence for that Task.

## Review language

**[Fact](./review-language.md#fact)**（事实）

Something directly observable in code, configuration, tests, or runtime behavior.

**[Inference](./review-language.md#inference)**（推断）

A conclusion drawn from facts that may still have another explanation.

**[Judgment](./review-language.md#judgment)**（判断）

An evaluation of evidence against a stated engineering concern or tradeoff.

**[Recommendation](./review-language.md#recommendation)**（建议）

A proposed direction or action supported by evidence, not a decision; in a review, the smallest sufficient action for a finding or a clearly framed decision.

**[Finding](./review-language.md#finding)**（发现项）

A supported concern that states the evidence, impact, and recommendation, where a stylistic preference alone is not a finding.

**[False positive](./review-language.md#false-positive)**（误报）

A plausible concern that does not apply after the surrounding constraints or intent are considered.

## AI coding

**[model](./agent.md#model)**（模型）

The token predictor an agent calls; it receives tokens and returns tokens without state between requests.

**[agent](./agent.md)**（Agent）

A model plus a Harness, which supplies tools and instructions, holds the context, and runs the tool loop.

**[Harness](./agent.md#harness)**（Harness）

The runtime layer around a model that supplies tools and the system prompt, manages the context window, enforces permissions, and runs the tool loop.

**[context](./context-window.md#context)**（上下文）

The tokens available to a model for one request, including instructions, conversation, tool results, and retrieved material.

**[context window](./context-window.md#context-window)**（上下文窗口）

The maximum number of tokens a model can process in one request, shared by input and output.

**[token](./context-window.md#token)**（token）

The smallest text unit a model consumes and produces; the window limits how many fit in one request.

**[compaction](./context-window.md#compaction)**（压缩）

Replacing part of a conversation with a shorter summary so the remaining context fits the window.

**[handoff](./handoff.md)**（交接）

A durable record that lets a fresh session or agent continue work without the prior conversation.

**[subagent](./subagent.md)**（子代理）

An agent launched by another agent with its own context, task, and result boundary.

**[automated check](./review-tiers.md#automated-check)**（自动检查）

A deterministic command that verifies syntax, types, tests, formatting, or links without judging design quality.

**[automated review](./review-tiers.md#automated-review)**（自动审查）

A model or tool pass that looks for defects a check cannot encode, but cannot establish correctness or grant acceptance.

**[human review](./review-tiers.md#human-review)**（人工审查）

A person judging intent, tradeoffs, and acceptability that automated evidence cannot settle.

**[human-in-the-loop](./work-patterns.md#human-in-the-loop)**（人在回路）

A work pattern in which a person stays engaged during the session, reviewing, redirecting, or deciding at defined points.

**[AFK](./work-patterns.md#afk)**（AFK）

A work pattern that lets an agent run unattended and returns only the decisions that need a person.

**[grilling](./work-patterns.md#grilling)**（质询）

An interview pattern that asks at most three independent questions per round, with no round limit, records each answer, and closes after a confirmed summary unless the user ends it earlier.

**[prototyping](./work-patterns.md#prototyping)**（原型验证）

A work pattern that builds a small runnable version to resolve an uncertainty before the committed implementation.

**session**（会话）

One bounded interaction with a Harness, including its conversation, tool calls, and context.

**turn**（回合）

One unit of session work: a user message and the model response, including the tool calls it makes before yielding.

**tool call**（工具调用）

A structured request from the model for the Harness to run a tool with named arguments.

**tool result**（工具结果）

The output the Harness returns to the model after executing a tool call.

**permission mode**（权限模式）

A configured level of what an agent may do without asking, such as reading, editing, or running commands.

**sandbox**（沙箱）

An isolated execution environment that limits what a process or agent can read, write, or reach.

**memory system**（记忆系统）

Persistent storage outside the context window that a Harness loads selected content from in later sessions.

**AGENTS.md**（AGENTS.md）

A repository or directory instruction file that a Harness loads automatically to guide agent behavior.

**progressive disclosure**（渐进披露）

Loading a Skill's main instructions first and its references only when a task needs them, keeping the context small.

**effort**（推理强度）

A setting that controls how much computation a model spends before answering, trading latency and cost for deeper reasoning.

**non-determinism**（非确定性）

The property that repeated runs on identical input can yield different results, so a result needs checking rather than exact reproduction.

**hallucination**（幻觉）

A confident output that asserts something the available evidence does not support or that does not exist.

## Source

Entry organization follows [Matt Pocock's AI Coding Dictionary](https://github.com/mattpocock/dictionary-of-ai-coding): a short description, a definition, an optional avoid note, and examples. That repository has no license file, so this dictionary does not copy its text.
