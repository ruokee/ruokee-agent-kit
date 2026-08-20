# Agentic Coding

Reference documents for the quality of *AI agent configuration* — the files that shape how an agent behaves: `AGENTS.md`, `CLAUDE.md`, SKILL files, prompt rules, permission manifests, and workflow docs. The subject here is the configuration surface, not the code an agent emits. Smells in produced code (long functions, duplicated knowledge, thin wrappers, speculative generality) belong to `skills/code-quality/references/refactoring` and `skills/code-quality/references/design-principles`; this directory is about the instructions, context, and references that drive the agent in the first place.

The premise is that an agent's configuration is itself an engineered artifact with its own failure modes. Context is a budget, instructions can contradict, references can dangle, and templates rot. These problems degrade agent performance quietly — the agent still runs, it just reasons over noisier or stale input — so they need the same deliberate review that production code gets.

Everything lives in one document: [config-smells.md](./config-smells.md). It treats each failure mode as a smell in the Fowler sense — a surface symptom worth investigating, not an automatic defect. Route there when reviewing or authoring any agent-facing configuration.
