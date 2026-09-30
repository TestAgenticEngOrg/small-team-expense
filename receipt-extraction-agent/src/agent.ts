import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { streamText, stepCountIs, type LanguageModel, type ModelMessage } from "ai";
import { AsyncLocalStorage } from "node:async_hooks";
import { config } from "./config.js";
import { SYSTEM_PROMPT, MAX_ITERATIONS } from "./prompt.js";
import { tools } from "./tools.js";

// Per-request credential, reachable from a tool without the model seeing it.
// This agent allows no tools, but the context is still the place a future
// tool would read the caller's bearer from — never from the model.
export const callContext = new AsyncLocalStorage<{ authorization?: string }>();

export interface ModelSettings {
  format: string;
  baseURL: string;
  apiKey: string;
  modelName: string;
  keyHeader?: string;
  authScheme?: string;
}

// Filled from config once /healthz's required variables are all set.
export function modelSettings(): ModelSettings {
  return {
    format: config.modelApiFormat!,
    baseURL: config.modelEndpoint!,
    apiKey: config.modelApiKey!,
    modelName: config.modelName!,
    keyHeader: config.modelApiKeyHeader,
    authScheme: config.modelApiAuthScheme,
  };
}

export function modelClient(
  { format, baseURL, apiKey, modelName, keyHeader, authScheme }: ModelSettings,
): LanguageModel {
  switch (format) {
    case "anthropic":
      return createAnthropic({
        baseURL,
        ...(keyHeader
          ? { apiKey: "unused", headers: { [keyHeader]: apiKey } } // SDK will not start without an apiKey
          : authScheme === "bearer"
            ? { authToken: apiKey } // Authorization: Bearer
            : { apiKey }), // x-api-key
      })(modelName);
    case "openai-compatible":
      return createOpenAICompatible({
        name: "model",
        baseURL,
        includeUsage: true, // a streamed turn reports usage only when asked
        ...(keyHeader ? { headers: { [keyHeader]: apiKey } } : { apiKey }),
      })(modelName);
    default:
      throw new Error(`unsupported MODEL_API_FORMAT: ${format}`);
  }
}

export async function runTurn(messages: ModelMessage[]) {
  let failure: unknown;
  const result = streamText({
    model: modelClient(modelSettings()),
    system: SYSTEM_PROMPT,
    messages,
    tools,
    stopWhen: stepCountIs(MAX_ITERATIONS),
    // A provider error arrives HERE, not as the rejection below.
    onError: ({ error }) => { failure ??= error; },
  });
  // Awaiting these drives the stream, every tool step included, to its end.
  const [text, steps, toolCalls, usage] = await Promise.all([
    result.text, result.steps, result.toolCalls, result.totalUsage,
  ]).catch((err: unknown) => { throw failure ?? err; });
  if (failure !== undefined) throw failure;
  return { text, steps, toolCalls, usage };
}
