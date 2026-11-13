export type ReminderSettings = {
  mealsEnabled: boolean;
  breakfast: string;
  lunch: string;
  dinner: string;
  waterEnabled: boolean;
  waterIntervalMinutes: number;
};
export const initialReminders: ReminderSettings = { mealsEnabled: false, breakfast: "07:00", lunch: "12:00", dinner: "19:00", waterEnabled: false, waterIntervalMinutes: 120 };
