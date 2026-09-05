import assert from "node:assert/strict";
import test from "node:test";
import { completeSimple } from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import extension, { BASE_URL, getModels, PROVIDER_ID } from "../index.ts";

function sse(chunks: unknown[]): Response {
  return new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n", {
    headers: { "Content-Type": "text/event-stream" },
  });
}

test("registers a native provider without network access", () => {
  let provider: unknown;
  extension({ registerProvider: (value: unknown) => { provider = value; } } as ExtensionAPI);
  assert.equal((provider as { id: string }).id, PROVIDER_ID);
});

test("catalog matches documented limits, modalities, prices and distinct reasoning modes", () => {
  const [base, v2, large] = getModels();
  assert.deepEqual(getModels().map((m) => [m.id, m.contextWindow, m.maxTokens]), [
    ["abliterated-model", 262144, 262134],
    ["abliterated-model-large-v2", 1000000, 999990],
    ["abliterated-model-large", 1000000, 999990],
  ]);
  assert.deepEqual(base.input, ["text", "image"]);
  assert.deepEqual(v2.input, ["text"]);
  assert.deepEqual(large.input, ["text"]);
  assert.equal(base.cost.cacheRead, 0.3);
  assert.equal(v2.cost.cacheRead, 0.5);
  assert.equal(v2.cost.cacheWrite, 5);
  assert.equal(v2.thinkingLevelMap?.low, "low");
  assert.equal(large.thinkingLevelMap?.low, null);
  assert.equal(v2.thinkingLevelMap?.max, "max");
  base.thinkingLevelMap!.high = "changed";
  assert.equal(getModels()[0].thinkingLevelMap?.high, "high");
});

for (const model of getModels()) {
  for (const level of [undefined, "high", "max"] as const) {
    test(`${model.id}: serializes ${level ?? "off"}, streaming usage and unsupported-field omission`, async () => {
      const result = await completeSimple(model, {
        systemPrompt: "You are a coding assistant.",
        messages: [{ role: "user", content: "Hello", timestamp: 0 }],
      }, {
        apiKey: "test-only-key", reasoning: level, maxTokens: 64,
        sessionId: "test-conversation", cacheRetention: "long",
        fetch: async (input, init) => {
          assert.equal(String(input), `${BASE_URL}/chat/completions`);
          assert.equal(new Headers(init?.headers).get("authorization"), "Bearer test-only-key");
          const body = JSON.parse(String(init?.body));
          assert.equal(body.model, model.id);
          assert.equal(body.reasoning_effort, level ?? "none");
          assert.equal(body.max_tokens, 64);
          assert.equal(body.messages[0].role, "system");
          assert.equal(body.stream, true);
          assert.equal(body.stream_options.include_usage, true);
          assert.equal(body.prompt_cache_key, undefined);
          assert.equal(body.prompt_cache_retention, undefined);
          assert.equal(body.store, undefined);
          return sse([
            { choices: [{ index: 0, delta: { reasoning_content: "Thinking." }, finish_reason: null }] },
            { choices: [{ index: 0, delta: { content: "Hello!" }, finish_reason: "stop" }] },
            { choices: [], usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110,
              prompt_tokens_details: { cached_tokens: 80 } } },
          ]);
        },
      });
      assert.equal(result.stopReason, "stop", result.errorMessage);
      assert.ok(result.content.some((c) => c.type === "text" && c.text === "Hello!"));
      assert.ok(result.content.some((c) => c.type === "thinking" && c.thinking === "Thinking."));
      assert.equal(result.usage.cacheRead, 80);
      assert.equal(result.usage.input, 20);
      assert.equal(result.usage.totalTokens, 110);
      assert.ok(Math.abs(result.usage.cost.total - (30 * model.cost.input + 80 * model.cost.cacheRead) / 1e6) < 1e-10);
    });
  }
}

test("accumulates streamed tool arguments", async () => {
  const result = await completeSimple(getModels()[0], {
    messages: [{ role: "user", content: "Read README.md", timestamp: 0 }],
  }, {
    apiKey: "test-only-key", maxTokens: 64,
    fetch: async () => sse([
      { choices: [{ index: 0, delta: { tool_calls: [{ index: 0, id: "call_1", type: "function",
        function: { name: "read", arguments: '{"path":' } }] }, finish_reason: null }] },
      { choices: [{ index: 0, delta: { tool_calls: [{ index: 0,
        function: { arguments: '"README.md"}' } }] }, finish_reason: "tool_calls" }] },
    ]),
  });
  assert.equal(result.stopReason, "toolUse", result.errorMessage);
  const call = result.content.find((c) => c.type === "toolCall");
  assert.equal(call?.name, "read");
  assert.deepEqual(call?.arguments, { path: "README.md" });
});

test("surfaces authentication errors", async () => {
  const result = await completeSimple(getModels()[0], {
    messages: [{ role: "user", content: "Hello", timestamp: 0 }],
  }, { apiKey: "test-only-key", fetch: async () => new Response(
    JSON.stringify({ error: { message: "Invalid API key" } }),
    { status: 401, headers: { "Content-Type": "application/json" } },
  ) });
  assert.equal(result.stopReason, "error");
  assert.match(result.errorMessage ?? "", /401|Invalid API key/);
});
