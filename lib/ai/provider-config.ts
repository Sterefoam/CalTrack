import { AnalysisError } from "./errors";

export type HostedProvider = "groq" | "openai";
export type HostedOptions = { provider?: HostedProvider; apiKey?: string; model?: string; fetcher?: typeof fetch };

// Explicit injected keys preserve the existing OpenAI adapter contract in tests/tools.
export function hostedConfiguration(options: HostedOptions = {}, modality: "text" | "vision" | "chat" | "audio" = "text") {
  const provider = options.provider ?? (options.apiKey ? "openai" : process.env.AI_PROVIDER ?? "openai");
  if (provider !== "groq" && provider !== "openai") throw new AnalysisError("ai_not_configured", 503);
  const groq = provider === "groq";
  const defaults = { text: "openai/gpt-oss-20b", chat: "openai/gpt-oss-20b", vision: "qwen/qwen3.8-27b", audio: "whisper-large-v3-turbo" };
  const model = options.model ?? (groq
    ? process.env[`GROQ_${modality === "audio" ? "TRANSCRIPTION" : modality.toUpperCase()}_MODEL`] ?? defaults[modality]
    : modality === "audio" ? process.env.OPENAI_TRANSCRIPTION_MODEL ?? "whisper-1" : process.env.OPENAI_MODEL ?? "gpt-4o");
  return {
    provider, model, apiKey: options.apiKey ?? (groq ? process.env.GROQ_API_KEY : process.env.OPENAI_API_KEY),
    baseUrl: groq ? "https://api.groq.com/openai/v1" : "https://api.openai.com/v1",
    parameters: groq ? { max_completion_tokens: 4096,
      ...(model.startsWith("openai/gpt-oss-") ? { reasoning_effort: "low" } : {}),
      ...(model === "qwen/qwen3.8-27b" ? { reasoning_effort: "none", temperature: 0.2 } : {}),
    } : { store: false },
  };
}
