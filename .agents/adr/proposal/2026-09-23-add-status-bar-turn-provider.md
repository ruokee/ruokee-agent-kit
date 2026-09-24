# ADR proposal: Add a turn metric to the OMP status bar widget

Draft owner: Ruokee
Draft writer: OMP DeepSeek V4.1 Flash

English | [中文](./2026-09-23-add-status-bar-turn-provider.zh.md)

## Motivation

A user needs to see how many model requests the current session has issued. Read together with the token totals the widget already reports, that count is what the user uses to judge the token efficiency of a session and to notice a call that consumed far more than the rest, which is the reference for tuning how OMP is used.

The widget reports consumption through tokens spent, cache hit rate, and context usage, without any reading of how many model requests produced it.

## Analysis

A reading derived from session activity can only ship as a builtin provider. The public provider contract gives an instance its options, its configuration, a publication call, and managed timers; it carries no session data and no events, and the host binds session sources for builtin providers only. Adding such a channel to the public contract is a larger change than adding the reading.

The host reports each turn to the extension together with how the response ended, so the package can count successful responses without an upstream change.

The [decision that established the widget](../decision/2026-09-05-use-omp-status-bar-widget.md) delegates the per-provider contract to the package usage documents, which already list the builtin IDs, their options, and their colors, while the decision itself fixes those IDs as a list of exactly six.

## Proposal

### Add the turn metric

Add a builtin provider that shows how many model requests in the current session received a successful response.

The value is session-cumulative. It grows across prompts and across agent runs without restarting, and it keeps its value when the session is resumed or switched. It always reports the branch the session holds, so rewinding to an earlier point of the session or abandoning an attempt lowers it. That is the intended reading. Only a successful response advances it; a failed request, an interrupted response, and a request stopped before the model call leave it unchanged.

The widget renders the fixed label `Turn`, a space, and the value. It emphasizes the value while a turn is in flight, dims it otherwise, and renders nothing while the value is zero.

The provider publishes this count as a reading of its own. It derives no further metric from it.

### Replace the closed builtin ID list

Reverse the [decision that established the widget](../decision/2026-09-05-use-omp-status-bar-widget.md).

The effective clause is the first sentence of its [Ship the built-in metric providers](../decision/2026-09-05-use-omp-status-bar-widget.md#ship-the-built-in-metric-providers) section, which fixes the builtin IDs as a list of exactly six.

The successor states that the package ships builtin metric providers and links the package usage documentation as the owner of the current inventory, instead of fixing the ID list or its count inside the decision. The scope boundaries that clause carries survive: no amount, cost, or premium-request reading, and no legacy `tokens` alias.

The two cannot hold together. The clause admits no builtin ID beyond its fixed list, while the turn metric adds a seventh builtin ID, so the addition cannot be recorded as an update to that decision.

## Alternatives considered

None

## Acceptance criteria

1. The widget offers a builtin provider that shows how many model requests in the current session received a successful response, rendered as `Turn <value>`.
2. The value advances only for a successful response. A failed request, an interrupted response, and a request stopped before the model call leave it unchanged.
3. The value is session-cumulative. It does not restart at a prompt boundary or an agent run boundary, and after a resume or a session switch it reports the history of the branch that session holds.
4. The widget emphasizes the value while a turn is in flight, dims it otherwise, and renders nothing while the value is zero.
5. Documentation in both languages carries the metric in the builtin inventory and describes its meaning, its display, and how the value behaves across sessions.
6. The package's behavioral tests assert the counting rule, the display states, and the session behavior.
7. The successor decision links the usage documentation as the owner of the builtin inventory, so a later addition or removal of a builtin ID is an inventory change rather than a reversal.
8. The metric works within the declared OMP peer range without an upstream change.

## Risks

The value can differ by one around a session binding. A binding counts the history the session has recorded, while the turn that ended immediately before it may not be recorded yet, so the same session can show two values that differ by one.
