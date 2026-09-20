/**
 * Driving the registered entry points from a test.
 *
 * A confirmed write is submitted as a user message, so it becomes an operation
 * only when the extension itself submitted it and the host then runs the
 * request that message opens. These helpers drive the command the way the user
 * does, run the request the way the host does, and read back what that request
 * carries.
 */

import { COMMAND_NAME } from "../src/command.ts";
import { OUTCOME_TYPE } from "../src/delivery.ts";
import { RECORD_TYPE } from "../src/record.ts";
import { replay } from "../src/state.ts";
import { TOOL_NAME } from "../src/tool.ts";
import type { FakeHost } from "./host.ts";

/** Tool result of one `ctx_pin` call the host made. */
export interface FakeToolResult {
  content: Array<{ text: string }>;
  details: { code: string };
  isError?: boolean;
}

interface FakeTool {
  execute: (id: string, params: unknown, signal: unknown, onUpdate: unknown, ctx: unknown) => Promise<FakeToolResult>;
}

/** Call the registered tool the way the host does. */
export function callTool(host: FakeHost, id: string, params: unknown): Promise<FakeToolResult> {
  const tool = host.tools.get(TOOL_NAME) as unknown as FakeTool | undefined;
  if (tool === undefined) throw new Error("the tool is not registered");
  return tool.execute(id, params, undefined, undefined, host.ctx);
}

/** Run the `/ctx-pin` handler the user invoked, with the arguments they typed. */
export async function runCommand(host: FakeHost, args = ""): Promise<void> {
  const command = host.commands.get(COMMAND_NAME);
  if (command === undefined) throw new Error("the command is not registered");
  await command.handler(args, host.ctx);
}

/** Run one request the way the host does: from the branch, as it stands. */
export function consume(host: FakeHost): Array<Record<string, unknown>> {
  return replacementOf(host) ?? (host.request() as Array<Record<string, unknown>>);
}

/**
 * Replacement array one request produced, or `undefined` when the extension
 * left the request alone.
 *
 * `consume` reads the branch instead when no replacement was returned, which is
 * what the host shows the model. A test that has to see whether the extension
 * rebuilt the request reads this.
 */
export function replacementOf(host: FakeHost): Array<Record<string, unknown>> | undefined {
  const result = host.emit("context", { type: "context", messages: host.request() }) as
    { messages: Array<Record<string, unknown>> } | undefined;
  return result?.messages;
}

/** Run the command, then let the host run the request it submitted. */
export async function runAndConsume(host: FakeHost): Promise<void> {
  await runCommand(host);
  consume(host);
  endRun(host);
}

/**
 * End the run that is streaming, as the host reports it once the session is idle.
 *
 * The host queues a custom message sent while a run is streaming and runs it as
 * a further turn, so the extension hands a result over here instead.
 */
export function endRun(host: FakeHost): void {
  host.emit("agent_end", { type: "agent_end" });
}

/** Operation records in the journal, without the messages delivered beside them. */
export function recordsOf(host: FakeHost) {
  return host.journal.filter((entry) => entry.type === "custom" && entry.customType === RECORD_TYPE);
}

/** Result messages a request carries. */
export function resultsOf(messages: readonly Record<string, unknown>[]) {
  return messages.filter((message) => message.customType === OUTCOME_TYPE);
}

/** Key that moves the list selection down one row. */
const DOWN = "\u001b[B";
/** Key that confirms the row the list selection is on. */
const ENTER = "\r";
/** Key that closes the list without choosing a row. */
const ESCAPE = "\u001b";

/** Keys that move the list selection onto one row and confirm it. */
export function pickRow(index: number): string[] {
  return [...new Array<string>(index).fill(DOWN), ENTER];
}

/** Keys that close the list without choosing a row. */
export const cancelRow: string[] = [ESCAPE];
