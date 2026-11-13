import { parseNutritionLabel, NutritionLabelError, labelNutrientKeys, type LabelFact, type NutritionLabelResult } from "./label";
import { isLabelLanguage, labelLanguages, type LabelLanguage } from "./label-languages";

// Conservative single-column parser: unknown or multi-column amounts are left for review.
const rows: { key: LabelFact["key"]; pattern: RegExp }[] = [
  { key: "energy", pattern: /calories|energy|energi|énergie|energie|energía|energético|brennwert|エネルギー|熱量|热量|能量|الطاقة|طاقة|ऊर्जा/i },
  { key: "sugar", pattern: /sugars?|gula|sucres?|azúcares|zucker|糖類|糖类|糖质|糖質|糖分|السكريات|سكريات|शर्करा|चीनी/i },
  { key: "fiber", pattern: /fib(?:er|re|ra)|serat|ballaststoffe|食物繊維|膳食纤维|الألياف|ألياف|रेशा|फाइबर/i },
  { key: "protein", pattern: /protein|protéines?|proteínas?|eiwei[ßs]|たんぱく質|タンパク質|蛋白质|البروتين|بروتين|प्रोटीन/i },
  { key: "carbohydrate", pattern: /carbohydrate|karbohidrat|glucides?|hidratos|kohlenhydrate|炭水化物|碳水化合物|الكربوهيدرات|كربوهيدرات|कार्बोहाइड्रेट/i },
  { key: "fat", pattern: /total fat|\bfat\b|lemak total|\blemak\b|matières grasses|lipides?|grasas|\bfett\b|脂質|脂肪|الدهون|دهون|वसा/i },
  { key: "sodium", pattern: /sodium|natrium|sodio|ナトリウム|钠|الصوديوم|صوديوم|सोडियम/i },
  { key: "salt", pattern: /\bsalt\b|garam|\bsel\b|\bsal\b|\bsalz\b|食塩相当量|食盐|الملح|\bملح\b|नमक/i },
];
const numeral = "[0-9٠-٩۰-۹०-९০-৯๐-๙]";
const numeric = `${numeral}+(?:[.,٫٬]${numeral}+)*`;
const amountUnit = new RegExp(`([<≤≈]?\\s*${numeric})\\s*(kcal|kkal|kJ|mg|mcg|µg|μg|غرام|غ|ملغ|克|毫克|ग्राम|मि\\.?ग्रा\\.?|ग्रा\\.?|g|%)`, "gi");
const unit = (raw: string): LabelFact["unit"] => /^(kcal|kkal)$/i.test(raw) ? "kcal" : /^kj$/i.test(raw) ? "kJ" : /^(mg|ملغ|毫克|मि\.?ग्रा\.?)$/i.test(raw) ? "mg" : /^(mcg|µg|μg)$/i.test(raw) ? "mcg" : raw === "%" ? "%" : "g";
const basePattern = new RegExp(`(?:per(?:\\s*[/：:]\\s*(?:par)?)?|pour|por(?:\\s+porci[óo]n)?|pro|لكل)\\s*(${numeric})\\s*(ml|g|غرام|غ|مل)|(${numeric})\\s*(ml|g|克)\\s*(?:当たり|あたり|당)|每\\s*(${numeric})\\s*(ml|g|克)|प्रति\\s*(${numeric})\\s*(ग्राम|मिलीलीटर)`, "gi");

