export const labelLanguages = {
  eng: "English", ind: "Indonesia", fra: "Français", spa: "Español", deu: "Deutsch",
  jpn: "日本語", ara: "العربية", chi_sim: "简体中文", hin: "हिन्दी",
} as const;
export type LabelLanguage = keyof typeof labelLanguages;
export function isLabelLanguage(value: unknown): value is LabelLanguage {
  return typeof value === "string" && Object.hasOwn(labelLanguages, value);
}
