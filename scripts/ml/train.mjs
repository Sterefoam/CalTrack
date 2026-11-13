import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { createEncoder, MODEL_ID } from "./encoder.mjs";
import { sha256, metrics, trainCentroids, trainLinear } from "./core.mjs";
const root=fileURLToPath(new URL("../../.caltrack/ml/",import.meta.url));
const split=JSON.parse(await readFile(join(root,"split.json"),"utf8"));
const labels=Object.keys(split.counts).sort();
if(labels.length<2)throw new Error("Need at least two classes with 12 independent image groups each");
let modelInfo;
try { modelInfo=JSON.parse(await readFile(join(root,"encoder.json"),"utf8")); }
catch(error) {
  if(error.code!=="ENOENT")throw error;
  const response=await fetch(`https://huggingface.co/api/models/${MODEL_ID}`,{signal:AbortSignal.timeout(20000)});
  if(!response.ok)throw new Error("Cannot pin model revision");
  const data=await response.json();if(!/^[a-f0-9]{40}$/.test(data.sha))throw new Error("Invalid model revision");
  modelInfo={modelId:MODEL_ID,revision:data.sha,dtype:"q8",license:"MIT",sourceUrl:"https://huggingface.co/openai/clip-vit-base-patch16"};
  await writeFile(join(root,"encoder.json"),JSON.stringify(modelInfo,null,2));
}
let embeddings={};
try { embeddings=JSON.parse(await readFile(join(root,"embeddings.json"),"utf8")); }catch(error){if(error.code!=="ENOENT")throw error;}
const encoder=await createEncoder(modelInfo);
const rows=[];
try {
  for(const [i,row] of split.rows.entries()) {
    const key=sha256(`${modelInfo.revision}|q8|${row.sha256}`);
    if(!embeddings[key]) { embeddings[key]=await encoder.encode(join(root,row.file)); await writeFile(join(root,"embeddings.json"),JSON.stringify(embeddings)); }
    rows.push({...row,vector:embeddings[key]});
    if((i+1)%25===0)console.log(`Encoded ${i+1}/${split.rows.length}`);
  }
}finally{await encoder.dispose();}
const training=rows.filter(r=>r.split==="train"),validation=rows.filter(r=>r.split==="validation"),test=rows.filter(r=>r.split==="test");
const centroid=trainCentroids(training,labels);
const candidates=[centroid,...[0.0001,0.001,0.01].map(regularization=>trainLinear(training,labels,{regularization}))];
const validationRuns=candidates.map(model=>({model,result:metrics(validation,model)})).sort((a,b)=>b.result.macroF1-a.result.macroF1);
const selected=validationRuns[0];
const artifact={...selected.model,encoder:modelInfo,trainingSamples:training.length,datasetFingerprint:sha256(JSON.stringify(split.rows.map(({id,sha256,split})=>({id,sha256,split})))),experimental:true,productionEnabled:false};
await writeFile(join(root,"classifier.json"),JSON.stringify(artifact));
const report={createdAt:new Date().toISOString(),dataset:"Wikimedia Commons food categories",datasetFingerprint:artifact.datasetFingerprint,encoder:modelInfo,counts:split.counts,totalDownloaded:JSON.parse(await readFile(join(root,"manifest.json"),"utf8")).records.length,excluded:split.excluded.length,selected:{kind:artifact.kind,regularization:artifact.regularization},validationRuns:validationRuns.map(({model,result})=>({kind:model.kind,regularization:model.regularization,top1:result.top1,macroF1:result.macroF1})),test:metrics(test,artifact),centroidTest:metrics(test,centroid),randomBaseline:1/labels.length,limitations:["Category labels are weak supervision; no complete manual review", "Near-duplicate groups stay in one split; photographer/session leakage may remain", "Only closed-set dish classification; mixed plates and unknown foods require separate evaluation", "No ground-truth grams or nutrition; this model must not estimate calories", "No comparison against current OpenAI vision on the same test set", "Production remains disabled until an independent real-user-photo benchmark passes"]};
await writeFile(join(root,"report.json"),JSON.stringify(report,null,2));
console.log(JSON.stringify({classes:labels.length,training:training.length,validation:validation.length,test:report.test.samples,top1:report.test.top1,top3:report.test.top3,macroF1:report.test.macroF1,selected:report.selected,productionEnabled:false}));
