export class InputError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}
export async function readJson(request: Request, maxBytes = 100_000): Promise<unknown> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/json")) throw new InputError("json_required", 415);
  if (Number(request.headers.get("content-length")) > maxBytes) throw new InputError("payload_too_large", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("invalid_json");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new InputError("payload_too_large", 413); }
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch (error) {
    if (error instanceof InputError) throw error;
    throw new InputError("invalid_json");
  } finally { reader.releaseLock(); }
}
