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

The shortcut is fixed at `alt+shift+a`. The module adds no `/copy` command and no configurable key. The installed keyboard action table has no binding for `alt+shift+a`, and the shortcut registry and clipboard helper exist at the component's maintained 18.5.0 floor. The key is part of the public contract. Another extension must not claim it without a new decision.

### Registration time

The module registers the shortcut while the extension factory runs, before the first `session_start`. OMP loads extension factories before it constructs interactive mode, and interactive mode reads the shortcut registry while it installs key handling. A registration made on `session_start` would arrive after that read and would not become a key binding for the session. The handler therefore reads the activation snapshot through a closure; before the first `session_start` the copy module is `pending` and the handler does nothing.

The cost is that the key is claimed as soon as the extension factory binds for a session. Turning `copyEnabled` or the master switch off, or having the settings rejected, leaves the key claimed; the handler returns without copying. Releasing the key requires unloading that extension binding or a host change. This is accepted because the alternative is a shortcut that exists only after a session event the host may not deliver before key setup.

### Copy rule

The handler copies the last assistant message of the current branch, following the host's `AgentSession.getLastAssistantText()` semantics. It joins the message's `text` blocks without a separator, trims the result, and writes it through `@oh-my-pi/pi-coding-agent/utils/clipboard`. An aborted message with no content is skipped. A last assistant message with no text, including one that carries only thinking or tool calls, produces no copy and does not fall back to an older reply. Thinking, tool calls, tool output, images, and other non-text blocks are never part of the copied text.

While the agent is not idle, the handler warns and copies nothing, so a mid-stream key press does not put the previous reply on the clipboard. When no reply exists, the handler warns that there is nothing to copy. The host clipboard helper is best-effort and swallows write failures, so a real failed write is not reported; a copy function that throws is caught and produces one error notification without retrying.

The module reads the branch and writes the clipboard only. It adds no session entry, sends no request, and changes no transcript.

### Activation status

The module switch off reports `disabled` with `copy-disabled`; the master switch off reports `disabled` with `master-disabled`; an invalid `copyEnabled` disables this module only. `/qol` reports the module status, the effective switch, and the fixed shortcut.

## Alternatives considered

- **Register the shortcut in `session_start`.** It would avoid claiming the key before a session exists, but the host constructs interactive mode and its key handling before the first `session_start`. The registration would be too late for the session it was meant to serve. Considered while resolving registration time. Rejected.
- **Register a module `/copy` command instead of a shortcut.** The host already owns `/copy`; claiming the name would add a command entry point and require typing a name and pressing Enter. The requirement is a key press in the TUI. Considered while choosing the entry point. Rejected.
- **Read `copyEnabled` in the factory and skip registration when it is off.** It would release the key while the module is off, but the factory's settings read would use `process.cwd()`, which can differ from the session `cwd` under `--cwd`; project overrides could resolve from the wrong directory. The activation snapshot is the only value read with the session's cwd. Considered while resolving registration time and settings scope. Rejected.
- **Make the key configurable.** The factory would need the same cwd-sensitive settings read, and a changed key would need a restart. A fixed key keeps the public contract and the registration time simple. Considered while fixing the public key. Rejected.
- **Copy the raw assistant message, including thinking and tool calls.** It would preserve everything the model produced, but the requested behavior is the reply text, and terminal selections already expose raw content. Considered while defining the copied content. Rejected.
- **Fall back to an earlier assistant reply when the last one has no text.** It would make the shortcut more often productive, but it would copy a reply the user did not just see, and it would hide an empty or tool-only turn. Considered while defining the copy rule. Rejected.
- **Copy all text blocks with newlines.** It would separate paragraphs in multi-block messages, but the host's `AgentSession.getLastAssistantText()` joins text blocks directly and returns nothing when the selected message has no text; this module follows that method. Considered while matching host text extraction. Rejected.
- **Write the clipboard through an OS command.** It would avoid the host helper, but it would add platform branches and differ from the host's OSC 52 and native fallback. The host export is the supported interface. Considered while choosing the clipboard writer. Rejected.
- **Leave the feature to an existing host action.** The installed keyboard action table has no reply-copy action; the mouse `Copy answer` action needs a pointer, so waiting for a keyboard action leaves the requirement unmet. Considered while checking existing host behavior. Rejected.

## Consequences

- **Key claim while inactive.** For the life of that extension binding, `alt+shift+a` stays bound to a handler that does nothing when the module is off or settings are rejected. The user sees no copy and no explanation beyond `/qol`.
- **Fixed key.** A user who wants another chord cannot change it, and a conflict with another extension is resolved by the host's registry without this module detecting it.
- **Narrow copy.** The shortcut copies only the last assistant message's text blocks. It cannot copy a selection, an earlier reply, a tool result, an image, or thinking. A turn whose reply is only a tool call yields nothing.
- **Streaming guard.** The handler refuses to copy while the agent is not idle. A user who wants the partial text must wait for the turn to finish.
- **Clipboard dependence.** Writing uses the host helper, which treats OSC 52 and the native fallback as best-effort and swallows failures. A real failed write is not reported, and the module offers no fallback file or notification body. A copy function that throws is caught and reported once.
- **Per-binding registration.** Each time OMP binds the extension factory for a session, it creates a new extension instance and registers `alt+shift+a` on that instance's shortcut table. The handler reads that activation's snapshot and the context of its own key press. A later session in the same process binds the factory again and gets a separate registration and handler; a session-journal switch inside one interactive session keeps the registration it already has.
- **Verification gap.** Automated checks cover extraction, handler behavior, factory-time registration, status, and settings. Real OMP CLI key delivery and a system clipboard write have not been run and are documented as unverified.
