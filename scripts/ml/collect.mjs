import { mkdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import sharp from "sharp";
import { sourceClasses, acceptedLicense, allowedImageUrl, plainText, sha256, splitDataset } from "./core.mjs";

const directory = fileURLToPath(new URL("../../.caltrack/ml/", import.meta.url));
await mkdir(join(directory,"images"), { recursive: true });
const perClass = Number(process.env.ML_IMAGES_PER_CLASS ?? 50);
if (!Number.isInteger(perClass) || perClass < 12 || perClass > 500) throw new Error("ML_IMAGES_PER_CLASS must be 12–500");
const userAgent = "CalTrack-Research/0.1 (licensed food-image dataset; local ML experiment)";
const sleep = ms => new Promise(resolve=>setTimeout(resolve,ms));
async function fetchBounded(url, maxBytes) {
  for (let attempt=0;attempt<3;attempt++) {
    const response = await fetch(url, { headers:{"User-Agent":userAgent}, signal:AbortSignal.timeout(30000), redirect:"error" });
    if (response.status===429 || response.status===503) {
      await response.body?.cancel();
      if (attempt===2) throw new Error(`Provider rate limited: ${response.status}`);
      const delay = Math.min(30, Math.max(2,Number(response.headers.get("Retry-After")) || 2**attempt*3));
      await sleep(delay*1000); continue;
    }
    if (!response.ok) { await response.body?.cancel(); throw new Error(`Download HTTP ${response.status}`); }
    if (Number(response.headers.get("content-length"))>maxBytes) { await response.body?.cancel(); throw new Error("Source too large"); }
    const chunks=[];let bytes=0;
    for await (const chunk of response.body) { bytes+=chunk.length;if(bytes>maxBytes)throw new Error("Source too large"); chunks.push(chunk); }
    return Buffer.concat(chunks);
  }
}
let previous=[];
try { previous=JSON.parse(await readFile(join(directory,"manifest.json"),"utf8")).records; } catch(error) { if(error.code!=="ENOENT")throw error; }
const records = new Map(previous.map(r=>[r.id,r])), errors=[];
for (const [label,category] of sourceClasses) {
  let count=[...records.values()].filter(r=>r.label===label).length;
  let continuation;
  for (let page=0;page<10 && count<perClass;page++) {
    const url = new URL("https://commons.wikimedia.org/w/api.php");
    url.search = new URLSearchParams({action:"query",format:"json",generator:"categorymembers",gcmtitle:`Category:${category}`,gcmtype:"file",gcmlimit:"50",prop:"imageinfo",iiprop:"url|extmetadata|size",iiurlwidth:"384",...(continuation ?? {})}).toString();
    let data;
    try { data=JSON.parse((await fetchBounded(url,5_000_000)).toString("utf8")); if(data.error)throw new Error(data.error.code); }
    catch(error){ errors.push({label,reason:error.message}); break; }
    for (const entry of Object.values(data.query?.pages ?? {})) {
      if(count>=perClass)break;
      const id=String(entry.pageid),info=entry.imageinfo?.[0];
      if(!info || !/\.(?:jpg|jpeg|png|webp)$/i.test(entry.title) || Math.min(info.width,info.height)<224)continue;
      if(records.has(id))continue;
      const license=acceptedLicense(info.extmetadata ?? {});
      if(!license)continue;
      try {
        const imageUrl=allowedImageUrl(info.thumburl);
        const buffer=await fetchBounded(imageUrl,2_000_000);
        const image=sharp(buffer,{limitInputPixels:10_000_000,failOn:"error"});
        if((await image.metadata()).pages>1)continue;
        const normalized=await image.rotate().resize({width:384,height:384,fit:"inside",withoutEnlargement:true}).jpeg({quality:85}).toBuffer();
        const pixels=await sharp(normalized).resize(9,8,{fit:"fill"}).grayscale().raw().toBuffer();
        let hash=0n;for(let y=0;y<8;y++)for(let x=0;x<8;x++)hash=(hash<<1n)|(pixels[y*9+x]>pixels[y*9+x+1]?1n:0n);
        const digest=sha256(normalized);
        if([...records.values()].some(r=>r.sha256===digest))continue;
        await writeFile(join(directory,"images",`${id}.jpg`),normalized);
        records.set(id,{id,label,category,title:entry.title,file:`images/${id}.jpg`,sha256:digest,dhash:hash.toString(16).padStart(16,"0"),license,sourceUrl:info.descriptionurl,originalUrl:allowedImageUrl(info.url),downloadUrl:imageUrl,description:plainText(info.extmetadata.ImageDescription?.value).slice(0,1000),retrievedAt:new Date().toISOString(),modifications:"Resized to <=384px, JPEG re-encoded, metadata stripped"});
        count++;
      } catch(error){ errors.push({id,label,reason:error.message}); }
      await sleep(350);
    }
    await writeFile(join(directory,"manifest.json"),JSON.stringify({source:"Wikimedia Commons",perClass,records:[...records.values()],errors},null,2));
    continuation=data.continue;
    if(!continuation)break;
    await sleep(1000);
  }
  console.log(`${label}: ${count} licensed images`);
}
const split=splitDataset([...records.values()]);
await writeFile(join(directory,"split.json"),JSON.stringify(split,null,2));
console.log(JSON.stringify({downloaded:records.size,eligible:split.rows.length,classes:Object.keys(split.counts).length,excluded:split.excluded.length,downloadErrors:errors.length}));
