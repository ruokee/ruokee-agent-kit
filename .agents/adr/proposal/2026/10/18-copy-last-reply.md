# Copy the last reply

Draft owner: Ruokee
Draft writer: OMP DeepSeek V4.1 Flash

English | [中文](./18-copy-last-reply.zh.md)

## Motivation

`@ruokee/omp-qol` adds a fixed shortcut that copies the text of the last assistant reply from an interactive OMP session.

OMP 18.11.3 interactive mode copies the input prompt and the current input line with keyboard actions, and it offers a mouse `Copy answer` action. The installed keyboard action table has no shortcut for an assistant reply and no binding for `alt+shift+a`. A user working from the keyboard has to select the reply in the terminal or retype it. The extension API offers a shortcut registry and the host exports a clipboard helper at the component's maintained 18.5.0 floor, so the capability fits an extension without changing the host.

## Proposal

### Public configuration

The component gains an adjustment, `copy`, under the [OMP QoL decision](../../../decision/2026/09/20-omp-qol.md). Its public contract is one native OMP setting, `copyEnabled`, boolean, defaulting to `true`, subordinate to the component's master switch. It is read in the same activation snapshot as every other setting. A change applies at the next OMP start.

The shortcut is fixed at `alt+shift+a`. There is no `/copy` command and no configurable key. The key is part of the public contract. Another extension must not claim it without a new decision.

### Registration time

The module registers the shortcut while the extension factory runs, before the first `session_start`. OMP loads extension factories before it constructs interactive mode, and interactive mode reads the shortcut registry while it installs key handling. A registration made on `session_start` would arrive after that read and would not become a key binding for the session.

The cost is that the key is claimed as soon as the extension factory binds for a session. Turning `copyEnabled` or the master switch off, or having the settings rejected, leaves the key claimed; the handler returns without copying. Releasing the key requires unloading that extension binding or a host change.

### Copy rule

The handler copies the last assistant message of the current branch, following the host's `AgentSession.getLastAssistantText()` semantics. It joins the message's `text` blocks without a separator, trims the result, and writes it through the host clipboard helper. An aborted message with no content is skipped. A last assistant message with no text, including one that carries only thinking or tool calls, produces no copy and does not fall back to an older reply. Thinking, tool calls, tool output, images, and other non-text blocks are never part of the copied text.

While the agent is not idle, the handler warns and copies nothing, so a mid-stream key press does not put the previous reply on the clipboard. When no reply exists, the handler warns that there is nothing to copy. The host clipboard helper is best-effort and swallows write failures, so a real failed write is not reported; a copy function that throws is caught and produces one error notification without retrying.

The module reads the branch and writes the clipboard only. It adds no session entry, sends no request, and changes no transcript.

### Activation status

When the module switch is off, the status is `disabled` with `copy-disabled`. When the master switch is off, it is `disabled` with `master-disabled`. An invalid `copyEnabled` disables this module only. `/qol` reports the module status, the effective switch, and the fixed shortcut.

## Alternatives considered

- **Register the shortcut in `session_start`.** It would avoid claiming the key before a session exists, but the host constructs interactive mode and its key handling before the first `session_start`. The registration would be too late for the session it was meant to serve. Considered while resolving registration time. Rejected.
- **Register a `/copy` command instead of a shortcut.** Commands are discoverable and configurable, but they require typing a name and pressing Enter. The requirement is a key press in the TUI. Considered while choosing the entry point. Rejected.
- **Read `copyEnabled` in the factory and skip registration when it is off.** It would release the key while the module is off, but the factory's settings read would use `process.cwd()`, which can differ from the session `cwd` under `--cwd`; project overrides could resolve from the wrong directory. The activation snapshot is the only value read with the session's cwd. Considered while resolving registration time and settings scope. Rejected.
- **Make the key configurable.** The factory would need the same cwd-sensitive settings read, and a changed key would need a restart. A fixed key keeps the public contract and the registration time simple. Considered while fixing the public key. Rejected.
- **Copy the raw assistant message, including thinking and tool calls.** It would preserve everything the model produced, but the requested behavior is the reply text, and terminal selections already expose raw content. Considered while defining the copied content. Rejected.
- **Fall back to an earlier assistant reply when the last one has no text.** It would make the shortcut more often productive, but it would copy a reply the user did not just see, and it would hide an empty or tool-only turn. Considered while defining the copy rule. Rejected.
- **Copy all text blocks with newlines.** It would separate paragraphs in multi-block messages, but the host's `AgentSession.getLastAssistantText()` joins text blocks directly and returns nothing when the selected message has no text; this module follows that method. Considered while matching host text extraction. Rejected.
- **Write the clipboard through an OS command.** It would avoid the host helper, but it would add platform branches and differ from the host's OSC 52 and native fallback. The host export is the supported interface. Considered while choosing the clipboard writer. Rejected.
- **Leave the feature to an existing host action.** The installed keyboard action table has no reply-copy action; the mouse `Copy answer` action needs a pointer, so waiting for a keyboard action leaves the requirement unmet. Considered while checking existing host behavior. Rejected.

## Acceptance criteria

- With the module enabled and the agent idle, `alt+shift+a` writes the last assistant message's `text` blocks to the clipboard, joined without a separator and trimmed.
- A last assistant message with no text copies nothing. The handler does not fall back to an earlier reply. Thinking, tool calls, tool output, images, and other non-text blocks are not copied.
- While the agent is not idle, the shortcut warns and copies nothing.
- With `copyEnabled` off or the master switch off, the shortcut copies nothing and `/qol` reports `disabled` with the corresponding reason. The key remains claimed.
- An invalid `copyEnabled` disables only the `copy` module.
- No `/copy` command and no configurable key exist.
- A copy function that throws produces one error notification without retrying.
- The package manifest declares `copyEnabled` with its default and description. The component documentation, root README component list, and Spec describe the behavior, the fixed key and its reservation, and the clipboard limits.

## Risks

- **Key claim while inactive.** Turning the module or master switch off still leaves `alt+shift+a` bound to a handler that does nothing, so the user gets no copy.
- **Fixed key conflict.** Another extension may register the same key; the host picks one registration and the user may get no copy from this module.
- **Narrow copy.** The shortcut copies only the last assistant message's text. A user who wants an earlier reply, a tool result, an image, or thinking gets nothing.
- **Streaming guard.** A user who presses the shortcut during streaming gets no copy; if they miss the warning, they may paste older clipboard content.
- **Silent clipboard failure.** The host helper swallows write failures, so the user may believe the text was copied when the clipboard did not change.
- **Verification gap.** Real OMP CLI key delivery and system clipboard writes are untested; a platform-specific failure would appear only in real use.
