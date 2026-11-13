import { AutoProcessor, CLIPVisionModelWithProjection, RawImage, env } from "@huggingface/transformers";
import { fileURLToPath } from "node:url";
import { normalize } from "./core.mjs";
export const MODEL_ID = "Xenova/clip-vit-base-patch16";
export async function createEncoder({ revision, offline = false } = {}) {
  env.cacheDir=fileURLToPath(new URL("../../.caltrack/ml/model-cache/",import.meta.url));
  env.allowLocalModels=offline;
  env.allowRemoteModels=!offline;
  const options={revision,local_files_only:offline};
  const processor=await AutoProcessor.from_pretrained(MODEL_ID,options);
  const model=await CLIPVisionModelWithProjection.from_pretrained(MODEL_ID,{...options,dtype:"q8",device:"cpu",session_options:{intraOpNumThreads:2}});
  return { async encode(path) { const image=await RawImage.read(path);const inputs=await processor(image);const output=await model(inputs);return normalize(Array.from(output.image_embeds.data)); }, dispose:()=>model.dispose() };
}
