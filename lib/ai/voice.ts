import { AnalysisError, requestFoodAnalysis } from "./food-analysis";
import { analyzeText } from "./text";
type Options = Parameters<typeof requestFoodAnalysis>[2] & { transcriptionModel?: string };
export async function transcribeAudio(audio: File, signal: AbortSignal, options: Options = {}) {
  if (!audio.size || audio.size > 10 * 1024 * 1024) throw new AnalysisError("invalid_audio_size", 413);
  const mime = audio.type.split(";")[0].toLowerCase();
  const formats: Record<string, string> = { "audio/webm": "webm", "audio/wav": "wav", "audio/x-wav": "wav", "audio/mpeg": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a" };
  if (!formats[mime]) throw new AnalysisError("unsupported_audio", 415);
  const bytes = Buffer.from(await audio.arrayBuffer());
  const valid = mime === "audio/webm" ? bytes.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3]))
    : mime.includes("wav") ? bytes.toString("ascii",0,4) === "RIFF" && bytes.toString("ascii",8,12) === "WAVE"
    : mime === "audio/mpeg" ? bytes.toString("ascii",0,3) === "ID3" || (bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0)
    : bytes.toString("ascii",4,8) === "ftyp";
  if (!valid) throw new AnalysisError("invalid_audio", 400);
  const apiKey = options.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) throw new AnalysisError("ai_not_configured", 503);
  const combined = AbortSignal.any([signal, AbortSignal.timeout(15000)]);
  try {
    const form = new FormData();
    form.set("file", new File([new Uint8Array(bytes)], `recording.${formats[mime]}`, { type: mime }));
    form.set("model", options.transcriptionModel ?? process.env.OPENAI_TRANSCRIPTION_MODEL ?? "whisper-1");
    form.set("language", "id"); form.set("response_format", "json");
    const response = await (options.fetcher ?? fetch)("https://api.openai.com/v1/audio/transcriptions", { method: "POST", signal: combined, headers: { Authorization: `Bearer ${apiKey}` }, body: form });
    if (!response.ok) throw new AnalysisError("transcription_unavailable", 503);
    const data = await response.json();
    if (typeof data.text !== "string" || data.text.trim().length < 3) throw new AnalysisError("no_speech_detected", 422);
    if (data.text.trim().length > 1000) throw new AnalysisError("transcript_too_long", 422);
    return data.text.trim();
  } catch (error) {
    if (error instanceof AnalysisError) throw error;
    if (combined.aborted) throw new AnalysisError(signal.aborted ? "analysis_cancelled" : "transcription_timeout", signal.aborted ? 499 : 504);
    throw new AnalysisError("transcription_unavailable", 502);
  }
}
export async function analyzeVoice(audio: File, signal: AbortSignal, options?: Options) {
  const transcript = await transcribeAudio(audio, signal, options);
  return { ...await analyzeText(transcript, signal, options), transcript };
}
