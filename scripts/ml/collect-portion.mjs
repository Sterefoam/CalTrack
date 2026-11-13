import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import sharp from "sharp";
import { sha256 } from "./core.mjs";

const root = fileURLToPath(new URL("../../.caltrack/ml/portion/",import.meta.url));
const base = "https://storage.googleapis.com/nutrition5k_dataset/nutrition5k_dataset/";
const license = { name:"CC BY 4.0",url:"https://creativecommons.org/licenses/by/4.0/",author:"Quin Thames et al., Nutrition5k (CVPR 2021)",
  source:"https://github.com/google-research-datasets/Nutrition5k#license--contact" };
await mkdir(join(root,"sources"),{recursive:true});
await mkdir(join(root,"images"),{recursive:true});
async function download(url,limit) {
  const response = await fetch(url,{signal:AbortSignal.timeout(30000),redirect:"error",headers:{"User-Agent":"CalTrack-Research/0.3 (licensed food mass study)"}});
  if (!response.ok) { await response.body?.cancel(); const error = new Error(`HTTP ${response.status}`);error.status=response.status;throw error; }
  if (Number(response.headers.get("content-length")) > limit) { await response.body?.cancel();throw new Error("Response too large"); }
  const reader = response.body.getReader(),chunks=[];let size=0;
  try { while (true) { const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit){await reader.cancel();throw new Error("Response too large");}chunks.push(value); } }
  finally {reader.releaseLock();}
  return Buffer.concat(chunks);
}
async function source(name,path) {
  const destination = join(root,"sources",name);
  try {return await readFile(destination,"utf8");}catch(error){if(error.code!=="ENOENT")throw error;}
  const data = await download(base+path,5_000_000);await writeFile(destination,data);return data.toString("utf8");
}
async function save(name,value) {
  const temporary=join(root,`${name}.tmp`),destination=join(root,name);
  await writeFile(temporary,JSON.stringify(value,null,2));
  for(let attempt=0;;attempt++)try{await rename(temporary,destination);return;}catch(error){if(attempt>=9||!["EPERM","EACCES","EBUSY"].includes(error.code))throw error;await new Promise(resolve=>setTimeout(resolve,200*(attempt+1)));}
}
const masses=new Map();
for(const cafe of [1,2]) {
  const metadata=await source(`dish_metadata_cafe${cafe}.csv`,`metadata/dish_metadata_cafe${cafe}.csv`);
  for(const line of metadata.trim().split(/\r?\n/)) {
    // The three leading fields are unquoted dish ID, calories, and weighed mass.
    const [id,,mass]=line.split(","),grams=Number(mass);
    if(/^dish_\d{10}$/.test(id)&&Number.isFinite(grams)&&grams>0) {
      if(masses.has(id)&&masses.get(id)!==grams)throw new Error("Conflicting weighed mass");
      masses.set(id,grams);
    }
  }
}
const assignments=new Map();
for(const partition of ["train","test"]) {
  const ids=await source(`depth_${partition}_ids.txt`,`dish_ids/splits/depth_${partition}_ids.txt`);
  for(const id of ids.trim().split(/\s+/)) {
    if(!/^dish_\d{10}$/.test(id))throw new Error("Invalid official dish ID");
    if(assignments.has(id))throw new Error("Official split overlap");
    if(masses.has(id))assignments.set(id,partition);
  }
}
const day=id=>new Date(Number(id.slice(5))*1000).toISOString().slice(0,10);
const days=[...new Set([...assignments].filter(([,part])=>part==="train").map(([id])=>day(id)))].sort((a,b)=>sha256(`portion-v1:${a}`).localeCompare(sha256(`portion-v1:${b}`)));
const validationDays=new Set(days.slice(0,Math.max(1,Math.floor(days.length*0.2))));
let previous;
try{previous=JSON.parse(await readFile(join(root,"manifest.json"),"utf8"));}catch(error){if(error.code!=="ENOENT")throw error;}
const records=new Map((previous?.records??[]).map(row=>[row.id,row])),errors=[];
const jobs=[...assignments.keys()].sort((a,b)=>sha256(`portion-download:${a}`).localeCompare(sha256(`portion-download:${b}`)));
async function checkpoint(){await save("manifest.json",{source:"Nutrition5k",license,records:[...records.values()],errors,validationDays:[...validationDays],updatedAt:new Date().toISOString()});}
console.log(JSON.stringify({stage:"portion-collection",officialOverheadImages:jobs.length,trainDays:days.length,validationDays:validationDays.size,resumed:records.size}));
for(let offset=0;offset<jobs.length;offset+=4) {
  const results=await Promise.allSettled(jobs.slice(offset,offset+4).filter(id=>!records.has(id)).map(async id=>{
    const sourceUrl=`${base}imagery/realsense_overhead/${id}/rgb.png`;
    const original=await download(sourceUrl,4_000_000);
    const normalized=await sharp(original,{limitInputPixels:4_000_000,failOn:"error"}).rotate().resize({width:512,height:512,fit:"inside",withoutEnlargement:true}).jpeg({quality:90}).toBuffer();
    await writeFile(join(root,"images",`${id}.jpg`),normalized);
    const official=assignments.get(id),split=official==="test"?"test":validationDays.has(day(id))?"validation":"train";
    records.set(id,{id,grams:masses.get(id),file:`portion/images/${id}.jpg`,sha256:sha256(normalized),sourceSha256:sha256(original),
      sourceUrl,officialSplit:official,split,groupId:`${official}:${day(id)}`,day:day(id),
      modifications:"Overhead RGB only; resized <=512px and JPEG re-encoded; no depth or video used",labelStatus:"weighed-total-dish-mass"});
  }));
  for(const result of results)if(result.status==="rejected") {
    errors.push({reason:result.reason.message});
    if([429,503].includes(result.reason.status)){await checkpoint();throw new Error("Provider rate limited collection; resume after the indicated cooldown");}
  }
  if(offset%100===0||offset+4>=jobs.length){await checkpoint();console.log(JSON.stringify({stage:"portion-collection",images:records.size,visited:Math.min(offset+4,jobs.length),total:jobs.length,errors:errors.length}));}
  await new Promise(resolve=>setTimeout(resolve,100));
}
const hashes=new Map(),excluded=[];
for(const row of records.values()){if(!hashes.has(row.sha256))hashes.set(row.sha256,[]);hashes.get(row.sha256).push(row);}
const rows=[];
for(const group of hashes.values()) {
  if(new Set(group.map(row=>row.split)).size>1||Math.max(...group.map(row=>row.grams))-Math.min(...group.map(row=>row.grams))>0.1){excluded.push(...group.map(row=>({id:row.id,reason:"conflicting_duplicate_photo"})));continue;}
  rows.push(group.sort((a,b)=>a.id.localeCompare(b.id))[0]);
  excluded.push(...group.slice(1).map(row=>({id:row.id,reason:"exact_duplicate_photo"})));
}
rows.sort((a,b)=>a.id.localeCompare(b.id));
const counts=Object.fromEntries(["train","validation","test"].map(part=>[part,rows.filter(row=>row.split===part).length]));
await save("split.json",{protocol:"nutrition5k-overhead-rgb-mass-v1",license,rows,counts,excluded,
  partitionPolicy:"Official depth train/test IDs; validation uses whole UTC capture days from official train only. Official authors group incremental scans across train/test.",
  limitations:["Fixed capture rig and cafeteria domain; mobile plate scale and Indonesian cuisines not validated","No depth, hidden ingredients, or manual relabeling","Capture-day grouping supplements official plate split; adjacent test scans can remain correlated"]});
await checkpoint();
console.log(JSON.stringify({stage:"portion-collection-finished",downloaded:records.size,counts,excluded:excluded.length,errors:errors.length}));
