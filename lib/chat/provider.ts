import { hostedConfiguration } from "@/lib/ai/provider-config";
import { AnalysisError } from "@/lib/ai/food-analysis";

type Message = { role: string; content: string };
export type ProviderOptions = { fetcher?: typeof fetch; apiKey?: string; model?: string; provider?: "ollama" | "openai" | "groq"; baseUrl?: string };

function configuration(options: ProviderOptions): { provider: "ollama" | "openai" | "groq"; model: string; baseUrl: string } {
  const provider = options.provider ?? (options.apiKey ? "openai" : process.env.CHAT_PROVIDER ?? "ollama");
  if (provider !== "ollama" && provider !== "openai" && provider !== "groq") throw new AnalysisError("ai_not_configured", 503);
  return { provider, model: provider === "ollama" ? options.model ?? process.env.OLLAMA_MODEL ?? "qwen3:4b-instruct" : hostedConfiguration({ ...options, provider }, "chat").model, baseUrl: (options.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "") };
}

export async function chatStatus(options: ProviderOptions = {}) {
  const { provider, model, baseUrl } = configuration(options);
  if (provider !== "ollama") return { provider, model, ready: !!hostedConfiguration({ ...options, provider }, "chat").apiKey };
  try {
    const response = await (options.fetcher ?? fetch)(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2500), cache: "no-store" });
    const data = response.ok ? await response.json() : null;
    return { provider, model, ready: Array.isArray(data?.models) && data.models.some((item: { name?: string }) => item.name === model || item.name === `${model}:latest`) };
  } catch { return { provider, model, ready: false }; }
}

export async function generateNutritionReply(messages: Message[], signal: AbortSignal, options: ProviderOptions = {}) {
  const { provider, model, baseUrl } = configuration(options);
  const hosted = provider === "ollama" ? null : hostedConfiguration({ ...options, provider }, "chat");
  const apiKey = hosted?.apiKey;
  if (provider !== "ollama" && !apiKey) throw new AnalysisError("ai_not_configured", 503);
  const combined = AbortSignal.any([signal, AbortSignal.timeout(provider === "ollama" ? 110000 : 20000)]);
  try {
    const response = await (options.fetcher ?? fetch)(provider === "ollama" ? `${baseUrl}/api/chat` : `${hosted!.baseUrl}/chat/completions`, {
      method: "POST", signal: combined, headers: { "Content-Type": "application/json", ...(provider !== "ollama" ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify(provider === "ollama" ? { model, messages, stream: false, think: false, keep_alive: "10m", options: { temperature: 0.4, num_predict: 850, num_ctx: 8192 } } : { model, messages, max_completion_tokens: 850, ...hosted!.parameters })
    });
    if (!response.ok) throw new AnalysisError(response.status === 429 ? "ai_rate_limited" : "chat_unavailable", 503);
    const data = await response.json();
    const choice = data.choices?.[0];
    const content = provider === "ollama" ? data.message?.content : choice?.message?.content;
    const complete = provider === "ollama" ? data.done === true && data.done_reason === "stop" : choice?.finish_reason === "stop" && !choice.message?.refusal;
    if (!complete || typeof content !== "string" || !content.trim() || content.length > 8000) throw new AnalysisError("invalid_chat_response", 502);
    return content.trim();
  } catch (error) {
    if (error instanceof AnalysisError) throw error;
    throw new AnalysisError(combined.aborted ? "chat_timeout" : "chat_unavailable", combined.aborted ? 504 : 503);
  }
}

