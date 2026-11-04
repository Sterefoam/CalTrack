const requests = new Map<string, { until: number; count: number }>();
export function allowAnalysis(userId: string) {
  const now = Date.now();
  for (const [key, entry] of requests) if (entry.until <= now) requests.delete(key);
  const entry = requests.get(userId) ?? { until: now + 60_000, count: 0 };
  if (entry.count >= 10 || (!requests.has(userId) && requests.size >= 10_000)) return false;
  entry.count++;
  requests.set(userId, entry);
  return true;
}
