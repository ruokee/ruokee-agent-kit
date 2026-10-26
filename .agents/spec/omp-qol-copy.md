# QoL reply copying

## Goals

Copy the last assistant reply's text through a fixed interactive shortcut. This adjustment follows the component-wide configuration, activation, status, and isolation requirements.

## Out of scope

Selected-text copying, thinking, tool calls, tool output, images, a `/copy` command, configurable keys, or clipboard history.

## Public surface

### Configuration

| Key | Default |
| --- | --- |
| `copyEnabled` | `true` |

### Status

The `/qol` copy line shows the actual fixed key `alt+shift+a`.

### Copying replies

Bind `alt+shift+a` before the interactive host reads extension shortcuts. Each extension binding owns its registration; a session-journal switch retains the existing binding. The key remains claimed for that binding's lifetime when pending, disabled, or invalid, but the handler does nothing. A conflicting extension key is resolved by the host, not this module.

When enabled and idle, select the current branch's last assistant message, skipping an aborted message with no content. Join that message's `text` blocks with no separator and trim the result. Copy a nonempty result through the host clipboard helper. A last message with only thinking, tool calls, or other non-text content yields no copy and no fallback to an earlier reply. Never write an empty string or copy non-text blocks.

While busy, warn and leave the clipboard unchanged. With no copyable reply, warn and write nothing. The host helper is best-effort, using OSC 52 and native clipboard tools, and swallows write failures. A resolved helper call is reported as success even when the underlying write failed. A thrown copy error is caught and reported once without retry, file fallback, or a notification containing the copied body. Copying adds no session entry and starts no request.

## Acceptance criteria

- When enabled and idle, the shortcut passes the joined and trimmed text of the last assistant message to the host clipboard helper after skipping empty aborted messages. Non-text blocks are excluded; a last message with no copyable text does not fall back to an earlier reply.
- Disabled or busy handlers and replies without text leave the clipboard unchanged. Busy and no-text cases warn; a thrown clipboard error is reported once without retry or copied-body disclosure.
- `alt+shift+a` is available when the interactive host reads extension shortcuts, remains claimed for the binding's lifetime, and appears as the actual key in `/qol`.