export function parseLabelText(raw: string, language: LabelLanguage, confidence = 0) {
  if (!isLabelLanguage(language) || typeof raw !== "string" || raw.length > 24000) throw new NutritionLabelError("invalid_label_response");
  const text = raw.normalize("NFKC").replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "")
    // OCR inserts word spaces inside Japanese/Chinese nutrient names. Do not join digits.
    .replace(/(?<=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])[^\S\r\n]+(?=[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}])/gu, "");
  const bases = [...text.matchAll(basePattern)];
  const preamble = text.split(/\r?\n/).slice(0, text.split(/\r?\n/).findIndex(line => rows.some(row => row.pattern.test(line))));
  const headerAmounts = [...preamble.join(" ").matchAll(amountUnit)].filter(match => ["g", "mg"].includes(unit(match[2])));
  const mlHeaders = [...preamble.join(" ").matchAll(new RegExp(`${numeric}\\s*ml`, "gi"))];
  const multiColumn = bases.length > 1 || headerAmounts.length + mlHeaders.length > 1;
  const warnings: string[] = ["Hasil pembaca teks lokal. Periksa kembali semua angka, satuan, dan kolom pada foto."];
  let basis: { amount: string | null; unit: "g" | "ml" | "serving" | "unknown"; description: string } = { amount: null, unit: "unknown", description: "Acuan belum terbaca jelas" };
  if (bases.length === 1 && !multiColumn) {
    const match = bases[0], amount = match[1] ?? match[3] ?? match[5] ?? match[7], printedUnit = match[2] ?? match[4] ?? match[6] ?? match[8];
    basis = { amount, unit: /ml|مل|मिलीलीटर/i.test(printedUnit) ? "ml" : "g", description: match[0].trim() };
  } else if (multiColumn) warnings.push("Lebih dari satu acuan terlihat. Pilih dan isi satu kolom secara manual.");
  const facts: LabelFact[] = [];
  const lines = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  for (let index = 0; index < lines.length; index++) {
    let line = lines[index];
    // Subcomponents must not masquerade as total fat or total carbohydrates.
    if (/saturat|jenuh|gesättigt|飽和|饱和|مشبعة|संतृप्त/i.test(line)) continue;
    const matching = rows.filter(row => row.pattern.test(line));
    if (matching.length !== 1) continue;
    // A wrapped energy row can print kJ above kcal. Only join a value-only next line.
    if (matching[0].key === "energy" && lines[index + 1] && new RegExp(`^\\(?\\s*${numeric}\\s*(kcal|kkal|kJ)\\s*\\)?$`, "i").test(lines[index + 1])) line += ` ${lines[++index]}`;
    const found = [...line.matchAll(amountUnit)].filter(match => match[2] !== "%");
    const fact = matching[0];
    if (found.length === 0 && fact.key === "energy") {
      const label = line.replace(fact.pattern, ""); const number = label.trim().match(new RegExp(`^(${numeric})$`));
      if (number && /calories/i.test(line)) found.push(Object.assign([number[0], number[1], "kcal"], { index: 0, input: line }) as RegExpExecArray);
    }
    const dualEnergy = fact.key === "energy" && found.length === 2 && new Set(found.map(match => unit(match[2]))).size === 2 && found.every(match => ["kcal", "kJ"].includes(unit(match[2])));
    const safe = found.length === 1 || dualEnergy;
    if (!safe || multiColumn) {
      facts.push({ key: fact.key, label: line.slice(0, 100), value: null, unit: "unknown", qualifier: "unreadable" });
      warnings.push(`Baris ${fact.key} belum terbaca sebagai satu jumlah yang pasti.`); continue;
    }
    for (const match of found) facts.push({ key: fact.key, label: line.slice(0, 100), value: match[1].replace(/[<≤≈]/g, "").trim(), unit: unit(match[2]), qualifier: /[<≤]|less than|menos de|moins de|weniger als|أقل من|से कम|未満|小于/i.test(line) ? "less_than" : /≈/.test(match[1]) ? "approximate" : "exact" });
  }
  // Multiple nutrient lines plus a clear nutrition heading prevent arbitrary prose matches.
  const heading = /nutrition|nutrimental|nutrisi|nilai gizi|valeurs? nutrit|informaci[óo]n nutricional|nährwert|栄養成分|营养成分|حقائق غذائية|القيمة الغذائية|معلومات غذائية|पोषण/i.test(text);
  if (!heading || facts.length < 2) throw new NutritionLabelError("no_nutrition_label", 422);
  const parsed = parseNutritionLabel({ isNutritionLabel: true, productName: null, languages: [labelLanguages[language]], basis, facts: facts.slice(0, 20), warnings: warnings.slice(0, 12), confidenceScore: Math.max(0, Math.min(1, confidence / 100)) });
  // A table without a readable reference must not silently populate nutrient totals.
  if (parsed.basis.amount === null || parsed.basis.unit === "unknown") parsed.nutrients = Object.fromEntries(labelNutrientKeys.map(key => [key, null])) as NutritionLabelResult["nutrients"];
  return parsed;
}

export function parseLabelReadings(readings: { text: string; confidence: number }[], language: LabelLanguage): NutritionLabelResult {
  const results: NutritionLabelResult[] = [];
  let failure: unknown;
  for (const reading of readings) {
    try { results.push(parseLabelText(reading.text, language, reading.confidence)); }
    catch (error) { if (!(error instanceof NutritionLabelError)) throw error; failure ??= error; }
  }
  if (!results.length) throw failure ?? new NutritionLabelError("no_nutrition_label", 422);
  const first = results[0];
  if (results.length < 2) return first;
  const second = results[1];
  const warnings = [...new Set([...first.warnings, ...second.warnings])];
  const sameBasis = first.basis.amount !== null && first.basis.amount === second.basis.amount && first.basis.unit === second.basis.unit;
  // A different/unknown basis prevents copying values between image renderings.
  if (!sameBasis) {
    if (first.basis.amount !== null && second.basis.amount !== null) return { ...first,
      basis: { amount: null, unit: "unknown", description: "Acuan berbeda antar pembacaan; cocokkan dengan foto" },
      nutrients: Object.fromEntries(labelNutrientKeys.map(key => [key, null])) as NutritionLabelResult["nutrients"],
      warnings: [...warnings, "Pembacaan acuan bertentangan. Isi satu kolom secara manual."] };
    // Choose the known-basis reading by itself; never copy facts out of the unknown one.
    return first.basis.amount === null && second.basis.amount !== null ? second : first;
  }
  const nutrients = { ...first.nutrients };
  for (const key of labelNutrientKeys) {
    const a = first.nutrients[key], b = second.nutrients[key];
    if (a !== null && b !== null && Math.abs(a - b) > 1e-6) {
      nutrients[key] = null; warnings.push(`Dua pembacaan ${key} berbeda. Cocokkan angka dengan foto.`);
    } else nutrients[key] = a ?? b;
  }
  return { ...first, nutrients, warnings, facts: [...first.facts, ...second.facts].slice(0, 20), confidenceScore: Math.min(first.confidenceScore, second.confidenceScore) };
}
