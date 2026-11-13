import { readFile } from "node:fs/promises";
import { createEncoder } from "./encoder.mjs";
import { rank } from "./core.mjs";
if(!process.argv[2])throw new Error("Usage: node scripts/ml/predict.mjs <local-food-photo>");
const model=JSON.parse(await readFile(new URL("../../.caltrack/ml/classifier.json",import.meta.url),"utf8"));
const encoder=await createEncoder({...model.encoder,offline:true});
try { console.log(JSON.stringify({experimental:true,candidates:rank(await encoder.encode(process.argv[2]),model).slice(0,3),note:"Scores are uncalibrated classifier logits, not probabilities; confirm the dish and portion."},null,2)); }
finally{await encoder.dispose();}
