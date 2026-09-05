import { createProvider, envApiKeyAuth, type Model, type ThinkingLevelMap } from "@earendil-works/pi-ai";
import { openAICompletionsApi } from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

export const PROVIDER_ID = "abliteration";
export const BASE_URL = "https://api.abliteration.ai/v1";

// Documented Chat Completions modes, not the narrower Responses effort ladder.
const BASE_THINKING: ThinkingLevelMap = {
  off: "none", minimal: "minimal", low: "low", medium: "medium",
  high: "high", xhigh: "xhigh", max: "max",
};
const LARGE_THINKING: ThinkingLevelMap = {
  off: "none", minimal: null, low: null, medium: null,
  high: "high", xhigh: null, max: "max",
};
const LARGE_V2_THINKING: ThinkingLevelMap = {
  // Large V2 cannot disable reasoning: "none" runs low with its trace hidden.
  off: "none", minimal: null, low: "low", medium: null,
  high: "high", xhigh: null, max: "max",
};

/** Static, documented catalog: available before login and without network I/O. */
export function getModels(): Model<"openai-completions">[] {
  return [
    { id: "abliterated-model", name: "Abliterated Model", context: 262_144,
      output: 262_134, price: 3, vision: true, thinking: BASE_THINKING },
    { id: "abliterated-model-large-v2", name: "Abliterated Model Large V2", context: 1_000_000,
      output: 999_990, price: 5, vision: false, thinking: LARGE_V2_THINKING },
    { id: "abliterated-model-large", name: "Abliterated Model Large", context: 1_000_000,
      output: 999_990, price: 5, vision: false, thinking: LARGE_THINKING },
  ].map((entry) => ({
    id: entry.id,
    name: entry.name,
    provider: PROVIDER_ID,
    api: "openai-completions",
    baseUrl: BASE_URL,
    reasoning: true,
    thinkingLevelMap: { ...entry.thinking },
    input: entry.vision ? ["text", "image"] : ["text"],
    contextWindow: entry.context,
    maxTokens: entry.output,
    // USD per million tokens. Cache creation is charged at the input rate.
    cost: { input: entry.price, output: entry.price, cacheRead: entry.price / 10, cacheWrite: entry.price },
    compat: {
      supportsDeveloperRole: false,
      supportsStore: false,
      supportsStrictMode: false,
      maxTokensField: "max_tokens",
      supportsReasoningEffort: true,
      supportsUsageInStreaming: true,
      supportsLongCacheRetention: false,
      // Caching is automatic. Do not send OpenAI-specific affinity headers.
      sendSessionAffinityHeaders: false,
    },
  }));
}

export default function (pi: ExtensionAPI): void {
  pi.registerProvider(createProvider({
    id: PROVIDER_ID,
    name: "Abliteration AI",
    baseUrl: BASE_URL,
    auth: { apiKey: envApiKeyAuth("Abliteration AI API key", ["ABLITERATION_API_KEY", "ABLIT_KEY"]) },
    api: openAICompletionsApi(),
    models: getModels(),
  }));
}
