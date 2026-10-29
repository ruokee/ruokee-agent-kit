# Copy the last reply

Decision owner: Ruokee
Decision writer: OMP DeepSeek V4.1 Flash

English | [中文](./18-copy-last-reply.zh.md)

## Motivation

`@ruokee/omp-qol` adds a fixed shortcut that copies the text of the last assistant reply from an interactive OMP session.

OMP 18.11.3 interactive mode copies the input prompt and the current input line with keyboard actions, offers a mouse `Copy answer` action, and provides a `/copy` command that asks the user to pick text or code from the conversation. The installed keyboard action table has no shortcut for an assistant reply. A user working from the keyboard who wants the whole last reply has to run `/copy` and select text, select it in the terminal, or retype it. The extension API offers a shortcut registry and the host exports a clipboard helper, so the capability fits an extension without changing the host.

## Decision

### Public configuration

The component gains an adjustment, `copy`, under the [OMP QoL decision](../09/20-omp-qol.md). Its public contract is one native OMP setting, `copyEnabled`, boolean, defaulting to `true`, subordinate to the component's master switch. It is read in the same activation snapshot as every other setting. A change applies at the next OMP start.

The shortcut is fixed at `alt+shift+a`. The module adds no `/copy` command and no configurable key. The installed keyboard action table has no binding for `alt+shift+a`. The shortcut registry and clipboard helper were already available in OMP 18.5.0. The key is part of the public contract. Another extension must not claim it without a new decision.

### Registration time

The module registers the shortcut while the extension factory runs, before the first `session_start`. OMP loads extension factories before it constructs interactive mode, and interactive mode reads the shortcut registry while it installs key handling. A registration made on `session_start` would arrive after that read and would not become a key binding for the session. The handler therefore reads the activation snapshot through a closure; before the first `session_start` the copy module is `pending` and the handler does nothing.

The cost is that the key is claimed as soon as the extension factory binds for a session. Turning `copyEnabled` or the master switch off, or having the settings rejected, leaves the key claimed; the handler returns without copying. Releasing the key requires unloading that extension binding or a host change. This is accepted because the alternative is a shortcut that exists only after a session event the host may not deliver before key setup.

Each time OMP binds the extension factory for a session, it creates a new extension instance and registers `alt+shift+a` on that instance's shortcut table. The handler reads that activation's snapshot and the context of its own key press. A later session in the same process gets a separate registration and handler; a session-journal switch inside one interactive session keeps its existing registration.

### Copy rule

The handler copies the last assistant message of the current branch, following the host's `AgentSession.getLastAssistantText()` semantics. It joins the message's `text` blocks without a separator, trims the result, and writes it through `@oh-my-pi/pi-coding-agent/utils/clipboard`. An aborted message with no content is skipped. A last assistant message with no text, including one that carries only thinking or tool calls, produces no copy and does not fall back to an older reply. Thinking, tool calls, tool output, images, and other non-text blocks are never part of the copied text.

While the agent is not idle, the handler warns and copies nothing, so a mid-stream key press does not put the previous reply on the clipboard. When no reply exists, the handler warns that there is nothing to copy. The host clipboard helper is best-effort and swallows write failures, so a real failed write is not reported; a copy function that throws is caught and produces one error notification without retrying.

The module reads the branch and writes the clipboard only. It adds no session entry, sends no request, and changes no transcript.

### Activation status

The module switch off reports `disabled` with `copy-disabled`; the master switch off reports `disabled` with `master-disabled`; an invalid `copyEnabled` disables this module only. `/qol` reports the module status, the effective switch, and the fixed shortcut.

## Alternatives considered

None

## Consequences

- **Key claim while inactive.** For the life of that extension binding, `alt+shift+a` stays bound to a handler that does nothing when the module is off or settings are rejected. The user sees no copy and no explanation beyond `/qol`.
- **Fixed key.** A user who wants another chord cannot change it, and a conflict with another extension is resolved by the host's registry without this module detecting it.
- **Clipboard dependence.** Writing uses the host helper, which treats OSC 52 and the native fallback as best-effort and swallows failures. A real failed write is not reported, and the module offers no fallback file or notification body. A copy function that throws is caught and reported once.
