import { isDeepStrictEqual as equal } from "node:util";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import type { Context, Model } from "@oh-my-pi/pi-ai";
import { buildResponsesInput } from "@oh-my-pi/pi-ai/providers/openai-shared";
import {
  sanitizeOpenAIResponsesHistoryItemsForReplay,
  stripOpenAIResponsesOutputOnlyStatusesForReplay,
} from "@oh-my-pi/pi-ai/utils";
import type { AgentSession } from "@oh-my-pi/pi-coding-agent";
import { convertToLlm } from "@oh-my-pi/pi-coding-agent/session/messages";
import {
  cfgSnapcompactSystemPrompt,
  cfgSnapcompactToolResults,
} from "@oh-my-pi/pi-coding-agent/session/context-settings";
import { cfgImagesUrlsEnabled } from "@oh-my-pi/pi-coding-agent/blob-broker/settings";
import { body, object, standardResult, type Body, type Item, type Unit } from "./reuse.ts";

export const copy = <T>(value: T): T => structuredClone(value);

/** Encode source correspondence using the native V2 history policy, not the online replay policy. */
export function encode(model: Model, messages: AgentMessage[], converted = false): Item[] {
  if (model.api !== "openai-responses") throw new Error("source-api-unconfirmed");
  const responses = model as Model<"openai-responses">;
  const input = buildResponsesInput({
    model: responses,
    context: { messages: converted ? (messages as Context["messages"]) : convertToLlm(messages) },
    strictResponsesPairing: responses.compat.strictResponsesPairing,
    supportsImageDetailOriginal: responses.compat.supportsImageDetailOriginal === true,
    nativeHistory: { replay: true, filterReasoning: false },
    includeThinkingSignatures: true,
    repairOrphanOutputs: true,
  }) as unknown as Item[];
  if (converted) return stripOpenAIResponsesOutputOnlyStatusesForReplay(input);
  const opaque: Item[] = [];
  for (const message of messages) {
    const record = message as unknown as Item;
    const payload = record.providerPayload;
    if (
      object(payload) &&
      payload.type === "openaiResponsesHistory" &&
      payload.provider === model.provider &&
      Array.isArray(payload.items)
    ) {
      for (const item of payload.items)
        if (object(item) && item.type === "compaction" && typeof item.id === "string") opaque.push(item);
    }
  }
  return stripOpenAIResponsesOutputOnlyStatusesForReplay(
    input.map((item) => {
      if (item.type !== "compaction") return item;
      const matches = opaque.filter((record) =>
        equal(
          sanitizeOpenAIResponsesHistoryItemsForReplay([record], {
            supportsImageDetailOriginal: responses.compat.supportsImageDetailOriginal === true,
          })[0],
          item,
        ),
      );
      if (matches.length !== 1) throw new Error("opaque-source-unconfirmed");
      return matches[0]!;
    }),
  );
}

/** These native transforms have no cross-message dependency in this restricted local case. */
export function nativeIndependent(session: AgentSession, messages: AgentMessage[]): boolean {
  const runner = session.extensionRunner;
  if (!runner || runner.hasHandlers("context") || runner.hasHandlers("before_provider_request")) return false;
  if (
    session.obfuscator?.hasSecrets() ||
    cfgSnapcompactSystemPrompt.get(session.settings) !== "none" ||
    cfgSnapcompactToolResults.get(session.settings) ||
    cfgImagesUrlsEnabled.get(session.settings)
  )
    return false;
  return messages.every((message) => {
    if (!["user", "assistant", "toolResult"].includes(message.role)) return false;
    if (message.role === "assistant" && ["aborted", "error"].includes(message.stopReason)) return false;
    // Image budgets are history-dependent. Complete-range reuse still supports those transforms.
    return !(
      "content" in message &&
      Array.isArray(message.content) &&
      message.content.some((part) => part.type === "image")
    );
  });
}

export function units(
  model: Model,
  raw: AgentMessage[],
  prepared: Context["messages"],
  source: Item[],
  sent: Body,
  independent: boolean,
  cwd: string,
): Unit[] {
  const result: Unit[] = [{ source, sent: sent.input, proof: "complete-context" }];
  if (!independent || raw.length !== prepared.length || convertToLlm(raw).length !== raw.length) return result;
  const local: Unit[] = [];
  const firstUser = raw.findIndex((message) => message.role === "user");
  for (let index = 0; index < raw.length;) {
    // An assistant and all following results form one dependency unit, including parallel calls.
    let end = index + 1;
    if (raw[index]!.role === "assistant") while (end < raw.length && raw[end]!.role === "toolResult") end++;
    const unit = {
      source: encode(model, raw.slice(index, end)),
      sent: encode(model, prepared.slice(index, end) as AgentMessage[], true),
      proof: "native-independent" as const,
    };
    // Additional reminders depend on prior roots/date state, not just this later message.
    if (!standardResult(unit.source, unit.sent, cwd, index === firstUser)) return result;
    local.push(unit);
    index = end;
  }
  if (
    equal(
      local.flatMap((unit) => unit.source),
      source,
    ) &&
    equal(
      local.flatMap((unit) => unit.sent),
      sent.input,
    )
  )
    result.push(...local);
  return result;
}

export function payload(value: unknown): Body | undefined {
  return body(value) ? (JSON.parse(JSON.stringify(value)) as Body) : undefined;
}
export { standardResult };
