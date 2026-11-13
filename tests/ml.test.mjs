import assert from "node:assert/strict";
import test from "node:test";
import { acceptedLicense,allowedImageUrl,normalize,sha256,splitDataset,metrics,trainLinear } from "../scripts/ml/core.mjs";
test("ML source filtering requires a reusable license, artist and allowed image host",()=>{
  const metadata={Artist:{value:"<b>Test artist</b>"},LicenseShortName:{value:"CC BY-SA 4.0"},LicenseUrl:{value:"https://creativecommons.org/licenses/by-sa/4.0/"}};
  assert.equal(acceptedLicense(metadata).author,"Test artist");
  for(const name of ["CC BY-NC 4.0","Fair use","Unknown"])assert.equal(acceptedLicense({...metadata,LicenseShortName:{value:name}}),null);
  assert.equal(acceptedLicense({...metadata,Artist:{value:""}}),null);
  assert.throws(()=>allowedImageUrl("https://untrusted.example/image.jpg"));
  assert.throws(()=>allowedImageUrl("http://upload.wikimedia.org/image.jpg"));
});
test("duplicate groups never cross dataset splits and conflicting labels are excluded",()=>{
  const records=Array.from({length:30},(_,i)=>({id:String(i),label:"rice",sha256:sha256(String(i)),dhash:sha256(`image-${i}`).slice(0,16)}));
  records.push({...records[0],id:"duplicate"});
  const split=splitDataset(records);
  assert.equal(split.rows.find(r=>r.id==="0").split,split.rows.find(r=>r.id==="duplicate").split);
  const sets=new Map();for(const row of split.rows){if(sets.has(row.groupId))assert.equal(sets.get(row.groupId),row.split);sets.set(row.groupId,row.split);}
  const conflict=splitDataset([...records,{...records[0],id:"wrong-label",label:"soup"}]);
  assert.ok(conflict.excluded.some(r=>r.id==="0"&&r.reason==="conflicting_near_duplicate_labels"));
  assert.deepEqual(splitDataset(records),split);
});
test("linear head learns separable embeddings and reports macro metrics",()=>{
  const rows=[{label:"rice",vector:normalize([1,0])},{label:"rice",vector:normalize([1,0.1])},{label:"soup",vector:normalize([0,1])},{label:"soup",vector:normalize([0.1,1])}];
  const model=trainLinear(rows,["rice","soup"]);
  const result=metrics(rows,model);assert.equal(result.top1,1);assert.equal(result.macroF1,1);
  assert.throws(()=>normalize([0,0]));
});
