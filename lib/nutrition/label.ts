export class NutritionLabelError extends Error {
  constructor(public code:string,public status=502){super(code);}
}
export const labelNutrientKeys=["calories","proteinG","carbsG","fatG","fiberG","sugarG","sodiumMg"] as const;
export type LabelNutrientKey=typeof labelNutrientKeys[number];
type FactKey="energy"|"protein"|"carbohydrate"|"fat"|"fiber"|"sugar"|"sodium"|"salt";
type FactUnit="kcal"|"kJ"|"g"|"mg"|"mcg"|"%"|"unknown";
export type LabelFact={key:FactKey;label:string;value:string|null;unit:FactUnit;qualifier:"exact"|"less_than"|"approximate"|"unreadable"};
export type NutritionLabelResult={productName:string|null;languages:string[];basis:{amount:number|null;unit:"g"|"ml"|"serving"|"unknown";description:string};
  nutrients:Record<LabelNutrientKey,number|null>;facts:LabelFact[];warnings:string[];confidenceScore:number;requiresConfirmation:true};

// Recognize common Unicode decimal numeral families. Language names do not determine
// ambiguous decimal/grouping separators; an ambiguous printed number stays unknown.
const digitStarts=[0x660,0x6f0,0x966,0x9e6,0xa66,0xae6,0xb66,0xbe6,0xc66,0xce6,0xd66,0xe50,0xed0,0xf20,0x1040,0x1090,0x17e0,0x1810,0x1a80,0x1a90,0x1b50,0x1bb0,0xa620,0xa8d0,0xa900,0xa9d0,0xaa50,0xabf0];
export function parsePrintedNumber(raw:unknown):number|null {
  if(typeof raw!=="string"||raw.length>40)return null;
  let text=Array.from(raw.normalize("NFKC")).map(character=>{
    const point=character.codePointAt(0)!;const start=digitStarts.find(start=>point>=start&&point<start+10);
    return start===undefined?character:String(point-start);
  }).join("").replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,"").replace(/\u066b/g,".").replace(/\u066c/g," ").trim();
  if(/\s/.test(text)) {
    if(!/^\d{1,3}(?:\s\d{3})+(?:[.,]\d+)?$/.test(text))return null;
    text=text.replace(/\s/g,"");
  }
  if(/^\d+$/.test(text)){const value=Number(text);return Number.isFinite(value)?value:null;}
  if(text.includes(",")&&text.includes(".")) {
    const decimal=text.lastIndexOf(",")>text.lastIndexOf(".")?",":".",group=decimal===","?".":",";
    const index=text.lastIndexOf(decimal),whole=text.slice(0,index),fraction=text.slice(index+1);
    const groups=whole.split(group);
    if(!/^\d+$/.test(fraction)||!/^\d{1,3}$/.test(groups[0])||groups.slice(1).some(value=>!/^\d{3}$/.test(value)))return null;
    const value=Number(groups.join("")+"."+fraction);return Number.isFinite(value)?value:null;
  }
  const match=text.match(/^(\d*)[.,](\d+)$/);
  if(match) {
    // 1,234 / 1.234 has two plausible interpretations; 0.005 does not.
    if(match[2].length===3&&Number(match[1])>0)return null;
    const value=Number((match[1]||"0")+"."+match[2]);return Number.isFinite(value)?value:null;
  }
  if(/^\d{1,3}(?:,\d{3}){2,}$/.test(text)||/^\d{1,3}(?:\.\d{3}){2,}$/.test(text))return Number(text.replace(/[,.]/g,""));
  return null;
}

const nullableText={type:["string","null"]};
export const nutritionLabelSchema={type:"object",additionalProperties:false,properties:{
  isNutritionLabel:{type:"boolean"},productName:nullableText,languages:{type:"array",maxItems:8,items:{type:"string"}},
  basis:{type:"object",additionalProperties:false,properties:{amount:nullableText,unit:{type:"string",enum:["g","ml","serving","unknown"]},description:{type:"string"}},required:["amount","unit","description"]},
  facts:{type:"array",maxItems:20,items:{type:"object",additionalProperties:false,properties:{
    key:{type:"string",enum:["energy","protein","carbohydrate","fat","fiber","sugar","sodium","salt"]},label:{type:"string"},value:nullableText,
    unit:{type:"string",enum:["kcal","kJ","g","mg","mcg","%","unknown"]},qualifier:{type:"string",enum:["exact","less_than","approximate","unreadable"]}},required:["key","label","value","unit","qualifier"]}},
  warnings:{type:"array",maxItems:12,items:{type:"string"}},confidenceScore:{type:"number",minimum:0,maximum:1}
},required:["isNutritionLabel","productName","languages","basis","facts","warnings","confidenceScore"]};

