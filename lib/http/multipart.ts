import { InputError } from "./json";

export async function readMultipart(request: Request, maxBytes = 4 * 1024 * 1024 + 65536) {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("multipart/form-data;")) throw new InputError("multipart_required", 415);
  if (Number(request.headers.get("content-length")) > maxBytes) throw new InputError("payload_too_large", 413);
  const reader = request.body?.getReader();
  if (!reader) throw new InputError("invalid_upload");
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > maxBytes) { await reader.cancel(); throw new InputError("payload_too_large", 413); }
      chunks.push(value);
    }
    return await new Response(Buffer.concat(chunks), { headers: { "Content-Type": contentType } }).formData();
  } catch (error) { if (error instanceof InputError) throw error; throw new InputError("invalid_upload"); }
  finally { reader.releaseLock(); }
}
