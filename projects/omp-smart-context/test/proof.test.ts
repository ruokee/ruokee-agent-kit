import { expect, test } from "bun:test";
import type { AgentMessage } from "@oh-my-pi/pi-agent-core";
import type { Model } from "@oh-my-pi/pi-ai";
import { encode } from "../src/proof.ts";

const model: Model<"openai-responses"> = {
  api: "openai-responses",
  id: "synthetic-model",
  name: "Synthetic proof model",
  provider: "synthetic-provider",
  identity: { class: "unknown" },
  baseUrl: "http://127.0.0.1:1",
  reasoning: false,
  input: ["text"],
  contextWindow: 40000,
  maxTokens: 1000,
  cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
  compat: { strictResponsesPairing: true } as Model<"openai-responses">["compat"],
};
const opaque = { type: "compaction", id: "persisted-opaque", encrypted_content: "opaque-bytes", status: "completed" };
const source = (items: Record<string, unknown>[]): AgentMessage => ({
  role: "user",
  content: [],
  timestamp: 1,
  providerPayload: { type: "openaiResponsesHistory", provider: model.provider, items },
});

test("source proof preserves opaque identity while applying native V2 lifecycle normalization", () => {
  const messages = [source([opaque])];
  const before = structuredClone(messages);
  expect(encode(model, messages)).toEqual([
    { type: "compaction", id: "persisted-opaque", encrypted_content: "opaque-bytes" },
  ]);
  expect(encode(model, messages, true)).toEqual([{ type: "compaction", encrypted_content: "opaque-bytes" }]);
  expect(messages).toEqual(before);
});

test("opaque source correspondence never chooses between equal records by their position", () => {
  expect(() => encode(model, [source([opaque, { ...opaque, id: "different-opaque" }])])).toThrow(
    "opaque-source-unconfirmed",
  );
});
