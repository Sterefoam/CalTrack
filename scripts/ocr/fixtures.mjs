import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
import sharp from "sharp";

const directory = new URL("../../.caltrack/ocr/fixtures/", import.meta.url);
await mkdir(directory, { recursive: true });
const definitions = [
  ["eng", "Arial", ["Nutrition facts", "Per 100 g", "Energy 240 kcal", "Protein 5.5 g", "Carbohydrate 30 g", "Total fat 9 g", "Fiber 2 g", "Sugars 0 g", "Sodium 120 mg"]],
  ["ind", "Arial", ["Informasi nilai gizi", "Per 100 g", "Energi 240 kkal", "Protein 5,5 g", "Karbohidrat 30 g", "Lemak total 9 g", "Serat 2 g", "Gula 0 g", "Natrium 120 mg"]],
  ["fra", "Arial", ["Informations nutritionnelles", "Pour 100 g", "Énergie 240 kcal", "Protéines 5,5 g", "Glucides 30 g", "Matières grasses 9 g", "Fibres 2 g", "Sucres 0 g", "Sodium 120 mg"]],
  ["spa", "Arial", ["Información nutricional", "Por 100 g", "Energía 240 kcal", "Proteínas 5,5 g", "Hidratos de carbono 30 g", "Grasas 9 g", "Fibra 2 g", "Azúcares 0 g", "Sodio 120 mg"]],
  ["deu", "Arial", ["Nährwertangaben", "Pro 100 g", "Brennwert 240 kcal", "Eiweiß 5,5 g", "Kohlenhydrate 30 g", "Fett 9 g", "Ballaststoffe 2 g", "Zucker 0 g", "Natrium 120 mg"]],
  ["jpn", "Yu Gothic", ["栄養成分表示", "100 g 当たり", "エネルギー 240 kcal", "たんぱく質 5.5 g", "炭水化物 30 g", "脂質 9 g", "食物繊維 2 g", "糖類 0 g", "食塩相当量 0.3 g"]],
  ["ara", "Arial", ["القيمة الغذائية", "لكل ١٠٠ غرام", "الطاقة ٢٤٠ kcal", "البروتين ٥٫٥ غرام", "الكربوهيدرات ٣٠ غرام", "الدهون ٩ غرام", "الألياف ٢ غرام", "السكريات ٠ غرام", "الصوديوم ١٢٠ mg"]],
  ["chi_sim", "Microsoft YaHei", ["营养成分表", "每 100 克", "能量 1004.16 kJ", "蛋白质 5.5 克", "碳水化合物 30 克", "脂肪 9 克", "膳食纤维 2 克", "糖类 0 克", "钠 120 毫克"]],
  ["hin", "Nirmala UI", ["पोषण संबंधी जानकारी", "प्रति 100 ग्राम", "ऊर्जा 240 kcal", "प्रोटीन 5.5 ग्राम", "कार्बोहाइड्रेट 30 ग्राम", "वसा 9 ग्राम", "फाइबर 2 ग्राम", "शर्करा 0 ग्राम", "सोडियम 120 mg"]],
];
const escape = value => value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const browser = await chromium.launch({ channel: process.env.OCR_BROWSER_CHANNEL || "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 850 }, deviceScaleFactor: 1 });
const records = [];
try {
  for (const [language, font, lines] of definitions) {
    // Chromium supplies proper HarfBuzz shaping for Arabic and Devanagari.
    await page.setContent(`<html><head><meta charset="utf-8"><style>body{margin:0;background:white;color:black}.label{box-sizing:border-box;margin:22px;border:3px solid black;padding:18px 36px;font:40px/1.4 "${font}",sans-serif;height:806px}.row{height:82px;white-space:nowrap}</style></head><body><div class="label" dir="${language === "ara" ? "rtl" : "ltr"}">${lines.map(line => `<div class="row">${escape(line)}</div>`).join("")}</div></body></html>`);
    await page.evaluate(() => document.fonts.ready);
    const buffer = await page.screenshot({ type: "png" });
    for (const variant of ["clear", "degraded", "skewed"]) {
      let image = sharp(buffer);
      if (variant === "degraded") image = sharp(await image.resize(660, 510).blur(.65).toBuffer()).resize(1100, 850);
      if (variant === "skewed") image = image.rotate(4, { background: "#fff" });
      await image.jpeg({ quality: variant === "degraded" ? 82 : 95 }).toFile(fileURLToPath(new URL(`${language}-${variant}.jpg`, directory)));
      records.push({ id: `${language}-${variant}`, language, variant, file: `.caltrack/ocr/fixtures/${language}-${variant}.jpg`, kind: "controlled-synthetic-label",
        expected: { basisAmount: 100, basisUnit: "g", nutrients: { calories: 240, proteinG: 5.5, carbsG: 30, fatG: 9, fiberG: 2, sugarG: 0, sodiumMg: 120 } }, text: lines });
    }
  }
} finally { await browser.close(); }
await writeFile(new URL("manifest.json", directory), JSON.stringify({ source: "CalTrack generated translated nutrition labels, rendered with Chromium and system fonts", notRealPackaging: true, records }, null, 2));
console.log(JSON.stringify({ generated: records.length, languages: definitions.length, synthetic: true }));
