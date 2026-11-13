import test from "node:test";
import assert from "node:assert/strict";
import { parseLabelText, parseLabelReadings } from "../lib/nutrition/label-text";
import { isLabelLanguage } from "../lib/nutrition/label-languages";

test("single-column OCR text preserves missing values, ignores daily percentages and converts energy and salt", () => {
  const result = parseLabelText("Nutrition facts\nPer 100 g\nEnergy 836.8 kJ\nProtein 5.5 g 12%\nSaturated fat 2 g\nTotal fat 8 g\nSalt 1.25 g\nSugars 0 g", "eng", 85);
  assert.equal(result.basis.amount, 100); assert.equal(result.basis.unit, "g");
  assert.equal(result.nutrients.calories, 200); assert.equal(result.nutrients.sodiumMg, 500);
  assert.equal(result.nutrients.proteinG, 5.5); assert.equal(result.nutrients.fatG, 8);
  assert.equal(result.nutrients.sugarG, 0); assert.equal(result.nutrients.fiberG, null);
});

test("two OCR renderings fill missing values only on the same basis and clear conflicting values", () => {
  const read = (basis: string, protein: string, sugar = "0 g") => ({ text: `Nutrition facts\nPer ${basis} g\nProtein ${protein}\nSugars ${sugar}\nTotal fat 9 g`, confidence: 80 });
  const filled = parseLabelReadings([read("100", "5.5 g", "unreadable"), read("100", "unreadable")], "eng");
  assert.equal(filled.nutrients.proteinG, 5.5); assert.equal(filled.nutrients.sugarG, 0);
  const conflict = parseLabelReadings([read("100", "5.5 g"), read("100", "55 g")], "eng");
  assert.equal(conflict.nutrients.proteinG, null); assert.equal(conflict.nutrients.fatG, 9);
  const differentBasis = parseLabelReadings([read("100", "5.5 g"), read("10", "0.55 g")], "eng");
  assert.equal(differentBasis.basis.amount, null); assert.equal(differentBasis.nutrients.proteinG, null);
  const unknownBasis = parseLabelReadings([read("?", "99 g"), read("100", "5.5 g")], "eng");
  assert.equal(unknownBasis.nutrients.proteinG, 5.5);
  assert.equal(unknownBasis.basis.amount, 100);
  const wrapped = parseLabelText("Nutrition facts\nPer: 100 ml\nEnergy 180 kJ\n42 kcal\nFat 0 g\nProtein 0 g", "eng");
  assert.equal(wrapped.nutrients.calories, 42);
  const hiddenColumn = parseLabelText("Nutrition facts\nPer: 100 ml 330 ml\nProtein 5 g\nTotal fat 9 g", "eng");
  assert.equal(hiddenColumn.nutrients.proteinG, null);
  assert.equal(hiddenColumn.basis.amount, null);
});
test("multi-column OCR and percentages cannot be silently treated as one exact nutrient amount", () => {
  const result = parseLabelText("Nutrition facts\nPer 100 g\nProtein 5 g 2 g\nTotal fat 20%\nSugars <0.5 g", "eng");
  assert.equal(result.nutrients.proteinG, null); assert.equal(result.nutrients.fatG, null); assert.equal(result.nutrients.sugarG, null);
  const multiple = parseLabelText("Nutrition facts\nPer 100 g\nPer 50 g\nProtein 5 g\nTotal fat 8 g", "eng");
  assert.equal(multiple.basis.amount, null); assert.equal(multiple.nutrients.proteinG, null);
});
test("known scripts parse exact printed rows and arbitrary prose or unsupported language paths are rejected", () => {
  const japanese = parseLabelText("栄養成分表示\n100 g 当たり\nエネルギー 200 kcal\nたんぱく質 5.5 g\n食塩相当量 0.3 g", "jpn");
  assert.equal(japanese.nutrients.sodiumMg, 120); assert.equal(japanese.basis.amount, 100);
  const chinese = parseLabelText("营养成分表\n每 100 克\n能量 836.8 kJ\n蛋白质 5.5 克\n钠 120 毫克", "chi_sim");
  assert.equal(chinese.nutrients.calories, 200); assert.equal(chinese.nutrients.sodiumMg, 120);
  assert.throws(() => parseLabelText("Ingredients protein 5 g fat 3 g", "eng"), /no_nutrition_label/);
  assert.equal(isLabelLanguage("../../secret"), false); assert.equal(isLabelLanguage("__proto__"), false);
});

test("Spanish portions and uncertain fiber, and OCR spaces within CJK names stay conservative", () => {
  const spanish = parseLabelText("Información Nutrimental\nPor porción 18 g\nContenido energético 100 kcal\nProteínas 1 g\nCarbohidratos 10 g\nFibra dietética Menos de 1 g", "spa");
  assert.equal(spanish.basis.amount, 18); assert.equal(spanish.nutrients.calories, 100);
  assert.equal(spanish.nutrients.carbsG, 10); assert.equal(spanish.nutrients.fiberG, null);
  const japanese = parseLabelText("栄養 成分 表示\n100 g 当たり\nエネ ルギー 200 kcal\nた ん ぱ く 質 5.5 g\n食塩 相当 量 0.3 g", "jpn");
  assert.equal(japanese.nutrients.proteinG, 5.5); assert.equal(japanese.nutrients.sodiumMg, 120);
  const corrupted = parseLabelText("Nutrition facts\nPer 100 g\nProtein 5.59\nSodium 120 wrongunit\nTotal fat 9 g", "eng");
  assert.equal(corrupted.nutrients.proteinG, null); assert.equal(corrupted.nutrients.sodiumMg, null);
});
