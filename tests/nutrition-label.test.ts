import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { parseNutritionLabel,parsePrintedNumber } from "../lib/nutrition/label";
import { analyzeNutritionLabel } from "../lib/ai/nutrition-label";

const label={isNutritionLabel:true,productName:"Biskuit",languages:["Japanese","Arabic"],basis:{amount:"１００",unit:"g",description:"100 g 当たり"},
  facts:[{key:"energy",label:"エネルギー",value:"８３６,８",unit:"kJ",qualifier:"exact"},
    {key:"protein",label:"たんぱく質",value:"٥٫٥",unit:"g",qualifier:"exact"},
    {key:"carbohydrate",label:"炭水化物",value:"۳۰",unit:"g",qualifier:"exact"},
    {key:"fat",label:"الدهون",value:"८",unit:"g",qualifier:"exact"},
    {key:"sugar",label:"糖類",value:"০",unit:"g",qualifier:"exact"},
    {key:"salt",label:"食塩相当量",value:"1,25",unit:"g",qualifier:"exact"}],warnings:[],confidenceScore:.8};

test("label numbers normalize numeral families without guessing ambiguous separators or inequalities",()=>{
  assert.equal(parsePrintedNumber("１２,５"),12.5);
  assert.equal(parsePrintedNumber("١٬٢٣٤٫٥"),1234.5);
  assert.equal(parsePrintedNumber("१२.५"),12.5);
  assert.equal(parsePrintedNumber("๑๒.๕"),12.5);
  assert.equal(parsePrintedNumber("1 234,5"),1234.5);
  assert.equal(parsePrintedNumber("0.005"),.005);
  for(const text of ["1,234","1.234","<0.5","12%","1e3","-2","1,2.3","garam"])assert.equal(parsePrintedNumber(text),null,text);
});
test("extracted multilingual facts convert energy and salt while preserving unknown versus explicit zero",()=>{
  const parsed=parseNutritionLabel(label);
  assert.equal(parsed.basis.amount,100);
  assert.equal(parsed.nutrients.calories,200);
  assert.equal(parsed.nutrients.sodiumMg,500);
  assert.equal(parsed.nutrients.proteinG,5.5);
  assert.equal(parsed.nutrients.carbsG,30);
  assert.equal(parsed.nutrients.fatG,8);
  assert.equal(parsed.nutrients.sugarG,0);
  assert.equal(parsed.nutrients.fiberG,null);
  assert.equal(parsed.facts[0].label,"エネルギー");
  assert.equal(parsed.requiresConfirmation,true);
});
test("contradictory columns, percentage amounts and unreadable values require manual review",()=>{
  const parsed=parseNutritionLabel({...label,facts:[...label.facts,
    {key:"protein",label:"Protein per serving",value:"2",unit:"g",qualifier:"exact"},
    {key:"fiber",label:"Serat",value:"8",unit:"%",qualifier:"exact"},
    {key:"sodium",label:"Sodium",value:"50",unit:"mg",qualifier:"exact"}]});
  assert.equal(parsed.nutrients.proteinG,null);
  assert.equal(parsed.nutrients.sodiumMg,null);
  assert.equal(parsed.nutrients.fiberG,null);
  assert.ok(parsed.warnings.length>=3);
  const inequality=parseNutritionLabel({...label,facts:[{key:"sugar",label:"Sugar",value:"0.5",unit:"g",qualifier:"less_than"}]});
  assert.equal(inequality.nutrients.sugarG,null);
  assert.throws(()=>parseNutritionLabel({...label,isNutritionLabel:false}),/no_nutrition_label/);
  assert.throws(()=>parseNutritionLabel({...label,confidenceScore:Infinity}),/invalid_label_response/);
});
test("nutrition label vision uses the single-column multilingual extraction contract and high resolution",async()=>{
  const buffer=await sharp({create:{width:2800,height:1000,channels:3,background:"#fff"}}).png().toBuffer();
  const file=new File([new Uint8Array(buffer)],"label.png",{type:"image/png"});
  const parsed=await analyzeNutritionLabel(file,new AbortController().signal,{apiKey:"test-only",fetcher:async(_url,init)=>{
    const body=JSON.parse(String(init?.body));
    assert.match(body.messages[0].content,/SATU kolom/);
    assert.equal(body.messages[1].content[1].image_url.detail,"high");
    assert.equal(body.response_format.json_schema.schema.additionalProperties,false);
    const bytes=Buffer.from(body.messages[1].content[1].image_url.url.split(",")[1],"base64");
    assert.equal((await sharp(bytes).metadata()).width,2400);
    return Response.json({choices:[{finish_reason:"stop",message:{content:JSON.stringify(label)}}]});
  }});
  assert.equal(parsed.nutrients.calories,200);
});