const object=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==="object"&&!Array.isArray(value);
const text=(value:unknown,max:number)=>typeof value==="string"&&value.length<=max;
const keys:FactKey[]=["energy","protein","carbohydrate","fat","fiber","sugar","sodium","salt"];
const units:FactUnit[]=["kcal","kJ","g","mg","mcg","%","unknown"];
const qualifiers=["exact","less_than","approximate","unreadable"];
const massGrams=(value:number,unit:FactUnit)=>unit==="g"?value:unit==="mg"?value/1000:unit==="mcg"?value/1e6:null;
const target:Partial<Record<FactKey,LabelNutrientKey>>={protein:"proteinG",carbohydrate:"carbsG",fat:"fatG",fiber:"fiberG",sugar:"sugarG"};
export function parseNutritionLabel(value:unknown):NutritionLabelResult {
  if(!object(value)||typeof value.isNutritionLabel!=="boolean")throw new NutritionLabelError("invalid_label_response");
  if(!value.isNutritionLabel)throw new NutritionLabelError("no_nutrition_label",422);
  if(!(value.productName===null||text(value.productName,120))||!Array.isArray(value.languages)||value.languages.length>8||!value.languages.every(item=>text(item,40))||!object(value.basis)||!(value.basis.amount===null||text(value.basis.amount,40))||!text(value.basis.description,200)||!["g","ml","serving","unknown"].includes(value.basis.unit as string)||!Array.isArray(value.facts)||value.facts.length>20||!Array.isArray(value.warnings)||value.warnings.length>12||!value.warnings.every(item=>text(item,300))||typeof value.confidenceScore!=="number"||!Number.isFinite(value.confidenceScore)||value.confidenceScore<0||value.confidenceScore>1)throw new NutritionLabelError("invalid_label_response");
  const facts:LabelFact[]=value.facts.map(fact=>{
    if(!object(fact)||!keys.includes(fact.key as FactKey)||!text(fact.label,100)||!(fact.value===null||text(fact.value,40))||!units.includes(fact.unit as FactUnit)||!qualifiers.includes(fact.qualifier as string))throw new NutritionLabelError("invalid_label_response");
    return fact as LabelFact;
  });
  const warnings=[...value.warnings] as string[];
  const candidates=new Map<LabelNutrientKey,number[]>();const energyKcal:number[]=[],energyKj:number[]=[],sodium:number[]=[],salt:number[]=[];
  const add=(key:LabelNutrientKey,amount:number)=>{if(!candidates.has(key))candidates.set(key,[]);candidates.get(key)!.push(amount);};
  for(const fact of facts) {
    const amount=fact.qualifier==="exact"?parsePrintedNumber(fact.value):null;
    if(amount===null){if(fact.value!==null)warnings.push(`Periksa angka ${fact.label}: tidak pasti atau formatnya ambigu.`);continue;}
    if(fact.key==="energy") {if(fact.unit==="kcal")energyKcal.push(amount);else if(fact.unit==="kJ")energyKj.push(amount/4.184);continue;}
    const grams=massGrams(amount,fact.unit);
    if(grams===null){warnings.push(`Satuan ${fact.label} belum dapat dikonversi; persentase nilai harian bukan gram.`);continue;}
    if(fact.key==="sodium")sodium.push(grams*1000);
    else if(fact.key==="salt")salt.push(grams*1000/2.5);
    else add(target[fact.key]!,grams);
  }
  for(const amount of [...energyKcal,...energyKj])add("calories",amount);
  for(const amount of [...sodium,...salt])add("sodiumMg",amount);
  if(!energyKcal.length&&energyKj.length)warnings.push("Kalori dikonversi dari kJ dengan faktor 4,184 kJ per kkal.");
  if(!sodium.length&&salt.length)warnings.push("Natrium dihitung dari garam: garam dibagi 2,5, lalu diubah ke mg.");
  const nutrients=Object.fromEntries(labelNutrientKeys.map(key=>[key,null])) as Record<LabelNutrientKey,number|null>;
  const maximum:Record<LabelNutrientKey,number>={calories:20000,proteinG:2000,carbsG:3000,fatG:2000,fiberG:1000,sugarG:2000,sodiumMg:100000};
  for(const [key,numbers] of candidates) {
    const minimum=Math.min(...numbers),max=Math.max(...numbers),tolerance=key==="calories"?Math.max(2,max*.05):key==="sodiumMg"?Math.max(5,max*.05):Math.max(.05,max*.05);
    if(numbers.some(number=>!Number.isFinite(number)||number<0||number>maximum[key])||max-minimum>tolerance){warnings.push(`Nilai ${key} bertentangan atau di luar batas; isi dari label setelah ditinjau.`);continue;}
    // Prefer explicit kcal/sodium when a consistent kJ/salt equivalent is also printed.
    nutrients[key]=Number(numbers[0].toPrecision(12));
  }
  const amount=parsePrintedNumber(value.basis.amount),basisAmount=amount!==null&&amount>0&&amount<=10000?amount:null;
  if(basisAmount===null||value.basis.unit==="unknown")warnings.push("Acuan per 100 g/ml atau per porsi belum jelas. Lengkapi sebelum menghitung porsi.");
  if(labelNutrientKeys.some(key=>nutrients[key]===null))warnings.push("Nilai kosong berarti belum diketahui, bukan nol. Lengkapi dari label sebelum mencatat.");
  return {productName:typeof value.productName==="string"?value.productName.trim()||null:null,languages:value.languages as string[],
    basis:{amount:basisAmount,unit:value.basis.unit as NutritionLabelResult["basis"]["unit"],description:value.basis.description as string},
    nutrients,facts,warnings:[...new Set(warnings)],confidenceScore:value.confidenceScore,requiresConfirmation:true};
}
