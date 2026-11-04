import { AnalysisError, requestFoodAnalysis } from "./food-analysis";
export async function analyzeText(text: unknown, signal: AbortSignal, options?: Parameters<typeof requestFoodAnalysis>[2]) {
  if (typeof text !== "string" || text.trim().length < 3 || text.trim().length > 1000) throw new AnalysisError("invalid_food_text", 400);
  return requestFoodAnalysis(text.trim(), signal, options);
}
