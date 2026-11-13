import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { parsePhotoReference,parseReferencedPhoto } from "../lib/ai/photo-reference";
import { analyzePhoto } from "../lib/ai/photo";
import { requestVisionJson } from "../lib/ai/vision-request";

const rice={food_name:"Nasi",estimated_weight_grams:200,calories:260,macros:{protein_g:5,carbs_g:56,fat_g:0.6},micros:{fiber_g:0.8,sugar_g:0.2,sodium_mg:2},confidence_score:0.8};
const result={items:[rice,{...rice,food_name:"Ayam",estimated_weight_grams:100,calories:165}],confidence_score:0.8,reference_visible:true,
  weight_ranges:[{lower_grams:150,upper_grams:300,note:"Ketebalan nasi belum diketahui."},{lower_grams:80,upper_grams:150,note:"Mungkin mengandung tulang."}]};

test("photo reference validates dimensions, known edible mass and untrusted form values",()=>{
  assert.deepEqual(parsePhotoReference('{"kind":"plate_diameter_cm","value":26}'),{kind:"plate_diameter_cm",value:26});
  assert.equal(parsePhotoReference(null),undefined);
  for(const value of ["bad",[],{kind:"plate_diameter_cm",value:5},{kind:"known_total_grams",value:Infinity},{kind:"known_total_grams",value:"500"},{kind:"known_total_grams",value:500,extra:true}])assert.throws(()=>parsePhotoReference(value),/invalid_photo_reference/);
});
test("known total mass controls scaling of all components and nutrients on the server",()=>{
  const parsed=parseReferencedPhoto(result,{kind:"known_total_grams",value:600});
  assert.equal(parsed.items.reduce((sum,item)=>sum+item.weightGrams,0),600);
  assert.equal(parsed.items[0].weightGrams,400);
  assert.equal(parsed.items[0].calories,520);
  assert.equal(parsed.items[1].sodiumMg,4);
  assert.equal(parsed.photoAssessment.items[0].lowerGrams,300);
  assert.equal(parsed.photoAssessment.calibrated,false);
  assert.equal(parsed.requiresConfirmation,true);
});
test("plate estimates require a visible reference and ranges enclosing each estimate",()=>{
  assert.throws(()=>parseReferencedPhoto({...result,reference_visible:false},{kind:"plate_diameter_cm",value:26}),/reference_not_visible/);
  assert.throws(()=>parseReferencedPhoto({...result,weight_ranges:[{lower_grams:250,upper_grams:300,note:"bad"},result.weight_ranges[1]]},{kind:"plate_diameter_cm",value:26}),/invalid_ai_response/);
  assert.throws(()=>parseReferencedPhoto({...result,weight_ranges:[]},{kind:"plate_diameter_cm",value:26}),/invalid_ai_response/);
  assert.equal(parseReferencedPhoto(result,{kind:"plate_diameter_cm",value:26}).items[0].weightGrams,200);
});
test("referenced photo sends its scale and high resolution image, while cancellation and refusal fail safely",async()=>{
  const bytes=await sharp({create:{width:40,height:40,channels:3,background:"#778844"}}).jpeg().toBuffer();
  const file=new File([new Uint8Array(bytes)],"food.jpg",{type:"image/jpeg"});
  const parsed=await analyzePhoto(file,new AbortController().signal,{apiKey:"test-only",reference:{kind:"plate_diameter_cm",value:26},fetcher:async(_url,init)=>{
    const body=JSON.parse(String(init?.body));
    assert.match(body.messages[0].content,/26 cm/);
    assert.equal(body.messages[1].content[1].image_url.detail,"high");
    assert.equal(body.store,false);
    return Response.json({choices:[{finish_reason:"stop",message:{content:JSON.stringify(result)}}]});
  }});
  assert.equal("photoAssessment" in parsed,true);
  const stop=new AbortController();stop.abort();
  await assert.rejects(requestVisionJson(Buffer.from("image"),"test",{},stop.signal,{apiKey:"test-only",fetcher:async(_url,init)=>{init?.signal?.throwIfAborted();return new Response();}}),/analysis_cancelled/);
  await assert.rejects(requestVisionJson(Buffer.from("image"),"test",{},new AbortController().signal,{apiKey:"test-only",fetcher:async()=>Response.json({choices:[{finish_reason:"stop",message:{refusal:"no",content:"{}"}}]})}),/invalid_ai_response/);
});
