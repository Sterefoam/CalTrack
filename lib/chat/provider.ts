import { AnalysisError } from "@/lib/ai/food-analysis";

type Message = { role: string; content: string };
type ProviderOptions = { fetcher?: typeof fetch; apiKey?: string; model?: string; provider?: "ollama" | "openai"; baseUrl?: string };

function configuration(options: ProviderOptions) {
  const provider = options.provider ?? (options.apiKey ? "openai" : process.env.CHAT_PROVIDER ?? "ollama");
  if (provider !== "ollama" && provider !== "openai") throw new AnalysisError("ai_not_configured", 503);
  return { provider, model: options.model ?? (provider === "ollama" ? process.env.OLLAMA_MODEL ?? "qwen3:4b" : process.env.OPENAI_MODEL ?? "gpt-4o"), baseUrl: (options.baseUrl ?? process.env.OLLAMA_BASE_URL ?? "http://127.0.0.1:11434").replace(/\/$/, "") };
}

export async function chatStatus(options: ProviderOptions = {}) {
  const { provider, model, baseUrl } = configuration(options);
  if (provider === "openai") return { provider, model, ready: !!(options.apiKey ?? process.env.OPENAI_API_KEY) };
  try {
    const response = await (options.fetcher ?? fetch)(`${baseUrl}/api/tags`, { signal: AbortSignal.timeout(2500), cache: "no-store" });
    const data = response.ok ? await response.json() : null;
    return { provider, model, ready: Array.isArray(data?.models) && data.models.some((item: { name?: string }) => item.name === model || item.name === `${model}:latest`) };
  } catch { return { provider, model, ready: false }; }
}

export async function generateNutritionReply(messages: Message[], signal: AbortSignal, options: ProviderOptions = {}) {
  const { provider, model, baseUrl } = configuration(options);
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (provider === "openai" && !apiKey) throw new AnalysisError("ai_not_configured", 503);
  const combined = AbortSignal.any([signal, AbortSignal.timeout(provider === "ollama" ? 110000 : 20000)]);
  try {
    const response = await (options.fetcher ?? fetch)(provider === "ollama" ? `${baseUrl}/api/chat` : "https://api.openai.com/v1/chat/completions", {
      method: "POST", signal: combined, headers: { "Content-Type": "application/json", ...(provider === "openai" ? { Authorization: `Bearer ${apiKey}` } : {}) },
      body: JSON.stringify(provider === "ollama" ? { model, messages, stream: false, think: false, keep_alive: "10m", options: { temperature: 0.4, num_predict: 850, num_ctx: 8192 } } : { model, messages, store: false, max_completion_tokens: 850 })
    });
    if (!response.ok) throw new AnalysisError("chat_unavailable", 503);
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
