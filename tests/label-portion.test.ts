import test from "node:test";
import assert from "node:assert/strict";
import { labelPortionToFood, type LabelPortionInput } from "../lib/nutrition/label-portion";

const input = (): LabelPortionInput => ({ productName: "Susu", basisAmount: "100", basisUnit: "g", consumedAmount: "250", actualGrams: "", confirmed: true,
  nutrients: { calories: "60", proteinG: "3", carbsG: "5", fatG: "3", fiberG: "0", sugarG: "5", sodiumMg: "40" } });
test("label portion scales the selected gram column and preserves an explicit zero", () => {
  const item = labelPortionToFood(input());
  assert.equal(item.calories, 150); assert.equal(item.proteinG, 7.5); assert.equal(item.weightGrams, 250); assert.equal(item.fiberG, 0);
});
test("milliliters and servings need independent actual consumed weight", () => {
  const value = { ...input(), basisUnit: "ml" as const };
  assert.throws(() => labelPortionToFood(value), /gram/);
  const item = labelPortionToFood({ ...value, actualGrams: "258" });
  assert.equal(item.weightGrams, 258); assert.equal(item.calories, 150);
  const serving = labelPortionToFood({ ...input(), basisAmount: "1", basisUnit: "serving", consumedAmount: "0.5", actualGrams: "80" });
  assert.equal(serving.calories, 30); assert.equal(serving.weightGrams, 80);
});
test("unknown nutrients, ambiguous basis, unchecked confirmation and overflow cannot be logged", () => {
  const value = input();
  for (const blank of ["", " "]) assert.throws(() => labelPortionToFood({ ...value, nutrients: { ...value.nutrients, fiberG: blank } }), /kosong/);
  assert.throws(() => labelPortionToFood({ ...value, basisUnit: "unknown" }), /acuan/);
  assert.throws(() => labelPortionToFood({ ...value, confirmed: false }), /konfirmasi/);
  assert.throws(() => labelPortionToFood({ ...value, basisAmount: "0" }), /acuan/);
  assert.throws(() => labelPortionToFood({ ...value, basisAmount: "0.01", consumedAmount: "10000" }), /Kalori/);
  assert.throws(() => labelPortionToFood({ ...value, nutrients: { ...value.nutrients, calories: "Infinity" } }), /Kalori/);
});
