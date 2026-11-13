export type Recipe = {
  id: string;
  name: string;
  description: string;
  meal: "Sarapan" | "Makan siang" | "Makan malam";
  minutes: number;
  calories: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

// Contoh per satu porsi, bukan hasil analisis atau rekomendasi personal.
export const recipes: Recipe[] = [
  { id: "oat-pisang", name: "Oat pisang & yogurt", description: "Oat hangat dengan pisang, yogurt tawar, dan kacang.", meal: "Sarapan", minutes: 10, calories: 380, proteinG: 18, carbsG: 50, fatG: 12 },
  { id: "telur-roti", name: "Telur sayur & roti gandum", description: "Telur dadar bayam dengan roti gandum dan tomat.", meal: "Sarapan", minutes: 15, calories: 340, proteinG: 22, carbsG: 27, fatG: 16 },
  { id: "ayam-nasi", name: "Nasi ayam panggang", description: "Ayam berbumbu, nasi, dan tumis buncis wortel.", meal: "Makan siang", minutes: 30, calories: 520, proteinG: 38, carbsG: 56, fatG: 16 },
  { id: "gado-gado", name: "Gado-gado tahu tempe", description: "Sayuran rebus, tahu, tempe, dan saus kacang terukur.", meal: "Makan siang", minutes: 25, calories: 460, proteinG: 24, carbsG: 46, fatG: 20 },
  { id: "ikan-kuah", name: "Ikan kuah kunyit", description: "Ikan berkuah ringan dengan nasi dan sayuran hijau.", meal: "Makan malam", minutes: 30, calories: 440, proteinG: 32, carbsG: 51, fatG: 12 },
  { id: "sup-tahu", name: "Sup tahu jamur", description: "Kuah bening berisi tahu, jamur, dan sayuran; disajikan dengan nasi.", meal: "Makan malam", minutes: 20, calories: 360, proteinG: 20, carbsG: 43, fatG: 12 },
];
