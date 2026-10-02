# ADR proposal: Count only conversation usage in the status bar token metrics

Draft owner: Ruokee
Draft writer: OMP DeepSeek V4.1 Flash

English | [中文](./2026-10-02-scope-token-metrics-to-conversation.zh.md)

## Motivation

Count only the conversation's own usage in the status bar's token readings and cache-hit rate, instead of the session-wide usage statistics OMP returns.

OMP aggregates every model call it records into one session total. The row reads that total, so calls the conversation never made enter the readings as if the conversation had paid for them. The Find tool's judgment cascade is such a caller: it records its own model calls in the session ledger with `purpose: "find"`, and those records carry no cache reading. The judgment path reports an input count, an output count, and a billed cost, and it writes cache read and cache write as zero regardless of what the serving endpoint cached, so the recording cannot show whether a prefix was reused.

The effect is large enough to invert the reading. In the validation run recorded for this change, one Find call over a large repository billed 16 judgment requests and 68K input tokens: the conversation's own usage was 10K input and 7.7K cache read, a 43.5% hit rate, where the session-wide total read 78K input and 8.9%. The number of judgment records grows with the files a Find call reads, so the drift grows with the search.

The five token readings exist to show how efficiently a conversation spends tokens and how well its prompt cache is reused, and they sit beside readings that describe the conversation itself: the answered-request count and the context estimate. Traffic the conversation did not initiate moves them away from that purpose.

## Analysis

The reported values are arithmetically correct; what they describe is the session rather than the conversation. OMP's session total has no per-purpose split and no per-entry breakdown, so no caller of that API can separate the conversation's usage from the rest. Reading the ledger directly is the only way to make the distinction, and the session branch the extension already holds carries every entry with its parent chain.

The extension already reads that branch for the answered-request count, which is why rewind and branch behavior are defined there. Moving the token scope to the same source keeps the two readings consistent: a tree rewind or a new branch re-seeds the tokens exactly as it re-seeds the count, and a session switch reads the branch then in front.

A judgment record adds to `I` and nothing to `C`, so each cascade request both inflates the input reading and depresses `C / (I + C)`, and the drift follows the number of judgment records rather than how much the endpoint cached. In the run above, those records added 68K input and no cache read, moving the reading from 43.5% to 8.9%, while the conversation's own requests read 7.7K from the cache.

A `task` tool call is the opposite case. Its sub-agent works on the conversation's request, and OMP reports that work as the usage of the tool result, so those tokens belong to the conversation and stay counted.

## Proposal

The five token readings keep the formulas that [the package usage documentation](../../../projects/omp-status-bar/docs/usage.md) owns and change the records they sum. `I` is the conversation's input plus cache write, `C` its cache read, `O` its output, `T` is `I + C + O`, and the rate is `C / (I + C)`.

Two shapes count: an assistant message's usage on the branch the session holds, and the usage a `task` tool result reports. Nothing else contributes. A standalone `model_usage` record does not count whatever purpose it carries, an entry of another type or a message of another role contributes nothing, and a message with no usage contributes nothing. Within a usage that does count, only finite numbers are added, so an invalid counter is left out while the remaining counters still count.

Nothing else about the row changes. No provider ID, option, color, or form is added or removed, the package still ships no cost reading, and OMP's own statusline and cost reporting keep their meaning.

This proposal reverses the clause of [Maintain the OMP status bar across OMP host upgrades](../decision/2026-09-28-maintain-omp-status-bar.md) that derives the shared token scope "from the session usage statistics", and the same clause in its Chinese counterpart. The scope cannot come from that aggregate and exclude out-of-band records at the same time, so the two cannot hold at once. The successor decision keeps every other rule of that decision, including the widget, the provider contract, the builtin inventory, the speculation estimate and its limits, the answered-request count, and the real TUI check before release.

Both language usage documents state the scope, name what it excludes, and continue to own the formulas.

## Alternatives considered

**Subtract the out-of-band records from the session aggregate.** This keeps the documented source as the base. The aggregate exposes no per-purpose split, so the subtraction would have to walk the same branch and classify the same records this proposal reads, then subtract them from a total that already contains them. The result then rests on two sides that must keep agreeing, the aggregate that sets the base and the classification that sets the correction, and a host change to either side leaves a residual the package cannot account for. A direct sum has one source and no residual.

**Keep the session aggregate and add a reading for out-of-band traffic.** This keeps every existing number and reports the excluded amount beside it. It leaves the readings a reader compares against the conversation's own cost distorted, and asks the reader to subtract one reading from another to recover the conversation's usage.

**Make the corrected scope depend on an upstream change.** OMP could report the judgment calls' real cache fields, or expose a per-purpose split. Both are outside the package's control, and neither is promised, so the readings would stay distorted for an unknown period while the package waits.

## Acceptance criteria

- In a session that ran the Find judgment cascade, the token readings and the cache-hit rate equal the conversation's own usage to the token, and no out-of-band record reaches them.
- The readings follow the branch the session holds, so a tree rewind or a branch switch re-seeds them the way the answered-request count is re-seeded.
- Every documented formula keeps its meaning, the documented provider inventory is unchanged, and no compatibility alias appears.
- The English and Chinese usage documentation describe the scope and what it excludes, and the current decision records it while the reversed clause moves to the archive.
- A release records a real TUI check of a session with out-of-band traffic before tagging, following the evidence rules the current decision already sets.

## Risks

**A reader compares the row against OMP's own session-wide reporting and reads the difference as a defect.** The native statusline token segment and any cost report still include out-of-band traffic, so the numbers differ by design. The usage documentation states the scope and the excluded records beside the formulas, so the difference is a documented consequence rather than a finding.

**A host change to the recorded shapes makes the readings under-count silently.** If OMP stops reporting `task` usage on the tool result, or starts recording conversation usage in a shape the package does not read, the row keeps rendering numbers that no longer match the conversation. The read rules live in one module whose tests pin the two shapes read today, so adapting to a new shape is a small edit, but no test can notice the change on its own. A host that records differently reaches the package as a reading that stops matching the conversation, through a user report or through the release check on a real ledger and a real TUI, which the current decision already requires.

**Each sample walks the branch.** The walk grows with the session's entry count and runs on the sampling cadence, so a long session pays work proportional to its length on every tick. The walk reads only the fields it needs and runs at most once per tick for all five readings, rather than once per reading.
